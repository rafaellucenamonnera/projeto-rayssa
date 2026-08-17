# Fase A — Base operacional do painel Onb Clientes Cross

Escopo restrito: tarefas, observações, histórico, notificações Cross e bloqueio. Sem Jira, Canva, Gmail, cron ou processamento automático.

## Confirmação dos arquivos e do estado atual

- `src/pages/admin/AdminLeads.tsx` — board do painel (`CROSS_CLIENT_PANEL_ID`), criação/edição de card, drag-and-drop de etapa.
- `src/components/admin/RepresentativeCardTasks.tsx` — hoje só cria, conclui (nota via `window.prompt`) e filtra; sem edição, sem exclusão, sem descrição.
- `src/components/admin/RepresentativeCardComments.tsx` — comentários com anexos (permanece como está).
- `src/components/admin/CardAttachments.tsx` + `src/lib/cardAttachments.ts` — anexos do card (preservados).
- `src/components/admin/ClienteCrossDialog.tsx` — dialog de criação/edição do cliente.
- `src/lib/notifications.ts` + `src/components/admin/NotificationCenter.tsx` — RPC `create_notification`.
- Banco: `representative_card_tasks` (sem `descricao`), `representative_card_attachments`, `notifications` com CHECK fechado em 9 tipos e sem vínculo com cards do painel; policies atuais são "admins e gestores" via `ALL`.

## Migrations (reversíveis, sem apagar dados)

1. `representative_card_tasks`: adicionar `descricao text`, `updated_by uuid`, `deleted_at timestamptz` (exclusão lógica) — nada existente é alterado.
2. Nova tabela `representative_card_history` com `id`, `representative_card_id` (FK), `actor_user_id`, `action text`, `source_stage_id`, `destination_stage_id`, `payload jsonb default '{}'`, `created_at`; GRANTs para `authenticated`/`service_role`, RLS ativa, SELECT/INSERT para admins e gestores com acesso ao painel, sem UPDATE/DELETE (trilha imutável).
3. Trigger `AFTER UPDATE OF stage_id` em `representative_cards` registrando `stage_changed` no histórico com etapa origem/destino e `auth.uid()`.
4. Bloqueio em `representative_cards`: `is_blocked boolean not null default false`, `blocked_reason text`, `blocked_at timestamptz`, `blocked_by uuid`, `blocked_source text`, `unblocked_at timestamptz`. Trigger de etapa recusa a mudança quando `is_blocked = true` (mensagem clara ao usuário).
5. Observações: nova tabela `representative_card_notes` (`representative_card_id`, `content text`, `created_by`, `created_at`, `updated_at`) com histórico de versões via `representative_card_history` — permite salvar, editar e ver o histórico sem virar regra de negócio.
6. Notificações: adicionar `representative_card_id uuid` nullable (FK para `representative_cards`) e ampliar o CHECK de `type` com os tipos Cross (`cross_card_created`, `cross_card_updated`, `cross_stage_changed`, `cross_task_created`, `cross_task_updated`, `cross_task_completed`, `cross_task_deleted`, `cross_attachment_added`, `cross_attachment_removed`, `cross_block_created`, `cross_block_resolved`) preservando os 9 tipos atuais do painel comercial. `create_notification` ganha parâmetro opcional `p_representative_card_id` com default, mantendo todas as chamadas existentes válidas. Policy de SELECT continua "cada usuário lê as suas".

## Alterações de front-end

- `RepresentativeCardTasks.tsx`: formulário de edição inline (título, descrição, prazo, responsável, status), diálogo de conclusão com nota obrigatória (substitui `window.prompt`), exclusão visível apenas para admin, e gravação no histórico + notificação Cross a cada ação.
- Novo `src/components/admin/RepresentativeCardNotes.tsx`: campo de observações operacionais com salvar/editar e lista de versões anteriores.
- Novo `src/components/admin/RepresentativeCardHistory.tsx`: timeline read-only do histórico do card.
- Novo `src/components/admin/RepresentativeCardBlock.tsx`: marcar bloqueio (motivo obrigatório) e resolver bloqueio, com selo visível no card e no board.
- `AdminLeads.tsx`: incluir as novas seções no detalhe do card do painel Cross, exibir selo de bloqueio e impedir arrastar card bloqueado com mensagem explicativa.
- `src/lib/notifications.ts`: suporte a `representativeCardId` e helper `crossCardActionUrl`; payload padronizado com cliente, CNPJ, etapa, motivo, evidência, ação realizada, decisão necessária e próximo passo (renderizado no `NotificationCenter`).
- `src/lib/cardAttachments.ts`: registrar `attachment_added` / `attachment_removed` no histórico (sem mudar formatos aceitos).

## Destinatários

Notificações Cross vão para os usuários com acesso ao painel, garantindo sempre Rafael Lucena e Maycon Santos (resolvidos por perfil no momento do envio, sem IDs fixos em código).

## Testes

- Typecheck e build.
- Verificação via Playwright no painel: criar tarefa, editar, concluir com nota, excluir como admin, salvar/editar observação, bloquear card e tentar mover (deve recusar), conferir timeline e notificações.
- Consultas de leitura para confirmar linhas em `representative_card_history` e `notifications`.

## Entregável do relatório final

Migrations criadas, componentes alterados, policies adicionadas, testes executados e pendências.
