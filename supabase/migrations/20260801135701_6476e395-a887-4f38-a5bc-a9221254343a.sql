ALTER TABLE public.lifepay_accounts
  ADD COLUMN IF NOT EXISTS is_worker boolean NOT NULL DEFAULT false;

UPDATE public.lifepay_accounts
SET is_worker = true
WHERE job_title IS NOT NULL OR department IS NOT NULL OR salary_cents > 0;