ALTER TABLE public.gmail_processed_messages
  ADD COLUMN IF NOT EXISTS to_address text,
  ADD COLUMN IF NOT EXISTS codigo_encontrado text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_result text,
  ADD COLUMN IF NOT EXISTS pending_reason text,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'triage',
  ADD COLUMN IF NOT EXISTS matched_card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL;

ALTER TABLE public.gmail_processed_messages
  DROP CONSTRAINT IF EXISTS gmail_processed_messages_status_check;

ALTER TABLE public.gmail_processed_messages
  ADD CONSTRAINT gmail_processed_messages_status_check CHECK (status = ANY (ARRAY[
    'pending','created','duplicate_cnpj','skipped_no_name','error',
    'triage_ok','triage_sem_cnpj','triage_sem_nome','triage_sem_codigo',
    'triage_duplicado','triage_ambiguo','triage_fora_do_escopo'
  ]));

ALTER TABLE public.gmail_sync_runs
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'triage';