-- Grant admin permissions for configuracao_painel module
INSERT INTO public.module_permissions (user_id, modulo, acao, permitido)
SELECT ur.user_id, 'configuracao_painel', a.acao, true
FROM public.user_roles ur
CROSS JOIN (VALUES ('visualizar'),('editar'),('criar_estagio'),('excluir_estagio')) AS a(acao)
WHERE ur.role = 'admin'
ON CONFLICT (user_id, modulo, acao) DO NOTHING;

-- Duplicate card RPC
CREATE OR REPLACE FUNCTION public.duplicate_card(card_id uuid, target_stage_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT (has_role(v_uid, 'admin') OR has_role(v_uid, 'gestor_conta')) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  INSERT INTO public.leads (
    nome_fantasia, nome_responsavel, email_responsavel, telefone_responsavel, cidade, cnpj, erp_utilizado,
    quantidade_funcionarios, descricao_necessidade, origem, parceiro_id, status_lead, valor_setup, valor_mensalidade,
    qtd_parcelas, quantidade_lojas, valor_campanhas, percentual_consultor, motivo_perda
  )
  SELECT nome_fantasia, nome_responsavel, email_responsavel, telefone_responsavel, cidade, cnpj, erp_utilizado,
    quantidade_funcionarios, descricao_necessidade, origem, parceiro_id, target_stage_id::lead_status, valor_setup, valor_mensalidade,
    qtd_parcelas, quantidade_lojas, valor_campanhas, percentual_consultor, motivo_perda
  FROM public.leads WHERE id = card_id
  RETURNING id INTO new_id;

  INSERT INTO public.lead_comments (lead_id, user_id, usuario, etapa, comentario)
  VALUES (new_id, v_uid, 'Sistema', target_stage_id, 'Card duplicado do lead ' || card_id::text);

  RETURN new_id;
END;
$$;