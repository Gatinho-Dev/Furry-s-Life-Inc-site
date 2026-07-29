CREATE TABLE public.lifepay_faceid (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  samples jsonb NOT NULL,
  device_label text NOT NULL DEFAULT 'Face ID',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lifepay_faceid TO authenticated;
GRANT ALL ON public.lifepay_faceid TO service_role;

ALTER TABLE public.lifepay_faceid ENABLE ROW LEVEL SECURITY;

CREATE POLICY "faceid_select_own" ON public.lifepay_faceid
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "faceid_insert_own" ON public.lifepay_faceid
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "faceid_update_own" ON public.lifepay_faceid
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "faceid_delete_own" ON public.lifepay_faceid
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.lifepay_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE EXECUTE ON FUNCTION public.lifepay_touch_updated_at() FROM anon, authenticated;

CREATE TRIGGER update_lifepay_faceid_updated_at
  BEFORE UPDATE ON public.lifepay_faceid
  FOR EACH ROW EXECUTE FUNCTION public.lifepay_touch_updated_at();