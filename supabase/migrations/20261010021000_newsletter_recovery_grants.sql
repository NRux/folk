BEGIN;
CREATE TABLE public.folkly_newsletter_recovery_grants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 token_sha256 TEXT NOT NULL UNIQUE CHECK(token_sha256 ~ '^[a-f0-9]{64}$'),
 contract_sha TEXT NOT NULL CHECK(contract_sha ~ '^[a-f0-9]{64}$'),
 authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','running','verified','revoked')),
 lease_id UUID,
 completed_at TIMESTAMPTZ,
 receipt JSONB,
 CHECK(expires_at>authorized_at AND expires_at<=authorized_at+interval '10 minutes')
);
ALTER TABLE public.folkly_newsletter_recovery_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.folkly_newsletter_recovery_grants FROM PUBLIC,anon,authenticated,service_role;
-- Only an administrator may issue a grant. Runtime cannot mint or remove one.
GRANT SELECT,UPDATE ON public.folkly_newsletter_recovery_grants TO service_role;

CREATE FUNCTION public.folkly_claim_newsletter_recovery(p_token_hash TEXT,p_contract_sha TEXT,p_lease_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE grant_id UUID; paused BOOLEAN;
BEGIN
 IF current_user<>'service_role' OR p_lease_id IS NULL THEN RAISE EXCEPTION 'Recovery authorization required' USING ERRCODE='42501'; END IF;
 LOCK TABLE public.folkly_settings IN SHARE MODE;
 SELECT count(*)=3 AND bool_and(value='false') INTO paused FROM public.folkly_settings
 WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled');
 IF paused IS DISTINCT FROM true THEN RAISE EXCEPTION 'Editorial switches must stay paused'; END IF;
 UPDATE public.folkly_newsletter_recovery_grants SET status='running',lease_id=p_lease_id
 WHERE token_sha256=p_token_hash AND contract_sha=p_contract_sha AND status='issued' AND expires_at>clock_timestamp()
 RETURNING id INTO grant_id;
 IF grant_id IS NULL THEN RAISE EXCEPTION 'Recovery authorization required' USING ERRCODE='42501'; END IF;
 RETURN grant_id;
END $$;

CREATE FUNCTION public.folkly_complete_newsletter_recovery(p_grant_id UUID,p_lease_id UUID,p_receipt JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path='' SET lock_timeout='5s' AS $$
DECLARE grant_row public.folkly_newsletter_recovery_grants%ROWTYPE; paused BOOLEAN;
 checks TEXT[]:=ARRAY['concurrentClaim','corruptSuppressionDenied','fullRestoreHeld','immutableClaim','interruptionHeld','inventoryReadback','lostWriteReply','receiptOnlyRestore','subscriberReadback','suppressionStable','terminalReadback'];
BEGIN
 IF current_user<>'service_role' THEN RAISE EXCEPTION 'Recovery authorization required' USING ERRCODE='42501'; END IF;
 SELECT * INTO grant_row FROM public.folkly_newsletter_recovery_grants WHERE id=p_grant_id FOR UPDATE;
 IF NOT FOUND OR grant_row.status<>'running' OR grant_row.lease_id IS DISTINCT FROM p_lease_id OR grant_row.expires_at<=clock_timestamp() THEN
  RAISE EXCEPTION 'Recovery claim unavailable' USING ERRCODE='42501';
 END IF;
 LOCK TABLE public.folkly_settings IN SHARE MODE;
 SELECT count(*)=3 AND bool_and(value='false') INTO paused FROM public.folkly_settings
 WHERE key IN ('production.autonomous_enabled','publication.autonomous_enabled','schedule.enabled');
 IF paused IS DISTINCT FROM true THEN RAISE EXCEPTION 'Editorial switches must stay paused'; END IF;
 IF jsonb_typeof(p_receipt) IS DISTINCT FROM 'object' OR
  (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_receipt) k) IS DISTINCT FROM
  ARRAY['checks','contractSha','deliveryPaused','emailsSent','format','grantId','inventorySha','objects','projectId','switchesPaused','verifiedAt']::TEXT[] OR
  p_receipt->>'format' IS DISTINCT FROM 'folkly-newsletter-storage-recovery-v1' OR
  p_receipt->>'projectId' IS DISTINCT FROM 'vxmyggasjgsiohqzzwzh' OR
  p_receipt->>'contractSha' IS DISTINCT FROM grant_row.contract_sha OR
  p_receipt->>'grantId' IS DISTINCT FROM p_grant_id::TEXT OR
  p_receipt->'emailsSent' IS DISTINCT FROM '0'::JSONB OR
  p_receipt->'deliveryPaused' IS DISTINCT FROM 'true'::JSONB OR
  p_receipt->'switchesPaused' IS DISTINCT FROM 'true'::JSONB OR
  jsonb_typeof(p_receipt->'checks') IS DISTINCT FROM 'object' OR
  (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(p_receipt->'checks') k) IS DISTINCT FROM checks OR
  EXISTS(SELECT 1 FROM jsonb_each(p_receipt->'checks') WHERE value IS DISTINCT FROM 'true'::JSONB) OR
  jsonb_typeof(p_receipt->'objects') IS DISTINCT FROM 'number' OR (p_receipt->>'objects')::INTEGER NOT BETWEEN 1 AND 30 OR
  jsonb_typeof(p_receipt->'inventorySha') IS DISTINCT FROM 'string' OR (p_receipt->>'inventorySha') !~ '^[a-f0-9]{64}$' OR
  jsonb_typeof(p_receipt->'verifiedAt') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid recovery receipt'; END IF;
 PERFORM (p_receipt->>'verifiedAt')::TIMESTAMPTZ;
 IF p_receipt->>'verifiedAt' IS NULL THEN RAISE EXCEPTION 'Invalid recovery time'; END IF;
 UPDATE public.folkly_newsletter_recovery_grants SET status='verified',completed_at=clock_timestamp(),receipt=p_receipt,lease_id=NULL WHERE id=p_grant_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.folkly_claim_newsletter_recovery(TEXT,TEXT,UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.folkly_complete_newsletter_recovery(UUID,UUID,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.folkly_claim_newsletter_recovery(TEXT,TEXT,UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.folkly_complete_newsletter_recovery(UUID,UUID,JSONB) TO service_role;
COMMIT;
