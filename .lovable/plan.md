# Fluxo pós-código Monnera — plano de implementação em 6 fases (revisão 2)

Objetivo: transformar a cadeia hoje quebrada (código → Canva → HTML → e-mail → movimentação) em um fluxo orquestrado, idempotente e auditável.

Regras invariantes desta revisão:
- Padrão `dry_run = true`, ativação controlada, **um card por execução**, allowlist exclusiva `TESTE FASE A QA`.
- O orquestrador **nunca inicia automaticamente** para cards em `Cadastro`.
- Ausência de código Monnera **não bloqueia** a etapa `Cadastro`; o código só é obrigatório em `Criação Painel`.
- **ORCA LOGÍSTICA não será alterada em nenhuma fase**, nem em dry-run, nem em execução real — bloqueio permanente por `protected_entities` + trigger de banco, verificado no gate de entrada de toda etapa.

---

## FASE 1 — Jira (somente diagnóstico)

- Rodar `jira-create-panel-task?check=1`: secrets → `/myself` → `/project/{key}` → `/mypermissions` → `/createmeta`.
- Confirmar conta de serviço, projeto, board, tipo de issue e `CREATE_ISSUES` com `havePermission === true`.
- **Não alterar secrets automaticamente**: apenas reportar quais valores precisam ser corrigidos e por quem.
- **Não criar tarefas** em nenhum projeto.
- `jira_sync_state.read_only` permanece `true`; só é desligado com autorização administrativa explícita, registrada.

Aceite: relatório completo do diagnóstico, zero issues criadas, zero secrets modificados, `read_only` inalterado.

---

## FASE 2 — Dados do card

Migrations:
1. `representative_cards.codigo_recebido_at timestamptz null`; backfill conservador a partir de `card_field_provenance` do campo `codigo_monnera`, senão nulo.
2. Correção pontual do `canva_public_url` do card QA para o formato `canva.link/...`.

Validação Canva unificada (`src/lib/canvaLink.ts` + `supabase/functions/_shared/canvaLink.ts`):
- **Aceito exclusivamente**: `https://canva.link/<token>`.
- Rejeitado: `/edit`, `canva.com/design/...`, `canva.com/d/s_...` e também `https://www.canva.com/d/<token>` (hoje aceito no backend — passa a ser rejeitado nos dois lados).

`origin_thread_id`: preenchido apenas a partir de vínculo comprovado em `card_source_links`. Para o QA, **somente uma thread de teste controlada**, criada para esse fim — nenhuma conversa real de cliente será associada.

Aceite: uma única função de validação em uso; QA com link `canva.link/...`; nenhum card real alterado.

---

## FASE 3 — Orquestrador `cross-onboarding-advance`

Máquina de estados, uma etapa por invocação:

```text
codigo_validado -> canva_pendente -> canva_pronto -> html_pronto
    -> email_pendente -> email_enviado -> card_movido
```

Gate de entrada (avaliado antes de qualquer etapa; falha = parada sem efeito):
- card na etapa `Criação Painel` (por label normalizado, não por `stage_id`);
- código Monnera válido já aplicado (não demonstrativo, 8 caracteres A-Z/0-9);
- card não bloqueado, não protegido, fora de `protected_entities`;
- vínculo Jira confirmado (`jira_issue_key` presente e resolvível);
- card na allowlist de QA enquanto o modo controlado estiver ativo.

Gates por etapa:
| Etapa | Gate |
|---|---|
| `codigo_validado` | gate de entrada + `codigo_recebido_at` registrado |
| `canva_pendente` | código válido; sem link público válido ainda |
| `canva_pronto` | `canva_public_url` no formato `canva.link/...`, confirmado |
| `html_pronto` | render sem placeholders órfãos + checklist da Fase 5 aprovado |
| `email_pendente` | thread comprovada + destinatários validados + sem envio prévio |
| `email_enviado` | resposta 2xx da API Gmail **com `message_id`** |
| `card_movido` | `email_enviado = sucesso` com `message_id` persistido |

Migration — `cross_onboarding_steps`: `id`, `card_id`, `step`, `status` (`pendente|executando|sucesso|bloqueado|erro|pendencia_manual`), `attempt`, `gate_result jsonb`, `error`, `payload jsonb`, `started_at`, `finished_at`, `created_at`, `updated_at`. Unicidade `(card_id, step)`. GRANT `SELECT` para `authenticated`, `ALL` para `service_role`; RLS: leitura `admin`/`gestor_conta`, escrita só `service_role`.

Idempotência e antiduplicidade (item 8): chaves de deduplicação combinadas em `card_id`, `codigo_monnera`, `jira_issue_key`, `thread_id`, `message_id` e `step`, materializadas em índices únicos parciais. Reexecução retorna o resultado anterior sem novo efeito externo.

