ALTER FUNCTION public.lifepay_transfer_v2(text, bigint, text, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.lifepay_transfer_v3(text, bigint, text, text, text, text, uuid, integer) SET search_path = public, extensions;
ALTER FUNCTION public.lifepay_pay_invoice(uuid, bigint, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.lifepay_create_random_key() SET search_path = public, extensions;
ALTER FUNCTION public.lifepay_create_card(text, boolean, bigint) SET search_path = public, extensions;
ALTER FUNCTION public.lifepay_purchase(uuid, text, bigint, integer, text, text) SET search_path = public, extensions;
ALTER FUNCTION public.ensure_lifepay_account(uuid) SET search_path = public, extensions;
ALTER FUNCTION public.lifepay_gen_pan() SET search_path = public, extensions;