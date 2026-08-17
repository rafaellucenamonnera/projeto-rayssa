ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS pending_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS body_snippet text;