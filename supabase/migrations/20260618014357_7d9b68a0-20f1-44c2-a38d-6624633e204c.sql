
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sub public.subsidiary;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'gatinho@furrs.life' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'ceo') ON CONFLICT DO NOTHING;
    FOR sub IN SELECT unnest(enum_range(NULL::public.subsidiary)) LOOP
      INSERT INTO public.user_subsidiary_access(user_id, subsidiary, granted_by)
      VALUES (NEW.id, sub, NEW.id) ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'staff') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
