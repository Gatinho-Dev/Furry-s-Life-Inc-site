
CREATE TABLE public.osint_case_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  label TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  pos_x DOUBLE PRECISION NOT NULL DEFAULT 0,
  pos_y DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.osint_case_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.osint_investigations(id) ON DELETE CASCADE,
  source_node UUID NOT NULL REFERENCES public.osint_case_nodes(id) ON DELETE CASCADE,
  target_node UUID NOT NULL REFERENCES public.osint_case_nodes(id) ON DELETE CASCADE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.osint_case_nodes(investigation_id);
CREATE INDEX ON public.osint_case_edges(investigation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_case_nodes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.osint_case_edges TO authenticated;
GRANT ALL ON public.osint_case_nodes TO service_role;
GRANT ALL ON public.osint_case_edges TO service_role;

ALTER TABLE public.osint_case_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.osint_case_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agency staff manage nodes" ON public.osint_case_nodes
  FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(), 'agency'))
  WITH CHECK (public.has_subsidiary_access(auth.uid(), 'agency'));
CREATE POLICY "agency staff manage edges" ON public.osint_case_edges
  FOR ALL TO authenticated
  USING (public.has_subsidiary_access(auth.uid(), 'agency'))
  WITH CHECK (public.has_subsidiary_access(auth.uid(), 'agency'));

CREATE TRIGGER touch_osint_case_nodes BEFORE UPDATE ON public.osint_case_nodes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
