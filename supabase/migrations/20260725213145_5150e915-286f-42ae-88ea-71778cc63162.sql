REVOKE EXECUTE ON FUNCTION public.lifepay_guard_account_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_lifepay() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_lifepay_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lifepay_transfer(text, bigint, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lifepay_admin_adjust(text, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lifepay_transfer(text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lifepay_admin_adjust(text, bigint, text) TO authenticated;