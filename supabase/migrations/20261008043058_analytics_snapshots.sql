BEGIN;
CREATE ROLE folkly_analytics NOLOGIN;
GRANT folkly_analytics TO authenticator;
GRANT USAGE ON SCHEMA public TO folkly_analytics;
CREATE TABLE public.folkly_analytics_config(id boolean PRIMARY KEY DEFAULT true CHECK(id),enabled boolean NOT NULL DEFAULT false,property_id text CHECK(property_id ~ '^[0-9]+$'));
INSERT INTO public.folkly_analytics_config DEFAULT VALUES;
CREATE TABLE public.folkly_analytics_snapshots(
 property_id text NOT NULL,window_start date NOT NULL,window_end date NOT NULL,
 report_version text NOT NULL CHECK(report_version='page-daily-v1'),
 response_hash text NOT NULL CHECK(response_hash ~ '^[0-9a-f]{64}$'),
 report jsonb NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(property_id,window_start,window_end,report_version),CHECK(window_end>=window_start)
);
ALTER TABLE public.folkly_analytics_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folkly_analytics_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_analytics_config,public.folkly_analytics_snapshots FROM PUBLIC,anon,authenticated,folkly_analytics,folkly_publisher;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.folkly_analytics_config,public.folkly_analytics_snapshots TO service_role;
CREATE FUNCTION public.folkly_save_analytics_snapshot(snapshot jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.folkly_analytics_config; first_day date; last_day date;
BEGIN
 IF (auth.jwt()->>'role') IS DISTINCT FROM 'folkly_analytics' THEN RAISE EXCEPTION 'Analytics authority required'; END IF;
 SELECT * INTO config FROM public.folkly_analytics_config WHERE id;
 IF NOT FOUND OR NOT config.enabled OR config.property_id IS NULL THEN RETURN false; END IF;
 IF jsonb_typeof(snapshot)<>'object' OR octet_length(snapshot::text)>1000000 OR (snapshot->>'propertyId') IS DISTINCT FROM config.property_id OR (snapshot->>'version') IS DISTINCT FROM 'page-daily-v1' OR NOT coalesce(snapshot->>'hash' ~ '^[0-9a-f]{64}$',false) OR jsonb_typeof(snapshot->'report') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid analytics snapshot'; END IF;
 first_day:=(snapshot->>'startDate')::date;last_day:=(snapshot->>'endDate')::date;
 IF first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day-first_day>60 OR last_day>current_date THEN RAISE EXCEPTION 'Invalid analytics window'; END IF;
 INSERT INTO public.folkly_analytics_snapshots(property_id,window_start,window_end,report_version,response_hash,report)
 VALUES(config.property_id,first_day,last_day,'page-daily-v1',snapshot->>'hash',snapshot->'report')
 ON CONFLICT(property_id,window_start,window_end,report_version) DO UPDATE SET response_hash=excluded.response_hash,report=excluded.report,retrieved_at=now();
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.folkly_save_analytics_snapshot(jsonb) FROM PUBLIC,anon,authenticated,service_role,folkly_publisher;
GRANT EXECUTE ON FUNCTION public.folkly_save_analytics_snapshot(jsonb) TO folkly_analytics;
COMMIT;
