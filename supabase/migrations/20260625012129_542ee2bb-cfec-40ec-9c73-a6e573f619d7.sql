-- Restore EXECUTE on SECURITY DEFINER helper functions used by RLS policies.
-- Without these grants, Postgres RLS denies all access referencing the functions
-- (error: "permission denied for function …"). The functions are SECURITY DEFINER
-- and own restrictive logic, so granting EXECUTE to authenticated/anon is safe.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_sub_role(uuid, subsidiary, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_subsidiary_access(uuid, subsidiary) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_ceo_or_admin(uuid) TO anon, authenticated;