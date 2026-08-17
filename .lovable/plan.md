# Auditoria técnica — Painel Onb Clientes Cross (`painel_msj9fyji`)

Somente auditoria + plano. Nenhum código alterado, nada publicado.

## 1. Rotas e componentes

- Rota: `/admin/painel-comercial?panel=painel_msj9fyji` (deep link de card via `?card=<id>`), renderizada por `src/pages/admin/AdminLeads.tsx` (3.378 linhas) dentro de `src/layouts/AdminLayout.tsx`.
- Constante do painel: `CROSS_CLIENT_PANEL_ID = "painel_msj9fyji"` (`AdminLeads.tsx:63`); flag `isCrossClientPanel` troca o botão "+ Card" por "+ Add Cliente".
- Componentes do card:
  - `src/components/admin/ClienteCrossDialog.tsx` — criação/edição do cliente (CNPJ único, focal, vendedor).
  - `src/components/admin/CardAttachments.tsx` + `src/lib/cardAttachments.ts` — anexos (PDF, doc/docx, xls/xlsx/csv, jpg/png; 10 MB; bucket `representative-card-attachments`).
  - `src/components/admin/RepresentativeCardComments.tsx` — histórico/comentários com anexos.
  - `src/components/admin/RepresentativeCardTasks.tsx` — tarefas do card.
  - `src/components/admin/NotificationCenter.tsx` — sino de notificações.

## 2. Tabelas e migrations

- `representative_cards` (cards do painel; `panel_id`, `stage_id`, `cnpj`, focal/vendedor; `phone`, `email`, `responsible_user_id` já são opcionais).
- `representative_card_comments`, `representative_card_comment_attachments`.
- `representative_card_attachments` (com `content_sha256` para dedup).
- `representative_card_tasks` (título, `due_at`, `assigned_to`, status, `completed_note`).
- `representative_card_meetings`, `representative_card_dossiers` (existem, pouco usados no fluxo Cross).
- `pipeline_panels`, `pipeline_stages_config` (8 etapas do painel), `pipeline_panel_edit_history`.
- `gmail_sync_runs`, `gmail_processed_messages` (idempotência do worker).
- `notifications` + `notification_deliveries`; RPC `create_notification`.
- Índices únicos parciais: CNPJ único apenas no painel Cross; telefone/e-mail únicos apenas fora dele (migration `20260810134154_...sql`).

## 3. Tarefas, comentários, anexos e notificações (estado atual)

- Tarefas: criar, concluir (com nota) e filtrar (abertas/minhas/vencidas/concluídas). **Não há edição** de título, prazo ou responsável depois de criada; não há exclusão.
- Comentários: criação com anexos; servem como histórico manual. Não há trilha automática de execução (mudança de etapa, upload, ação do worker).
- Anexos: upload/remoção com validação de extensão e tamanho; `content_sha256` gravado pela via MCP.
- Notificações: `notifications.type` tem CHECK fechado com 9 valores (`task_assigned`, `task_updated`, `task_deadline_48h`, `task_deadline_24h`, `comment_mention`, etc.). Qualquer tipo novo do fluxo Cross falha hoje (foi essa a causa do erro no Teste Monnera). Além disso `notifications.lead_id`/`task_id` apontam para `leads`/`lead_tasks`, ou seja, não referenciam cards do painel Cross — hoje as notificações do painel só funcionam com `metadata` + `action_url`.
- Usuários alvo confirmados: Rafael Lucena `d8e99940-…`, maycon.santos `87842ad6-…`, Livia `95871e5b-…`.

## 4. Integrações existentes

- **Supabase (Lovable Cloud)**: RLS, RPCs, storage, edge functions (`mcp`, `gmail-baston-sync`, `send-notification-email`, `send-task-deadline-reminders`, `sync-drive-clients`, etc.).
- **Gmail**: edge function `gmail-baston-sync` via connector gateway `google_mail`, extração com IA (Lovable AI Gateway), dedup por `message_id` e SHA-256 de anexos, cron `gmail-baston-sync-2h` (`0 */2 * * *`, ativo). Hoje só filtra remetentes `@baston.com.br`.
- **Jira**: **não existe** integração no código. Só há um conector Atlassian disponível para o agente, não para o app.
- **Canva**: **não existe** integração no código. Conector Canva também só está disponível no lado do agente.
- Cron ativos: `gmail-baston-sync-2h`, `commercial-proposal-followups-hourly`, `move-inactive-commercial-leads`.

