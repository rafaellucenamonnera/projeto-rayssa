
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'success_panel_rule_priority') THEN
    CREATE TYPE public.success_panel_rule_priority AS ENUM ('baixa', 'media', 'alta', 'critica');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.success_customers (
  contratante_cnpj text PRIMARY KEY CHECK (contratante_cnpj ~ '^[0-9]{14}$'),
  mes_referencia date,
  razao_social text,
  nome_fantasia text,
  tipo_contratante text,
  segmento text,
  municipio text,
  uf text,
  meses_monnera integer,
  mensalidade numeric(14,2),
  quantidade_empresas integer,
  quantidade_empresas_ativas integer,
  status_campanha text,
  classificacao text,
  prioridade public.success_panel_rule_priority,
  motivo_classificacao text,
  acao_recomendada text,
  receita_transferencias numeric(14,2) NOT NULL DEFAULT 0,
  receita_campanhas numeric(14,2) NOT NULL DEFAULT 0,
  receita_ordem_pagamento numeric(14,2) NOT NULL DEFAULT 0,
  receita_servicos_outros numeric(14,2) NOT NULL DEFAULT 0,
  venda_total numeric(16,2) NOT NULL DEFAULT 0,
  venda_premiada numeric(16,2) NOT NULL DEFAULT 0,
  aderencia numeric(8,4),
  dias_sem_sincronizacao_media numeric(10,2),
  dias_atraso_venda_media numeric(10,2),
  quantidade_cnpjs_sem_sincronizacao integer NOT NULL DEFAULT 0,
  quantidade_cnpjs_atraso_venda integer NOT NULL DEFAULT 0,
  source_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.success_customers TO authenticated;
GRANT ALL ON public.success_customers TO service_role;

ALTER TABLE public.success_customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_success_customers_prioridade
  ON public.success_customers (prioridade, razao_social);

CREATE TABLE IF NOT EXISTS public.success_customer_assignments (
  contratante_cnpj text PRIMARY KEY CHECK (contratante_cnpj ~ '^[0-9]{14}$'),
  cs_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cs_name_snapshot text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.success_customer_assignments TO authenticated;
GRANT ALL ON public.success_customer_assignments TO service_role;

ALTER TABLE public.success_customer_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.success_customer_feedback_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contratante_cnpj text NOT NULL CHECK (contratante_cnpj ~ '^[0-9]{14}$'),
  survey_month date NOT NULL,
  csat_exp integer CHECK (csat_exp BETWEEN 0 AND 5),
  csat_dono integer CHECK (csat_dono BETWEEN 0 AND 5),
  nps integer CHECK (nps BETWEEN 0 AND 10),
  filled_at timestamptz NOT NULL DEFAULT now(),
  filled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contratante_cnpj, survey_month)
);

GRANT SELECT, INSERT, UPDATE ON public.success_customer_feedback_history TO authenticated;
GRANT ALL ON public.success_customer_feedback_history TO service_role;

ALTER TABLE public.success_customer_feedback_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_success_feedback_customer_month
  ON public.success_customer_feedback_history (contratante_cnpj, survey_month DESC);

-- Policies
DROP POLICY IF EXISTS "Authenticated users can read success customers" ON public.success_customers;
CREATE POLICY "Authenticated users can read success customers"
  ON public.success_customers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read success customer assignments" ON public.success_customer_assignments;
CREATE POLICY "Authenticated users can read success customer assignments"
  ON public.success_customer_assignments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read success customer feedback" ON public.success_customer_feedback_history;
CREATE POLICY "Authenticated users can read success customer feedback"
  ON public.success_customer_feedback_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and gestores can manage success customer assignments" ON public.success_customer_assignments;
CREATE POLICY "Admins and gestores can manage success customer assignments"
  ON public.success_customer_assignments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role));

DROP POLICY IF EXISTS "Admins and gestores can manage success customer feedback" ON public.success_customer_feedback_history;
CREATE POLICY "Admins and gestores can manage success customer feedback"
  ON public.success_customer_feedback_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role));

-- View
CREATE OR REPLACE VIEW public.success_customer_cards_view
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
