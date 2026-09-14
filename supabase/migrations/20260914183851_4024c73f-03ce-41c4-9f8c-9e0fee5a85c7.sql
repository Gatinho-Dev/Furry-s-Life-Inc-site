-- ============ Life Workspace / Life Drive ============

CREATE TABLE public.drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  trashed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_folders TO authenticated;
GRANT ALL ON public.drive_folders TO service_role;
ALTER TABLE public.drive_folders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.drive_folders(id) ON DELETE SET NULL,
  name text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes bigint NOT NULL DEFAULT 0,
  trashed_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_files TO authenticated;
GRANT ALL ON public.drive_files TO service_role;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.drive_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('file','folder')),
  file_id uuid REFERENCES public.drive_files(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  shared_with uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_email text,
  permission text NOT NULL DEFAULT 'view' CHECK (permission IN ('view','comment','edit','owner')),
  link_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_shares TO authenticated;
GRANT ALL ON public.drive_shares TO service_role;
ALTER TABLE public.drive_shares ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.drive_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('file','folder')),
  file_id uuid REFERENCES public.drive_files(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.drive_folders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drive_favorites TO authenticated;
GRANT ALL ON public.drive_favorites TO service_role;
ALTER TABLE public.drive_favorites ENABLE ROW LEVEL SECURITY;

CREATE INDEX drive_folders_owner_idx ON public.drive_folders(owner_id, parent_id);
CREATE INDEX drive_files_owner_idx ON public.drive_files(owner_id, folder_id);
CREATE INDEX drive_shares_target_idx ON public.drive_shares(shared_with);
CREATE UNIQUE INDEX drive_fav_file_uniq ON public.drive_favorites(user_id, file_id) WHERE file_id IS NOT NULL;
CREATE UNIQUE INDEX drive_fav_folder_uniq ON public.drive_favorites(user_id, folder_id) WHERE folder_id IS NOT NULL;

-- helpers -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.drive_file_permission(_file uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.drive_files f WHERE f.id = _file AND f.owner_id = auth.uid()) THEN 'owner'
    ELSE (SELECT s.permission FROM public.drive_shares s
          WHERE s.file_id = _file AND s.shared_with = auth.uid()
          ORDER BY CASE s.permission WHEN 'owner' THEN 4 WHEN 'edit' THEN 3 WHEN 'comment' THEN 2 ELSE 1 END DESC
          LIMIT 1)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.drive_file_permission(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.drive_folder_permission(_folder uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.drive_folders f WHERE f.id = _folder AND f.owner_id = auth.uid()) THEN 'owner'
    ELSE (SELECT s.permission FROM public.drive_shares s
          WHERE s.folder_id = _folder AND s.shared_with = auth.uid()
          ORDER BY CASE s.permission WHEN 'owner' THEN 4 WHEN 'edit' THEN 3 WHEN 'comment' THEN 2 ELSE 1 END DESC
          LIMIT 1)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.drive_folder_permission(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.drive_object_readable(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.drive_files f
    WHERE f.storage_path = _path
      AND (f.owner_id = auth.uid()
           OR EXISTS (SELECT 1 FROM public.drive_shares s WHERE s.file_id = f.id AND s.shared_with = auth.uid()))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.drive_object_readable(text) FROM anon;

-- policies ------------------------------------------------------------
CREATE POLICY "folders owner all" ON public.drive_folders FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "folders shared read" ON public.drive_folders FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drive_shares s WHERE s.folder_id = drive_folders.id AND s.shared_with = auth.uid()));

CREATE POLICY "files owner all" ON public.drive_files FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "files shared read" ON public.drive_files FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.drive_shares s WHERE s.file_id = drive_files.id AND s.shared_with = auth.uid()));

CREATE POLICY "shares owner all" ON public.drive_shares FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "shares recipient read" ON public.drive_shares FOR SELECT TO authenticated
  USING (shared_with = auth.uid());

CREATE POLICY "favorites own" ON public.drive_favorites FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- updated_at triggers -------------------------------------------------
CREATE TRIGGER drive_folders_touch BEFORE UPDATE ON public.drive_folders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER drive_files_touch BEFORE UPDATE ON public.drive_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();