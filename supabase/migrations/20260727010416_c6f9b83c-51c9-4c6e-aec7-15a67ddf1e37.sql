-- ============ Fase 2: cartões, compras, parcelas e faturas ============
ALTER TABLE public.lifepay_accounts ADD COLUMN IF NOT EXISTS credit_used bigint NOT NULL DEFAULT 0;

-- ---------- CARDS ----------
CREATE TABLE IF NOT EXISTS public.lifepay_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'LifePay',
  brand text NOT NULL DEFAULT 'LifePay',
  pan text NOT NULL,
  last4 text NOT NULL,
  cvv text NOT NULL,
  exp_month smallint NOT NULL,
  exp_year smallint NOT NULL,
  holder_name text NOT NULL,
  card_limit bigint NOT NULL DEFAULT 0,
  is_virtual boolean NOT NULL DEFAULT false,
  is_temporary boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lifepay_cards_user_idx ON public.lifepay_cards(user_id);

-- número completo e cvv NÃO são expostos ao cliente (grant por coluna)
GRANT SELECT (id, user_id, label, brand, last4, exp_month, exp_year, holder_name,
              card_limit, is_virtual, is_temporary, expires_at, status, deleted_at, created_at, updated_at)
  ON public.lifepay_cards TO authenticated;
GRANT ALL ON public.lifepay_cards TO service_role;
ALTER TABLE public.lifepay_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cards_owner_select" ON public.lifepay_cards
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_lifepay_perm(auth.uid(), 'cards'));

CREATE TRIGGER lifepay_cards_touch BEFORE UPDATE ON public.lifepay_cards
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- INVOICES ----------
CREATE TABLE IF NOT EXISTS public.lifepay_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference_month date NOT NULL,
  closing_date date NOT NULL,
  due_date date NOT NULL,
  total bigint NOT NULL DEFAULT 0,
  paid bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, reference_month)
);
GRANT SELECT ON public.lifepay_invoices TO authenticated;
GRANT ALL ON public.lifepay_invoices TO service_role;
ALTER TABLE public.lifepay_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_owner_select" ON public.lifepay_invoices
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_lifepay_perm(auth.uid(), 'invoices'));
CREATE TRIGGER lifepay_invoices_touch BEFORE UPDATE ON public.lifepay_invoices
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- PURCHASES ----------
CREATE TABLE IF NOT EXISTS public.lifepay_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id uuid REFERENCES public.lifepay_cards(id) ON DELETE SET NULL,
  merchant text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  amount bigint NOT NULL,
  installments_count smallint NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  idempotency_key text,
  created_by uuid,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS lifepay_purchases_user_idx ON public.lifepay_purchases(user_id);
GRANT SELECT ON public.lifepay_purchases TO authenticated;
GRANT ALL ON public.lifepay_purchases TO service_role;
ALTER TABLE public.lifepay_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_owner_select" ON public.lifepay_purchases
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_lifepay_perm(auth.uid(), 'purchases'));

-- ---------- INSTALLMENTS ----------
CREATE TABLE IF NOT EXISTS public.lifepay_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.lifepay_purchases(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invoice_id uuid REFERENCES public.lifepay_invoices(id) ON DELETE SET NULL,
  number smallint NOT NULL,
  total_count smallint NOT NULL,
  amount bigint NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lifepay_installments_user_idx ON public.lifepay_installments(user_id);
CREATE INDEX IF NOT EXISTS lifepay_installments_invoice_idx ON public.lifepay_installments(invoice_id);
GRANT SELECT ON public.lifepay_installments TO authenticated;
GRANT ALL ON public.lifepay_installments TO service_role;
ALTER TABLE public.lifepay_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "installments_owner_select" ON public.lifepay_installments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_lifepay_perm(auth.uid(), 'purchases'));

-- ============ FUNÇÕES ============

-- gera número de cartão (16 dígitos, prefixo LifePay 5372)
CREATE OR REPLACE FUNCTION public.lifepay_gen_pan()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT '5372' || lpad((floor(random()*1000000000000))::bigint::text, 12, '0')
$$;
REVOKE EXECUTE ON FUNCTION public.lifepay_gen_pan() FROM PUBLIC, anon, authenticated;

