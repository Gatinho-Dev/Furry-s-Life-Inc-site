CREATE OR REPLACE FUNCTION public.form_accepts(_form uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.forms f WHERE f.id = _form AND f.status = 'published'
    AND (f.visibility = 'public' OR auth.uid() IS NOT NULL)
    AND COALESCE((f.settings->>'accepting')::boolean, true)
    AND (NULLIF(f.settings->>'closesAt','') IS NULL OR (f.settings->>'closesAt')::timestamp AT TIME ZONE 'America/Sao_Paulo' > now())
    AND (NULLIF(f.settings->>'maxResponses','') IS NULL OR (SELECT count(*) FROM public.form_responses r WHERE r.form_id = f.id) < (f.settings->>'maxResponses')::int))
$$;
CREATE OR REPLACE FUNCTION public.form_response_count(_form uuid)
 RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT count(*)::int FROM public.form_responses WHERE form_id = _form AND EXISTS (SELECT 1 FROM public.forms WHERE id = _form AND status = 'published') $$;
GRANT EXECUTE ON FUNCTION public.form_response_count(uuid) TO anon, authenticated;