# Fluxo pós-código Monnera — plano de implementação em 6 fases (revisão 3)

Objetivo: transformar a cadeia hoje quebrada (código → Canva → HTML → e-mail → movimentação) em um fluxo orquestrado, idempotente e auditável.

Regras invariantes:
- Padrão `dry_run = true`, ativação controlada, **um card por execução**, allowlist exclusiva `TESTE FASE A QA`.
- **Validação de etapa exclusivamente pelo `stage_id` oficial do painel** (`painel_msj9fyji`); o label de `pipeline_stages_config` é usado apenas para exibição e mensagens.
- O orquestrador **nunca inicia automaticamente** para cards na etapa `Cadastro`.
- Ausência de código Monnera **não bloqueia** `Cadastro`; o código só é obrigatório em `Criação Painel`.
- `QATEST01` é aceito **somente** no card `TESTE FASE A QA` com `test_mode = true`; em qualquer card real é rejeitado como código inválido.
- **ORCA LOGÍSTICA permanece protegida e sem qualquer alteração**, em dry-run ou execução real (bloqueio por `protected_entities` + trigger de banco, verificado no gate de entrada de toda etapa).

---

## FASE 1 — Jira (somente diagnóstico)

- Rodar `jira-create-panel-task?check=1`: secrets → `/myself` → `/project/{key}` → `/mypermissions` → `/createmeta`.
- Confirmar conta de serviço, projeto, board, tipo de issue e `CREATE_ISSUES` com `havePermission === true`.
- **Não criar tarefas**, **não alterar secrets**, `jira_sync_state.read_only` permanece `true` durante toda a fase.
- A criação da tarefa Jira do card QA só ocorre após autorização administrativa explícita **e** confirmação de `CREATE_ISSUES`.

Aceite: relatório completo; zero issues criadas; zero secrets alterados; `read_only` inalterado.

---

## FASE 2 — Dados do card

Migrations:
1. `representative_cards.codigo_recebido_at timestamptz null`; backfill conservador via `card_field_provenance` do campo `codigo_monnera`, senão nulo.
2. Correção pontual do `canva_public_url` do card QA para `canva.link/...`.

Validação Canva unificada (`src/lib/canvaLink.ts` + `supabase/functions/_shared/canvaLink.ts`):
- **Aceito exclusivamente**: `https://canva.link/<token>`.
- Rejeitado: `/edit`, `canva.com/design/...`, `canva.com/d/s_...` e também `https://www.canva.com/d/<token>` (hoje aceito no backend — passa a ser rejeitado nos dois lados).

`origin_thread_id`: preenchido apenas por vínculo comprovado em `card_source_links`. Para o QA, **somente uma thread de teste real e controlada, com evidência registrada** (`card_source_links` + `automation_runs`). Nenhuma thread de cliente real será associada.

---

## FASE 3 — Orquestrador `cross-onboarding-advance`

```text
codigo_validado -> canva_pendente -> canva_pronto -> html_pronto
    -> email_pendente -> email_enviado -> card_movido
```

Gate de entrada (falha = parada sem efeito):
- `stage_id` do card igual ao `stage_id` oficial de `Criação Painel` do painel Cross;
- código Monnera válido aplicado (8 caracteres A-Z/0-9, não demonstrativo; `QATEST01` só com `test_mode = true` no card QA);
- card não bloqueado, não protegido, ausente de `protected_entities`;
- vínculo Jira confirmado (`jira_issue_key` presente e resolvível);
- card na allowlist de QA enquanto o modo controlado estiver ativo.

Gates por etapa:
| Etapa | Gate |
|---|---|
| `codigo_validado` | gate de entrada + `codigo_recebido_at` registrado |
| `canva_pendente` | código válido; ainda sem link público válido |
| `canva_pronto` | `canva_public_url` no formato `canva.link/...`, confirmado por integração oficial ou inserção manual válida |
| `html_pronto` | render sem placeholders órfãos + checklist da Fase 5 aprovado |
| `email_pendente` | thread comprovada + destinatários validados + sem envio prévio |
| `email_enviado` | resposta 2xx da API Gmail **com `message_id` persistido** |
| `card_movido` | `email_enviado = sucesso` com `message_id` |

Migration — `cross_onboarding_steps`: `id`, `card_id`, `step`, `status` (`pendente|executando|sucesso|bloqueado|erro|pendencia_manual`), `attempt`, `gate_result jsonb`, `error`, `payload jsonb`, `codigo_monnera`, `jira_issue_key`, `thread_id`, `message_id`, `started_at`, `finished_at`, `created_at`, `updated_at`. GRANT `SELECT` para `authenticated`, `ALL` para `service_role`; RLS: leitura `admin`/`gestor_conta`, escrita apenas `service_role`.

Deduplicação transacional e contextual (sem índices únicos globais): toda escrita ocorre dentro de uma função `SECURITY DEFINER` com `SELECT ... FOR UPDATE` no card, garantindo idempotência por:
- `card_id + step`;
- `card_id + codigo_monnera`;
- `card_id + jira_issue_key`;
- `card_id + thread_id + message_id`.

Índices únicos são **parciais e escopados ao card**, nunca globais por código ou thread. Reexecução retorna o resultado anterior sem novo efeito externo.

