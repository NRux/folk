BEGIN;
CREATE TABLE public.folkly_import_grants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 token_sha256 TEXT NOT NULL UNIQUE CHECK (token_sha256 ~ '^[a-f0-9]{64}$'),
 source_sha TEXT NOT NULL CHECK (source_sha ~ '^[a-f0-9]{64}$'),
 contract_sha TEXT NOT NULL CHECK (contract_sha ~ '^[a-f0-9]{64}$'),
 expected_counts JSONB NOT NULL CHECK (jsonb_typeof(expected_counts)='object'),
 authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','running','committed','verified','revoked')),
 lease_id UUID,
 lease_expires_at TIMESTAMPTZ,
 completed_at TIMESTAMPTZ,
 receipt JSONB,
 CHECK (expires_at>authorized_at AND expires_at<=authorized_at+interval '30 minutes')
);
ALTER TABLE public.folkly_import_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_import_grants FROM PUBLIC, anon, authenticated, service_role;
-- Grant issuance is an administrative operation, never a public/server RPC.
GRANT SELECT, UPDATE ON public.folkly_import_grants TO service_role;
-- Explicit imported identity values require advancing these two sequences.
GRANT UPDATE ON SEQUENCE public.folkly_persona_briefs_id_seq,public.folkly_editorial_checks_id_seq TO service_role;

CREATE FUNCTION public.folkly_claim_editorial_import(p_token_hash TEXT,p_source_sha TEXT,p_contract_sha TEXT,p_lease_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE grant_id UUID;
BEGIN
 IF current_user<>'service_role' OR p_lease_id IS NULL THEN RAISE EXCEPTION 'Import authorization required' USING ERRCODE='42501'; END IF;
 UPDATE public.folkly_import_grants SET status='running',lease_id=p_lease_id,
  lease_expires_at=least(expires_at,clock_timestamp()+interval '5 minutes')
 WHERE token_sha256=p_token_hash AND source_sha=p_source_sha AND contract_sha=p_contract_sha
  AND status='issued' AND expires_at>clock_timestamp() RETURNING id INTO grant_id;
 IF grant_id IS NULL THEN RAISE EXCEPTION 'Import authorization required' USING ERRCODE='42501'; END IF;
 RETURN grant_id;
END $$;

CREATE FUNCTION public.folkly_commit_editorial_import(p_grant_id UUID,p_lease_id UUID,p_records JSONB,p_objects JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' SET statement_timeout='60s' AS $$
DECLARE
 grant_row public.folkly_import_grants%ROWTYPE;
 tables TEXT[]:=ARRAY['personas','persona_briefs','pitches','articles','article_versions','assignments','page_blocks','sources','claim_citations','media_assets','editorial_checks'];
 name TEXT; target TEXT; n BIGINT; expected BIGINT; mismatch BOOLEAN; cols TEXT[]; item JSONB; state_ok BOOLEAN;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Import authorization required' USING ERRCODE='42501'; END IF;
 SELECT * INTO grant_row FROM public.folkly_import_grants WHERE id=p_grant_id FOR UPDATE;
 IF NOT FOUND OR grant_row.status<>'running' OR grant_row.lease_id IS DISTINCT FROM p_lease_id OR
  grant_row.expires_at<=clock_timestamp() OR grant_row.lease_expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Import lease unavailable' USING ERRCODE='42501';
 END IF;
 IF jsonb_typeof(p_records) IS DISTINCT FROM 'object' OR jsonb_typeof(p_objects) IS DISTINCT FROM 'array' OR
  (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_records) k) IS DISTINCT FROM
  (SELECT array_agg(k ORDER BY k) FROM unnest(tables) k) OR
  (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(grant_row.expected_counts) k) IS DISTINCT FROM
  (SELECT array_agg(k ORDER BY k) FROM unnest(tables) k) THEN RAISE EXCEPTION 'Invalid import tables'; END IF;
 LOCK TABLE public.folkly_settings,public.folkly_personas,public.folkly_persona_briefs,public.folkly_pitches,
  public.folkly_articles,public.folkly_article_versions,public.folkly_assignments,public.folkly_page_blocks,
  public.folkly_sources,public.folkly_claim_citations,public.folkly_media_assets,public.folkly_editorial_checks IN SHARE ROW EXCLUSIVE MODE;
 -- Keep Blob references append-only: service_role has no UPDATE/DELETE/strong
 -- LOCK permission. The locked parent versions, FK and one-reference-per-version
 -- PK bound the complete index; concurrent INSERT conflicts are compared below.
 SELECT count(*)=3 AND bool_and(value='false') INTO state_ok FROM public.folkly_settings
 WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled');
 IF state_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Editorial switches must remain paused'; END IF;
 FOREACH name IN ARRAY tables LOOP
  target:='folkly_'||name;
  IF jsonb_typeof(p_records->name) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid import rows'; END IF;
  expected:=jsonb_array_length(p_records->name);
  IF expected>10000 OR expected IS DISTINCT FROM (grant_row.expected_counts->>name)::BIGINT THEN RAISE EXCEPTION 'Import count mismatch'; END IF;
  SELECT array_agg(attname::TEXT ORDER BY attname) INTO cols FROM pg_catalog.pg_attribute
  WHERE attrelid=('public.'||target)::regclass AND attnum>0 AND NOT attisdropped;
  FOR item IN SELECT value FROM jsonb_array_elements(p_records->name) LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR
    (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(item) k) IS DISTINCT FROM cols THEN RAISE EXCEPTION 'Invalid import columns'; END IF;
  END LOOP;
  EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I,$1) ON CONFLICT DO NOTHING',target,target) USING p_records->name;
  EXECUTE format('SELECT count(*) FROM public.%I',target) INTO n;
  IF n<>expected THEN RAISE EXCEPTION 'Destination count conflict'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM jsonb_array_elements($1) x WHERE NOT EXISTS(SELECT 1 FROM public.%I t WHERE to_jsonb(t)=x))',target)
   INTO mismatch USING p_records->name;
  IF mismatch THEN RAISE EXCEPTION 'Destination revision conflict'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.folkly_article_versions WHERE content_json<>'') OR
  jsonb_array_length(p_objects)<>jsonb_array_length(p_records->'article_versions') THEN RAISE EXCEPTION 'Incomplete Blob import'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_objects) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR
   (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(item) k) IS DISTINCT FROM
   ARRAY['article_version_id','byte_size','pathname','sha256','verified_at']::TEXT[] OR
   (item->>'sha256') !~ '^[a-f0-9]{64}$' OR (item->>'pathname') IS DISTINCT FROM ('editorial/versions/'||(item->>'sha256')||'.json') OR
   (item->>'byte_size')::INTEGER NOT BETWEEN 1 AND 200000 OR
   NOT EXISTS(SELECT 1 FROM public.folkly_article_versions WHERE id=item->>'article_version_id') THEN RAISE EXCEPTION 'Invalid Blob reference'; END IF;
 END LOOP;
 INSERT INTO public.folkly_content_objects SELECT * FROM jsonb_populate_recordset(NULL::public.folkly_content_objects,p_objects) ON CONFLICT DO NOTHING;
 SELECT count(*) INTO n FROM public.folkly_content_objects;
 IF n<>jsonb_array_length(p_objects) THEN RAISE EXCEPTION 'Blob reference count conflict'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_objects) x WHERE NOT EXISTS(SELECT 1 FROM public.folkly_content_objects t
  WHERE t.article_version_id=x->>'article_version_id' AND t.pathname=x->>'pathname' AND t.sha256=x->>'sha256' AND t.byte_size=(x->>'byte_size')::INTEGER)) THEN
  RAISE EXCEPTION 'Blob reference revision conflict';
 END IF;
 PERFORM setval('public.folkly_persona_briefs_id_seq',greatest((SELECT coalesce(max(id),1) FROM public.folkly_persona_briefs),(SELECT last_value FROM public.folkly_persona_briefs_id_seq)),true);
 PERFORM setval('public.folkly_editorial_checks_id_seq',greatest((SELECT coalesce(max(id),1) FROM public.folkly_editorial_checks),(SELECT last_value FROM public.folkly_editorial_checks_id_seq)),true);
 UPDATE public.folkly_import_grants SET status='committed' WHERE id=p_grant_id;
 RETURN true;
