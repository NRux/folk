BEGIN;
CREATE TABLE public.folkly_translation_budget (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 enabled boolean NOT NULL DEFAULT false,
 model text NOT NULL DEFAULT '' CHECK(length(model)<=120),
 total_usd numeric(10,6) NOT NULL DEFAULT 0 CHECK(total_usd BETWEEN 0 AND 50),
 job_usd numeric(10,6) NOT NULL DEFAULT 0 CHECK(job_usd BETWEEN 0 AND 5),
 input_per_million numeric(10,6) NOT NULL DEFAULT 0 CHECK(input_per_million BETWEEN 0 AND 1000),
 output_per_million numeric(10,6) NOT NULL DEFAULT 0 CHECK(output_per_million BETWEEN 0 AND 1000),
 valid_until timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.folkly_translation_budget DEFAULT VALUES;
CREATE TABLE public.folkly_translation_jobs (
 job_id uuid PRIMARY KEY,
 reservation_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 slug text NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=100),
 locale text NOT NULL CHECK(locale IN ('zh-Hans','es','hi','ar','fr','ja')),
 source_hash text NOT NULL CHECK(source_hash ~ '^[a-f0-9]{64}$'),
 glossary_hash text NOT NULL CHECK(glossary_hash ~ '^[a-f0-9]{64}$'),
 prompt_version text NOT NULL CHECK(length(prompt_version) BETWEEN 1 AND 120),
 model text NOT NULL,
 reserved_usd numeric(10,6) NOT NULL CHECK(reserved_usd>0),
 input_per_million numeric(10,6) NOT NULL,
 output_per_million numeric(10,6) NOT NULL,
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','generated','failed')),
 evidence jsonb,
 estimated_usd numeric(16,8),
 content_reference jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 recorded_at timestamptz,
 UNIQUE(slug,locale,source_hash,glossary_hash,prompt_version)
);
ALTER TABLE public.folkly_translation_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folkly_translation_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_translation_budget,public.folkly_translation_jobs FROM PUBLIC,anon,authenticated,folkly_publisher;
GRANT SELECT,INSERT,UPDATE ON public.folkly_translation_budget,public.folkly_translation_jobs TO service_role;

CREATE FUNCTION public.folkly_claim_translation(job_key uuid,story_slug text,target_locale text,source_checksum text,glossary_checksum text,prompt text,model_id text,max_dollars numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE budget public.folkly_translation_budget; spent numeric; token uuid;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF job_key IS NULL OR max_dollars IS NULL OR max_dollars::text IN ('NaN','Infinity','-Infinity') OR max_dollars<=0 OR max_dollars>5 THEN RAISE EXCEPTION 'Invalid translation claim'; END IF;
 SELECT * INTO budget FROM public.folkly_translation_budget WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT budget.enabled OR budget.valid_until<=now() OR model_id IS DISTINCT FROM budget.model OR max_dollars>budget.job_usd OR budget.input_per_million<=0 OR budget.output_per_million<=0 THEN RETURN NULL; END IF;
 -- One input token per UTF-8 byte, including system/schema overhead; output capped.
 IF (200000*budget.input_per_million+24000*budget.output_per_million)/1000000>max_dollars THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM public.folkly_translation_jobs WHERE job_id=job_key OR state='reserved' OR (slug=story_slug AND locale=target_locale AND source_hash=source_checksum AND glossary_hash=glossary_checksum AND prompt_version=prompt)) THEN RETURN NULL; END IF;
 SELECT coalesce(sum(reserved_usd),0) INTO spent FROM public.folkly_translation_jobs;
 IF spent+max_dollars>budget.total_usd THEN RETURN NULL; END IF;
 INSERT INTO public.folkly_translation_jobs(job_id,slug,locale,source_hash,glossary_hash,prompt_version,model,reserved_usd,input_per_million,output_per_million)
 VALUES(job_key,story_slug,target_locale,source_checksum,glossary_checksum,prompt,model_id,max_dollars,budget.input_per_million,budget.output_per_million) RETURNING reservation_id INTO token;
 RETURN jsonb_build_object('id',token,'jobId',job_key,'maxDollars',max_dollars);
END $$;

CREATE FUNCTION public.folkly_finish_translation(job_key uuid,reservation_token uuid,outcome text,usage_evidence jsonb,object_reference jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE job public.folkly_translation_jobs; estimate numeric;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Server authority required'; END IF;
 IF outcome IS NULL OR outcome NOT IN ('generated','failed') OR usage_evidence IS NULL OR jsonb_typeof(usage_evidence)<>'object' OR octet_length(usage_evidence::text)>4096 THEN RAISE EXCEPTION 'Invalid translation evidence'; END IF;
 IF outcome='generated' AND (object_reference IS NULL OR jsonb_typeof(object_reference)<>'object' OR (object_reference->>'sha256') IS NULL OR (object_reference->>'sha256') !~ '^[a-f0-9]{64}$' OR (object_reference->>'pathname') IS DISTINCT FROM ('editorial/translations/'||(object_reference->>'sha256')||'.json') OR (object_reference->>'byte_size') IS NULL OR (object_reference->>'byte_size') !~ '^[0-9]+$' OR (object_reference->>'byte_size')::numeric NOT BETWEEN 1 AND 200000 OR (object_reference->>'verified_at') IS NULL OR octet_length(object_reference::text)>1024) THEN RAISE EXCEPTION 'Verified private translation required'; END IF;
 IF outcome='failed' AND object_reference IS NOT NULL THEN RAISE EXCEPTION 'Unexpected failed reference'; END IF;
 IF outcome='generated' THEN
   IF (object_reference->>'verified_at')::timestamptz > now()+interval '5 minutes' OR NOT isfinite((object_reference->>'verified_at')::timestamptz) THEN RAISE EXCEPTION 'Invalid verification time'; END IF;
 END IF;
 SELECT * INTO job FROM public.folkly_translation_jobs WHERE job_id=job_key AND reservation_id=reservation_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Translation reservation not found'; END IF;
 IF job.state<>'reserved' THEN
   IF job.state=outcome AND job.evidence=usage_evidence AND job.content_reference IS NOT DISTINCT FROM object_reference THEN RETURN true; END IF;
   RAISE EXCEPTION 'Translation evidence is immutable';
 END IF;
 IF (usage_evidence->>'inputTokens') ~ '^[0-9]+$' AND (usage_evidence->>'outputTokens') ~ '^[0-9]+$' AND (usage_evidence->>'inputTokens')::numeric<=10000000 AND (usage_evidence->>'outputTokens')::numeric<=10000000 THEN
   estimate=((usage_evidence->>'inputTokens')::numeric*job.input_per_million+(usage_evidence->>'outputTokens')::numeric*job.output_per_million)/1000000;
 END IF;
 UPDATE public.folkly_translation_jobs SET state=outcome,evidence=usage_evidence,estimated_usd=estimate,content_reference=object_reference,recorded_at=now() WHERE job_id=job_key;
 -- Unexpected reported usage holds later jobs; reservations are never refunded.
 IF estimate>job.reserved_usd THEN UPDATE public.folkly_translation_budget SET enabled=false WHERE id; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.folkly_claim_translation(uuid,text,text,text,text,text,text,numeric),public.folkly_finish_translation(uuid,uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated,folkly_publisher;
GRANT EXECUTE ON FUNCTION public.folkly_claim_translation(uuid,text,text,text,text,text,text,numeric),public.folkly_finish_translation(uuid,uuid,text,jsonb,jsonb) TO service_role;
COMMIT;
