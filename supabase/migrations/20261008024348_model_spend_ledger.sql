BEGIN;
-- Configuration starts closed. An operator must approve bounded rates and caps.
CREATE TABLE public.folkly_model_budget (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 daily_usd numeric(10,6) NOT NULL DEFAULT 0 CHECK (daily_usd BETWEEN 0 AND 50),
 job_usd numeric(10,6) NOT NULL DEFAULT 0 CHECK (job_usd BETWEEN 0 AND 5)
);
INSERT INTO public.folkly_model_budget DEFAULT VALUES;
CREATE TABLE public.folkly_model_rates (
 model text PRIMARY KEY CHECK (length(model) BETWEEN 1 AND 120),
 input_per_million numeric(10,6) NOT NULL CHECK (input_per_million > 0 AND input_per_million <= 1000),
 output_per_million numeric(10,6) NOT NULL CHECK (output_per_million > 0 AND output_per_million <= 1000),
 valid_until timestamptz NOT NULL
);
CREATE TABLE public.folkly_model_reservations (
 job_id uuid PRIMARY KEY,
 reservation_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 budget_date date NOT NULL,
 model text NOT NULL REFERENCES public.folkly_model_rates(model),
 reserved_usd numeric(10,6) NOT NULL CHECK (reserved_usd > 0),
 state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','draft','failed')),
 evidence jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 recorded_at timestamptz
);
CREATE INDEX folkly_model_reservations_date_idx ON public.folkly_model_reservations(budget_date);
ALTER TABLE public.folkly_model_budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folkly_model_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folkly_model_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_model_budget,public.folkly_model_rates,public.folkly_model_reservations FROM PUBLIC,anon,authenticated,folkly_publisher;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.folkly_model_budget,public.folkly_model_rates,public.folkly_model_reservations TO service_role;

CREATE FUNCTION public.folkly_reserve_model_budget(job_key uuid, model_id text, max_dollars numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE budget public.folkly_model_budget; rates public.folkly_model_rates; day date; spent numeric; token uuid;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_publisher' THEN RAISE EXCEPTION 'Publisher authority required'; END IF;
 IF job_key IS NULL OR model_id IS NULL OR max_dollars IS NULL OR max_dollars::text IN ('NaN','Infinity','-Infinity') OR max_dollars <= 0 OR max_dollars > 5 THEN RAISE EXCEPTION 'Invalid budget request'; END IF;
 -- This singleton lock serializes both same-job retries and competing daily jobs.
 SELECT * INTO budget FROM public.folkly_model_budget WHERE id FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.folkly_settings WHERE key='production.autonomous_enabled' AND value='true') THEN RETURN NULL; END IF;
 IF max_dollars > budget.job_usd THEN RETURN NULL; END IF;
 SELECT * INTO rates FROM public.folkly_model_rates WHERE model=model_id AND valid_until > now();
 IF NOT FOUND THEN RETURN NULL; END IF;
 -- One input token per UTF-8 byte is deliberately conservative. Include system
 -- and schema overhead, and retain the entire reservation after any outcome.
 IF (64000 * rates.input_per_million + 6000 * rates.output_per_million)/1000000 > max_dollars THEN RETURN NULL; END IF;
 IF EXISTS (SELECT 1 FROM public.folkly_model_reservations WHERE job_id=job_key) THEN RETURN NULL; END IF;
 day:=(now() AT TIME ZONE 'America/Los_Angeles')::date;
 SELECT coalesce(sum(reserved_usd),0) INTO spent FROM public.folkly_model_reservations WHERE budget_date=day;
 IF spent+max_dollars > budget.daily_usd THEN RETURN NULL; END IF;
 INSERT INTO public.folkly_model_reservations(job_id,budget_date,model,reserved_usd)
 VALUES(job_key,day,model_id,max_dollars) RETURNING reservation_id INTO token;
 RETURN jsonb_build_object('id',token,'jobId',job_key,'maxDollars',max_dollars);
END $$;
CREATE FUNCTION public.folkly_record_model_usage(job_key uuid, reservation_token uuid, outcome text, usage_evidence jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row public.folkly_model_reservations;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_publisher' THEN RAISE EXCEPTION 'Publisher authority required'; END IF;
 IF outcome IS NULL OR outcome NOT IN ('draft','failed') OR usage_evidence IS NULL OR jsonb_typeof(usage_evidence)<>'object' OR octet_length(usage_evidence::text)>4096 THEN RAISE EXCEPTION 'Invalid usage evidence'; END IF;
 SELECT * INTO row FROM public.folkly_model_reservations WHERE job_id=job_key AND reservation_id=reservation_token FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
 IF row.state<>'reserved' THEN
   IF row.state=outcome AND row.evidence=usage_evidence THEN RETURN true; END IF;
   RAISE EXCEPTION 'Usage evidence is immutable';
 END IF;
 UPDATE public.folkly_model_reservations SET state=outcome,evidence=usage_evidence,recorded_at=now() WHERE job_id=job_key;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.folkly_reserve_model_budget(uuid,text,numeric),public.folkly_record_model_usage(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.folkly_reserve_model_budget(uuid,text,numeric),public.folkly_record_model_usage(uuid,uuid,text,jsonb) TO folkly_publisher;
COMMIT;
