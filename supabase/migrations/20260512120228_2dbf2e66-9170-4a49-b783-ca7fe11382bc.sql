ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS revenue_current_month text,
  ADD COLUMN IF NOT EXISTS revenue_previous_month text;