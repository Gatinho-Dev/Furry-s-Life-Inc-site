-- 1. Email queue helper functions: fixed search_path + no public execute
CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
 RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN
    PERFORM pgmq.create(dlq_name);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN
    PERFORM pgmq.delete(source_queue, message_id);
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
 RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$function$;

-- 2. Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_queue_wake() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_lifepay() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_lifepay_account(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_sub_role(uuid, public.subsidiary, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_subsidiary_access(uuid, public.subsidiary) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_ceo_or_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lifepay_transfer(text, bigint, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.lifepay_admin_adjust(text, bigint, text) FROM anon;

-- 3. profiles: owner or admin only
DROP POLICY IF EXISTS "anyone authed reads profiles" ON public.profiles;
CREATE POLICY "profiles: self or admin read" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_ceo_or_admin(auth.uid()));

-- 4. lifepay_accounts: owner or admin read
DROP POLICY IF EXISTS "lifepay accounts: read all" ON public.lifepay_accounts;
CREATE POLICY "lifepay accounts: self or admin read" ON public.lifepay_accounts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ceo_or_admin(auth.uid()));

-- Pix key lookup without exposing balances
CREATE OR REPLACE FUNCTION public.lifepay_lookup_pix(_pix text)
RETURNS TABLE(display_name text, pix_key text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.display_name, a.pix_key
  FROM public.lifepay_accounts a
  WHERE auth.uid() IS NOT NULL
    AND lower(a.pix_key) = lower(trim(_pix))
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.lifepay_lookup_pix(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.lifepay_lookup_pix(text) TO authenticated;

-- 5. Prevent self-escalation of balance / is_admin on own row
CREATE OR REPLACE FUNCTION public.lifepay_guard_account_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) IN ('service_role','postgres') THEN
    RETURN NEW;
  END IF;
  IF NEW.balance IS DISTINCT FROM OLD.balance
     OR NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Alteração de saldo ou privilégios não permitida';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lifepay_guard_account_update() FROM anon, authenticated;

DROP TRIGGER IF EXISTS lifepay_guard_account_update_trg ON public.lifepay_accounts;
CREATE TRIGGER lifepay_guard_account_update_trg
  BEFORE UPDATE ON public.lifepay_accounts
  FOR EACH ROW EXECUTE FUNCTION public.lifepay_guard_account_update();