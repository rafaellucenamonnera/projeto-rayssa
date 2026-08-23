ALTER TABLE public.representative_card_attachments
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.representative_card_tasks(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_rep_card_attachments_task ON public.representative_card_attachments(task_id);