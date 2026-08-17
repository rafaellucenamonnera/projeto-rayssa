ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS cnpj_source text,
  ADD COLUMN IF NOT EXISTS cnpj_snippet text,
  ADD COLUMN IF NOT EXISTS cnpj_candidates jsonb NOT NULL DEFAULT '[]'::jsonb;