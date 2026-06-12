
-- Stage column for Painel Sucesso kanban
ALTER TABLE public.success_customers
  ADD COLUMN IF NOT EXISTS stage_id text;

-- Backfill from prioridade when null
UPDATE public.success_customers
SET stage_id = CASE prioridade
  WHEN 'critica' THEN 'critico'
  WHEN 'alta'    THEN 'risco'
  WHEN 'media'   THEN 'monitorar'
  WHEN 'baixa'   THEN 'saudavel'
  ELSE 'monitorar'
END
WHERE stage_id IS NULL;

ALTER TABLE public.success_customers
  ALTER COLUMN stage_id SET DEFAULT 'monitorar',
  ALTER COLUMN stage_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_success_customers_stage
  ON public.success_customers (stage_id);

-- Allow admin / gestor_conta to update stage_id (and other moderation fields)
DROP POLICY IF EXISTS "Admins and gestores can update success customers" ON public.success_customers;
CREATE POLICY "Admins and gestores can update success customers"
  ON public.success_customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
           OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role));

GRANT UPDATE (stage_id) ON public.success_customers TO authenticated;

-- Recreate view including stage_id
DROP VIEW IF EXISTS public.success_customer_cards_view;
CREATE VIEW public.success_customer_cards_view
WITH (security_invoker = true) AS
WITH latest_feedback AS (
  SELECT DISTINCT ON (contratante_cnpj)
    contratante_cnpj, survey_month, csat_exp, csat_dono, nps, filled_at, filled_by
  FROM public.success_customer_feedback_history
  ORDER BY contratante_cnpj, survey_month DESC, filled_at DESC
)
SELECT
  p.contratante_cnpj, p.mes_referencia, p.razao_social, p.nome_fantasia,
  p.tipo_contratante, p.segmento, p.municipio, p.uf, p.meses_monnera, p.mensalidade,
  p.quantidade_empresas, p.quantidade_empresas_ativas, p.status_campanha,
  p.classificacao, p.prioridade, p.motivo_classificacao, p.acao_recomendada,
  p.stage_id,
  p.receita_transferencias, p.receita_campanhas, p.receita_ordem_pagamento,
  p.receita_servicos_outros, p.venda_total, p.venda_premiada, p.aderencia,
  p.dias_sem_sincronizacao_media, p.dias_atraso_venda_media,
  p.quantidade_cnpjs_sem_sincronizacao, p.quantidade_cnpjs_atraso_venda,
  a.cs_user_id, a.cs_name_snapshot,
  f.survey_month, f.csat_exp, f.csat_dono, f.nps, f.filled_at,
  p.updated_at
FROM public.success_customers p
LEFT JOIN public.success_customer_assignments a ON a.contratante_cnpj = p.contratante_cnpj
LEFT JOIN latest_feedback f ON f.contratante_cnpj = p.contratante_cnpj;

GRANT SELECT ON public.success_customer_cards_view TO authenticated;
