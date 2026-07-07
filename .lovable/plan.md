## Objetivo

Espelhar cards do Painel Comercial em `contrato_assinado` para a coluna **"Contrato assinado"** (`etapa_onboarding_1777497467069`) do painel Onboarding, sem alterar o original. Apenas backend/Supabase.

## Estratégia contra divergência de schema

A cópia é feita com **SQL dinâmico**: cada coluna candidata só entra no INSERT se existir em `information_schema.columns` para `public.leads`. O SQL final executado nunca referencia colunas inexistentes — vale tanto no ambiente local do usuário quanto no Cloud.

## Migration 1 — enum (isolada, precisa commitar antes da 2)

```sql
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'etapa_onboarding_1777497467069';
```

## Migration 2 — tabela, função, trigger, backfill

### 2.1 Tabela `public.lead_onboarding_links`

```sql
CREATE TABLE public.lead_onboarding_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  onboarding_lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (commercial_lead_id),
  UNIQUE (onboarding_lead_id)
);
GRANT SELECT ON public.lead_onboarding_links TO authenticated;
GRANT ALL    ON public.lead_onboarding_links TO service_role;
ALTER TABLE public.lead_onboarding_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/gestor podem ler vinculos"
  ON public.lead_onboarding_links FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );
```

Sem policy de INSERT/UPDATE/DELETE — mutações apenas via SECURITY DEFINER; `service_role` bypassa RLS.

### 2.2 Função `ensure_onboarding_card_from_contract_signed(p_lead_id uuid) RETURNS uuid`

`LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`.

Fluxo:
1. Ler `panel_id, status_lead` do lead; sair (`RETURN NULL`) se não existir, se `panel_id NOT IN ('comercial','comerc')`, ou se `status_lead::text <> 'contrato_assinado'`.
2. `IF NOT EXISTS (SELECT 1 FROM pipeline_stages_config WHERE panel_key='onboarding' AND value='etapa_onboarding_1777497467069') THEN RAISE EXCEPTION ...`.
3. Idempotência: se já existe vínculo em `lead_onboarding_links.commercial_lead_id = p_lead_id`, retornar o `onboarding_lead_id` existente.
4. `PERFORM set_config('app.system_lead_update','on', true);`
5. Montar INSERT dinâmico. Cada coluna abaixo só entra se existir em `information_schema.columns` (`table_schema='public' AND table_name='leads'`) — o SQL final executado é sempre válido contra o schema real. Nenhuma coluna inexistente é referenciada.

   **Candidatos a copiar** (interseção com colunas reais):
   `cidade, cnpj, campaign_status_current, campaign_status_current_month, campaign_status_previous, campaign_status_previous_month, categoria, consultor, cpf_responsavel, csat, csat_current, csat_current_month, csat_direction, csat_previous, csat_previous_month, csat_variation, data_contrato_assinado, descricao_necessidade, email_responsavel, endereco_cep, endereco_estado, endereco_numero, endereco_rua, erp_utilizado, health_status, impact_level, juros_recebidos, multas_recebidas, nome_fantasia, nome_responsavel, parceiro_id, percentual_consultor, qtd_parcelas, quantidade_funcionarios, quantidade_lojas, razao_social, receita_taxa_boleto, receita_transferencias, responsavel_comercial_email, responsavel_comercial_nome, responsavel_comercial_telefone, responsavel_rh_email, responsavel_rh_nome, responsavel_rh_telefone, responsavel_tecnico_email, responsavel_tecnico_nome, responsavel_tecnico_telefone, responsible_user_id, revenue_breakdown, revenue_current, revenue_current_month, revenue_previous, revenue_previous_month, revenue_total, revenue_variation, status, telefone_responsavel, valor_campanhas, valor_campanhas_anterior, valor_mensalidade, valor_mensalidade_anterior, valor_pagamento, valor_pagamento_anterior`

   **Overrides fixos** (só entram se a coluna existir em `leads` — não hardcodar):
   - `panel_id = 'onboarding'`
   - `status_lead = 'etapa_onboarding_1777497467069'::public.lead_status`
   - `origem = 'copia_automatica_comercial'`
   - `completion_token = NULL`
   - `dados_completos = true`
   - `parcelas_pagas = NULL`
   - `proposta_url = NULL`, `numero_proposta = NULL`, `contrato_url = NULL`
   - `motivo_perda = NULL`

   **Overrides condicionais** (também via checagem de `information_schema`):
   - `dados_contrato_completos = true`
   - `auto_lost_at = NULL`
   - `auto_lost_reason = NULL`

   Colunas de override são excluídas da lista de cópia para não duplicar. **Nunca copiar/setar**: `id`, `data_cadastro`, `financeiro_preenchido_*`, `financeiro_editado_*`.

   Executar via `EXECUTE format('INSERT INTO public.leads (%s) SELECT %s FROM public.leads WHERE id = $1 RETURNING id', cols_sql, vals_sql) USING p_lead_id INTO v_new_id;`.
6. `INSERT INTO public.lead_onboarding_links(commercial_lead_id, onboarding_lead_id) VALUES (p_lead_id, v_new_id);`
7. `RETURN v_new_id;`

### 2.3 Trigger

```sql
CREATE OR REPLACE FUNCTION public.trg_leads_ensure_onboarding_card_fn()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public.ensure_onboarding_card_from_contract_signed(NEW.id);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_leads_ensure_onboarding_card
AFTER INSERT OR UPDATE OF status_lead, panel_id ON public.leads
FOR EACH ROW
WHEN (NEW.panel_id IN ('comercial','comerc')
      AND NEW.status_lead::text = 'contrato_assinado')
EXECUTE FUNCTION public.trg_leads_ensure_onboarding_card_fn();
```

Card cópia (`panel_id='onboarding'`) não satisfaz o `WHEN` → sem recursão.

### 2.4 Revogar execução pública das funções SECURITY DEFINER

```sql
REVOKE ALL ON FUNCTION public.ensure_onboarding_card_from_contract_signed(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_leads_ensure_onboarding_card_fn() FROM PUBLIC, anon, authenticated;
```

Triggers seguem executando (não dependem de permissão do chamador).

### 2.5 Backfill (fim da Migration 2)

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.leads
     WHERE panel_id IN ('comercial','comerc')
       AND status_lead::text = 'contrato_assinado'
  LOOP
    PERFORM public.ensure_onboarding_card_from_contract_signed(r.id);
  END LOOP;
END $$;
```

## Evidência após aplicar

```sql
SELECT count(*) AS cards_origem_contrato_assinado
  FROM public.leads
 WHERE panel_id IN ('comercial','comerc')
   AND status_lead::text='contrato_assinado';

SELECT count(*) AS vinculos_onboarding FROM public.lead_onboarding_links;

SELECT count(*) AS cards_destino_onboarding
  FROM public.leads
 WHERE panel_id='onboarding'
   AND status_lead::text='etapa_onboarding_1777497467069';
```

## Fora do escopo
Frontend, rotas, componentes, edge functions, outros painéis/etapas.
