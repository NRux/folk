BEGIN;
-- Auth session lookup is privileged and explicitly callable only by server code.
CREATE FUNCTION public.folkly_owner_session_active(owner_user uuid, session_uuid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
   SELECT 1 FROM auth.sessions s JOIN public.folkly_owners o ON o.user_id=s.user_id
   WHERE s.id=session_uuid AND s.user_id=owner_user
     AND (s.not_after IS NULL OR s.not_after > now())
 );
$$;
REVOKE ALL ON FUNCTION public.folkly_owner_session_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.folkly_owner_session_active(uuid,uuid) TO service_role;
COMMIT;
