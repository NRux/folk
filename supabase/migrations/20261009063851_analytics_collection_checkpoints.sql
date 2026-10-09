BEGIN;

CREATE TABLE public.folkly_analytics_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_key uuid NOT NULL,
  property_id text NOT NULL CHECK (property_id ~ '^[0-9]+$'),
  window_start date NOT NULL,
  window_end date NOT NULL,
  report_version text NOT NULL CHECK (report_version = 'page-daily-v1'),
  state text NOT NULL CHECK (state IN ('claimed','retryable_failure','held','completed')),
  lease_token uuid,
  lease_expires_at timestamptz,
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count BETWEEN 1 AND 5),
  next_offset integer NOT NULL DEFAULT 0 CHECK (next_offset BETWEEN 0 AND 10000),
  expected_rows integer CHECK (expected_rows BETWEEN 0 AND 10000),
  checkpoint jsonb,
  checkpoint_hash text CHECK (checkpoint_hash IS NULL OR checkpoint_hash ~ '^[0-9a-f]{64}$'),
  failure_code text CHECK (failure_code IS NULL OR failure_code IN ('auth_unavailable','request_unavailable','rate_limited','quota_exhausted','incompatible','property_mismatch','invalid_report','persistence_unavailable')),
  retry_after timestamptz,
  snapshot_hash text CHECK (snapshot_hash IS NULL OR snapshot_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (property_id, window_start, window_end, report_version),
  CHECK (window_end >= window_start)
);

ALTER TABLE public.folkly_analytics_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_analytics_runs FROM PUBLIC, anon, authenticated, folkly_analytics, folkly_publisher;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folkly_analytics_runs TO service_role;

