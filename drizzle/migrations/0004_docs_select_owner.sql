DROP POLICY docs_select ON public.docs;
CREATE POLICY docs_select ON public.docs FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.doc_role(id, auth.uid()) IS NOT NULL);
DROP POLICY docs_update ON public.docs;
CREATE POLICY docs_update ON public.docs FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.doc_role(id, auth.uid()) = 'editor') WITH CHECK (owner_id = auth.uid() OR public.doc_role(id, auth.uid()) = 'editor');