BEGIN;
CREATE ROLE folkly_publisher NOLOGIN;
GRANT folkly_publisher TO authenticator;
GRANT USAGE ON SCHEMA public TO folkly_publisher;
ALTER TABLE public.folkly_publication_slots ADD COLUMN lease_token uuid;
ALTER TABLE public.folkly_publication_slots ADD COLUMN lease_expires_at timestamptz;
ALTER TABLE public.folkly_publication_slots ADD COLUMN request_key uuid;
CREATE FUNCTION public.folkly_claim_slot(publication_date date, job_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE slot public.folkly_publication_slots; fence uuid;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_publisher' THEN RAISE EXCEPTION 'Publisher authority required'; END IF;
 IF publication_date IS NULL OR job_key IS NULL OR publication_date <> (now() AT TIME ZONE 'America/Los_Angeles')::date THEN RAISE EXCEPTION 'Invalid publication date'; END IF;
 IF (SELECT count(*) FROM public.folkly_settings WHERE key IN ('publication.autonomous_enabled','schedule.enabled') AND value='true') <> 2 THEN
   RETURN jsonb_build_object('state','paused');
 END IF;
 INSERT INTO public.folkly_publication_slots(id,slot_date,status) VALUES ('daily:'||publication_date::text,publication_date::text,'open') ON CONFLICT (slot_date) DO NOTHING;
 SELECT * INTO slot FROM public.folkly_publication_slots WHERE slot_date=publication_date::text FOR UPDATE;
 IF slot.status='published' THEN RETURN jsonb_build_object('state','published','readback_hash',slot.readback_hash); END IF;
 IF slot.lease_expires_at>now() THEN
   IF slot.request_key=job_key THEN RETURN jsonb_build_object('state','claimed','lease_token',slot.lease_token,'expires_at',slot.lease_expires_at); END IF;
   RETURN jsonb_build_object('state','busy');
 END IF;
 fence:=gen_random_uuid();
 UPDATE public.folkly_publication_slots SET status='claimed',request_key=job_key,lease_token=fence,lease_expires_at=now()+interval '5 minutes' WHERE slot_date=publication_date::text;
 RETURN jsonb_build_object('state','claimed','lease_token',fence,'expires_at',now()+interval '5 minutes');
END $$;
REVOKE ALL ON FUNCTION public.folkly_claim_slot(date,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.folkly_claim_slot(date,uuid) TO folkly_publisher;
COMMIT;
