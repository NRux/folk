BEGIN;
CREATE FUNCTION public.folkly_read_translation_budget()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE budget public.folkly_translation_budget; reserved numeric;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 SELECT * INTO budget FROM public.folkly_translation_budget WHERE id=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'Translation budget unavailable'; END IF;
 SELECT coalesce(sum(reserved_usd),0) INTO reserved FROM public.folkly_translation_jobs;
 RETURN jsonb_build_object('budget',to_jsonb(budget),'reserved',reserved);
END $$;

CREATE FUNCTION public.folkly_save_translation_budget(expected_budget jsonb,maximum numeric,approval_until timestamptz,pilot_enabled boolean,configured_model text,configured_job numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE budget public.folkly_translation_budget; previous jsonb; reserved numeric;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF expected_budget IS NULL OR jsonb_typeof(expected_budget)<>'object' OR octet_length(expected_budget::text)>2048 OR maximum IS NULL OR maximum::text IN ('NaN','Infinity','-Infinity') OR maximum<0 OR maximum>50 OR maximum<>round(maximum,2) OR pilot_enabled IS NULL OR approval_until IS NULL OR NOT isfinite(approval_until) OR approval_until<=now() OR approval_until>now()+interval '30 days' THEN
  RETURN jsonb_build_object('status','invalid');
 END IF;
 SELECT * INTO budget FROM public.folkly_translation_budget WHERE id=true FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Translation budget unavailable'; END IF;
 previous=to_jsonb(budget);
 IF previous IS DISTINCT FROM expected_budget THEN RETURN jsonb_build_object('status','conflict'); END IF;
 IF configured_model IS DISTINCT FROM budget.model OR configured_job IS NULL OR configured_job::text IN ('NaN','Infinity','-Infinity') OR configured_job<=0 OR configured_job>5 OR configured_job<>round(configured_job,6) OR budget.input_per_million<=0 OR budget.output_per_million<=0 OR (200000*budget.input_per_million+24000*budget.output_per_million)/2000000>configured_job THEN
  RETURN jsonb_build_object('status','configuration');
 END IF;
 SELECT coalesce(sum(reserved_usd),0) INTO reserved FROM public.folkly_translation_jobs;
 IF maximum<reserved OR (pilot_enabled AND maximum<configured_job) THEN RETURN jsonb_build_object('status','below_reserved'); END IF;
 UPDATE public.folkly_translation_budget SET total_usd=maximum,job_usd=configured_job,valid_until=approval_until,enabled=pilot_enabled WHERE id=true RETURNING * INTO budget;
 INSERT INTO public.folkly_audit_events(at,actor,action,entity,entity_id,reason)
 VALUES(now()::text,'owner-panel','translation-budget-save','translation-budget','singleton',jsonb_build_object('before',previous,'after',to_jsonb(budget),'reserved',reserved)::text);
 RETURN jsonb_build_object('status','saved','budget',to_jsonb(budget),'reserved',reserved);
END $$;
REVOKE ALL ON FUNCTION public.folkly_read_translation_budget(),public.folkly_save_translation_budget(jsonb,numeric,timestamptz,boolean,text,numeric) FROM PUBLIC,anon,authenticated,folkly_publisher;
GRANT EXECUTE ON FUNCTION public.folkly_read_translation_budget(),public.folkly_save_translation_budget(jsonb,numeric,timestamptz,boolean,text,numeric) TO service_role;
COMMIT;
