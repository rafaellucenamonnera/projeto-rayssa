
ALTER TABLE public.parceiros_comerciais
  ADD COLUMN IF NOT EXISTS cliente_monnera boolean,
  ADD COLUMN IF NOT EXISTS cliente_monnera_cnpj text;

CREATE UNIQUE INDEX IF NOT EXISTS parceiros_comerciais_cpf_key
  ON public.parceiros_comerciais (cpf);
CREATE UNIQUE INDEX IF NOT EXISTS parceiros_comerciais_email_key
  ON public.parceiros_comerciais (email);

DROP FUNCTION IF EXISTS public.register_parceiro(uuid,text,text,text,text,text,text,text);

CREATE OR REPLACE FUNCTION public.register_parceiro(
  p_user_id uuid,
  p_codigo_parceiro text,
  p_nome text,
  p_cpf text,
  p_email text,
  p_telefone_ddd text,
  p_telefone_numero text,
  p_slug_consultor text,
  p_cliente_monnera boolean,
  p_cliente_monnera_cnpj text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Não autorizado: user_id não corresponde ao usuário autenticado';
  END IF;

  INSERT INTO public.parceiros_comerciais (
    user_id, codigo_parceiro, nome, cpf, email, telefone_ddd, telefone_numero,
    slug_consultor, cliente_monnera, cliente_monnera_cnpj
  ) VALUES (
    p_user_id, p_codigo_parceiro, p_nome, p_cpf, p_email, p_telefone_ddd, p_telefone_numero,
    p_slug_consultor, p_cliente_monnera, p_cliente_monnera_cnpj
  )
  RETURNING json_build_object(
    'id', id,
    'nome', nome,
    'codigo_parceiro', codigo_parceiro,
    'slug_consultor', slug_consultor
  ) INTO result;

  RETURN result;
END;
$function$;
