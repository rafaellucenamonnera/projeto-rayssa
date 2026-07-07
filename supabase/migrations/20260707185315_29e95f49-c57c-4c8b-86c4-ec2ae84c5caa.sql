CREATE OR REPLACE FUNCTION public.prevent_partner_self_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    NEW.aprovado := OLD.aprovado;
    NEW.ativo := OLD.ativo;
    NEW.cpf := OLD.cpf;
    NEW.codigo_parceiro := OLD.codigo_parceiro;
    NEW.slug_consultor := OLD.slug_consultor;
    NEW.email := OLD.email;
  END IF;
  RETURN NEW;
END;
$$;