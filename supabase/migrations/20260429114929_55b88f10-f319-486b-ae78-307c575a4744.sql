-- 1) Contatos independentes
ALTER TABLE public.lead_contatos
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS comentario text;

ALTER TABLE public.lead_contatos
  ALTER COLUMN lead_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_contatos_lead_id_nullable
  ON public.lead_contatos(lead_id);

UPDATE public.lead_contatos
SET comentario = COALESCE(comentario, observacao)
WHERE comentario IS NULL;

-- 2) Permissões por módulo/ação
CREATE TABLE IF NOT EXISTS public.module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  modulo text NOT NULL,
  acao text NOT NULL,
  permitido boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT module_permissions_unique UNIQUE (user_id, modulo, acao)
);

ALTER TABLE public.module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage module_permissions"
ON public.module_permissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users read own module_permissions"
ON public.module_permissions
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3) Auditoria
CREATE TABLE IF NOT EXISTS public.permission_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  modulo text NOT NULL,
  acao text NOT NULL,
  permitido boolean NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read permission logs"
ON public.permission_change_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins insert permission logs"
ON public.permission_change_logs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));