END $$;

CREATE FUNCTION public.folkly_complete_editorial_import(p_grant_id UUID,p_lease_id UUID,p_receipt JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE grant_row public.folkly_import_grants%ROWTYPE; state_ok BOOLEAN;
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Import authorization required' USING ERRCODE='42501'; END IF;
 SELECT * INTO grant_row FROM public.folkly_import_grants WHERE id=p_grant_id FOR UPDATE;
 IF NOT FOUND OR grant_row.status<>'committed' OR grant_row.lease_id IS DISTINCT FROM p_lease_id OR
  grant_row.expires_at<=clock_timestamp() OR grant_row.lease_expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Import lease unavailable' USING ERRCODE='42501'; END IF;
 LOCK TABLE public.folkly_settings IN SHARE MODE;
 SELECT count(*)=3 AND bool_and(value='false') INTO state_ok FROM public.folkly_settings
 WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled');
 IF state_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Editorial switches must remain paused'; END IF;
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR
  (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_receipt) k) IS DISTINCT FROM
  ARRAY['backupVerified','counts','format','mode','privateCount','projectId','publishedCount','sourceSha','sweeps','switchesPaused','verifiedAt','verifiedVersions']::TEXT[] OR
  p_receipt->>'format' IS DISTINCT FROM 'folkly-import-readback-v1' OR p_receipt->>'mode' IS DISTINCT FROM 'blob' OR
  p_receipt->>'projectId' IS DISTINCT FROM 'vxmyggasjgsiohqzzwzh' OR p_receipt->>'sourceSha' IS DISTINCT FROM grant_row.source_sha OR
  p_receipt->'counts' IS DISTINCT FROM grant_row.expected_counts OR p_receipt->'backupVerified' IS DISTINCT FROM 'true'::JSONB OR
  p_receipt->'switchesPaused' IS DISTINCT FROM 'true'::JSONB OR p_receipt->'sweeps' IS DISTINCT FROM '2'::JSONB OR
  (p_receipt->>'verifiedVersions')::BIGINT IS DISTINCT FROM (grant_row.expected_counts->>'article_versions')::BIGINT OR
  (p_receipt->>'publishedCount')::BIGINT<0 OR (p_receipt->>'privateCount')::BIGINT<0 OR
  (p_receipt->>'publishedCount')::BIGINT+(p_receipt->>'privateCount')::BIGINT IS DISTINCT FROM (grant_row.expected_counts->>'articles')::BIGINT THEN RAISE EXCEPTION 'Invalid readback receipt'; END IF;
 PERFORM (p_receipt->>'verifiedAt')::TIMESTAMPTZ;
 UPDATE public.folkly_import_grants SET status='verified',receipt=p_receipt,completed_at=clock_timestamp(),lease_id=NULL,lease_expires_at=NULL WHERE id=p_grant_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.folkly_claim_editorial_import(TEXT,TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.folkly_commit_editorial_import(UUID,UUID,JSONB,JSONB) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.folkly_complete_editorial_import(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.folkly_claim_editorial_import(TEXT,TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.folkly_commit_editorial_import(UUID,UUID,JSONB,JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.folkly_complete_editorial_import(UUID,UUID,JSONB) TO service_role;
COMMIT;
