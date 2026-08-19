# Fluxo pós-código Monnera — plano de implementação em 6 fases (revisão 4)

Objetivo: transformar a cadeia hoje quebrada (código → Canva → HTML → e-mail → movimentação) em um fluxo orquestrado, idempotente e auditável.

Regras invariantes:
- Padrão `dry_run = true`. No dry-run só existem registros em `automation_runs`: nenhuma tarefa Jira, nenhum card alterado, nenhum Canva gerado, nenhum e-mail enviado, nenhuma etapa movida.
- **Limite de um card por execução** aplicado a cron, botão manual, reprocessamento, retry e ativação controlada.
- Allowlist exclusiva `TESTE FASE A QA` enquanto o modo controlado estiver ativo.
- **Validação de etapa exclusivamente pelo `stage_id` oficial** do painel `painel_msj9fyji`; o label é usado apenas para exibição.
- O orquestrador nunca inicia automaticamente para cards em `Cadastro`. Código Monnera não é exigido em `Cadastro`, apenas em `Criação Painel`.
- `QATEST01` só é aceito no card `TESTE FASE A QA` (`test_mode = true`); em cards reais é rejeitado. Cards reais usam apenas o código Monnera recebido e aplicado na etapa `Criação Painel`.

### Proteção da ORCA LOGÍSTICA — verificada antes deste plano
Confirmado em consulta somente leitura:
- `protected_entities` contém o card `f76d5bfa-680b-47e2-9f11-ca443ee2c40b` (ORCA LOGÍSTICA, CNPJ `04690956000113`, motivo registrado);
- o card tem `is_protected = true`;
- os triggers `trg_representative_card_guard_protected` e `representative_cards_guard_stage` existem e estão ativos em `representative_cards`.

A ORCA LOGÍSTICA permanece intocada em todas as fases, em dry-run e em execução real. A checagem será repetida antes das migrations e ao final do teste QA.

---

## FASE 1 — Jira (somente diagnóstico)

- Rodar `jira-create-panel-task?check=1`: secrets → `/myself` → `/project/{key}` → `/mypermissions` → `/createmeta`.
- Confirmar conta de serviço, projeto, board, tipo de issue e `CREATE_ISSUES` com `havePermission === true`.
- **Não criar tarefas**, **não alterar secrets**, `jira_sync_state.read_only` permanece `true`.
- A criação da tarefa Jira do card QA só ocorre após autorização administrativa explícita **e** confirmação de `CREATE_ISSUES`.

Aceite: relatório completo; zero issues criadas; zero secrets alterados; `read_only` inalterado.

---

## FASE 2 — Migrations e validações (não destrutivas)

Pré-condição: reconfirmar `protected_entities`, `is_protected` e os triggers de proteção antes de rodar qualquer migration.

Migrations:
1. `representative_cards.codigo_recebido_at timestamptz null`; backfill conservador via `card_field_provenance` do campo `codigo_monnera`, senão nulo.
2. `cross_onboarding_steps` (detalhada na Fase 3).
3. Correção do `canva_public_url` do card QA — executada **somente** quando houver um link público real e validado em mãos. **Nenhum placeholder `canva.link/...` será gravado**; sem link real, o campo é limpo e o card fica em `pendencia_manual`.

Validação Canva unificada (`src/lib/canvaLink.ts` + `supabase/functions/_shared/canvaLink.ts`):
- Aceito exclusivamente `https://canva.link/<token>`.
- Rejeitado: `/edit`, `canva.com/design/...`, `canva.com/d/s_...` e `https://www.canva.com/d/<token>` (hoje aceito no backend — passa a ser rejeitado nos dois lados).

`origin_thread_id`: preenchido apenas por vínculo comprovado em `card_source_links`. No QA, somente uma thread de teste real e controlada, com evidência registrada. Nenhuma thread de cliente real será associada.

---

## FASE 3 — Orquestrador `cross-onboarding-advance` (dry-run)

```text
codigo_validado -> canva_pendente -> canva_pronto -> html_pronto
    -> email_pendente -> email_enviado -> card_movido
```

Gate de entrada (falha = parada sem efeito):
- `stage_id` igual ao `stage_id` oficial de `Criação Painel`;
- código Monnera válido aplicado (8 caracteres A-Z/0-9, não demonstrativo; `QATEST01` só no card QA com `test_mode = true`);
- card não bloqueado, `is_protected = false`, ausente de `protected_entities`;
- **`jira_issue_key` presente, resolvível no Jira e vinculado ao card**. Se o Jira responder 403 ou não houver chave válida, o fluxo é interrompido sem Canva, HTML, e-mail ou movimentação;
- card na allowlist de QA; uma execução por card.

Gates por etapa:
| Etapa | Gate |
|---|---|
| `codigo_validado` | gate de entrada + `codigo_recebido_at` registrado |
| `canva_pendente` | código válido; ainda sem link público válido |
| `canva_pronto` | `canva_public_url` real no formato `canva.link/...`, validado e com evidência |
| `html_pronto` | render sem placeholders órfãos + checklist da Fase 5 aprovado |
| `email_pendente` | thread comprovada + destinatários validados + sem envio prévio |
| `email_enviado` | resposta 2xx da API Gmail com `message_id` persistido |
| `card_movido` | `email_enviado = sucesso` com `message_id` |

Migration — `cross_onboarding_steps`: `id`, `card_id`, `step`, `status` (`pendente|executando|sucesso|bloqueado|erro|pendencia_manual`), `attempt`, `gate_result jsonb`, `error`, `payload jsonb`, `codigo_monnera`, `jira_issue_key`, `thread_id`, `message_id`, `started_at`, `finished_at`, `created_at`, `updated_at`. GRANT `SELECT` para `authenticated`, `ALL` para `service_role`; RLS: leitura `admin`/`gestor_conta`, escrita apenas `service_role`.

