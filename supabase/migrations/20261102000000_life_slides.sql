-- ============ Life Slides ============

CREATE TABLE public.presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.drive_folders(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Apresentação sem título',
  deck jsonb NOT NULL DEFAULT '{"slides":[]}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.presentation_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id uuid NOT NULL REFERENCES public.presentations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentation_id, shared_with)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presentation_shares TO authenticated;
GRANT ALL ON public.presentations, public.presentation_shares TO service_role;

ALTER TABLE public.presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_shares ENABLE ROW LEVEL SECURITY;

CREATE INDEX presentations_owner_idx ON public.presentations(owner_id, folder_id);
CREATE INDEX presentation_shares_target_idx ON public.presentation_shares(shared_with);

-- Permissão efetiva do usuário atual: owner, edit, view ou NULL.
CREATE OR REPLACE FUNCTION public.presentation_permission(_pres uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.presentations p WHERE p.id = _pres AND p.owner_id = auth.uid()) THEN 'owner'
    ELSE (SELECT sh.permission FROM public.presentation_shares sh
          WHERE sh.presentation_id = _pres AND sh.shared_with = auth.uid() LIMIT 1)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.presentation_permission(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.presentation_permission(uuid) TO authenticated;

CREATE POLICY "presentations owner all" ON public.presentations FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "presentations shared read" ON public.presentations FOR SELECT TO authenticated
  USING (public.presentation_permission(id) IN ('view','edit'));
CREATE POLICY "presentations shared edit" ON public.presentations FOR UPDATE TO authenticated
  USING (public.presentation_permission(id) = 'edit')
  WITH CHECK (public.presentation_permission(id) = 'edit');

CREATE POLICY "presentation shares owner all" ON public.presentation_shares FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "presentation shares recipient read" ON public.presentation_shares FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

CREATE TRIGGER presentations_touch BEFORE UPDATE ON public.presentations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
