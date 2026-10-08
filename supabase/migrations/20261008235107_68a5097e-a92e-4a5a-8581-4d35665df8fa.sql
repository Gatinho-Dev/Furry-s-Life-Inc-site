REVOKE EXECUTE ON FUNCTION public.drive_file_permission(uuid) FROM authenticated, public;
REVOKE EXECUTE ON FUNCTION public.drive_folder_permission(uuid) FROM authenticated, public;

CREATE POLICY "drive upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'life-drive' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "drive update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'life-drive' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "drive delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'life-drive' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "drive read own or shared" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'life-drive' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.drive_object_readable(name)));

-- lookup users by email for sharing (returns only id)
CREATE OR REPLACE FUNCTION public.drive_find_user(_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE lower(email) = lower(trim(_email)) LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.drive_find_user(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.drive_find_user(text) TO authenticated;