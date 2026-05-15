ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS can_be_responsible boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET can_be_responsible = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role IN ('admin','gestor_conta')
);