CREATE FUNCTION public.folkly_claim_analytics_run(job_key uuid, analytics_property text, first_day date, last_day date, query_version text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  config public.folkly_analytics_config;
  run public.folkly_analytics_runs;
  fence uuid;
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_analytics' THEN RAISE EXCEPTION 'Analytics authority required'; END IF;
  IF job_key IS NULL OR analytics_property IS NULL OR analytics_property !~ '^[0-9]{1,20}$' OR first_day IS NULL OR last_day IS NULL OR query_version IS DISTINCT FROM 'page-daily-v1' OR last_day < first_day OR last_day-first_day > 60 OR last_day > current_date THEN RAISE EXCEPTION 'Invalid analytics claim'; END IF;
  SELECT * INTO config FROM public.folkly_analytics_config WHERE id FOR UPDATE;
  IF NOT FOUND OR NOT config.enabled OR config.property_id IS DISTINCT FROM analytics_property THEN RETURN jsonb_build_object('state','paused'); END IF;
  IF EXISTS (SELECT 1 FROM public.folkly_analytics_runs WHERE request_key=job_key AND (property_id,window_start,window_end,report_version) IS DISTINCT FROM (analytics_property,first_day,last_day,query_version)) THEN RAISE EXCEPTION 'Analytics request key already used'; END IF;

  SELECT * INTO run FROM public.folkly_analytics_runs WHERE property_id=analytics_property AND window_start=first_day AND window_end=last_day AND report_version=query_version FOR UPDATE;
  IF NOT FOUND THEN
    fence:=gen_random_uuid();
    INSERT INTO public.folkly_analytics_runs(request_key,property_id,window_start,window_end,report_version,state,lease_token,lease_expires_at)
    VALUES(job_key,analytics_property,first_day,last_day,query_version,'claimed',fence,now()+interval '5 minutes') RETURNING * INTO run;
    RETURN jsonb_build_object('state','claimed','leaseToken',fence,'checkpoint',NULL,'attempt',1);
  END IF;
  IF run.state='completed' THEN RETURN jsonb_build_object('state','completed','snapshotHash',run.snapshot_hash); END IF;
  IF run.state='held' OR run.attempt_count>=5 THEN RETURN jsonb_build_object('state','held','failureCode',run.failure_code); END IF;
  IF run.state='claimed' AND run.lease_expires_at>now() THEN
    IF run.request_key=job_key THEN RETURN jsonb_build_object('state','claimed','leaseToken',run.lease_token,'checkpoint',run.checkpoint,'attempt',run.attempt_count); END IF;
    RETURN jsonb_build_object('state','busy');
  END IF;
  IF run.retry_after>now() THEN RETURN jsonb_build_object('state','backoff','retryAfter',run.retry_after); END IF;
  fence:=gen_random_uuid();
  UPDATE public.folkly_analytics_runs SET request_key=job_key,state='claimed',lease_token=fence,lease_expires_at=now()+interval '5 minutes',attempt_count=attempt_count+1,failure_code=NULL,retry_after=NULL,updated_at=now() WHERE id=run.id RETURNING * INTO run;
  RETURN jsonb_build_object('state','claimed','leaseToken',fence,'checkpoint',run.checkpoint,'attempt',run.attempt_count);
END $$;

CREATE FUNCTION public.folkly_checkpoint_analytics_run(job_key uuid, lease_token uuid, checkpoint_digest text, checkpoint_value jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run public.folkly_analytics_runs; next_value integer; expected_value integer;
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_analytics' THEN RAISE EXCEPTION 'Analytics authority required'; END IF;
  IF job_key IS NULL OR lease_token IS NULL OR checkpoint_digest !~ '^[0-9a-f]{64}$' OR jsonb_typeof(checkpoint_value) IS DISTINCT FROM 'object' OR octet_length(checkpoint_value::text)>1000000 OR (checkpoint_value->>'format') IS DISTINCT FROM 'folkly-ga4-checkpoint-v1' THEN RAISE EXCEPTION 'Invalid analytics checkpoint'; END IF;
  IF (checkpoint_value->>'nextOffset') !~ '^(0|[1-9][0-9]{0,4})$' OR (checkpoint_value->>'expectedRows') !~ '^(0|[1-9][0-9]{0,4})$' OR jsonb_typeof(checkpoint_value->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(checkpoint_value->'quality') IS DISTINCT FROM 'array' OR jsonb_typeof(checkpoint_value->'quotas') IS DISTINCT FROM 'array' OR jsonb_typeof(checkpoint_value->'responseHashes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid analytics checkpoint'; END IF;
  next_value:=(checkpoint_value->>'nextOffset')::integer; expected_value:=(checkpoint_value->>'expectedRows')::integer;
  IF next_value>expected_value OR next_value<>jsonb_array_length(checkpoint_value->'rows') OR jsonb_array_length(checkpoint_value->'quality')>5 OR jsonb_array_length(checkpoint_value->'quotas')<>jsonb_array_length(checkpoint_value->'quality') OR jsonb_array_length(checkpoint_value->'responseHashes')<>jsonb_array_length(checkpoint_value->'quality') THEN RAISE EXCEPTION 'Invalid analytics checkpoint'; END IF;
  SELECT * INTO run FROM public.folkly_analytics_runs WHERE request_key=job_key FOR UPDATE;
  IF NOT FOUND OR run.state<>'claimed' OR run.lease_token<>lease_token OR run.lease_expires_at<=now() THEN RAISE EXCEPTION 'Analytics lease unavailable'; END IF;
  IF (checkpoint_value->>'propertyId') IS DISTINCT FROM run.property_id OR (checkpoint_value->>'startDate') IS DISTINCT FROM run.window_start::text OR (checkpoint_value->>'endDate') IS DISTINCT FROM run.window_end::text OR (checkpoint_value->>'version') IS DISTINCT FROM run.report_version THEN RAISE EXCEPTION 'Analytics checkpoint identity mismatch'; END IF;
  IF next_value<run.next_offset OR (run.expected_rows IS NOT NULL AND expected_value<>run.expected_rows) THEN RAISE EXCEPTION 'Analytics checkpoint regression'; END IF;
  UPDATE public.folkly_analytics_runs SET next_offset=next_value,expected_rows=expected_value,checkpoint=checkpoint_value,checkpoint_hash=checkpoint_digest,lease_expires_at=now()+interval '5 minutes',updated_at=now() WHERE id=run.id;
  RETURN true;
END $$;

CREATE FUNCTION public.folkly_finish_analytics_run(job_key uuid, lease_token uuid, checkpoint_digest text, snapshot jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run public.folkly_analytics_runs; config public.folkly_analytics_config; first_day date; last_day date;
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_analytics' THEN RAISE EXCEPTION 'Analytics authority required'; END IF;
  SELECT * INTO run FROM public.folkly_analytics_runs WHERE request_key=job_key FOR UPDATE;
  IF NOT FOUND OR run.state<>'claimed' OR run.lease_token<>lease_token OR run.lease_expires_at<=now() OR run.checkpoint_hash IS DISTINCT FROM checkpoint_digest OR run.expected_rows IS NULL OR run.next_offset<>run.expected_rows THEN RAISE EXCEPTION 'Analytics completion lease unavailable'; END IF;
  SELECT * INTO config FROM public.folkly_analytics_config WHERE id;
  IF NOT FOUND OR NOT config.enabled OR config.property_id IS NULL THEN RETURN false; END IF;
  IF jsonb_typeof(snapshot)<>'object' OR octet_length(snapshot::text)>1000000 OR (snapshot->>'propertyId') IS DISTINCT FROM config.property_id OR (snapshot->>'propertyId') IS DISTINCT FROM run.property_id OR (snapshot->>'version') IS DISTINCT FROM run.report_version OR NOT coalesce(snapshot->>'hash' ~ '^[0-9a-f]{64}$',false) OR jsonb_typeof(snapshot->'report') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid analytics snapshot'; END IF;
  first_day:=(snapshot->>'startDate')::date; last_day:=(snapshot->>'endDate')::date;
  IF first_day IS DISTINCT FROM run.window_start OR last_day IS DISTINCT FROM run.window_end THEN RAISE EXCEPTION 'Invalid analytics window'; END IF;
  INSERT INTO public.folkly_analytics_snapshots(property_id,window_start,window_end,report_version,response_hash,report)
  VALUES(run.property_id,first_day,last_day,run.report_version,snapshot->>'hash',snapshot->'report')
  ON CONFLICT(property_id,window_start,window_end,report_version) DO UPDATE SET response_hash=excluded.response_hash,report=excluded.report,retrieved_at=now();
  UPDATE public.folkly_analytics_runs SET state='completed',snapshot_hash=snapshot->>'hash',completed_at=now(),updated_at=now(),lease_token=NULL,lease_expires_at=NULL,failure_code=NULL,retry_after=NULL WHERE id=run.id;
  RETURN true;
END $$;

CREATE FUNCTION public.folkly_fail_analytics_run(job_key uuid, lease_token uuid, failure text, retry_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE run public.folkly_analytics_runs; final_state text;
BEGIN
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_analytics' THEN RAISE EXCEPTION 'Analytics authority required'; END IF;
  IF failure IS NULL OR failure NOT IN ('auth_unavailable','request_unavailable','rate_limited','quota_exhausted','incompatible','property_mismatch','invalid_report','persistence_unavailable') OR (retry_seconds IS NOT NULL AND retry_seconds NOT BETWEEN 1 AND 86400) THEN RAISE EXCEPTION 'Invalid analytics failure'; END IF;
  SELECT * INTO run FROM public.folkly_analytics_runs WHERE request_key=job_key FOR UPDATE;
  IF NOT FOUND OR run.state<>'claimed' OR run.lease_token<>lease_token THEN RAISE EXCEPTION 'Analytics lease unavailable'; END IF;
  final_state:=CASE WHEN retry_seconds IS NOT NULL AND run.attempt_count<5 THEN 'retryable_failure' ELSE 'held' END;
  UPDATE public.folkly_analytics_runs SET state=final_state,failure_code=failure,retry_after=CASE WHEN final_state='retryable_failure' THEN now()+make_interval(secs=>retry_seconds) END,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=run.id;
  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public.folkly_save_analytics_snapshot(jsonb) FROM folkly_analytics;
REVOKE ALL ON FUNCTION public.folkly_claim_analytics_run(uuid,text,date,date,text),public.folkly_checkpoint_analytics_run(uuid,uuid,text,jsonb),public.folkly_finish_analytics_run(uuid,uuid,text,jsonb),public.folkly_fail_analytics_run(uuid,uuid,text,integer) FROM PUBLIC,anon,authenticated,service_role,folkly_publisher;
GRANT EXECUTE ON FUNCTION public.folkly_claim_analytics_run(uuid,text,date,date,text),public.folkly_checkpoint_analytics_run(uuid,uuid,text,jsonb),public.folkly_finish_analytics_run(uuid,uuid,text,jsonb),public.folkly_fail_analytics_run(uuid,uuid,text,integer) TO folkly_analytics;

COMMIT;
