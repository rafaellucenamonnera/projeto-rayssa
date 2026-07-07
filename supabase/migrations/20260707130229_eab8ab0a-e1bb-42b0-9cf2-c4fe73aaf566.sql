CREATE TABLE IF NOT EXISTS public.pipeline_panel_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id text NOT NULL,
  action_type text NOT NULL CHECK (
    action_type IN ('rename_stage', 'add_stage', 'delete_stage', 'rename_panel', 'create_panel', 'delete_panel')
  ),
  summary text NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reverted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_pipeline_panel_edit_history_panel_recent
  ON public.pipeline_panel_edit_history(panel_id, created_at DESC)
  WHERE reverted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pipeline_panel_edit_history TO authenticated;
GRANT ALL ON public.pipeline_panel_edit_history TO service_role;

ALTER TABLE public.pipeline_panel_edit_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal read pipeline panel edit history" ON public.pipeline_panel_edit_history;
CREATE POLICY "internal read pipeline panel edit history"
  ON public.pipeline_panel_edit_history
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );

DROP POLICY IF EXISTS "admins manage pipeline panel edit history" ON public.pipeline_panel_edit_history;
CREATE POLICY "admins manage pipeline panel edit history"
  ON public.pipeline_panel_edit_history
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));