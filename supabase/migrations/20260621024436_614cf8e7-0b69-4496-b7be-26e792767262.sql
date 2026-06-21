CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sub public.subsidiary;
  is_ceo boolean := lower(NEW.email) IN ('gatinho@furrys.life','gatinho@furrs.life');
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;

  IF is_ceo THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'ceo') ON CONFLICT DO NOTHING;
    FOR sub IN SELECT unnest(enum_range(NULL::public.subsidiary)) LOOP
      INSERT INTO public.user_subsidiary_access(user_id, subsidiary, granted_by)
      VALUES (NEW.id, sub, NEW.id) ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'staff') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'ceo'::public.app_role
FROM auth.users u
WHERE lower(u.email) IN ('gatinho@furrys.life','gatinho@furrs.life')
ON CONFLICT DO NOTHING;

INSERT INTO public.user_subsidiary_access (user_id, subsidiary, granted_by)
SELECT u.id, s, u.id
FROM auth.users u
CROSS JOIN unnest(enum_range(NULL::public.subsidiary)) AS s
WHERE lower(u.email) IN ('gatinho@furrys.life','gatinho@furrs.life')
ON CONFLICT DO NOTHING;