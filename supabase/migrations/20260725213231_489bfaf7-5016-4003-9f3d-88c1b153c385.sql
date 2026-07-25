CREATE OR REPLACE FUNCTION public.lifepay_counterparty_names()
RETURNS TABLE(user_id uuid, display_name text, pix_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.user_id, a.display_name, a.pix_key
  FROM public.lifepay_accounts a
  WHERE auth.uid() IS NOT NULL
    AND a.user_id IN (
      SELECT t.from_user FROM public.lifepay_transactions t
      WHERE t.from_user = auth.uid() OR t.to_user = auth.uid()
      UNION
      SELECT t.to_user FROM public.lifepay_transactions t
      WHERE t.from_user = auth.uid() OR t.to_user = auth.uid()
    )
$$;
REVOKE EXECUTE ON FUNCTION public.lifepay_counterparty_names() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifepay_counterparty_names() TO authenticated;