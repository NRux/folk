BEGIN;
CREATE TABLE public.folkly_translation_batches (
 batch_id uuid PRIMARY KEY,
 manifest_hash text NOT NULL CHECK(manifest_hash ~ '^[a-f0-9]{64}$'),
 model text NOT NULL,
 state text NOT NULL DEFAULT 'ready' CHECK(state IN ('ready','submitting','submitted','held','completed')),
 input_file_id text CHECK(input_file_id ~ '^file-[A-Za-z0-9_-]+$'),
 provider_batch_id text UNIQUE CHECK(provider_batch_id ~ '^batch_[A-Za-z0-9_-]+$'),
 provider_status text,
 sync_token uuid,
 sync_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.folkly_translation_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_translation_batches FROM PUBLIC,anon,authenticated,folkly_publisher;
GRANT SELECT,INSERT,UPDATE ON public.folkly_translation_batches TO service_role;
ALTER TABLE public.folkly_translation_jobs ADD COLUMN batch_id uuid REFERENCES public.folkly_translation_batches(batch_id),
 ADD COLUMN processing_mode text NOT NULL DEFAULT 'standard' CHECK(processing_mode IN ('standard','batch'));
CREATE INDEX folkly_translation_jobs_batch_idx ON public.folkly_translation_jobs(batch_id);

-- All-or-nothing claims. The existing approval stores STANDARD prices; batch
-- jobs snapshot half those prices, without rewriting approval or old evidence.
CREATE FUNCTION public.folkly_claim_translation_batch(batch_key uuid,manifest_checksum text,model_id text,max_dollars numeric,requests jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE budget public.folkly_translation_budget; item jsonb; spent numeric; n integer;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF batch_key IS NULL OR manifest_checksum IS NULL OR manifest_checksum !~ '^[a-f0-9]{64}$' OR max_dollars IS NULL OR max_dollars::text IN ('NaN','Infinity','-Infinity') OR max_dollars<=0 OR max_dollars>5 OR requests IS NULL OR jsonb_typeof(requests)<>'array' THEN RAISE EXCEPTION 'Invalid batch claim'; END IF;
 n:=jsonb_array_length(requests);
 IF n NOT BETWEEN 1 AND 12 OR octet_length(requests::text)>20000 THEN RAISE EXCEPTION 'Invalid batch size'; END IF;
 SELECT * INTO budget FROM public.folkly_translation_budget WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT budget.enabled OR budget.valid_until<=now() OR model_id IS DISTINCT FROM budget.model OR max_dollars>budget.job_usd OR budget.input_per_million<=0 OR budget.output_per_million<=0 OR (200000*budget.input_per_million+24000*budget.output_per_million)/2000000>max_dollars THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.folkly_translation_batches WHERE batch_id=batch_key) OR EXISTS(SELECT 1 FROM public.folkly_translation_jobs WHERE state='reserved') THEN RETURN false; END IF;
 SELECT coalesce(sum(reserved_usd),0) INTO spent FROM public.folkly_translation_jobs;
 IF spent+n*max_dollars>budget.total_usd THEN RETURN false; END IF;
 INSERT INTO public.folkly_translation_batches(batch_id,manifest_hash,model) VALUES(batch_key,manifest_checksum,model_id);
 FOR item IN SELECT value FROM jsonb_array_elements(requests) LOOP
  -- NOT NULL, source identity uniqueness and locale/checksum constraints on
  -- the job table reject malformed or repeated members, rolling back ALL rows.
  INSERT INTO public.folkly_translation_jobs(job_id,slug,locale,source_hash,glossary_hash,prompt_version,model,reserved_usd,input_per_million,output_per_million,batch_id,processing_mode)
  VALUES((item->>'jobId')::uuid,item->>'slug',item->>'locale',item->>'sourceHash',item->>'glossaryHash',item->>'promptVersion',model_id,max_dollars,budget.input_per_million/2,budget.output_per_million/2,batch_key,'batch');
 END LOOP;
 RETURN true;
END $$;

-- Durable fence BEFORE contacting OpenAI. Never reset this to ready, even
-- after a timeout. Provider metadata can reconcile a lost creation response.
CREATE FUNCTION public.folkly_start_translation_batch(batch_key uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 PERFORM 1 FROM public.folkly_translation_budget b WHERE b.id AND b.enabled AND b.valid_until>now()
 AND b.model=(SELECT model FROM public.folkly_translation_batches WHERE batch_id=batch_key) FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.folkly_translation_batches SET state='submitting',updated_at=now() WHERE batch_id=batch_key AND state='ready';
 RETURN FOUND;
END $$;

CREATE FUNCTION public.folkly_attach_translation_batch(batch_key uuid,file_id text,provider_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE batch public.folkly_translation_batches;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF file_id IS NULL OR file_id !~ '^file-[A-Za-z0-9_-]+$' OR length(file_id)>120 OR (provider_id IS NOT NULL AND (provider_id !~ '^batch_[A-Za-z0-9_-]+$' OR length(provider_id)>120)) THEN RAISE EXCEPTION 'Invalid provider receipt'; END IF;
 SELECT * INTO batch FROM public.folkly_translation_batches WHERE batch_id=batch_key FOR UPDATE;
 IF NOT FOUND OR batch.state NOT IN ('submitting','submitted','held') OR (batch.input_file_id IS NOT NULL AND batch.input_file_id<>file_id) OR (batch.provider_batch_id IS NOT NULL AND batch.provider_batch_id IS DISTINCT FROM provider_id) THEN RETURN false; END IF;
 UPDATE public.folkly_translation_batches SET input_file_id=file_id,provider_batch_id=provider_id,state=CASE WHEN provider_id IS NULL THEN 'submitting' ELSE 'submitted' END,updated_at=now() WHERE batch_id=batch_key;
 RETURN true;
END $$;

CREATE FUNCTION public.folkly_lock_translation_batch(batch_key uuid,lock_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF lock_token IS NULL THEN RETURN false; END IF;
 UPDATE public.folkly_translation_batches SET sync_token=lock_token,sync_until=now()+interval '90 seconds'
 WHERE batch_id=batch_key AND state IN ('submitting','submitted','held') AND (sync_until IS NULL OR sync_until<now());
 RETURN FOUND;
END $$;
CREATE FUNCTION public.folkly_unlock_translation_batch(batch_key uuid,lock_token uuid,status text)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF status IS NULL OR status NOT IN ('held','validating','in_progress','finalizing','completed','failed','expired','cancelling','cancelled') THEN RAISE EXCEPTION 'Invalid batch status'; END IF;
 UPDATE public.folkly_translation_batches SET sync_token=NULL,sync_until=NULL,provider_status=status,updated_at=now(),
 state=CASE WHEN NOT EXISTS(SELECT 1 FROM public.folkly_translation_jobs WHERE batch_id=batch_key AND state='reserved') THEN 'completed' WHEN status='held' THEN 'held' ELSE state END
 WHERE batch_id=batch_key AND sync_token=lock_token;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.folkly_claim_translation_batch(uuid,text,text,numeric,jsonb),public.folkly_start_translation_batch(uuid),public.folkly_attach_translation_batch(uuid,text,text),public.folkly_lock_translation_batch(uuid,uuid),public.folkly_unlock_translation_batch(uuid,uuid,text) FROM PUBLIC,anon,authenticated,folkly_publisher;
GRANT EXECUTE ON FUNCTION public.folkly_claim_translation_batch(uuid,text,text,numeric,jsonb),public.folkly_start_translation_batch(uuid),public.folkly_attach_translation_batch(uuid,text,text),public.folkly_lock_translation_batch(uuid,uuid),public.folkly_unlock_translation_batch(uuid,uuid,text) TO service_role;
COMMIT;
