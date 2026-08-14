ALTER TABLE public.representative_card_attachments
  ADD COLUMN IF NOT EXISTS content_sha256 text;

CREATE INDEX IF NOT EXISTS representative_card_attachments_hash_idx
  ON public.representative_card_attachments (representative_card_id, content_sha256);

CREATE TABLE IF NOT EXISTS public.representative_card_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  representative_card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  due_at timestamp with time zone NOT NULL,
  due_date date GENERATED ALWAYS AS ((due_at AT TIME ZONE 'America/Sao_Paulo')::date) STORED,
  assigned_to uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  completed_at timestamp with time zone,
  completed_note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.representative_card_tasks TO authenticated;
GRANT ALL ON public.representative_card_tasks TO service_role;

ALTER TABLE public.representative_card_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read representative card tasks"
  ON public.representative_card_tasks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores write representative card tasks"
  ON public.representative_card_tasks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE INDEX IF NOT EXISTS representative_card_tasks_card_idx
  ON public.representative_card_tasks (representative_card_id, status, due_at);

CREATE TRIGGER update_representative_card_tasks_updated_at
  BEFORE UPDATE ON public.representative_card_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();