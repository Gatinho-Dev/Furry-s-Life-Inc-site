-- ============ CONTAS ============
ALTER TABLE public.lifepay_accounts
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS credit_limit bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS closing_day smallint NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS due_day smallint NOT NULL DEFAULT 28,
  ADD COLUMN IF NOT EXISTS pin_hash text,
  ADD COLUMN IF NOT EXISTS first_access_done boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_access_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text;

DO $$ BEGIN
  ALTER TABLE public.lifepay_accounts ADD CONSTRAINT lifepay_accounts_status_check
    CHECK (status IN ('active','blocked','closed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.lifepay_accounts ADD CONSTRAINT lifepay_accounts_days_check
    CHECK (closing_day BETWEEN 1 AND 28 AND due_day BETWEEN 1 AND 28);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.lifepay_accounts a
SET full_name = COALESCE(a.full_name, p.full_name, a.display_name),
    email = COALESCE(a.email, p.email)
FROM public.profiles p WHERE p.id = a.user_id;

-- ============ CHAVES ============
CREATE TABLE IF NOT EXISTS public.lifepay_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_type text NOT NULL CHECK (key_type IN ('email','random')),
  key_value text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS lifepay_keys_value_uidx
  ON public.lifepay_keys (lower(key_value)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS lifepay_keys_user_idx ON public.lifepay_keys (user_id);

GRANT SELECT ON public.lifepay_keys TO authenticated;
GRANT ALL ON public.lifepay_keys TO service_role;
ALTER TABLE public.lifepay_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lifepay keys: read own" ON public.lifepay_keys;
CREATE POLICY "lifepay keys: read own" ON public.lifepay_keys FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ceo_or_admin(auth.uid()));

-- ============ MOVIMENTAÇÕES ============
ALTER TABLE public.lifepay_transactions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS key_used text,
  ADD COLUMN IF NOT EXISTS auth_method text,
  ADD COLUMN IF NOT EXISTS from_balance_before bigint,
  ADD COLUMN IF NOT EXISTS from_balance_after bigint,
  ADD COLUMN IF NOT EXISTS to_balance_before bigint,
  ADD COLUMN IF NOT EXISTS to_balance_after bigint,
  ADD COLUMN IF NOT EXISTS receipt_code text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.lifepay_transactions DROP CONSTRAINT IF EXISTS lifepay_transactions_kind_check;
ALTER TABLE public.lifepay_transactions ADD CONSTRAINT lifepay_transactions_kind_check
  CHECK (kind IN ('transfer','admin_grant','admin_debit','signup_bonus','purchase','invoice_payment','refund'));

CREATE UNIQUE INDEX IF NOT EXISTS lifepay_tx_idem_uidx
  ON public.lifepay_transactions (from_user, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- ============ PERMISSÕES ADMIN ============
CREATE TABLE IF NOT EXISTS public.lifepay_admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT ON public.lifepay_admin_permissions TO authenticated;
GRANT ALL ON public.lifepay_admin_permissions TO service_role;
ALTER TABLE public.lifepay_admin_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lifepay perms: read own or admin" ON public.lifepay_admin_permissions;
CREATE POLICY "lifepay perms: read own or admin" ON public.lifepay_admin_permissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ceo_or_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.has_lifepay_perm(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_ceo_or_admin(_user_id) OR EXISTS(
    SELECT 1 FROM public.lifepay_admin_permissions
    WHERE user_id = _user_id AND permission = _perm
  )
$$;
REVOKE ALL ON FUNCTION public.has_lifepay_perm(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_lifepay_perm(uuid, text) TO authenticated, service_role;

-- ============ AUDITORIA ============
CREATE TABLE IF NOT EXISTS public.lifepay_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_kind text NOT NULL DEFAULT 'admin',
  action text NOT NULL,
  target_user uuid,
  target_ref text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  auth_method text,
  ip text,
  device text,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lifepay_audit_created_idx ON public.lifepay_audit_logs (created_at DESC);
GRANT SELECT ON public.lifepay_audit_logs TO authenticated;
GRANT ALL ON public.lifepay_audit_logs TO service_role;
ALTER TABLE public.lifepay_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lifepay audit: read with perm" ON public.lifepay_audit_logs;
CREATE POLICY "lifepay audit: read with perm" ON public.lifepay_audit_logs FOR SELECT TO authenticated
  USING (public.has_lifepay_perm(auth.uid(), 'audit'));

-- ============ ENSURE ACCOUNT (com chave de e-mail) ============
CREATE OR REPLACE FUNCTION public.ensure_lifepay_account(_user_id uuid)
RETURNS public.lifepay_accounts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  acc public.lifepay_accounts;
  u auth.users%ROWTYPE;
  pix TEXT; base TEXT; attempt INT := 0;
  admin_flag BOOLEAN; starting_balance BIGINT;
BEGIN
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
END; $$;
REVOKE ALL ON FUNCTION public.ensure_lifepay_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_lifepay_account(uuid) TO authenticated, service_role;

-- backfill chaves de e-mail para contas existentes
INSERT INTO public.lifepay_keys(user_id, key_type, key_value)
SELECT a.user_id, 'email', lower(a.pix_key) FROM public.lifepay_accounts a
WHERE NOT EXISTS (SELECT 1 FROM public.lifepay_keys k WHERE k.user_id=a.user_id AND k.key_type='email' AND k.deleted_at IS NULL);

-- ============ CONSULTA DE DESTINATÁRIO ============
CREATE OR REPLACE FUNCTION public.lifepay_resolve_key(_key text)
RETURNS TABLE(user_id uuid, display_name text, key_value text, key_type text, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT k.user_id, coalesce(a.full_name, a.display_name), k.key_value, k.key_type, a.status
  FROM public.lifepay_keys k
  JOIN public.lifepay_accounts a ON a.user_id = k.user_id
  WHERE auth.uid() IS NOT NULL
    AND k.deleted_at IS NULL AND k.status = 'active'
    AND lower(k.key_value) = lower(trim(_key))
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.lifepay_resolve_key(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifepay_resolve_key(text) TO authenticated;

-- ============ GESTÃO DE CHAVES ============
CREATE OR REPLACE FUNCTION public.lifepay_create_random_key()
RETURNS public.lifepay_keys LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); k public.lifepay_keys; n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT count(*) INTO n FROM public.lifepay_keys WHERE user_id=uid AND key_type='random' AND deleted_at IS NULL;
  IF n >= 5 THEN RAISE EXCEPTION 'Limite de 5 chaves aleatórias atingido'; END IF;
  LOOP
    BEGIN
      INSERT INTO public.lifepay_keys(user_id, key_type, key_value)
      VALUES (uid, 'random', encode(gen_random_bytes(16),'hex')) RETURNING * INTO k;
      EXIT;
    EXCEPTION WHEN unique_violation THEN NULL; END;
  END LOOP;
  RETURN k;
END; $$;
REVOKE ALL ON FUNCTION public.lifepay_create_random_key() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifepay_create_random_key() TO authenticated;

CREATE OR REPLACE FUNCTION public.lifepay_update_key(_id uuid, _action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); k public.lifepay_keys;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO k FROM public.lifepay_keys WHERE id=_id AND user_id=uid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave não encontrada'; END IF;
  IF _action = 'delete' THEN
    IF k.key_type = 'email' THEN RAISE EXCEPTION 'A chave de e-mail não pode ser removida'; END IF;
    UPDATE public.lifepay_keys SET deleted_at = now(), status='inactive' WHERE id=_id;
  ELSIF _action IN ('activate','deactivate') THEN
    UPDATE public.lifepay_keys SET status = CASE WHEN _action='activate' THEN 'active' ELSE 'inactive' END WHERE id=_id;
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  RETURN true;
END; $$;
REVOKE ALL ON FUNCTION public.lifepay_update_key(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifepay_update_key(uuid, text) TO authenticated;

-- ============ TRANSFERÊNCIA ATÔMICA ============
CREATE OR REPLACE FUNCTION public.lifepay_transfer_v2(_key text, _amount bigint, _note text, _auth_method text, _idem text)
RETURNS public.lifepay_transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  sender public.lifepay_accounts; recipient public.lifepay_accounts;
  target record; tx public.lifepay_transactions;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _idem IS NULL OR length(_idem) < 8 THEN RAISE EXCEPTION 'Requisição inválida'; END IF;

  SELECT * INTO tx FROM public.lifepay_transactions WHERE from_user = uid AND idempotency_key = _idem;
  IF FOUND THEN RETURN tx; END IF;

  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 THEN RAISE EXCEPTION 'Informe a chave do destinatário'; END IF;

  PERFORM public.ensure_lifepay_account(uid);

  SELECT k.user_id INTO target FROM public.lifepay_keys k
    WHERE k.deleted_at IS NULL AND k.status='active' AND lower(k.key_value)=lower(trim(_key)) LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'Chave LifePay não encontrada ou inativa'; END IF;
  IF target.user_id = uid THEN RAISE EXCEPTION 'Não é possível transferir para a própria conta'; END IF;

  SELECT * INTO sender FROM public.lifepay_accounts WHERE user_id = uid FOR UPDATE;
  SELECT * INTO recipient FROM public.lifepay_accounts WHERE user_id = target.user_id FOR UPDATE;
  IF recipient IS NULL THEN RAISE EXCEPTION 'Conta do destinatário indisponível'; END IF;
  IF sender.status <> 'active' THEN RAISE EXCEPTION 'Sua conta está bloqueada'; END IF;
  IF recipient.status <> 'active' THEN RAISE EXCEPTION 'A conta do destinatário está bloqueada'; END IF;
  IF sender.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  UPDATE public.lifepay_accounts SET balance = balance - _amount WHERE user_id = sender.user_id;
  UPDATE public.lifepay_accounts SET balance = balance + _amount WHERE user_id = recipient.user_id;

  INSERT INTO public.lifepay_transactions(from_user, to_user, amount, note, kind, status, key_used, auth_method,
    from_balance_before, from_balance_after, to_balance_before, to_balance_after, receipt_code, idempotency_key)
  VALUES (sender.user_id, recipient.user_id, _amount, nullif(trim(coalesce(_note,'')),''), 'transfer', 'completed',
    lower(trim(_key)), coalesce(_auth_method,'password'),
    sender.balance, sender.balance - _amount, recipient.balance, recipient.balance + _amount,
    upper(encode(gen_random_bytes(6),'hex')), _idem)
  RETURNING * INTO tx;

  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref, after_data, auth_method)
  VALUES (uid, 'user', 'transfer', recipient.user_id, tx.id::text,
          jsonb_build_object('amount', _amount, 'key', lower(trim(_key))), coalesce(_auth_method,'password'));

  RETURN tx;
END; $$;
REVOKE ALL ON FUNCTION public.lifepay_transfer_v2(text, bigint, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifepay_transfer_v2(text, bigint, text, text, text) TO authenticated;