-- cria cartão (principal ou temporário)
CREATE OR REPLACE FUNCTION public.lifepay_create_card(_label text DEFAULT 'LifePay', _temporary boolean DEFAULT false, _limit bigint DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); acc public.lifepay_accounts; c public.lifepay_cards; n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  acc := public.ensure_lifepay_account(uid);
  IF acc.status <> 'active' THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;

  IF _temporary THEN
    SELECT count(*) INTO n FROM public.lifepay_cards WHERE user_id=uid AND is_temporary AND deleted_at IS NULL;
    IF n >= 5 THEN RAISE EXCEPTION 'Limite de 5 cartões temporários atingido'; END IF;
  ELSE
    SELECT count(*) INTO n FROM public.lifepay_cards WHERE user_id=uid AND NOT is_temporary AND deleted_at IS NULL;
    IF n >= 1 THEN RAISE EXCEPTION 'Você já possui um cartão principal'; END IF;
  END IF;

  INSERT INTO public.lifepay_cards(user_id, label, pan, last4, cvv, exp_month, exp_year, holder_name,
                                   card_limit, is_virtual, is_temporary, expires_at)
  VALUES (uid, coalesce(nullif(trim(_label),''), CASE WHEN _temporary THEN 'Temporário' ELSE 'LifePay' END),
          public.lifepay_gen_pan(), '', lpad((floor(random()*1000))::int::text,3,'0'),
          extract(month from now())::smallint, (extract(year from now())+5)::smallint,
          upper(coalesce(acc.full_name, acc.display_name)),
          coalesce(_limit, acc.credit_limit), true, _temporary,
          CASE WHEN _temporary THEN now() + interval '30 days' ELSE NULL END)
  RETURNING * INTO c;

  UPDATE public.lifepay_cards SET last4 = right(pan, 4) WHERE id = c.id;

  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref)
  VALUES (uid, 'user', CASE WHEN _temporary THEN 'card_create_temp' ELSE 'card_create' END, uid, c.id::text);
  RETURN c.id;
END; $$;

-- bloquear / desbloquear / excluir cartão
CREATE OR REPLACE FUNCTION public.lifepay_card_action(_id uuid, _action text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); c public.lifepay_cards;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO c FROM public.lifepay_cards WHERE id=_id AND user_id=uid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cartão não encontrado'; END IF;
  IF _action = 'block' THEN UPDATE public.lifepay_cards SET status='blocked' WHERE id=_id;
  ELSIF _action = 'unblock' THEN UPDATE public.lifepay_cards SET status='active' WHERE id=_id;
  ELSIF _action = 'delete' THEN
    IF NOT c.is_temporary THEN RAISE EXCEPTION 'O cartão principal não pode ser excluído'; END IF;
    UPDATE public.lifepay_cards SET deleted_at=now(), status='canceled' WHERE id=_id;
  ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref)
  VALUES (uid, 'user', 'card_' || _action, uid, _id::text);
  RETURN true;
END; $$;

-- ajustar limite do cartão dentro do limite da conta
CREATE OR REPLACE FUNCTION public.lifepay_set_card_limit(_id uuid, _limit bigint)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); acc public.lifepay_accounts;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO acc FROM public.lifepay_accounts WHERE user_id=uid;
  IF _limit IS NULL OR _limit < 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
  IF _limit > acc.credit_limit THEN RAISE EXCEPTION 'Acima do limite aprovado da conta'; END IF;
  UPDATE public.lifepay_cards SET card_limit=_limit WHERE id=_id AND user_id=uid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cartão não encontrado'; END IF;
  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref, after_data)
  VALUES (uid, 'user', 'card_limit', uid, _id::text, jsonb_build_object('limit', _limit));
  RETURN true;
END; $$;

