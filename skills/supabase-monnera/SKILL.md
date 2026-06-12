---
name: supabase-monnera
description: Use esta skill sempre que uma tarefa envolver banco de dados, tabelas, migrations, queries, RLS, Edge Functions, tipos TypeScript do Supabase, ou qualquer operacao de leitura e escrita no backend do projeto Monnera. Ela e a origem de verdade para o schema de dados, relacionamentos, regras de negocio no backend e padroes de integracao com o cliente Supabase.
---

# Supabase Monnera

## Cliente

Importar sempre de `@/integrations/supabase/client`.
Tipos gerados em `@/integrations/supabase/types.ts` — nao redefinir manualmente.

```ts
import { supabase } from "@/integrations/supabase/client";
```

## Schema Principal — Tabelas e Relacionamentos

### leads
Tabela central do CRM. Representa uma empresa prospectada ou cliente ativo.

Campos essenciais:
- `id` uuid PK
- `nome_fantasia` string (obrigatorio)
- `nome_responsavel` string (obrigatorio)
- `telefone_responsavel` string (obrigatorio)
- `status` string — etapa do pipeline comercial (ver skill pipeline-crm)
- `status_lead` string — estado geral do lead
- `origem` string — canal de entrada
- `panel_id` string — painel ao qual o lead pertence
- `parceiro_id` string — parceiro que cadastrou
- `revenue_total` number — receita total calculada
- `health_status` string — saude do cliente (sucesso)
- `dados_completos` boolean — indica se ficha esta preenchida

Campos financeiros:
- `valor_mensalidade`, `valor_setup`, `valor_campanhas`, `valor_pagamento`
- `revenue_current`, `revenue_previous`, `revenue_variation`
- `csat`, `csat_current`, `csat_previous`, `csat_variation`

Campos de campanha:
- `campaign_status_current`, `campaign_status_previous`
- `campaign_status_current_month`, `campaign_status_previous_month`

### parceiros
Empresas parceiras que indicam leads.
- Relacionamento: `leads.parceiro_id → parceiros.id`

### profiles
Perfil de usuarios internos (admin, gestor_conta).
- `user_id` uuid FK para auth.users
- Relacionamento com `lead_tasks`, `lead_comments`, `notifications`

### user_roles
Roles dos usuarios internos.
- Valores: `admin`, `gestor_conta`

### pipeline_panels
Paineis configuraveis (comercial, sucesso, campanhas).
- `panel_key`: identificador unico do painel
- `panel_type`: tipo do painel

### pipeline_stages_config
Etapas dinamicas por painel.
- `panel_key`: painel ao qual a etapa pertence
- Etapas de sucesso usam prefixo `etapa_sucesso_`
- Etapas de campanhas usam prefixo `etapa_campanhas_`

### lead_tasks
Tarefas vinculadas a leads.
- `status`: pendente | concluida
- `due_at` / `due_date`: prazo
- `assigned_to`: usuario responsavel
- Lembretes automaticos: `reminder_24h_sent_at`, `reminder_48h_sent_at`

### lead_comments
Comentarios internos por etapa do lead.
- Suporta mencoes (`lead_comment_mentions`) e anexos (`lead_comment_attachments`)
- Limite de anexos: 5 por comentario, 10 MB cada

### lead_contatos
Contatos multiplos vinculados a um lead.
- `principal: boolean` — contato principal
- Campos: nome, cargo, email, telefone, empresa

### lead_stage_history
Historico de transicoes de etapa.
- `data_entrada`, `data_saida`, `dias_na_etapa`

### contracts
Contratos gerados para leads convertidos.
- `arquivo_proposta_url`, `contrato_pdf_url`

### notifications
Notificacoes em tempo real.
- `type`: tipo do evento
- `recipient_user_id`: destinatario
- `read_at`: null = nao lida
- `action_url`: link de acao

### Kit de Vendas (tabelas prefixo `kit_`)
- `kit_argumentos`: objecoes e respostas por pilar
- `kit_portfolio`: PDFs de portfolio
- `kit_videos`: videos de apresentacao
- `kit_redes_sociais`: links de redes sociais
- `kit_whatsapp_messages`: mensagens prontas para WhatsApp

### lead_campaign_links
Vincula leads do pipeline comercial ao pipeline de campanhas.
- `success_lead_id → leads.id` (cliente ativo)
- `campaign_lead_id → leads.id` (lead no pipeline de campanhas)

## Edge Functions

Localizacao: `supabase/functions/`

| Funcao | Descricao |
|---|---|
| `admin-create-user` | Cria usuarios internos com role |
| `delete-orphan-user` | Remove usuarios sem perfil |
| `generate-contract` | Gera PDF de contrato para lead convertido |
| `generate-dossie` | Gera dossia completo do lead |
| `send-notification-email` | Envia emails de notificacao |
| `send-task-deadline-reminders` | Lembretes de prazo de tarefas (24h e 48h) |
| `sync-drive-clients` | Sincroniza clientes do Google Drive (roda diariamente as 02:00) |

## Migrations

Localizacao: `supabase/migrations/`
Convencao de nome: `{timestamp}_{uuid}.sql`
Migrations manuais usam nomes descritivos: ex. `20260526182000_partner_conversion_public_flows.sql`

Ao criar uma nova migration:
1. Usar timestamp atual no formato `YYYYMMDDHHMMSS`
2. Toda regra de negocio deve estar no backend (RLS, triggers, functions)
3. Frontend apenas consome e exibe — nao calcular no frontend o que pode ser calculado no banco

## Padroes de Query

```ts
// Busca simples com tipagem
const { data, error } = await supabase
  .from("leads")
  .select("id, nome_fantasia, status, revenue_total")
  .eq("panel_id", panelId)
  .order("data_cadastro", { ascending: false });

// Upsert por chave unica
await supabase
  .from("leads")
  .upsert({ cnpj, nome_fantasia }, { onConflict: "cnpj" });

// Realtime (notificacoes)
supabase
  .channel("notifications")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, handler)
  .subscribe();
```

## RLS — Row Level Security

Toda tabela sensivel tem RLS ativo.
- Usuarios so acessam dados dos seus paineis (`user_panel_permissions`)
- Admins tem acesso irrestrito
- Parceiros so veem seus proprios leads

## Sync com Google Drive

Funcao: `sync-drive-clients`
Chave de deduplicacao: **CNPJ**
Rotina: diaria as 02:00
Campos sincronizados: empresa, CNPJ, responsavel CS, CSAT, impacto, receitas

Consultar `docs/sync-drive-clients.md` para detalhes da integracao.

## Checklist de Backend

Antes de criar ou alterar logica de dados:
- [ ] A regra de negocio esta no banco (trigger, function, RLS)?
- [ ] O frontend so lê e exibe — sem calculos criticos no cliente?
- [ ] A migration tem timestamp unico e nao quebra dados existentes?
- [ ] Upsert usa a chave correta para evitar duplicatas?
- [ ] Edge Functions tratam erros e retornam status HTTP correto?
