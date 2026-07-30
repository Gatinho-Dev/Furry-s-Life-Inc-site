-- 1) Guard trigger: só deve bloquear alterações diretas via API, não as funções oficiais (SECURITY DEFINER rodam como o dono da função)
CREATE OR REPLACE FUNCTION public.lifepay_guard_account_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.credit_used IS DISTINCT FROM OLD.credit_used
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Alteração de saldo ou privilégios não permitida';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Salário e dados funcionais
ALTER TABLE public.lifepay_accounts
  ADD COLUMN IF NOT EXISTS salary_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_day smallint NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS department text;

-- 3) Sem obrigatoriedade de trocar a senha inicial
ALTER TABLE public.lifepay_accounts ALTER COLUMN must_change_password SET DEFAULT false;
ALTER TABLE public.lifepay_accounts ALTER COLUMN first_access_done SET DEFAULT true;
UPDATE public.lifepay_accounts SET must_change_password = false, first_access_done = true
  WHERE must_change_password OR NOT first_access_done;

-- 4) Transferência com origem em saldo ou cartão de crédito (parcelada)
CREATE OR REPLACE FUNCTION public.lifepay_transfer_v3(
  _key text, _amount bigint, _note text, _auth_method text, _idem text,
  _source text DEFAULT 'balance', _card_id uuid DEFAULT NULL, _installments integer DEFAULT 1
) RETURNS public.lifepay_transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  sender public.lifepay_accounts; recipient public.lifepay_accounts;
  target_user uuid; tx public.lifepay_transactions; p public.lifepay_purchases;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _idem IS NULL OR length(_idem) < 8 THEN RAISE EXCEPTION 'Requisição inválida'; END IF;

  SELECT * INTO tx FROM public.lifepay_transactions WHERE from_user = uid AND idempotency_key = _idem;
  IF FOUND THEN RETURN tx; END IF;

  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Informe um valor maior que zero'; END IF;
  IF _key IS NULL OR length(trim(_key)) = 0 THEN RAISE EXCEPTION 'Informe a chave do destinatário'; END IF;
  IF coalesce(_source,'balance') NOT IN ('balance','credit') THEN RAISE EXCEPTION 'Origem inválida'; END IF;

  PERFORM public.ensure_lifepay_account(uid);

  SELECT k.user_id INTO target_user FROM public.lifepay_keys k
    WHERE k.deleted_at IS NULL AND k.status = 'active' AND lower(k.key_value) = lower(trim(_key)) LIMIT 1;
  IF target_user IS NULL THEN RAISE EXCEPTION 'Chave LifePay não encontrada ou inativa'; END IF;
  IF target_user = uid THEN RAISE EXCEPTION 'Não é possível transferir para a própria conta'; END IF;

  SELECT * INTO sender FROM public.lifepay_accounts WHERE user_id = uid FOR UPDATE;
  SELECT * INTO recipient FROM public.lifepay_accounts WHERE user_id = target_user FOR UPDATE;
  IF recipient.user_id IS NULL THEN RAISE EXCEPTION 'Conta do destinatário indisponível'; END IF;
  IF sender.status <> 'active' THEN RAISE EXCEPTION 'Sua conta está bloqueada'; END IF;
  IF recipient.status <> 'active' THEN RAISE EXCEPTION 'A conta do destinatário está bloqueada'; END IF;

  IF coalesce(_source,'balance') = 'balance' THEN
    IF sender.balance < _amount THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
    UPDATE public.lifepay_accounts SET balance = balance - _amount WHERE user_id = uid;
  ELSE
    IF _card_id IS NULL THEN RAISE EXCEPTION 'Selecione o cartão de crédito'; END IF;
    p := public.lifepay_purchase(
      _card_id,
      'Transferência LifePay • ' || coalesce(recipient.full_name, recipient.display_name),
      _amount, coalesce(_installments, 1), 'transferencia', _idem || '-card');
  END IF;

  UPDATE public.lifepay_accounts SET balance = balance + _amount WHERE user_id = target_user;

  INSERT INTO public.lifepay_transactions(from_user, to_user, amount, note, kind, status, key_used, auth_method,
    from_balance_before, from_balance_after, to_balance_before, to_balance_after, receipt_code, idempotency_key)
  VALUES (uid, target_user, _amount,
    nullif(trim(coalesce(_note,'')),''),
    'transfer', 'completed', lower(trim(_key)), coalesce(_auth_method,'password'),
    sender.balance,
    CASE WHEN coalesce(_source,'balance') = 'balance' THEN sender.balance - _amount ELSE sender.balance END,
    recipient.balance, recipient.balance + _amount,
    upper(encode(gen_random_bytes(6),'hex')), _idem)
  RETURNING * INTO tx;

  INSERT INTO public.lifepay_audit_logs(actor_id, actor_kind, action, target_user, target_ref, after_data, auth_method)
  VALUES (uid, 'user', 'transfer', target_user, tx.id::text,
          jsonb_build_object('amount', _amount, 'key', lower(trim(_key)),
                             'source', coalesce(_source,'balance'), 'installments', coalesce(_installments,1)),
          coalesce(_auth_method,'password'));

  RETURN tx;
END;
$function$;

REVOKE ALL ON FUNCTION public.lifepay_transfer_v3(text, bigint, text, text, text, text, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lifepay_transfer_v3(text, bigint, text, text, text, text, uuid, integer) TO authenticated, service_role;