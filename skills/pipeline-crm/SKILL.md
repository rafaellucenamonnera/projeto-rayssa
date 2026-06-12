---
name: pipeline-crm
description: Use esta skill sempre que uma tarefa envolver o pipeline comercial do CRM Monnera: etapas de venda, kanban, transicao de leads, reunioes, propostas, contratos, motivo de perda, fluxo de campanhas, score de priorizacao ou qualquer logica de progressao de leads no funil. Ela e a origem de verdade para as etapas, regras de transicao e comportamento do pipeline.
---

# Pipeline CRM Monnera

## Etapas do Pipeline Comercial

Definidas em `src/lib/pipelineConstants.ts`.

| value | label | descricao |
|---|---|---|
| `novo_lead` | Lead | Lead recém-cadastrado |
| `contato_realizado` | Contato Realizado | Primeiro contato feito |
| `reuniao_agendada` | Reunião Agendada | Reuniao marcada com o cliente |
| `reuniao_realizada` | Reunião Realizada | Reuniao ocorreu |
| `proposta_enviada` | Proposta Enviada | Proposta comercial enviada |
| `lead_convertido` | Lead Convertido | Cliente fechou negocio |
| `contrato_enviado` | Contrato Enviado | Contrato enviado para assinatura |
| `contrato_assinado` | Contrato Assinado | Contrato assinado — cliente ativo |
| `lead_perdido` | Lead Perdido | Negocio nao fechado |

Legacy: `proposta_comercial` mapeia para `proposta_enviada`.

## Helpers

```ts
import { PIPELINE_STAGES, PIPELINE_LABELS, getPipelineStageLabel, getPipelineStageOrder } from "@/lib/pipelineConstants";

// Obter label de uma etapa
getPipelineStageLabel("novo_lead"); // "Lead"

// Obter ordem numerica
getPipelineStageOrder("proposta_enviada"); // 4
```

## Componentes Principais

### PipelineKanban (`src/components/admin/PipelineKanban.tsx`)
Visualizacao em colunas drag-and-drop. Cada coluna = uma etapa.
- Drag entre colunas muda o `status` do lead
- Exibe DaysInStage (dias na etapa atual)
- Suporta filtros por responsavel, parceiro, periodo

### AgendarReuniaoDialog / EditReuniaoDialog
- Agendar reuniao vinculada ao lead
- Campos: data, hora, participantes, link/local
- Ao agendar: status muda para `reuniao_agendada`

### LeadReuniao (`src/components/admin/LeadReuniao.tsx`)
- Listagem e gerenciamento das reunioes do lead

### PropostaUploadDialog
- Upload de proposta PDF
- Armazena em `leads.proposta_url`
- Muda status para `proposta_enviada`

### LeadPerdidoDialog
- Registra motivo da perda
- Campo `leads.motivo_perda`
- Move para etapa `lead_perdido`

### CadastroFinanceiroDialog
- Preenche dados financeiros apos conversao
- Campos: valor mensalidade, setup, campanhas, pagamento
- Marca `leads.dados_completos = true`

## Fluxo de Criacao de Campanhas

Apos conversao, um lead ativo pode iniciar campanha.
Constantes em `src/lib/campaignFlow.ts`:

```ts
// Etapa de sucesso que dispara criacao de campanha
SUCESSO_STAGE_CRIACAO_CAMPANHA = "etapa_sucesso_1777903393480"

// Etapas no pipeline de campanhas
CAMPANHAS_STAGE_CONSTRUCAO        = "etapa_campanhas_1781056513527"
CAMPANHAS_STAGE_PRIMEIRA          = "etapa_campanhas_1781056626070"
CAMPANHAS_STAGE_AGUARDANDO_CLIENTE = "etapa_campanhas_1781056849363"
CAMPANHAS_STAGE_EM_EXECUCAO       = "etapa_campanhas_1781056861987"
CAMPANHAS_STAGE_CONCLUIDA         = "etapa_campanhas_1781057426192"

// SLAs
SLA_SUCESSO_TO_CAMPANHA_HOURS = 48          // 48h para mover de sucesso para campanha
SLA_CAMPANHAS_AGUARDANDO_CLIENTE_HOURS = 24 // 24h em aguardando cliente
```

Tabela `lead_campaign_links` vincula:
- `success_lead_id` — cliente no painel de sucesso
- `campaign_lead_id` — lead no pipeline de campanhas

## Historico de Etapas

Tabela `lead_stage_history`:
- Registra automaticamente cada transicao
- Calcula `dias_na_etapa` ao sair da etapa
- Componente `DaysInStage` exibe tempo atual na etapa

## Importacao e Exportacao

### LeadImportDialog
- Upload de CSV com leads em lote
- Validacao de campos obrigatorios antes de importar

### LeadExportButton
- Exporta leads filtrados para CSV
- Respeita filtros ativos no kanban

## Tarefas e Comentarios no Lead

### LeadTasks (`src/components/admin/LeadTasks.tsx`)
- Tarefas vinculadas ao lead com prazo e responsavel
- Status: `pendente` | `concluida`
- Lembretes automaticos 24h e 48h antes do prazo (Edge Function)

### LeadComments (`src/components/admin/LeadComments.tsx`)
- Historico de comentarios por etapa
- Suporte a mencoes `@usuario`
- Anexos: ate 5 por comentario, maximo 10 MB cada
- Tipos aceitos: imagens, PDF, CSV, XLS/XLSX

### LeadContatos (`src/components/admin/LeadContatos.tsx`)
- Multiplos contatos por lead
- Um contato marcado como `principal`

## Paineis Dinamicos

Paineis configurados na tabela `pipeline_panels`.
- `panel_type`: tipo do painel (`comercial`, `sucesso`, `campanhas`)
- Etapas proprias por painel via `pipeline_stages_config`
- Permissoes por usuario via `user_panel_permissions`

## Regras de Negocio

- Status `lead_perdido` exige preenchimento de `motivo_perda`
- Status `lead_convertido` dispara geracao de numero de proposta
- Status `contrato_assinado` dispara `generate-contract` (Edge Function)
- Toda transicao registra entrada em `lead_stage_history`
- `dados_completos` so fica `true` quando ficha financeira esta preenchida

## Checklist de Pipeline

Ao implementar qualquer feature de pipeline:
- [ ] A transicao de etapa registra em `lead_stage_history`?
- [ ] Campos obrigatorios da etapa estao validados antes da transicao?
- [ ] O componente kanban reflete o novo estado sem necessitar reload completo?
- [ ] SLAs relevantes estao sendo respeitados?
- [ ] A permissao do usuario sobre o painel foi verificada?
