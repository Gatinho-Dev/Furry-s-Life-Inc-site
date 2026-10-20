CREATE TABLE public.docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'Documento sem título',
  content jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  preview text NOT NULL DEFAULT '',
  folder_id uuid,
  trashed_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.doc_shares (
  doc_id uuid NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer','editor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_id, user_id)
);
CREATE TABLE public.doc_favorites (
  doc_id uuid NOT NULL REFERENCES public.docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  PRIMARY KEY (doc_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs, public.doc_shares, public.doc_favorites TO authenticated;
GRANT ALL ON public.docs, public.doc_shares, public.doc_favorites TO service_role;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doc_favorites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.doc_role(_doc uuid, _uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM docs WHERE id=_doc AND owner_id=_uid) THEN 'owner'
  ELSE (SELECT role FROM doc_shares WHERE doc_id=_doc AND user_id=_uid) END
$$;
REVOKE EXECUTE ON FUNCTION public.doc_role(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.doc_role(uuid,uuid) TO authenticated;

CREATE POLICY docs_select ON public.docs FOR SELECT TO authenticated USING (public.doc_role(id, auth.uid()) IS NOT NULL);
CREATE POLICY docs_insert ON public.docs FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY docs_update ON public.docs FOR UPDATE TO authenticated USING (public.doc_role(id, auth.uid()) IN ('owner','editor')) WITH CHECK (public.doc_role(id, auth.uid()) IN ('owner','editor'));
CREATE POLICY docs_delete ON public.docs FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY shares_select ON public.doc_shares FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.doc_role(doc_id, auth.uid()) = 'owner');
CREATE POLICY shares_write ON public.doc_shares FOR ALL TO authenticated USING (public.doc_role(doc_id, auth.uid()) = 'owner') WITH CHECK (public.doc_role(doc_id, auth.uid()) = 'owner');

CREATE POLICY fav_all ON public.doc_favorites FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND public.doc_role(doc_id, auth.uid()) IS NOT NULL);

-- editors cannot change owner/trash; bump version & updated_at
CREATE OR REPLACE FUNCTION public.docs_touch() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.owner_id <> OLD.owner_id THEN RAISE EXCEPTION 'owner imutável'; END IF;
  IF OLD.owner_id <> auth.uid() AND NEW.trashed_at IS DISTINCT FROM OLD.trashed_at THEN RAISE EXCEPTION 'apenas o dono'; END IF;
  NEW.updated_at := now();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER docs_touch BEFORE UPDATE ON public.docs FOR EACH ROW EXECUTE FUNCTION public.docs_touch();

CREATE OR REPLACE FUNCTION public.docs_find_user(_email text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(trim(_email)) AND auth.uid() IS NOT NULL LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.docs_find_user(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.docs_find_user(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.docs_owner_emails(_ids uuid[]) RETURNS TABLE(id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, u.email::text FROM auth.users u WHERE u.id = ANY(_ids) AND auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM docs d WHERE d.owner_id = u.id AND public.doc_role(d.id, auth.uid()) IS NOT NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.docs_owner_emails(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.docs_owner_emails(uuid[]) TO authenticated;
CREATE INDEX docs_owner_idx ON public.docs(owner_id, updated_at DESC);