Deduplicação transacional e contextual (sem índices únicos globais): toda escrita ocorre em função `SECURITY DEFINER` com `SELECT ... FOR UPDATE` no card, garantindo idempotência por `card_id + step`, `card_id + codigo_monnera`, `card_id + jira_issue_key` e `card_id + thread_id + message_id`. Índices únicos parciais escopados ao card.

Falhas e rollback:
- Falha de gate → `bloqueado`, motivo legível, nenhum efeito.
- Falha externa → `erro`, `attempt + 1`, até 3 tentativas com backoff, depois `pendencia_manual` + notificação a Rafael e Maycon.
- Falha após o envio nunca move o card de volta: registra falha, preserva histórico, abre pendência de recuperação manual.

---

## FASE 4 — Canva (pendência manual)

- **Sem token ou integração oficial do Canva, nada é duplicado ou editado automaticamente.** A fase funciona como pendência manual: o operador insere um link público real `https://canva.link/...`, o sistema valida, registra a evidência (`canva_material_generations` + `card_field_provenance`) e o fluxo prossegue.
- Quando houver integração oficial confirmada: duplicar o modelo `https://canva.link/qp4jojog4s01mjl`, substituir `3SAXJF92` pelo código válido na página 12 (no card QA, por `QATEST01`; em cards reais, pelo código Monnera aplicado em `Criação Painel`), publicar como apresentação pública e registrar `design_id`, link e data.
- Nunca simular sucesso, nunca gravar link fictício.

---

## FASE 5 — HTML e e-mail

Mapeamento do HTML v2: `{{NOME_PARCEIRO}}` = nome do parceiro; `{{CODIGO_CADASTRO_PARCEIRO}}` = código Monnera; `{{LINK_MATERIAL_CLIENTE}}` = link público do Canva.

Checklist obrigatório antes do envio (falha = `bloqueado`): logo Monnera presente; links respondendo; nenhum placeholder remanescente; nenhuma referência a Jira, Lovable, cards ou automação; assunto e destinatários corretos.

Thread: `send-onboarding-email` passa a aceitar `thread_id`, `in_reply_to` e `references`, montando os headers `In-Reply-To` e `References` e enviando `threadId` à API Gmail. Sem thread comprovada → sem envio (pendência manual); nunca criar thread nova silenciosamente.

Destinatários: e-mails comprovados no card e na thread; excluir Jira, `no-reply@`, `notifications@`, endereços técnicos e a conta remetente; Denise/Deise somente como último recurso; no teste QA, somente `rafael.lucena@monnera.com.br`.

Conclusão do envio: apenas com resposta confirmada da API Gmail e `message_id` persistido. Outbox é estado intermediário, não envio concluído.

---

## FASE 6 — Movimentação

- Somente após `email_enviado` com `message_id`: mover do `stage_id` de `Criação Painel` para o `stage_id` de `Material Onboarding Cliente`.
- Gate do envio corrigido: exige `stage_id` de `Criação Painel` + código + link Canva válidos.
- Registrar em `representative_card_history` e `card_field_provenance`; notificar Rafael e Maycon.
- Nunca mover o card de volta automaticamente. Nenhuma cobrança ou e-mail adicional junto ao onboarding.

---

## Ordem de execução e teste controlado

1. Fase 1 — diagnóstico Jira.
2. Fase 2 — migrations não destrutivas e validações.
3. Fase 3 — dry-run do orquestrador.
4. Somente após revisão: teste controlado no card `TESTE FASE A QA` (`32d1e94e-ab53-42b3-9118-ab3ad2d07c77`, `test_mode = true`), um item por vez mediante autorização: tarefa Jira, código de teste, Canva real, e-mail real só para `rafael.lucena@monnera.com.br`.

Antes de qualquer envio real ou movimentação, será apresentado: resultado de todos os gates, link Canva validado, `message_id` do e-mail e confirmação de que ORCA LOGÍSTICA permaneceu intacta.

---

## Entregáveis técnicos

Arquivos novos: `supabase/functions/cross-onboarding-advance/index.ts`; `supabase/functions/_shared/crossOnboarding.ts`; `supabase/functions/_shared/canvaLink.ts`; `src/lib/canvaLink.ts`; `src/components/admin/CrossOnboardingSteps.tsx`.

Arquivos alterados: `supabase/functions/send-onboarding-email/index.ts`; `src/components/admin/CanvaPublicLinkSection.tsx`; `src/pages/admin/AdminLeads.tsx`; `supabase/functions/jira-create-panel-task/index.ts` (somente se o diagnóstico exigir).

Migrations: (1) `codigo_recebido_at` + backfill; (2) `cross_onboarding_steps` com GRANTs, RLS, índices parciais escopados ao card e função transacional de avanço; (3) correção do link Canva do QA, condicionada a link real validado.

Policies: `cross_onboarding_steps` — `SELECT` para `admin` e `gestor_conta` via `has_role`; escrita apenas `service_role`. Execução do orquestrador restrita a `admin`.

Secrets: nenhum novo. Atlassian apenas conferido na Fase 1. Canva permanece sem token, por decisão.

Riscos: endurecer a validação Canva invalida o link atual do QA (`https://www.canva.com/d/...`), que passa a ser pendência manual; inverter o gate de etapa muda comportamento atual (mitigado pela allowlist); sem token Canva o fluxo para na Fase 4 por desenho.
