-- ============ Life Slides: imagens no bucket life-drive ============
-- Imagens ficam em <owner_uid>/slides/<presentation_id>/<image_id>.
-- Quem pode ver a apresentação (dono, leitor ou editor) pode ler a imagem.

CREATE OR REPLACE FUNCTION public.slide_image_readable(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (storage.foldername(_path))[2] = 'slides'
    AND EXISTS (
      SELECT 1 FROM public.presentations p
      WHERE p.id::text = (storage.foldername(_path))[3]
        AND public.presentation_permission(p.id) IN ('owner','edit','view')
    )
$$;
REVOKE EXECUTE ON FUNCTION public.slide_image_readable(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.slide_image_readable(text) TO authenticated;

-- Leitura adicional (as políticas do Drive continuam valendo, sem alterações).
CREATE POLICY "slides images read shared" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'life-drive' AND public.slide_image_readable(name));
