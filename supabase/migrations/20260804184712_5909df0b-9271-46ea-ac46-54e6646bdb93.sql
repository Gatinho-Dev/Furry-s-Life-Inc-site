CREATE OR REPLACE FUNCTION public.guard_notification_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Somente o estado de leitura da notificação pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_notification_update_trg ON public.lifepay_notifications;
CREATE TRIGGER guard_notification_update_trg
  BEFORE UPDATE ON public.lifepay_notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_update();

CREATE OR REPLACE FUNCTION public.guard_mail_message_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.mailbox_address IS DISTINCT FROM OLD.mailbox_address
     OR NEW.direction IS DISTINCT FROM OLD.direction
     OR NEW.from_address IS DISTINCT FROM OLD.from_address
     OR NEW.from_name IS DISTINCT FROM OLD.from_name
     OR NEW.to_addresses IS DISTINCT FROM OLD.to_addresses
     OR NEW.cc_addresses IS DISTINCT FROM OLD.cc_addresses
     OR NEW.subject IS DISTINCT FROM OLD.subject
     OR NEW.snippet IS DISTINCT FROM OLD.snippet
     OR NEW.text_body IS DISTINCT FROM OLD.text_body
     OR NEW.html_body IS DISTINCT FROM OLD.html_body
     OR NEW.attachments IS DISTINCT FROM OLD.attachments
     OR NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id
     OR NEW.received_at IS DISTINCT FROM OLD.received_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Somente pasta, leitura e estrela podem ser alterados';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_mail_message_update_trg ON public.mail_messages;
CREATE TRIGGER guard_mail_message_update_trg
  BEFORE UPDATE ON public.mail_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_mail_message_update();

REVOKE EXECUTE ON FUNCTION public.guard_notification_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_mail_message_update() FROM anon, authenticated;