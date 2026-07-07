## Objetivo

Automatizar o fluxo **Painel de Treinamento → Campanhas**: quando um card em `panel_id = 'painel_mrb33dc3'` entrar na etapa `etapa_painel_mrb33dc3_2` ("Integração Finalizada"), gerar automaticamente um card-espelho em `panel_id = 'campanhas'` na coluna `etapa_campanhas_1781056513527` ("Treinamento Painel"). Card original permanece. Idempotente via tabela dedicada `lead_training_panel_campaign_links`. **Não** reutiliza `lead_campaign_links`; fluxo Sucesso→Campanhas fica intacto.

## Pré-check (rodo antes da Migration 2)

```sql
SELECT value, label
FROM public.pipeline_stages_config
WHERE (panel_key = 'painel_mrb33dc3' AND value = 'etapa_painel_mrb33dc3_2')
   OR (panel_key = 'campanhas'      AND value = 'etapa_campanhas_1781056513527');
```
Esperado: 2 linhas. Se faltar alguma, aborto.

## Migration 1 — `20260707174916_add_training_panel_campaign_links_and_stages.sql`

Escopo: tabela de vínculo + upsert defensivo das duas stages. Sem função, sem trigger, sem `ALTER TYPE`.

- `CREATE TABLE IF NOT EXISTS public.lead_training_panel_campaign_links`:
  - `id uuid primary key default gen_random_uuid()`
  - `source_lead_id uuid not null references public.leads(id) on delete cascade`
  - `campaign_lead_id uuid not null references public.leads(id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - `UNIQUE (source_lead_id)`, `UNIQUE (campaign_lead_id)`
  - índices em `source_lead_id` e `campaign_lead_id`
- GRANTs:
  - `GRANT SELECT ON public.lead_training_panel_campaign_links TO authenticated;`
  - `GRANT ALL ON public.lead_training_panel_campaign_links TO service_role;`
  - `REVOKE INSERT, UPDATE, DELETE ON public.lead_training_panel_campaign_links FROM authenticated;`
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
- Policy de leitura só para staff, com cast explícito:
  ```sql
  CREATE POLICY "Staff read lead_training_panel_campaign_links"
    ON public.lead_training_panel_campaign_links
    FOR SELECT TO authenticated
    USING (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
    );
  ```
- Upsert defensivo em `pipeline_stages_config` com `ON CONFLICT (panel_key, value) DO UPDATE SET label = EXCLUDED.label` (não mexe em `sort_order`):
  - `('painel_mrb33dc3', 'etapa_painel_mrb33dc3_2', 'Integração Finalizada')`
  - `('campanhas', 'etapa_campanhas_1781056513527', 'Treinamento Painel')`

## Migration 2 — `20260707174917_auto_training_panel_to_campaigns.sql`

Escopo: função `ensure_training_panel_campaign_card`, trigger em `public.leads`, backfill idempotente. **Sem cast para `lead_status`** (`leads.status_lead` é `text`).

### `public.ensure_training_panel_campaign_card(p_lead_id uuid) RETURNS uuid`

`LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public`. Sequência:

1. Ler `panel_id`, `status_lead` do lead. Se não achar, retorna NULL.
2. Guard: só age se `panel_id = 'painel_mrb33dc3'` e `status_lead = 'etapa_painel_mrb33dc3_2'`.
3. **Lock contra corrida** antes de qualquer leitura/insert do vínculo:
   ```sql
   PERFORM pg_advisory_xact_lock(hashtextextended(p_lead_id::text, 0));
   ```
4. Verificar destino em `pipeline_stages_config` (`panel_key='campanhas' AND value='etapa_campanhas_1781056513527'`); se ausente, `RAISE EXCEPTION`.
5. Idempotência: se existir linha em `lead_training_panel_campaign_links` com `source_lead_id = p_lead_id`, retorna o `campaign_lead_id` existente.
6. `PERFORM set_config('app.system_lead_update', 'on', true);` para bypass do `protect_lead_anon_token_update`.
7. INSERT dinâmico em `public.leads` (padrão `ensure_onboarding_card_from_contract_signed`: checa `information_schema.columns` antes de incluir cada coluna):
   - **Copiar do origem** (quando coluna existir): `nome_fantasia`, `razao_social`, `cnpj`, `nome_responsavel`, `telefone_responsavel`, `email_responsavel`, `parceiro_id`, `cidade`, `consultor`, `health_status`, `impact_level`, `quantidade_lojas`, `quantidade_funcionarios`, `descricao_necessidade`, `erp_utilizado`, `responsavel_comercial_nome/telefone/email`, `responsavel_tecnico_nome/telefone/email`, `responsavel_rh_nome/telefone/email`.
   - **Overrides fixos** (aplicados só se a coluna existir), **sem cast para enum**:
     - `panel_id = 'campanhas'`
     - `status = 'campanha'`
     - `status_lead = 'etapa_campanhas_1781056513527'`   ← literal text
     - `origem = 'copia_automatica_treinamento_painel'`
     - `dados_completos = true`
     - `dados_contrato_completos = true`
     - `completion_token = NULL`
     - `parcelas_pagas = NULL`
     - `proposta_url = NULL`
     - `numero_proposta = NULL`
     - `contrato_url = NULL`
     - `motivo_perda = NULL`
     - `auto_lost_at = NULL`
     - `auto_lost_reason = NULL`
   - **Não copiar**: financeiros (`valor_setup/mensalidade/campanhas/pagamento`, `percentual_consultor`, `qtd_parcelas`, `revenue_*`, `receita_*`, `juros_recebidos`, `multas_recebidas`), documentos (`proposta_url`, `numero_proposta`, `contrato_url`), controle/timestamps (`id`, `data_cadastro`, `created_at`, `updated_at`, `completion_token`).
8. `INSERT INTO public.lead_training_panel_campaign_links (source_lead_id, campaign_lead_id) VALUES (p_lead_id, v_new_id);`
9. Retorna `v_new_id`.

### `public.trg_leads_ensure_training_panel_campaign_card_fn()`

`LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public`. Trigger:
```
AFTER INSERT OR UPDATE OF status_lead, panel_id ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_leads_ensure_training_panel_campaign_card_fn();
```
Lógica:
- Só chama `ensure_training_panel_campaign_card(NEW.id)` se:
  - `NEW.panel_id = 'painel_mrb33dc3'` **e** `NEW.status_lead = 'etapa_painel_mrb33dc3_2'`, **e**
  - `TG_OP = 'INSERT'` **ou** (`OLD.status_lead IS DISTINCT FROM NEW.status_lead` **OR** `OLD.panel_id IS DISTINCT FROM NEW.panel_id`).
- Retorna `NEW`.

### Revogar execução pública das funções `SECURITY DEFINER`

```sql
REVOKE ALL ON FUNCTION public.ensure_training_panel_campaign_card(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_leads_ensure_training_panel_campaign_card_fn()
  FROM PUBLIC, anon, authenticated;
```
(Trigger continua funcionando: é executada com privilégio do owner.)

### Backfill idempotente

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.leads
    WHERE panel_id = 'painel_mrb33dc3'
      AND status_lead = 'etapa_painel_mrb33dc3_2'
      AND id NOT IN (SELECT source_lead_id FROM public.lead_training_panel_campaign_links)
  LOOP
    PERFORM public.ensure_training_panel_campaign_card(r.id);
  END LOOP;
END $$;
```

## Aplicação

Duas chamadas separadas ao `supabase--migration`, na ordem 1 → 2 (transações independentes).

## Retorno pós-aplicação

```sql
SELECT count(*) AS cards_origem
FROM public.leads
WHERE panel_id='painel_mrb33dc3' AND status_lead='etapa_painel_mrb33dc3_2';

SELECT count(*) AS vinculos FROM public.lead_training_panel_campaign_links;

SELECT count(*) AS cards_destino
FROM public.leads
WHERE panel_id='campanhas' AND status_lead='etapa_campanhas_1781056513527';
```

## Validação

- Card original permanece em `painel_mrb33dc3` (nenhum UPDATE nele).
- Cópia aparece em Campanhas na coluna "Treinamento Painel".
- Re-rodar o backfill não duplica (`UNIQUE(source_lead_id)` + filtro `NOT IN` + advisory lock).
- Reentrar na etapa de origem não duplica (função retorna o `campaign_lead_id` existente).
- `lead_campaign_links`, policies e código Sucesso→Campanhas ficam intocados.
- Nenhuma alteração de frontend nesta task.
