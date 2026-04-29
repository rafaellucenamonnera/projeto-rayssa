ALTER TABLE public.lead_contatos
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS comentario text,
  ALTER COLUMN lead_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_lead_contato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.nome IS NULL OR length(trim(NEW.nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do contato é obrigatório';
  END IF;
  IF length(NEW.nome) > 200 THEN
    RAISE EXCEPTION 'Nome excede 200 caracteres';
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email <> '' AND NEW.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  IF NEW.telefone IS NOT NULL AND length(NEW.telefone) > 30 THEN
    RAISE EXCEPTION 'Telefone excede 30 caracteres';
  END IF;
  IF NEW.cargo IS NOT NULL AND length(NEW.cargo) > 120 THEN
    RAISE EXCEPTION 'Cargo excede 120 caracteres';
  END IF;
  IF NEW.observacao IS NOT NULL AND length(NEW.observacao) > 500 THEN
    RAISE EXCEPTION 'Observação excede 500 caracteres';
  END IF;
  IF NEW.empresa IS NOT NULL AND length(NEW.empresa) > 200 THEN
    RAISE EXCEPTION 'Empresa excede 200 caracteres';
  END IF;
  IF NEW.comentario IS NOT NULL AND length(NEW.comentario) > 500 THEN
    RAISE EXCEPTION 'Comentário excede 500 caracteres';
  END IF;
  RETURN NEW;
END;
$function$;