Falhas e rollback:
- Falha de gate → `bloqueado`, motivo legível, nenhum efeito.
- Falha externa → `erro`, `attempt + 1`, até 3 tentativas com backoff, depois `pendencia_manual` + notificação a Rafael e Maycon.
- **Falha após o envio nunca move o card de volta**: registra falha, preserva histórico, abre pendência de recuperação manual.
- `dry_run = true` (padrão): grava **apenas** auditoria em `automation_runs`. Não altera cards, etapas, tarefas, notificações, Canva nem e-mails; candidatos e gates são avaliados somente em memória.

---

## FASE 4 — Canva

- Modelo oficial `https://canva.link/qp4jojog4s01mjl`; duplicar, substituir `3SAXJF92` pelo código válido na página 12, publicar como apresentação pública, registrar `design_id`, link e data em `canva_material_generations` + `representative_cards.canva_public_url`.
- **Só marcar como criado** com integração oficial confirmada **ou** inserção manual de link público válido `https://canva.link/...`. Caso contrário: `pendencia_manual` + notificação. Nunca simular sucesso nem gerar link fictício.

---

## FASE 5 — HTML e e-mail

Mapeamento do HTML v2: `{{NOME_PARCEIRO}}` = nome do parceiro; `{{CODIGO_CADASTRO_PARCEIRO}}` = código Monnera; `{{LINK_MATERIAL_CLIENTE}}` = link público do Canva.

Checklist obrigatório antes do envio (falha = `bloqueado`): logo Monnera presente; links respondendo; nenhum placeholder remanescente; nenhuma referência a Jira, Lovable, cards ou automação; assunto e destinatários corretos.

Thread: `send-onboarding-email` passa a aceitar `thread_id`, `in_reply_to` e `references`, montando os headers `In-Reply-To` e `References` e enviando `threadId` à API Gmail. Sem thread comprovada → sem envio (pendência manual); nunca criar thread nova silenciosamente.

Destinatários: e-mails comprovados no card e na thread; excluir Jira, `no-reply@`, `notifications@`, endereços técnicos e a conta remetente; Denise/Deise somente como último recurso; no teste QA, **somente** `rafael.lucena@monnera.com.br`.

Conclusão do envio: apenas com resposta confirmada da API Gmail e `message_id` persistido. Registro em outbox é estado intermediário (`email_pendente`), não envio concluído.

---

## FASE 6 — Movimentação

- Somente após `email_enviado` com `message_id`: mover do `stage_id` de `Criação Painel` para o `stage_id` de `Material Onboarding Cliente`.
- Gate do envio corrigido: exige `stage_id` de `Criação Painel` + código + link Canva válidos (hoje exige, erradamente, que o card já esteja em Material Onboarding).
- Registrar em `representative_card_history` e `card_field_provenance`; notificar Rafael e Maycon.
- **Nunca mover o card de volta automaticamente.** Nenhuma cobrança ou e-mail adicional junto ao onboarding.

---

## Teste controlado

Somente `TESTE FASE A QA` (`32d1e94e-ab53-42b3-9118-ab3ad2d07c77`, `test_mode = true`):
1. Preparar: thread de teste controlada com evidência em `origin_thread_id`; link `canva.link/...`.
2. Dry-run completo das 7 etapas, revisando gates em `automation_runs` (sem nenhum efeito colateral).
3. Mediante autorização explícita e um item por vez: uma tarefa Jira, um código de teste, um Canva real, um e-mail real só para `rafael.lucena@monnera.com.br`.
4. Validar `stage_id`, thread, headers, checklist do HTML, `message_id`, histórico e movimentação.

---

## Entregáveis técnicos

Arquivos novos: `supabase/functions/cross-onboarding-advance/index.ts`; `supabase/functions/_shared/crossOnboarding.ts`; `supabase/functions/_shared/canvaLink.ts`; `src/lib/canvaLink.ts`; `src/components/admin/CrossOnboardingSteps.tsx`.

Arquivos alterados: `supabase/functions/send-onboarding-email/index.ts`; `src/components/admin/CanvaPublicLinkSection.tsx`; `src/pages/admin/AdminLeads.tsx`; `supabase/functions/jira-create-panel-task/index.ts` (somente se o diagnóstico exigir).

Migrations: (1) `codigo_recebido_at` + backfill; (2) `cross_onboarding_steps` com GRANTs, RLS, índices parciais escopados ao card e função transacional de avanço; (3) correção do link Canva do card QA.

Policies: `cross_onboarding_steps` — `SELECT` para `admin` e `gestor_conta` via `has_role`; `INSERT/UPDATE` apenas `service_role`. Execução do orquestrador restrita a `admin`.

Secrets: nenhum novo. Atlassian apenas conferido na Fase 1, sem alteração. Canva permanece sem token, por decisão.

Dependências: Fase 3 depende da 2; Fase 5 depende da 4 e da thread vinculada; Fase 6 depende da 5. Fase 1 é independente.

Riscos: endurecer a validação Canva invalida o link atual do QA (corrigido na mesma fase); inverter o gate de etapa muda comportamento atual (mitigado pela allowlist); sem token Canva o fluxo para na etapa 2 por desenho.

Ordem segura: Fase 1 → Fase 2 → Fase 3 (dry-run) → Fase 4 → Fase 5 → Fase 6 → teste QA passo a passo com confirmação.
