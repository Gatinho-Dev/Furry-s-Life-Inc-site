-- ── 1. Accounts ────────────────────────────────────────────────────────────
CREATE TABLE public.lifepay_accounts (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pix_key      TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  balance      BIGINT NOT NULL DEFAULT 1000 CHECK (balance >= 0),
  is_admin     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.lifepay_accounts TO authenticated;
GRANT ALL ON public.lifepay_accounts TO service_role;
ALTER TABLE public.lifepay_accounts ENABLE ROW LEVEL SECURITY;

-- Everyone signed in can read accounts (needed to look up recipient by pix key + show display names in transactions).
CREATE POLICY "lifepay accounts: read all" ON public.lifepay_accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "lifepay accounts: self update display_name only" ON public.lifepay_accounts
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER lifepay_accounts_touch BEFORE UPDATE ON public.lifepay_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── 2. Transactions ───────────────────────────────────────────────────────
CREATE TABLE public.lifepay_transactions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount       BIGINT NOT NULL CHECK (amount > 0),
  note         TEXT,
  kind         TEXT NOT NULL DEFAULT 'transfer' CHECK (kind IN ('transfer','admin_grant','admin_debit','signup_bonus')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lifepay_transactions TO authenticated;
GRANT ALL ON public.lifepay_transactions TO service_role;
ALTER TABLE public.lifepay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lifepay tx: read own or admin" ON public.lifepay_transactions
  FOR SELECT TO authenticated USING (
    from_user = auth.uid()
    OR to_user = auth.uid()
    OR public.is_ceo_or_admin(auth.uid())
  );

CREATE INDEX lifepay_tx_from_idx ON public.lifepay_transactions (from_user, created_at DESC);
CREATE INDEX lifepay_tx_to_idx   ON public.lifepay_transactions (to_user, created_at DESC);

-- ── 3. Bootstrap helper: create lifepay account for any auth user lazily ─
CREATE OR REPLACE FUNCTION public.ensure_lifepay_account(_user_id UUID)
RETURNS public.lifepay_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc public.lifepay_accounts;
  u   auth.users%ROWTYPE;
  pix TEXT;
  base TEXT;
  attempt INT := 0;
  admin_flag BOOLEAN;
  starting_balance BIGINT;
BEGIN
  SELECT * INTO acc FROM public.lifepay_accounts WHERE user_id = _user_id;
  IF FOUND THEN RETURN acc; END IF;

  SELECT * INTO u FROM auth.users WHERE id = _user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'user not found'; END IF;

  admin_flag := public.is_ceo_or_admin(_user_id);
  starting_balance := CASE WHEN admin_flag THEN 10000000000 ELSE 1000 END;

  base := lower(coalesce(u.email, _user_id::text));
  pix  := base;
  LOOP
    BEGIN
      INSERT INTO public.lifepay_accounts(user_id, pix_key, display_name, balance, is_admin)
      VALUES (_user_id, pix, coalesce(split_part(u.email,'@',1), 'Usuário'), starting_balance, admin_flag)
      RETURNING * INTO acc;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempt := attempt + 1;
      pix := base || '+' || attempt::text;
      IF attempt > 50 THEN RAISE; END IF;
    END;
  END LOOP;

  INSERT INTO public.lifepay_transactions(to_user, amount, kind, note)
  VALUES (_user_id, starting_balance, 'signup_bonus', CASE WHEN admin_flag THEN 'Saldo inicial admin' ELSE 'Bônus de cadastro' END);

  RETURN acc;
END;
$$;
GRANT EXECUTE ON FUNCTION public.ensure_lifepay_account(UUID) TO authenticated;

-- ── 4. Transfer RPC: send Robux to another user by pix key ─────────────
CREATE OR REPLACE FUNCTION public.lifepay_transfer(_to_pix TEXT, _amount BIGINT, _note TEXT DEFAULT NULL)
RETURNS public.lifepay_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender public.lifepay_accounts;
  recipient public.lifepay_accounts;
  tx public.lifepay_transactions;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF _to_pix IS NULL OR length(trim(_to_pix)) = 0 THEN RAISE EXCEPTION 'Chave Pix obrigatória'; END IF;

  sender := public.ensure_lifepay_account(uid);

  SELECT * INTO recipient FROM public.lifepay_accounts
    WHERE lower(pix_key) = lower(trim(_to_pix)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave Pix não encontrada'; END IF;
  IF recipient.user_id = uid THEN RAISE EXCEPTION 'Não pode transferir para si mesmo'; END IF;

  SELECT * INTO sender FROM public.lifepay_accounts WHERE user_id = uid FOR UPDATE;
  IF sender.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  UPDATE public.lifepay_accounts SET balance = balance - _amount WHERE user_id = sender.user_id;
  UPDATE public.lifepay_accounts SET balance = balance + _amount WHERE user_id = recipient.user_id;

  INSERT INTO public.lifepay_transactions(from_user, to_user, amount, note, kind)
  VALUES (sender.user_id, recipient.user_id, _amount, nullif(trim(coalesce(_note,'')),''), 'transfer')
  RETURNING * INTO tx;
  RETURN tx;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lifepay_transfer(TEXT, BIGINT, TEXT) TO authenticated;

-- ── 5. Admin RPC: grant or debit Robux on any account ──────────────────
CREATE OR REPLACE FUNCTION public.lifepay_admin_adjust(_target_pix TEXT, _amount BIGINT, _note TEXT DEFAULT NULL)
RETURNS public.lifepay_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target public.lifepay_accounts;
  tx public.lifepay_transactions;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_ceo_or_admin(uid) THEN RAISE EXCEPTION 'Apenas admins podem ajustar saldos'; END IF;
  IF _amount IS NULL OR _amount = 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  SELECT * INTO target FROM public.lifepay_accounts
    WHERE lower(pix_key) = lower(trim(_target_pix)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave Pix não encontrada'; END IF;

  IF _amount > 0 THEN
    UPDATE public.lifepay_accounts SET balance = balance + _amount WHERE user_id = target.user_id;
    INSERT INTO public.lifepay_transactions(from_user, to_user, amount, note, kind)
    VALUES (uid, target.user_id, _amount, nullif(trim(coalesce(_note,'')),''), 'admin_grant')
    RETURNING * INTO tx;
  ELSE
    IF target.balance + _amount < 0 THEN RAISE EXCEPTION 'Saldo insuficiente para debitar'; END IF;
    UPDATE public.lifepay_accounts SET balance = balance + _amount WHERE user_id = target.user_id;
    INSERT INTO public.lifepay_transactions(from_user, to_user, amount, note, kind)
    VALUES (target.user_id, uid, abs(_amount), nullif(trim(coalesce(_note,'')),''), 'admin_debit')
    RETURNING * INTO tx;
  END IF;
  RETURN tx;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lifepay_admin_adjust(TEXT, BIGINT, TEXT) TO authenticated;

-- ── 6. Auto-create lifepay account on signup ──────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_lifepay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_lifepay_account(NEW.id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block auth signup
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_lifepay ON auth.users;
CREATE TRIGGER on_auth_user_created_lifepay
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_lifepay();