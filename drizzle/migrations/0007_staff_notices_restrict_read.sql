DROP POLICY IF EXISTS "any staff reads notices" ON public.staff_notices;
CREATE POLICY "staff reads notices" ON public.staff_notices FOR SELECT TO authenticated
USING (
  public.is_ceo_or_admin(auth.uid())
  OR public.has_role(auth.uid(), 'staff'::public.app_role)
  OR EXISTS (SELECT 1 FROM public.user_subsidiary_access a WHERE a.user_id = auth.uid())
);