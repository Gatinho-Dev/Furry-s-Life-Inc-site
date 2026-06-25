
-- 1. Fix mutable search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 2. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated/PUBLIC.
-- RLS policies still work because policies execute as the table owner regardless of caller grants.
-- service_role keeps access for server-side code; trigger functions are invoked by the trigger system, not by EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_sub_role(uuid, subsidiary, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_subsidiary_access(uuid, subsidiary) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_ceo_or_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_sub_role(uuid, subsidiary, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_subsidiary_access(uuid, subsidiary) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_ceo_or_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- 3. Replace permissive WITH CHECK (true) on contact_inbox INSERT with validated check
DROP POLICY IF EXISTS "anyone can submit" ON public.contact_inbox;
CREATE POLICY "anyone can submit"
  ON public.contact_inbox
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 200
    AND length(trim(email)) BETWEEN 3 AND 320
    AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND length(trim(subject)) BETWEEN 1 AND 300
    AND length(trim(body)) BETWEEN 1 AND 10000
    AND status = 'unread'
    AND replied_at IS NULL
  );
