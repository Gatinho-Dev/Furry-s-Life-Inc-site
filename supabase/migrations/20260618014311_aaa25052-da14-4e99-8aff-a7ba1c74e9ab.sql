
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('ceo','admin','staff');
CREATE TYPE public.subsidiary AS ENUM (
  'fli','studios','cruise','maldivas','college','cond','camping','labs',
  'theater','energy','server','soccer','agency','lifeplus','aircare'
);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SUBSIDIARY ACCESS ============
CREATE TABLE public.user_subsidiary_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subsidiary public.subsidiary NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, subsidiary)
);
GRANT SELECT ON public.user_subsidiary_access TO authenticated;
GRANT ALL ON public.user_subsidiary_access TO service_role;
ALTER TABLE public.user_subsidiary_access ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role)
$$;

CREATE OR REPLACE FUNCTION public.is_ceo_or_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role IN ('ceo','admin'))
$$;

CREATE OR REPLACE FUNCTION public.has_subsidiary_access(_user_id UUID, _sub public.subsidiary)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_ceo_or_admin(_user_id) OR EXISTS(
    SELECT 1 FROM public.user_subsidiary_access WHERE user_id=_user_id AND subsidiary=_sub
  )
$$;

-- ============ POLICIES: profiles ============
CREATE POLICY "anyone authed reads profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "ceo/admin manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.is_ceo_or_admin(auth.uid())) WITH CHECK (public.is_ceo_or_admin(auth.uid()));

-- ============ POLICIES: user_roles ============
CREATE POLICY "user reads own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ceo/admin read roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'ceo')) WITH CHECK (public.has_role(auth.uid(),'ceo'));

-- ============ POLICIES: user_subsidiary_access ============
CREATE POLICY "user reads own access" ON public.user_subsidiary_access FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "ceo/admin read access" ON public.user_subsidiary_access FOR SELECT TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo/admin manage access" ON public.user_subsidiary_access FOR ALL TO authenticated
  USING (public.is_ceo_or_admin(auth.uid())) WITH CHECK (public.is_ceo_or_admin(auth.uid()));

-- ============ TRIGGER: auto-create profile ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ COND: residents ============
CREATE TABLE public.residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  photo_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.residents TO authenticated;
GRANT ALL ON public.residents TO service_role;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cond staff manage residents" ON public.residents FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'cond'));
CREATE TRIGGER residents_touch BEFORE UPDATE ON public.residents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ COND: visitor_logs ============
CREATE TABLE public.visitor_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name TEXT NOT NULL,
  document TEXT,
  unit_visited TEXT NOT NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  reason TEXT,
  entry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_at TIMESTAMPTZ,
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visitor_logs TO authenticated;
GRANT ALL ON public.visitor_logs TO service_role;
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cond staff manage visits" ON public.visitor_logs FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'cond'));

-- ============ COLLEGE: students/teachers/classes ============
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  course TEXT,
  class_group TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "college staff manage students" ON public.students FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'college')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'college'));
CREATE TRIGGER students_touch BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  department TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "college staff manage teachers" ON public.teachers FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'college')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'college'));
CREATE TRIGGER teachers_touch BEFORE UPDATE ON public.teachers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  schedule TEXT,
  room TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "college staff manage classes" ON public.classes FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'college')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'college'));

-- ============ AGENCY: OSINT ============
CREATE TABLE public.osint_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  target TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'username',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_investigations TO authenticated;
GRANT ALL ON public.osint_investigations TO service_role;
ALTER TABLE public.osint_investigations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency staff manage investigations" ON public.osint_investigations FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'agency')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'agency'));
CREATE TRIGGER investigations_touch BEFORE UPDATE ON public.osint_investigations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.osint_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  finding_type TEXT NOT NULL,
  label TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  url TEXT,
  snapshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_findings TO authenticated;
GRANT ALL ON public.osint_findings TO service_role;
ALTER TABLE public.osint_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agency staff manage findings" ON public.osint_findings FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(),'agency')) WITH CHECK (public.has_subsidiary_access(auth.uid(),'agency'));
CREATE INDEX osint_findings_investigation_idx ON public.osint_findings(investigation_id);

-- ============ STAFF NOTICES ============
CREATE TABLE public.staff_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_notices TO authenticated;
GRANT ALL ON public.staff_notices TO service_role;
ALTER TABLE public.staff_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "any staff reads notices" ON public.staff_notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "ceo/admin write notices" ON public.staff_notices FOR INSERT TO authenticated WITH CHECK (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo/admin update notices" ON public.staff_notices FOR UPDATE TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "ceo/admin delete notices" ON public.staff_notices FOR DELETE TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
