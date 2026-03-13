
CREATE OR REPLACE FUNCTION public.register_parceiro(
  p_user_id uuid,
  p_codigo_parceiro text,
  p_nome text,
  p_cpf text,
  p_email text,
  p_telefone_ddd text,
  p_telefone_numero text,
  p_slug_consultor text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result json;
BEGIN
  INSERT INTO public.parceiros_comerciais (
    user_id, codigo_parceiro, nome, cpf, email, telefone_ddd, telefone_numero, slug_consultor
  ) VALUES (
    p_user_id, p_codigo_parceiro, p_nome, p_cpf, p_email, p_telefone_ddd, p_telefone_numero, p_slug_consultor
  )
  RETURNING json_build_object(
    'id', id,
    'nome', nome,
    'codigo_parceiro', codigo_parceiro,
    'slug_consultor', slug_consultor
  ) INTO result;

  RETURN result;
END;
$$;
