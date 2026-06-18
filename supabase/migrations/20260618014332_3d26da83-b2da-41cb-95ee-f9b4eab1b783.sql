
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_ceo_or_admin(UUID) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_subsidiary_access(UUID, public.subsidiary) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, public, authenticated;
