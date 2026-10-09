CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Formulário sem título',
  description text NOT NULL DEFAULT '',
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT ALL ON public.forms TO service_role;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.form_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL,
  permission text NOT NULL DEFAULT 'edit' CHECK (permission IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_collaborators TO authenticated;
GRANT ALL ON public.form_collaborators TO service_role;
ALTER TABLE public.form_collaborators ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.form_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  fields jsonb NOT NULL,
  settings jsonb NOT NULL,
  label text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.form_versions TO authenticated;
GRANT ALL ON public.form_versions TO service_role;
ALTER TABLE public.form_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  respondent_id uuid,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.form_responses TO anon;
GRANT SELECT, INSERT, DELETE ON public.form_responses TO authenticated;
GRANT ALL ON public.form_responses TO service_role;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;
CREATE INDEX form_responses_form_idx ON public.form_responses(form_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.form_role(_form uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.forms WHERE id = _form AND owner_id = auth.uid()) THEN 'owner'
    ELSE (SELECT permission FROM public.form_collaborators WHERE form_id = _form AND user_id = auth.uid() LIMIT 1)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.form_role(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.form_role(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.form_accepts(_form uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.forms WHERE id = _form AND status = 'published'
    AND (visibility = 'public' OR auth.uid() IS NOT NULL))
$$;
GRANT EXECUTE ON FUNCTION public.form_accepts(uuid) TO anon, authenticated;

-- forms
CREATE POLICY "forms owner all" ON public.forms FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "forms collab read" ON public.forms FOR SELECT TO authenticated
  USING (public.form_role(id) IN ('view','edit'));
CREATE POLICY "forms collab edit" ON public.forms FOR UPDATE TO authenticated
  USING (public.form_role(id) = 'edit') WITH CHECK (public.form_role(id) = 'edit');
CREATE POLICY "forms published public" ON public.forms FOR SELECT TO anon
  USING (status = 'published' AND visibility = 'public');
CREATE POLICY "forms published signed in" ON public.forms FOR SELECT TO authenticated
  USING (status = 'published');

-- collaborators
CREATE POLICY "collab owner manage" ON public.form_collaborators FOR ALL TO authenticated
  USING (public.form_role(form_id) = 'owner') WITH CHECK (public.form_role(form_id) = 'owner');
CREATE POLICY "collab self read" ON public.form_collaborators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.form_role(form_id) IS NOT NULL);

-- versions
CREATE POLICY "versions read" ON public.form_versions FOR SELECT TO authenticated
  USING (public.form_role(form_id) IS NOT NULL);
CREATE POLICY "versions create" ON public.form_versions FOR INSERT TO authenticated
  WITH CHECK (public.form_role(form_id) IN ('owner','edit') AND created_by = auth.uid());
CREATE POLICY "versions delete" ON public.form_versions FOR DELETE TO authenticated
  USING (public.form_role(form_id) = 'owner');

-- responses
CREATE POLICY "responses submit anon" ON public.form_responses FOR INSERT TO anon
  WITH CHECK (respondent_id IS NULL AND public.form_accepts(form_id));
CREATE POLICY "responses submit auth" ON public.form_responses FOR INSERT TO authenticated
  WITH CHECK ((respondent_id IS NULL OR respondent_id = auth.uid()) AND public.form_accepts(form_id));
CREATE POLICY "responses read team" ON public.form_responses FOR SELECT TO authenticated
  USING (public.form_role(form_id) IS NOT NULL);
CREATE POLICY "responses delete owner" ON public.form_responses FOR DELETE TO authenticated
  USING (public.form_role(form_id) IN ('owner','edit'));

CREATE TRIGGER forms_touch BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();