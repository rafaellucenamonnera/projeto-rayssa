CREATE OR REPLACE FUNCTION public.protect_lead_responsible_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    NEW.responsible_user_id := OLD.responsible_user_id;
    RETURN NEW;
  END IF;

  IF NEW.responsible_user_id IS DISTINCT FROM OLD.responsible_user_id THEN
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gestor_conta'::app_role)
      OR public.has_module_permission(auth.uid(), 'leads', 'editar')
    ) THEN
      RAISE EXCEPTION 'Apenas administradores, gestores ou usuários com permissão leads.editar podem alterar o responsável pelo lead';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;