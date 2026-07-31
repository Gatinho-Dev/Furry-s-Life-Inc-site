DROP FUNCTION IF EXISTS public.lifepay_transfer(text, bigint, text);
DROP FUNCTION IF EXISTS public.lifepay_admin_adjust(text, bigint, text);
DROP FUNCTION IF EXISTS public.lifepay_lookup_pix(text);

CREATE OR REPLACE FUNCTION public.ensure_lifepay_account(_user_id uuid)
 RETURNS lifepay_accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  acc public.lifepay_accounts;
  u auth.users%ROWTYPE;
  pix TEXT; base TEXT; attempt INT := 0;
  admin_flag BOOLEAN; starting_balance BIGINT;
BEGIN
  -- Um usuário autenticado só pode garantir a própria conta.
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() AND NOT public.is_ceo_or_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Operação não permitida';
  END IF;

  SELECT * INTO acc FROM public.lifepay_accounts WHERE user_id = _user_id;
  IF FOUND THEN
    INSERT INTO public.lifepay_keys(user_id, key_type, key_value)
    SELECT _user_id, 'email', lower(acc.pix_key)
    WHERE NOT EXISTS (SELECT 1 FROM public.lifepay_keys k WHERE k.user_id=_user_id AND k.key_type='email' AND k.deleted_at IS NULL);
    RETURN acc;
  END IF;

  SELECT * INTO u FROM auth.users WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;

  admin_flag := public.is_ceo_or_admin(_user_id);
  starting_balance := CASE WHEN admin_flag THEN 10000000000 ELSE 100000 END;

  base := lower(coalesce(u.email, _user_id::text));
  pix := base;
  LOOP
    BEGIN
      INSERT INTO public.lifepay_accounts(user_id, pix_key, display_name, balance, is_admin, full_name, email,
                                          credit_limit, first_access_done)
      VALUES (_user_id, pix, coalesce(split_part(u.email,'@',1),'Usuário'), starting_balance, admin_flag,
              coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)), lower(u.email),
              CASE WHEN admin_flag THEN 100000000 ELSE 200000 END, true)
      RETURNING * INTO acc;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1; pix := base || '+' || attempt::text;
      IF attempt > 50 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.lifepay_keys(user_id, key_type, key_value) VALUES (_user_id, 'email', pix);

  INSERT INTO public.lifepay_transactions(to_user, amount, kind, note, to_balance_before, to_balance_after, status)
  VALUES (_user_id, starting_balance, 'signup_bonus', 'Abertura de conta', 0, starting_balance, 'completed');

  RETURN acc;
END; $function$;

-- Face ID: leitura só do próprio dono; qualquer gravação passa pelo servidor.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='lifepay_faceid' LOOP
    EXECUTE format('DROP POLICY %I ON public.lifepay_faceid', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "faceid_select_own" ON public.lifepay_faceid
  FOR SELECT TO authenticated USING (user_id = auth.uid());
REVOKE INSERT, UPDATE, DELETE ON public.lifepay_faceid FROM authenticated;

-- Desafios WebAuthn são internos: nenhum acesso via API.
CREATE POLICY "webauthn_challenges_no_access" ON public.lifepay_webauthn_challenges
  FOR SELECT TO authenticated USING (false);
REVOKE ALL ON public.lifepay_webauthn_challenges FROM anon, authenticated;