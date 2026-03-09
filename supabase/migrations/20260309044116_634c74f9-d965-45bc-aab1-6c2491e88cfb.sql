
-- Replace get_financeiro_dashboard with version accepting optional month/year
CREATE OR REPLACE FUNCTION public.get_financeiro_dashboard(p_mes integer DEFAULT NULL, p_ano integer DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_pago numeric;
  v_pendente numeric;
  v_previsao numeric;
  v_ativos integer;
  result json;
BEGIN
  -- Somar pagos (filtrado por competência se informado)
  SELECT COALESCE(SUM(valor_comissao), 0) INTO v_pago 
  FROM public.pagamentos_consultores 
  WHERE status_pagamento = 'pago'
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_competencia) = p_mes)
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM data_competencia) = p_ano);

  -- Somar pendentes
  SELECT COALESCE(SUM(valor_comissao), 0) INTO v_pendente 
  FROM public.pagamentos_consultores 
  WHERE status_pagamento = 'gerado'
    AND (p_mes IS NULL OR EXTRACT(MONTH FROM data_competencia) = p_mes)
    AND (p_ano IS NULL OR EXTRACT(YEAR FROM data_competencia) = p_ano);

  -- Calcular previsão futura (não filtra por período pois é projeção)
  SELECT COALESCE(SUM((qtd_parcelas - parcelas_pagas) * valor_mensalidade * percentual_consultor), 0) INTO v_previsao
  FROM public.leads
  WHERE status_lead = 'lead_convertido' AND parcelas_pagas < qtd_parcelas;

  -- Contar clientes ativos (não filtra por período)
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

-- Replace get_financeiro_consultores with version accepting optional month/year
CREATE OR REPLACE FUNCTION public.get_financeiro_consultores(p_mes integer DEFAULT NULL, p_ano integer DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT 
      p.id as parceiro_id,
      p.nome as consultor,
      (
        SELECT COUNT(*) 
        FROM public.leads l 
        WHERE l.parceiro_id = p.id AND l.status_lead = 'lead_convertido' AND l.parcelas_pagas < l.qtd_parcelas
      ) as clientes_ativos,
      (
        SELECT COALESCE(SUM(pc.valor_comissao), 0) 
        FROM public.pagamentos_consultores pc 
        WHERE pc.parceiro_id = p.id AND pc.status_pagamento = 'pago'
          AND (p_mes IS NULL OR EXTRACT(MONTH FROM pc.data_competencia) = p_mes)
          AND (p_ano IS NULL OR EXTRACT(YEAR FROM pc.data_competencia) = p_ano)
      ) as valor_pago,
      (
        SELECT COALESCE(SUM(pc.valor_comissao), 0) 
        FROM public.pagamentos_consultores pc 
        WHERE pc.parceiro_id = p.id AND pc.status_pagamento = 'gerado'
          AND (p_mes IS NULL OR EXTRACT(MONTH FROM pc.data_competencia) = p_mes)
          AND (p_ano IS NULL OR EXTRACT(YEAR FROM pc.data_competencia) = p_ano)
      ) as valor_pendente,
      (
        SELECT COALESCE(SUM((l.qtd_parcelas - l.parcelas_pagas) * l.valor_mensalidade * l.percentual_consultor), 0)
        FROM public.leads l
        WHERE l.parceiro_id = p.id AND l.status_lead = 'lead_convertido' AND l.parcelas_pagas < l.qtd_parcelas
      ) as previsao_futura
    FROM public.parceiros_comerciais p
    WHERE p.ativo = true
    ORDER BY p.nome
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;
