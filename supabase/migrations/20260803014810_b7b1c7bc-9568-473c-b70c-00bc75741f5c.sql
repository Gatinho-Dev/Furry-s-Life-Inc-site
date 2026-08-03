-- ============ Caixa de entrada de e-mails do domínio ============
CREATE TABLE public.mail_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_address text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound','outbound')),
  folder text NOT NULL DEFAULT 'inbox' CHECK (folder IN ('inbox','sent','archive','spam','trash')),
  from_address text NOT NULL,
  from_name text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  snippet text NOT NULL DEFAULT '',
  text_body text,
  html_body text,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  provider_message_id text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mail_messages_user_idx ON public.mail_messages (user_id, folder, received_at DESC);
CREATE INDEX mail_messages_mailbox_idx ON public.mail_messages (lower(mailbox_address), received_at DESC);
CREATE UNIQUE INDEX mail_messages_provider_uidx ON public.mail_messages (provider_message_id) WHERE provider_message_id IS NOT NULL;

GRANT SELECT, UPDATE, DELETE ON public.mail_messages TO authenticated;
GRANT ALL ON public.mail_messages TO service_role;
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mail: read own" ON public.mail_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_ceo_or_admin(auth.uid()));
CREATE POLICY "mail: update own" ON public.mail_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "mail: delete own" ON public.mail_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER mail_messages_updated_at BEFORE UPDATE ON public.mail_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Links de pagamento (Receber) ============
CREATE TABLE public.lifepay_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  amount bigint NOT NULL CHECK (amount > 0),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','canceled')),
  expires_at timestamptz NOT NULL,
  paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at timestamptz,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lifepay_payreq_user_idx ON public.lifepay_payment_requests (user_id, created_at DESC);

GRANT SELECT ON public.lifepay_payment_requests TO authenticated;
GRANT ALL ON public.lifepay_payment_requests TO service_role;
ALTER TABLE public.lifepay_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payreq: read own" ON public.lifepay_payment_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR paid_by = auth.uid() OR public.is_ceo_or_admin(auth.uid()));

CREATE TRIGGER lifepay_payreq_updated_at BEFORE UPDATE ON public.lifepay_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Avisos internos do LifePay ============
CREATE TABLE public.lifepay_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lifepay_notif_user_idx ON public.lifepay_notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.lifepay_notifications TO authenticated;
GRANT ALL ON public.lifepay_notifications TO service_role;
ALTER TABLE public.lifepay_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif: read own" ON public.lifepay_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "notif: update own" ON public.lifepay_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());