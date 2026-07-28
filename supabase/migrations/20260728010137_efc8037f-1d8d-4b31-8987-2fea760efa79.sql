CREATE TABLE public.lifepay_webauthn_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  device_label text NOT NULL DEFAULT 'Este dispositivo',
  transports text[],
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lifepay_webauthn_credentials TO authenticated;
GRANT ALL ON public.lifepay_webauthn_credentials TO service_role;
ALTER TABLE public.lifepay_webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webauthn_select_own" ON public.lifepay_webauthn_credentials
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER lifepay_webauthn_credentials_touch
  BEFORE UPDATE ON public.lifepay_webauthn_credentials
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX lifepay_webauthn_credentials_user_idx ON public.lifepay_webauthn_credentials(user_id);

CREATE TABLE public.lifepay_webauthn_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.lifepay_webauthn_challenges TO service_role;
ALTER TABLE public.lifepay_webauthn_challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX lifepay_webauthn_challenges_user_idx ON public.lifepay_webauthn_challenges(user_id, purpose);