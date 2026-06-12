---
name: painel-sucesso
description: Use esta skill sempre que uma tarefa envolver o Painel de Sucesso da Monnera: saude de clientes, health status, CSAT, receita, score de priorizacao, sincronizacao com Google Drive, interacoes CS, pipeline de campanhas ou qualquer feature do pos-venda e customer success. Ela e a origem de verdade para logica, indicadores e regras do painel de sucesso.
---

# Painel de Sucesso Monnera

## Objetivo

Central operacional de **saude de clientes ativos**. Monitora receita, CSAT, interacoes e campanhas para que o time de CS priorize atencao onde e mais necessario.

Referencia de arquitetura: `docs/prompt-lovable-crm-monnera.md`

## Isolamento

Este painel e isolado dos outros:
- `panel_type = sucesso`
- Logica, indicadores, automacoes e permissoes proprias
- Nao herdar regras do pipeline comercial

## Dados do Cliente (lead ativo)

Campos relevantes na tabela `leads` para o painel de sucesso:

### Receita
- `revenue_total = mensalidade + campanha + ordem_pagamento`
- `revenue_current` / `revenue_current_month` — receita do mes atual
- `revenue_previous` / `revenue_previous_month` — receita do mes anterior
- `revenue_variation` — variacao percentual: `((atual - anterior) / anterior) * 100`

### CSAT
- `csat` — score atual
- `csat_current` / `csat_current_month`
- `csat_previous` / `csat_previous_month`
- `csat_variation` — variacao
- `csat_direction` — tendencia (up/down)

### Campanha
- `campaign_status_current` / `campaign_status_current_month`
- `campaign_status_previous` / `campaign_status_previous_month`

### Saude
- `health_status` — classificacao de saude do cliente
- `impact_level` — nivel de impacto financeiro
- `impacto` — descricao do impacto
- `risco` — nivel de risco

Cores de health status: importar de `src/lib/healthStatusColors.ts`

## Sincronizacao com Google Drive

Edge Function: `sync-drive-clients`
Documentacao: `docs/sync-drive-clients.md`

Rotina: **diaria as 02:00**
Chave de deduplicacao: **CNPJ** (`leads.cnpj`)

Regras:
- CNPJ ja existe: atualizar campos
- CNPJ nao existe: criar novo lead com `status = contrato_assinado`

Campos sincronizados do Drive:
- Empresa → `nome_fantasia`
- CNPJ → `cnpj`
- Responsavel CS → `consultor`
- CSAT → `csat`
- Impacto → `impacto`
- Receita Mensalidade → `valor_mensalidade`
- Receita Campanha → `valor_campanhas`
- Receita Ordem de Pagamento → `valor_pagamento`

## Score de Priorizacao

Calculado no backend. Fatores:
- Impacto financeiro (`impact_level`)
- Queda de receita (`revenue_variation` negativo)
- CSAT baixo ou em queda
- Dias sem interacao
- Status de campanha critica

Exibir no card: valor atual + percentual + tendencia (↑ verde / ↓ vermelho).

## Interacoes CS

Origem: comentarios (`lead_comments`) e logs internos.

Calcular e exibir:
- Ultima interacao (data do comentario mais recente)
- Quantidade de interacoes no periodo
- Dias sem interacao
- Consultor responsavel (`leads.consultor`)
- Responsavel atual (`leads.responsible_user_id`)

## Pipeline de Campanhas

Etapas (constantes em `src/lib/campaignFlow.ts`):

| Constante | Descricao |
|---|---|
| `CAMPANHAS_STAGE_CONSTRUCAO` | Campanha em construcao |
| `CAMPANHAS_STAGE_PRIMEIRA` | Primeira campanha |
| `CAMPANHAS_STAGE_AGUARDANDO_CLIENTE` | Aguardando aprovacao do cliente |
| `CAMPANHAS_STAGE_EM_EXECUCAO` | Campanha em execucao |
| `CAMPANHAS_STAGE_CONCLUIDA` | Campanha concluida |

SLAs:
- Sucesso → Campanha: **48h** (`SLA_SUCESSO_TO_CAMPANHA_HOURS`)
- Aguardando cliente: **24h** (`SLA_CAMPANHAS_AGUARDANDO_CLIENTE_HOURS`)

Vinculo: tabela `lead_campaign_links`
- `success_lead_id` — cliente no painel de sucesso
- `campaign_lead_id` — lead no pipeline de campanhas

Etapa de sucesso que dispara criacao: `SUCESSO_STAGE_CRIACAO_CAMPANHA`

## Geracao de Dossie

Edge Function: `generate-dossie`
Gera PDF completo com historico, indicadores e interacoes do cliente.

## Regras de Negocio

- Todo calculo de receita e CSAT deve ocorrer no backend
- Frontend apenas exibe — nao recalcular no cliente
- Clientes sincronizados do Drive entram como `contrato_assinado`
- CNPJ e chave unica — nunca duplicar clientes
- Health status e score calculados por funcao SQL ou Edge Function

## Checklist do Painel de Sucesso

Ao implementar features de sucesso:
- [ ] O `panel_type = sucesso` esta isolado de outros paineis?
- [ ] Receita e CSAT estao sendo lidos do banco (nao calculados no frontend)?
- [ ] Sync com Drive usa CNPJ como chave de deduplicacao?
- [ ] Score de priorizacao considera todos os fatores relevantes?
- [ ] Dias sem interacao e calculado com base em `lead_comments`?
- [ ] SLAs do pipeline de campanhas estao sendo monitorados?
