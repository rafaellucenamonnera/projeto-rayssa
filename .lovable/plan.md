
## Objetivo

Criar um CRM autônomo para os painéis customizados (Representantes / Embaixadores) sem reaproveitar a tabela `leads`, mantendo Painel Comercial, Sucesso, Onboarding e Campanhas intactos.

## 1. Banco de dados (migration única)

### Tabelas novas

**`representative_cards`**
- `id` uuid PK
- `panel_id` text (referencia `pipeline_panels.id`)
- `stage_id` text (valor de `pipeline_stages_config.value` do painel)
- `full_name`, `phone`, `email` text NOT NULL
- `city`, `state`, `region` text
- `responsible_user_id` uuid (auth.users)
- `created_by_user_id` uuid (auth.users) NOT NULL
- `source` text DEFAULT 'manual'
- `created_at`, `updated_at` timestamptz
- Trigger `set_updated_at`

**`representative_card_comments`**
- `id`, `card_id` (FK cascade), `user_id`, `usuario` text, `comentario` text (max 500), `created_at`

**`representative_card_meetings`**
- `id`, `card_id` (FK cascade), `created_by_user_id`, `meeting_date` date, `meeting_time` time, `title`, `notes`, `realizada` bool, `created_at`, `updated_at`

**`representative_card_dossiers`**
- `id`, `card_id` (FK cascade), `created_by_user_id`, `title`, `description`, `file_url`, `created_at`, `updated_at`

**`representative_card_stage_history`**
- `id`, `card_id`, `stage_id`, `data_entrada`, `data_saida`, `dias_na_etapa`
- Trigger BEFORE INSERT inicial e AFTER UPDATE quando `stage_id` muda (espelha `track_lead_stage_change`).

### Índices
`(panel_id, stage_id)`, `(responsible_user_id)`, `(created_by_user_id)`, `card_id` em todas as filhas.

### RLS (todas as 5 tabelas)
- Admin (`has_role admin`): ALL.
- Gestor de conta (`has_role gestor_conta`): ALL.
- Criador (`created_by_user_id = auth.uid()`): SELECT.
- Responsável (`responsible_user_id = auth.uid()`): SELECT + UPDATE em `representative_cards`; SELECT/INSERT nas tabelas filhas dos cards sob sua responsabilidade.
- Tabelas filhas usam EXISTS via `representative_cards` para herdar permissão.

### Validações por trigger
- `email` formato válido, `full_name` 1–200, `phone` ≤ 30, `comentario` ≤ 500 (CHECK constraints em colunas imutáveis estão OK; validações dependentes de tempo via trigger).

## 2. Frontend — `src/pages/admin/AdminLeads.tsx`

Aplicar **somente** quando `isCustomCrmPanel === true`. Painel Comercial e demais ficam idênticos.

- `loadData`: branch — quando custom, busca `representative_cards` + `representative_card_meetings` + agrupa por `card_id`. Quando não, mantém leads.
- `createRepresentativeCard`: insere em `representative_cards` (já alinhado ao diff do usuário).
- Movimento Kanban: novo handler `handleStageChangeCustom(cardId, newStageId)` que faz UPDATE em `representative_cards.stage_id`. `handleStatusChange` original passa por esse branch quando `isCustomCrmPanel`.
- Filtros: `filterEmpresa` lê `full_name`; `filterResponsibleUser` segue como já está.
- Pular handlers exclusivos de leads quando custom: financeiro, proposta, perdido (motivo), conversão, contrato, dossiê automático, autoGenerateContract — não disparar.
- Card detail (`detailLead`) em modo custom: render simplificado mostrando dados cadastrais, responsável, comentários, reuniões e dossiês desse card.

## 3. Frontend — componentes auxiliares

- **`PipelineKanban`**: já consome `status_lead`. Aceitar prop opcional `stageField` (default `status_lead`) e `onStageChange`. Em modo custom, AdminLeads passa `stageField="stage_id"` e `onStageChange={handleStageChangeCustom}`. Rendering de card simplificado via prop `renderCard` ou flag `customCrmMode`.
- **`LeadImportDialog`** (já tem `customCrmMode`): em modo custom passa a inserir em `representative_cards` (header CSV: full_name, phone, email, city, state, region, responsible_email).
- **`LeadExportButton`** (já tem `customCrmMode`): já lê os campos novos. Sem mudança.
- **Novos componentes** em `src/components/admin/representative-cards/`:
  - `RepresentativeCardComments.tsx` (lista + textarea, insert/select)
  - `RepresentativeCardMeetings.tsx` (lista + form simples)
  - `RepresentativeCardDossiers.tsx` (lista + upload em bucket `propostas` sob `representative-cards/<card_id>/`)
- O dialog de detalhe (`detailOpen`) em modo custom monta apenas: cabeçalho, edição de campos básicos (`full_name`/`phone`/`email`/`city`/`state`/`region`/`responsible_user_id`), e as 3 abas/blocos acima.

## 4. Storage

Reaproveitar bucket existente `propostas`, prefixo `representative-cards/<card_id>/<filename>`. Política já admite admin/gestor; adicionar policy específica para criador/responsável do card via EXISTS em `representative_cards`.

## 5. Fora do escopo

- Não tocar em Painel Comercial, Sucesso, Onboarding, Campanhas.
- Não criar contratos automáticos, dossiê PDF automático, financeiro, propostas, motivo de perda, Google Calendar para esses cards.
- Não alterar `leads`, `lead_comments`, `lead_stage_history`, `reunioes`, `parceiros_comerciais`.

## Ordem de execução

1. Migration (5 tabelas + triggers + RLS + storage policy).
2. Aprovação do usuário na migration.
3. Componentes novos (`RepresentativeCard{Comments,Meetings,Dossiers}`).
4. Refator mínimo de `PipelineKanban` (props `stageField`, `onStageChange`, `customCrmMode`).
5. Branches em `AdminLeads.tsx`: `loadData`, `handleStatusChange`, render do detail, filtros.
6. `LeadImportDialog` branch para insert custom.
7. Smoke test manual (criar card → mover etapa → comentar → reunião → dossiê).
