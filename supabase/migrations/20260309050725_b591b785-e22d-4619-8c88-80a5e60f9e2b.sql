
-- Fix 1: Add role guards + search_path to financial RPCs

CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_mes integer DEFAULT NULL, p_ano integer DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_pago numeric;
  v_pendente numeric;
  v_previsao numeric;
  v_ativos integer;
  result json;
BEGIN
  -- Role guard
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(SUM(valor_comissao), 0) INTO v_pago 
  FROM public.pagamentos_consultores 
  WHERE status_pagamento = 'pago'
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_competencia) = p_mes)
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM data_competencia) = p_ano);

  SELECT COALESCE(SUM(valor_comissao), 0) INTO v_pendente 
  FROM public.pagamentos_consultores 
  WHERE status_pagamento = 'gerado'
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_competencia) = p_mes)
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM data_competencia) = p_ano);

  SELECT COALESCE(SUM((qtd_parcelas - parcelas_pagas) * valor_mensalidade * percentual_consultor), 0) INTO v_previsao
  FROM public.leads
  WHERE status_lead = 'lead_convertido' AND parcelas_pagas < qtd_parcelas;

  SELECT COUNT(*) INTO v_ativos
  FROM public.leads
  WHERE status_lead = 'lead_convertido' AND parcelas_pagas < qtd_parcelas;

  result := json_build_object(
    'valor_pago', v_pago,
    'valor_pendente', v_pendente,
    'previsao_futura', v_previsao,
    'clientes_ativos', v_ativos
  );

  RETURN result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_financeiro_consultores(p_mes integer DEFAULT NULL, p_ano integer DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  result json;
BEGIN
  -- Role guard
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT 
      p.id as parceiro_id,
      p.nome as consultor,
      (SELECT COUNT(*) FROM public.leads l WHERE l.parceiro_id = p.id AND l.status_lead = 'lead_convertido' AND l.parcelas_pagas < l.qtd_parcelas) as clientes_ativos,
      (SELECT COALESCE(SUM(pc.valor_comissao), 0) FROM public.pagamentos_consultores pc WHERE pc.parceiro_id = p.id AND pc.status_pagamento = 'pago' AND (p_mes IS NULL OR EXTRACT(MONTH FROM pc.data_competencia) = p_mes) AND (p_ano IS NULL OR EXTRACT(YEAR FROM pc.data_competencia) = p_ano)) as valor_pago,
      (SELECT COALESCE(SUM(pc.valor_comissao), 0) FROM public.pagamentos_consultores pc WHERE pc.parceiro_id = p.id AND pc.status_pagamento = 'gerado' AND (p_mes IS NULL OR EXTRACT(MONTH FROM pc.data_competencia) = p_mes) AND (p_ano IS NULL OR EXTRACT(YEAR FROM pc.data_competencia) = p_ano)) as valor_pendente,
      (SELECT COALESCE(SUM((l.qtd_parcelas - l.parcelas_pagas) * l.valor_mensalidade * l.percentual_consultor), 0) FROM public.leads l WHERE l.parceiro_id = p.id AND l.status_lead = 'lead_convertido' AND l.parcelas_pagas < l.qtd_parcelas) as previsao_futura
    FROM public.parceiros_comerciais p
    WHERE p.ativo = true
    ORDER BY p.nome
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

-- Fix 2: Set search_path on other functions missing it
CREATE OR REPLACE FUNCTION public.generate_partner_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := 'MNR' || upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.parceiros_comerciais WHERE codigo_parceiro = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_slug(name_input text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
  exists_already BOOLEAN;
BEGIN
  base_slug := lower(trim(name_input));
  base_slug := translate(base_slug, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn');
  base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  
  final_slug := base_slug;
  LOOP
    SELECT EXISTS(SELECT 1 FROM public.parceiros_comerciais WHERE slug_consultor = final_slug) INTO exists_already;
    EXIT WHEN NOT exists_already;
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$function$;

-- Fix 3: Make propostas bucket private
UPDATE storage.buckets SET public = false WHERE id = 'propostas';
