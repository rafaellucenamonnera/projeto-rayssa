CREATE TABLE public.user_panel_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  panel_id text NOT NULL,
  can_access boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, panel_id)
);

ALTER TABLE public.user_panel_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user_panel_permissions"
ON public.user_panel_permissions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users read own panel permissions"
ON public.user_panel_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_user_panel_permissions_user ON public.user_panel_permissions(user_id);

CREATE TRIGGER trg_user_panel_permissions_updated_at
BEFORE UPDATE ON public.user_panel_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();