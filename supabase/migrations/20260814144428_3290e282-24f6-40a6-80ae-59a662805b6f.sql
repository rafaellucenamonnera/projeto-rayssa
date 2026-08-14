CREATE TABLE public.gmail_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  fetched_count integer NOT NULL DEFAULT 0,
  processed_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  error_details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gmail_sync_runs TO authenticated;
GRANT ALL ON public.gmail_sync_runs TO service_role;
ALTER TABLE public.gmail_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver execucoes do gmail"
  ON public.gmail_sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.gmail_processed_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  thread_id text,
  from_address text,
  subject text,
  received_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  representative_card_id uuid REFERENCES public.representative_cards(id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.gmail_sync_runs(id) ON DELETE SET NULL,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  attachments_count integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gmail_processed_messages_status_check
    CHECK (status IN ('pending','created','duplicate_cnpj','skipped_no_name','error'))
);

CREATE INDEX gmail_processed_messages_thread_idx ON public.gmail_processed_messages(thread_id);
CREATE INDEX gmail_processed_messages_created_idx ON public.gmail_processed_messages(created_at DESC);

GRANT SELECT ON public.gmail_processed_messages TO authenticated;
GRANT ALL ON public.gmail_processed_messages TO service_role;
ALTER TABLE public.gmail_processed_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver mensagens processadas"
  ON public.gmail_processed_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER gmail_processed_messages_updated_at
  BEFORE UPDATE ON public.gmail_processed_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();