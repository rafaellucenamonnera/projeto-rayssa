ALTER TABLE public.onboarding_email_sends
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS thread_id text,
  ADD COLUMN IF NOT EXISTS template_name text NOT NULL DEFAULT 'onboarding-parceiro-baston',
  ADD COLUMN IF NOT EXISTS template_version text NOT NULL DEFAULT 'v2',
  ADD COLUMN IF NOT EXISTS gmail_account text,
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_onboarding_email_sends_message_id
  ON public.onboarding_email_sends (message_id);