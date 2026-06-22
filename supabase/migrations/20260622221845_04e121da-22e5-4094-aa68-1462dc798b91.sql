
-- Contact inbox (public can insert, staff can read)
CREATE TABLE public.contact_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.contact_inbox TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_inbox TO authenticated;
GRANT ALL ON public.contact_inbox TO service_role;
ALTER TABLE public.contact_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can submit" ON public.contact_inbox FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "ceo/admin read inbox" ON public.contact_inbox FOR SELECT TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo/admin update inbox" ON public.contact_inbox FOR UPDATE TO authenticated USING (public.is_ceo_or_admin(auth.uid())) WITH CHECK (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo/admin delete inbox" ON public.contact_inbox FOR DELETE TO authenticated USING (public.is_ceo_or_admin(auth.uid()));

-- AirCare units
CREATE TABLE public.aircare_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT,
  filter_model TEXT,
  installed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aircare_units TO authenticated;
GRANT ALL ON public.aircare_units TO service_role;
ALTER TABLE public.aircare_units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aircare staff manage units" ON public.aircare_units FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(), 'aircare'))
  WITH CHECK (public.has_subsidiary_access(auth.uid(), 'aircare'));
CREATE TRIGGER touch_aircare_units BEFORE UPDATE ON public.aircare_units
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- AirCare readings
CREATE TABLE public.aircare_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES public.aircare_units(id) ON DELETE CASCADE,
  pm25 NUMERIC,
  co2_ppm NUMERIC,
  temperature_c NUMERIC,
  humidity_pct NUMERIC,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aircare_readings TO authenticated;
GRANT ALL ON public.aircare_readings TO service_role;
ALTER TABLE public.aircare_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aircare staff manage readings" ON public.aircare_readings FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(), 'aircare'))
  WITH CHECK (public.has_subsidiary_access(auth.uid(), 'aircare'));
CREATE INDEX ON public.aircare_readings(unit_id, measured_at DESC);

-- Per-subsidiary roles (informational + helper, doesn't replace user_subsidiary_access yet)
CREATE TABLE public.user_subsidiary_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subsidiary public.subsidiary NOT NULL,
  sub_role TEXT NOT NULL,
  granted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subsidiary, sub_role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_subsidiary_roles TO authenticated;
GRANT ALL ON public.user_subsidiary_roles TO service_role;
ALTER TABLE public.user_subsidiary_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self read sub roles" ON public.user_subsidiary_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo/admin manage sub roles" ON public.user_subsidiary_roles FOR ALL TO authenticated USING (public.is_ceo_or_admin(auth.uid())) WITH CHECK (public.is_ceo_or_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_sub_role(_user_id uuid, _sub public.subsidiary, _role text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_ceo_or_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.user_subsidiary_roles
    WHERE user_id = _user_id AND subsidiary = _sub AND sub_role = _role
  )
$$;
