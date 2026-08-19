# Fluxo Onb Clientes Cross sem webhook Jira

Objetivo: obter o Código Monnera do Jira por consulta (polling + botão manual), sem depender de Automation/Webhook, mantendo segurança, rastreabilidade e idempotência.

## 1. Criação manual da tarefa Jira (já existe — ajustes)

`jira-create-panel-task` e `JiraTaskDialog` já implementam: somente admin, etapa Criação Painel, nome + CNPJ confirmados, prévia, justificativa obrigatória, dedupe por card_id/CNPJ/thread/jira_issue_key, gravação da chave no card, `card_field_provenance`, histórico e `automation_runs`.

Ajustes:
- usar `project: { id: "10038" }` (hoje usa a chave `MB`), mantendo tipo `10042`;
- responsável lido diretamente do secret `JIRA_ASSIGNEE_ACCOUNT_ID`; se ausente, erro explícito e nenhuma criação (comportamento atual mantido e reforçado na mensagem de UI).

## 2. Nova Edge Function `jira-sync-panel-tasks`

Leitura da API Jira (`/rest/api/3/search` no projeto 10038 + `/comment` da issue). Para cada tarefa do fluxo Monnera:
- associação por `jira_issue_key` → `card_id` no texto → `thread_id` → CNPJ → nome exato; qualquer ambiguidade (0 ou >1 card) não aplica nada e registra `ambiguidade` em `automation_runs`;
- extrai o código de descrição, comentários ou campo configurável (`JIRA_CODE_FIELD_ID`, opcional);
- valida com `_shared/monneraCode.ts` (8 caracteres A-Z0-9; rejeita `3SAXJF92`, `UB5PXGDB`, `XXXXXXX`, `XXXXXXXX` e qualquer `MNR-`/com hífen);
- rejeita código já usado por outro CNPJ no painel;
- aplica via `apply_monnera_code_to_card` com `p_source = 'jira_polling'`, grava evidência em `card_field_provenance`, atualiza `jira_issue_status`/`jira_synced_at`;
- idempotência: se o card já tem o mesmo código, marca `ignorado`; código diferente gera `divergencia` + notificação, sem sobrescrever;
- nunca move o card e nunca toca em ORCA LOGÍSTICA (lista de cards protegidos);
- **modo geral desligado**: só processa cards com `test_mode = true` enquanto a chave de ativação global estiver off.

Lote e cursor: novo registro em `sync_job_logs` (tipo `jira_polling`) guardando `last_issue_updated_at` e `last_issue_key`; lote padrão de 10 issues por execução, retomando do cursor. Bloqueio single-flight por lease com expiração para evitar execuções concorrentes.

## 3. Botão "Sincronizar código Jira" no card

Novo bloco na UI do card (ao lado de "Criar tarefa Jira"), visível só para admin e só quando existe `jira_issue_key`:
- passo 1 (`dry_run`): consulta apenas a issue vinculada e mostra o código encontrado, a origem (descrição / comentário #N / campo) e o trecho de evidência;
- passo 2: confirmação administrativa explícita grava o código, com usuário responsável registrado em `card_field_provenance`, histórico do card e `automation_runs` (`origin: manual_jira_sync`).

Nenhuma gravação ocorre no passo 1.

## 4. Cron de 2 horas

O agendamento existente passa a chamar `jira-sync-panel-tasks` (além do worker Gmail). Lotes pequenos, cursor persistido, retomada, sem duplicar eventos, sem mover cards.

## 5. Fluxo posterior ao código

Após código válido: o card recebe o código e o card **não** é movido. A etapa Canva continua manual (link público colado e validado em `CanvaPublicLinkSection`), conforme a decisão anterior de não usar `CANVA_ACCESS_TOKEN`. Só com código válido + link `https://canva.link/...` confirmado + sem bloqueios o card pode ir para `Material Onboarding Cliente`, e o onboarding segue as validações já existentes em `send-onboarding-email`.

Observação: a geração automática/idempotente do Canva citada no item 5 exige o token do Canva; sem ele, mantemos a entrada manual. Se quiser a geração automática, é preciso fornecer o secret.

## 6. Webhook

`jira-code-webhook` permanece publicado e funcional (inclusive o modo ping), porém opcional. Nenhuma etapa do fluxo depende dele.

## 7. Segurança e limites

Sem follow-up, sem régua, sem cobrança, sem WhatsApp. RLS preservada; a função usa service role apenas no servidor. Modo geral desligado; teste inicial exclusivamente no card `TESTE FASE A QA`; ORCA LOGÍSTICA intocada.

## Escopo técnico

Migrations:
1. `jira_sync_state` (cursor + lease single-flight: `id`, `last_issue_updated_at`, `last_issue_key`, `locked_until`, `paused`, `updated_at`) com RLS de leitura para admin e GRANTs; escrita apenas por service_role.
2. Índice único parcial em `representative_cards (panel_id, codigo_monnera)` para impedir reuso do mesmo código por CNPJs diferentes (se ainda não existir).

Edge Functions:
- nova: `supabase/functions/jira-sync-panel-tasks/index.ts` (polling em lote, chamada pelo cron);
- nova: `supabase/functions/jira-sync-card-code/index.ts` (prévia + confirmação de um único card, chamada pelo botão);
- ajuste: `jira-create-panel-task` (project id 10038).

Frontend:
- `src/components/admin/JiraTaskDialog.tsx`: adiciona o botão "Sincronizar código Jira" com prévia e confirmação.

Secrets necessários (todos já configurados; nenhum novo obrigatório):
`ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_ASSIGNEE_ACCOUNT_ID`. Opcional: `JIRA_CODE_FIELD_ID` (id do campo customizado, se o código for preenchido em campo próprio).

Garantia durante a implementação: nenhuma tarefa Jira, card, e-mail ou material Canva real será criado. As funções só executam quando invocadas; a validação será feita em modo prévia e, quando houver escrita, apenas no card `TESTE FASE A QA`.