## 5. Fluxo atual de criação e movimentação

1. "+ Add Cliente" abre `ClienteCrossDialog` → valida nome obrigatório e CNPJ único no painel → insere em `representative_cards` na primeira etapa (`Cadastro`).
2. Worker Gmail (a cada 2h) lê e-mails Baston, extrai parceiro/CNPJ/focal/vendedor, cria card se o CNPJ não existir, anexa arquivos e registra em `gmail_processed_messages`.
3. Movimentação: drag-and-drop no board ou via MCP (`mover_cliente_cross_etapa`), atualizando `stage_id`. **Não há registro histórico** dessa movimentação para cards do painel (só `lead_stage_history` para o painel comercial).
4. Etapas: Cadastro → Criação Painel → Material Onboarding Cliente → Recebimento Dados → Cadastro Campanha Manual → Cadastro Campanha integração → Ordem Pagamento → Aguardando Informações.
5. MCP: 23 ferramentas (`src/lib/mcp/tools/*`, deploy em `supabase/functions/mcp`), incluindo o conjunto Cross completo.

## 6. Plano de implementação (próxima etapa)

**Fase A — Base operacional no card**
- Edição/exclusão de tarefas (título, prazo, responsável, status) em `RepresentativeCardTasks.tsx` + policies de UPDATE/DELETE.
- Campo de texto livre/observações estruturadas no card (`ClienteCrossDialog.tsx`).
- Nova tabela `representative_card_history` (ator, ação, etapa origem/destino, payload) + trigger de mudança de `stage_id`, com timeline no detalhe do card.
- Ampliar o CHECK de `notifications.type` com os tipos do fluxo Cross e criar `representative_card_id` na tabela `notifications` (nullable, FK), para notificar Rafael Lucena e Maycon Santos em criação, movimentação, tarefa e bloqueio.

**Fase B — Automação a cada 2h**
- Reaproveitar o cron existente: estender `gmail-baston-sync` (ou nova função `cross-onboarding-worker` chamada pelo mesmo agendamento) para também ler `rafael.lucena@monnera.com.br` e extrair o código alfanumérico do e-mail.
- Prevenção de duplicidade: manter dedup por `message_id`, CNPJ (índice único) e SHA-256 do anexo; registrar tudo em `gmail_processed_messages` e no novo histórico.
- Regra de bloqueio: quando a extração não atingir certeza total (campo obrigatório ausente, CNPJ ambíguo, código não encontrado), o card não avança de etapa, recebe status `bloqueado` + motivo e dispara notificação.

**Fase C — Jira e Canva**
- Jira: conectar o conector Atlassian ao app e criar issue de "Criação do painel Monnera" atribuída a Lívia Fernandes ao entrar na etapa *Criação Painel*; guardar a chave da issue no card e sincronizar o status de volta.
- Canva: conectar o conector Canva ao app e, ao receber o código alfanumérico, gerar cópia do template substituindo `3SAXJF92` na página 12, exportar e anexar o material ao card (etapa *Material Onboarding Cliente*).
- Ambos exigem passo de conexão do conector (cartão de conexão no chat) antes da implementação.

**Arquivos que serão alterados**
- `src/pages/admin/AdminLeads.tsx`, `src/components/admin/RepresentativeCardTasks.tsx`, `RepresentativeCardComments.tsx`, `CardAttachments.tsx`, `ClienteCrossDialog.tsx`, `NotificationCenter.tsx`
- `src/lib/notifications.ts`, `src/lib/cardAttachments.ts`, novos helpers de histórico
- `supabase/functions/gmail-baston-sync/index.ts` (+ novas functions `jira-create-panel-issue`, `canva-generate-material`)
- `src/lib/mcp/tools/*` e `supabase/functions/mcp/index.ts` (novas ferramentas de tarefa/histórico)
- Migrations: histórico, tipos de notificação, campos de bloqueio/código, policies de tarefas

**Perguntas em aberto para a Fase C**
- Chave/projeto Jira e conta da Lívia Fernandes.
- ID do template Canva e qual elemento da página 12 contém `3SAXJF92`.
