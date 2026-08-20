ALTER TABLE public.onboarding_email_sends
  ADD COLUMN IF NOT EXISTS is_resend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resend_of uuid REFERENCES public.onboarding_email_sends(id) ON DELETE SET NULL;