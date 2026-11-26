-- Life+ · identidade documental v2
-- Adiciona contato institucional por e-mail, assinatura visual, estilo do papel
-- timbrado, setor emissor e modelo padrão por tipo. Tudo idempotente.

ALTER TABLE public.lp_settings ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.lp_settings ADD COLUMN IF NOT EXISTS signature_url text;

ALTER TABLE public.lp_templates ADD COLUMN IF NOT EXISTS style jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.lp_templates ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE public.lp_templates ADD COLUMN IF NOT EXISTS signature_url text;
ALTER TABLE public.lp_templates ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS lp_templates_default_idx ON public.lp_templates (kind) WHERE is_default;

-- Status documentais completos: rascunho, aguardando aprovação, finalizado,
-- arquivado e cancelado.
ALTER TABLE public.lp_documents DROP CONSTRAINT IF EXISTS lp_documents_status_check;
ALTER TABLE public.lp_documents
  ADD CONSTRAINT lp_documents_status_check
  CHECK (status IN ('rascunho', 'aguardando', 'finalizado', 'arquivado', 'cancelado'));
