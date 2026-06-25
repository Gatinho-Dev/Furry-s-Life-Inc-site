
-- News posts
CREATE TABLE public.news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  content text NOT NULL DEFAULT '',
  tag text NOT NULL DEFAULT 'Comunicado',
  published boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_posts TO authenticated;
GRANT ALL ON public.news_posts TO service_role;
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published news" ON public.news_posts FOR SELECT USING (published = true);
CREATE POLICY "Admins read all news" ON public.news_posts FOR SELECT TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "Admins insert news" ON public.news_posts FOR INSERT TO authenticated WITH CHECK (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "Admins update news" ON public.news_posts FOR UPDATE TO authenticated USING (public.is_ceo_or_admin(auth.uid())) WITH CHECK (public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "Admins delete news" ON public.news_posts FOR DELETE TO authenticated USING (public.is_ceo_or_admin(auth.uid()));
CREATE TRIGGER tg_news_posts_touch BEFORE UPDATE ON public.news_posts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Cond tables
CREATE TABLE public.cond_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  unit text NOT NULL,
  carrier text,
  tracking_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  picked_up_at timestamptz,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cond_packages TO authenticated;
GRANT ALL ON public.cond_packages TO service_role;
ALTER TABLE public.cond_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cond access packages" ON public.cond_packages FOR ALL TO authenticated USING (public.has_subsidiary_access(auth.uid(), 'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(), 'cond'));
CREATE TRIGGER tg_cond_packages_touch BEFORE UPDATE ON public.cond_packages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cond_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  unit text,
  severity text NOT NULL DEFAULT 'low',
  status text NOT NULL DEFAULT 'open',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cond_incidents TO authenticated;
GRANT ALL ON public.cond_incidents TO service_role;
ALTER TABLE public.cond_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cond access incidents" ON public.cond_incidents FOR ALL TO authenticated USING (public.has_subsidiary_access(auth.uid(), 'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(), 'cond'));
CREATE TRIGGER tg_cond_incidents_touch BEFORE UPDATE ON public.cond_incidents FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cond_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  unit text,
  assignee text,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  scheduled_for timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cond_maintenance TO authenticated;
GRANT ALL ON public.cond_maintenance TO service_role;
ALTER TABLE public.cond_maintenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cond access maintenance" ON public.cond_maintenance FOR ALL TO authenticated USING (public.has_subsidiary_access(auth.uid(), 'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(), 'cond'));
CREATE TRIGGER tg_cond_maintenance_touch BEFORE UPDATE ON public.cond_maintenance FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cond_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  unit text NOT NULL,
  resident_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cond_reservations TO authenticated;
GRANT ALL ON public.cond_reservations TO service_role;
ALTER TABLE public.cond_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cond access reservations" ON public.cond_reservations FOR ALL TO authenticated USING (public.has_subsidiary_access(auth.uid(), 'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(), 'cond'));
CREATE TRIGGER tg_cond_reservations_touch BEFORE UPDATE ON public.cond_reservations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.cond_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cond_notices TO authenticated;
GRANT ALL ON public.cond_notices TO service_role;
ALTER TABLE public.cond_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cond access notices" ON public.cond_notices FOR ALL TO authenticated USING (public.has_subsidiary_access(auth.uid(), 'cond')) WITH CHECK (public.has_subsidiary_access(auth.uid(), 'cond'));
CREATE TRIGGER tg_cond_notices_touch BEFORE UPDATE ON public.cond_notices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
