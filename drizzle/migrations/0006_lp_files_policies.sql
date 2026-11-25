DROP POLICY lp_delete ON public.lp_patients;
CREATE POLICY lp_delete ON public.lp_patients FOR DELETE TO authenticated USING (public.lp_has(auth.uid(), ARRAY['administrador','diretor']) OR (is_simulated AND public.lp_access(auth.uid())));
CREATE POLICY "lp files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'lp-files' AND public.lp_access(auth.uid()));
CREATE POLICY "lp files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lp-files' AND public.lp_access(auth.uid()));
CREATE POLICY "lp files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'lp-files' AND public.lp_has(auth.uid(), ARRAY['administrador','diretor']));