Falhas e rollback:
- Falha de gate → `bloqueado`, motivo legível, nenhum efeito.
- Falha externa → `erro`, `attempt + 1`, até 3 tentativas com backoff, depois `pendencia_manual` + notificação a Rafael e Maycon.
- **Falha após o envio do e-mail nunca move o card para trás**: registra a falha, preserva histórico e abre pendência de recuperação manual.
- Etapas internas (gravação de link, movimentação) são revertíveis por registro em `representative_card_history`; o e-mail nunca é revertido.
- `dry_run: true` (padrão): avalia gates e grava simulação em `automation_runs`; sem persistir estado, sem chamadas externas, sem notificações.

---

## FASE 4 — Canva

- Modelo oficial `https://canva.link/qp4jojog4s01mjl`; duplicar, substituir `3SAXJF92` pelo código válido na página 12, publicar como apresentação pública, registrar `design_id`, link e data em `canva_material_generations` + `representative_cards.canva_public_url`.
- **Só marcar como criado após confirmação real da integração oficial.** Sem token/conector: `pendencia_manual`, notificação a Rafael e Maycon, fluxo aguarda link público válido. Nunca simular sucesso nem gerar link fictício.
- Link final aceito: exclusivamente `https://canva.link/...`.

---

## FASE 5 — HTML e e-mail

Mapeamento do HTML v2:
- `{{NOME_PARCEIRO}}` = nome do parceiro;
- `{{CODIGO_CADASTRO_PARCEIRO}}` = código Monnera;
- `{{LINK_MATERIAL_CLIENTE}}` = link público do Canva.

Checklist obrigatório antes do envio (falha = `bloqueado`): logo Monnera presente; links respondendo; nenhum placeholder remanescente; nenhuma referência a Jira, Lovable, cards ou automação; assunto e destinatários corretos.

Thread: `send-onboarding-email` passa a aceitar `thread_id`, `in_reply_to` e `references`, montando os headers `In-Reply-To` e `References` e enviando `threadId` à API Gmail. Sem thread comprovada → sem envio (pendência manual); nunca criar thread nova silenciosamente.

Destinatários:
- e-mails comprovados no card e na thread original;
- excluir Jira, `no-reply@`, `notifications@` e demais endereços técnicos, além da própria conta remetente;
- Denise/Deise somente como último recurso, quando não houver contato comprovado;
- no teste QA, **somente** `rafael.lucena@monnera.com.br`.

Conclusão do envio: só após resposta confirmada da API Gmail **com `message_id`**. Registro em outbox é estado intermediário (`email_pendente`), não envio concluído.

---

## FASE 6 — Movimentação

- Somente após `email_enviado` com `message_id` confirmado: mover de `Criação Painel` para `Material Onboarding Cliente`.
- Gate do envio corrigido: exige `Criação Painel` + código + link Canva válidos (hoje exige, erradamente, que o card já esteja em Material Onboarding).
- Registrar em `representative_card_history` e `card_field_provenance` (etapa anterior, nova etapa, origem, `message_id`); notificar Rafael e Maycon.
- Nenhuma cobrança, régua ou e-mail adicional junto ao onboarding.

---

## Teste controlado

Somente `TESTE FASE A QA` (`32d1e94e-ab53-42b3-9118-ab3ad2d07c77`, `test_mode = true`):
1. Preparar: thread de teste controlada em `origin_thread_id` e link `canva.link/...`.
2. Dry-run completo das 7 etapas, revisando gates em `automation_runs`.
3. Mediante confirmação explícita e um item por vez: uma tarefa Jira, um código de teste, um Canva real, um e-mail real só para `rafael.lucena@monnera.com.br`.
4. Validar thread, headers, checklist do HTML, histórico e movimentação.

---

## Entregáveis técnicos

Arquivos novos: `supabase/functions/cross-onboarding-advance/index.ts`; `supabase/functions/_shared/crossOnboarding.ts`; `supabase/functions/_shared/canvaLink.ts`; `src/lib/canvaLink.ts`; `src/components/admin/CrossOnboardingSteps.tsx`.

Arquivos alterados: `supabase/functions/send-onboarding-email/index.ts`; `src/components/admin/CanvaPublicLinkSection.tsx`; `src/pages/admin/AdminLeads.tsx`; `supabase/functions/jira-create-panel-task/index.ts` (somente se o diagnóstico da Fase 1 exigir).

Migrations: (1) `codigo_recebido_at` + backfill; (2) `cross_onboarding_steps` com GRANTs, RLS e índices únicos de deduplicação; (3) correção do link Canva do card QA.

Permissões e secrets: nenhum secret novo. Atlassian já existente, apenas conferido na Fase 1 (sem alteração automática). Canva permanece sem token, por decisão. Execução do orquestrador restrita a `admin` via `has_role`; escrita das tabelas apenas por `service_role`.

Dependências: Fase 3 depende da 2; Fase 5 depende da 4 e da thread vinculada; Fase 6 depende da 5. Fase 1 é independente.

Riscos: endurecer a validação Canva invalida o link atual do QA (corrigido na mesma fase); inverter o gate de etapa muda comportamento atual (mitigado pela allowlist); ausência de token Canva mantém o fluxo parado por desenho.

Ordem segura: Fase 1 → Fase 2 → Fase 3 (dry-run) → Fase 4 → Fase 5 → Fase 6 → teste QA passo a passo com confirmação.