-- fatura correspondente a uma data de vencimento (cria se não existir)
CREATE OR REPLACE FUNCTION public.lifepay_invoice_for(_user uuid, _ref date)
RETURNS public.lifepay_invoices LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE acc public.lifepay_accounts; inv public.lifepay_invoices; cl date; du date; last_c int; last_d int;
BEGIN
  SELECT * INTO acc FROM public.lifepay_accounts WHERE user_id=_user;
  SELECT * INTO inv FROM public.lifepay_invoices WHERE user_id=_user AND reference_month=_ref;
  IF FOUND THEN RETURN inv; END IF;
  last_c := extract(day from (_ref + interval '1 month - 1 day'))::int;
  cl := _ref + (least(acc.closing_day, last_c) - 1);
  last_d := extract(day from (_ref + interval '2 month - 1 day'))::int;
  IF acc.due_day > acc.closing_day THEN du := _ref + (least(acc.due_day, last_c) - 1);
  ELSE du := (_ref + interval '1 month')::date + (least(acc.due_day, last_d) - 1); END IF;
  INSERT INTO public.lifepay_invoices(user_id, reference_month, closing_date, due_date)
  VALUES (_user, _ref, cl, du) RETURNING * INTO inv;
  RETURN inv;
END; $$;
REVOKE EXECUTE ON FUNCTION public.lifepay_invoice_for(uuid, date) FROM PUBLIC, anon, authenticated;

-- compra (à vista ou parcelada)
CREATE OR REPLACE FUNCTION public.lifepay_purchase(_card_id uuid, _merchant text, _amount bigint,
  _installments int, _category text, _idem text)
RETURNS public.lifepay_purchases LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); acc public.lifepay_accounts; card public.lifepay_cards;
  p public.lifepay_purchases; inv public.lifepay_invoices;
  i int; base bigint; rest bigint; val bigint; ref date; used bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _idem IS NULL OR length(_idem) < 8 THEN RAISE EXCEPTION 'Requisição inválida'; END IF;
  SELECT * INTO p FROM public.lifepay_purchases WHERE user_id=uid AND idempotency_key=_idem;
  IF FOUND THEN RETURN p; END IF;

  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;
  IF _installments IS NULL OR _installments NOT IN (1,2,3,4,5,6,8,10,12) THEN RAISE EXCEPTION 'Parcelamento inválido'; END IF;
  IF _merchant IS NULL OR length(trim(_merchant))=0 THEN RAISE EXCEPTION 'Informe o estabelecimento'; END IF;

  SELECT * INTO acc FROM public.lifepay_accounts WHERE user_id=uid FOR UPDATE;
  IF acc.status <> 'active' THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;
  SELECT * INTO card FROM public.lifepay_cards WHERE id=_card_id AND user_id=uid AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cartão não encontrado'; END IF;
  IF card.status <> 'active' THEN RAISE EXCEPTION 'Cartão bloqueado'; END IF;
  IF card.expires_at IS NOT NULL AND card.expires_at < now() THEN RAISE EXCEPTION 'Cartão temporário expirado'; END IF;

  IF acc.credit_used + _amount > acc.credit_limit THEN RAISE EXCEPTION 'Limite insuficiente'; END IF;
  SELECT coalesce(sum(ins.amount),0) INTO used FROM public.lifepay_installments ins
    WHERE ins.user_id=uid AND ins.status='open'
      AND ins.purchase_id IN (SELECT id FROM public.lifepay_purchases WHERE card_id=card.id);
  IF used + _amount > card.card_limit THEN RAISE EXCEPTION 'Limite do cartão insuficiente'; END IF;

  INSERT INTO public.lifepay_purchases(user_id, card_id, merchant, category, amount, installments_count, idempotency_key, created_by)
  VALUES (uid, card.id, trim(_merchant), coalesce(nullif(trim(_category),''),'geral'), _amount, _installments, _idem, uid)
  RETURNING * INTO p;

  base := _amount / _installments;
  rest := _amount - (base * _installments);

  ref := date_trunc('month', now())::date;
  IF extract(day from now())::int >= acc.closing_day THEN ref := (ref + interval '1 month')::date; END IF;

  FOR i IN 1.._installments LOOP
    val := base + CASE WHEN i = 1 THEN rest ELSE 0 END;
    inv := public.lifepay_invoice_for(uid, (ref + ((i-1) || ' month')::interval)::date);
    INSERT INTO public.lifepay_installments(purchase_id, user_id, invoice_id, number, total_count, amount, due_date)
    VALUES (p.id, uid, inv.id, i, _installments, val, inv.due_date);
    UPDATE public.lifepay_invoices SET total = total + val WHERE id = inv.id;
  END LOOP;

  UPDATE public.lifepay_accounts SET credit_used = credit_used + _amount WHERE user_id = uid;

  INSERT INTO public.lifepay_transactions(from_user, amount, kind, note, status, key_used)
  VALUES (uid, _amount, 'purchase',
          trim(_merchant) || CASE WHEN _installments > 1 THEN ' • ' || _installments || 'x' ELSE '' END,
          'completed', '•••• ' || card.last4);

  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref, after_data)
  VALUES (uid, 'user', 'purchase', uid, p.id::text,
          jsonb_build_object('amount', _amount, 'installments', _installments, 'merchant', trim(_merchant)));
  RETURN p;
END; $$;

-- pagamento de fatura com saldo
CREATE OR REPLACE FUNCTION public.lifepay_pay_invoice(_invoice_id uuid, _amount bigint, _auth_method text, _idem text)
RETURNS public.lifepay_transactions LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); acc public.lifepay_accounts; inv public.lifepay_invoices;
  tx public.lifepay_transactions; due bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _idem IS NULL OR length(_idem) < 8 THEN RAISE EXCEPTION 'Requisição inválida'; END IF;
  SELECT * INTO tx FROM public.lifepay_transactions WHERE from_user=uid AND idempotency_key=_idem;
  IF FOUND THEN RETURN tx; END IF;

  SELECT * INTO inv FROM public.lifepay_invoices WHERE id=_invoice_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fatura não encontrada'; END IF;
  IF inv.status IN ('paid','canceled') THEN RAISE EXCEPTION 'Fatura já quitada'; END IF;

  due := inv.total - inv.paid;
  IF due <= 0 THEN RAISE EXCEPTION 'Nada a pagar nesta fatura'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;
  IF _amount > due THEN RAISE EXCEPTION 'Valor acima do saldo devedor da fatura'; END IF;

  SELECT * INTO acc FROM public.lifepay_accounts WHERE user_id=uid FOR UPDATE;
  IF acc.status <> 'active' THEN RAISE EXCEPTION 'Conta bloqueada'; END IF;
  IF acc.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;

  UPDATE public.lifepay_accounts
    SET balance = balance - _amount,
        credit_used = greatest(0, credit_used - _amount)
    WHERE user_id = uid;

  UPDATE public.lifepay_invoices
    SET paid = paid + _amount,
        status = CASE WHEN paid + _amount >= total THEN 'paid' ELSE 'partial' END
    WHERE id = inv.id;

  IF inv.paid + _amount >= inv.total THEN
    UPDATE public.lifepay_installments SET status='paid' WHERE invoice_id = inv.id AND status='open';
  END IF;

  INSERT INTO public.lifepay_transactions(from_user, amount, kind, note, status, auth_method,
    from_balance_before, from_balance_after, receipt_code, idempotency_key)
  VALUES (uid, _amount, 'invoice_payment',
          'Fatura ' || to_char(inv.reference_month, 'MM/YYYY'), 'completed', coalesce(_auth_method,'password'),
          acc.balance, acc.balance - _amount, upper(encode(gen_random_bytes(6),'hex')), _idem)
  RETURNING * INTO tx;

  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref, after_data, auth_method)
  VALUES (uid, 'user', 'invoice_payment', uid, inv.id::text,
          jsonb_build_object('amount', _amount, 'invoice', inv.reference_month), coalesce(_auth_method,'password'));
  RETURN tx;
END; $$;
