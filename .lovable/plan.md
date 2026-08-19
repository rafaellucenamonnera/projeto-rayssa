# Fluxo pós-código Monnera — plano de implementação em 6 fases

Objetivo: transformar a cadeia hoje quebrada (código → Canva → HTML → e-mail → movimentação) em um fluxo orquestrado, idempotente e auditável, sem tocar em clientes reais. Toda execução começa em dry-run e só o card `TESTE FASE A QA` é elegível para efeitos reais.

Regra permanente durante todo o plano: `ORCA LOGÍSTICA` e qualquer card real permanecem intocados (proteção por `protected_entities` + trigger já existente).

---

## FASE 1 — Jira (destravar a origem do código)

O que fazer:
- Rodar o diagnóstico somente leitura já implantado (`jira-create-panel-task?check=1`): secrets → `/myself` → `/project/{key}` → `/mypermissions` → `/createmeta`.
- Confirmar chave do projeto, tipo de issue, board e se a conta de serviço tem `CREATE_ISSUES` com `havePermission === true`.
- Corrigir os secrets conforme o resultado (chave errada, conta sem acesso ao projeto, ou tipo de issue inválido) e reportar exatamente qual valor precisa mudar.
- Polling permanece `read_only = true` até a validação passar.
- Nenhum POST no Jira durante o diagnóstico; nenhuma tarefa em produção.

Saída da fase: relatório com conta autenticada, projeto, permissão e tipo de issue válidos, e a lista de secrets a ajustar.

Critérios de aceite: `?check=1` retorna todas as etapas verdes; nenhuma issue criada; `automation_runs` registra o diagnóstico com `origin = manual_preview`.

---

## FASE 2 — Dados do card

Migration:
- `representative_cards.codigo_recebido_at timestamptz null` — preenchido quando um código válido é aplicado (Gmail, Jira ou manual admin).
- Backfill somente por inferência segura: usar o `created_at` do registro de `card_field_provenance` do campo `codigo_monnera` quando existir; caso contrário, deixar nulo (nunca inventar data).
- `origin_thread_id` já existe; será preenchido pelo vínculo de origem (`card_source_links`) quando houver thread comprovada. Para o card QA será definido manualmente na fase de teste.

Unificação da validação Canva:
- Criar `src/lib/canvaLink.ts` e `supabase/functions/_shared/canvaLink.ts` com a mesma regra, e passar `CanvaPublicLinkSection.tsx`, `send-onboarding-email` e o orquestrador a usá-la.
- Formato aceito: `https://canva.link/<token>` (link público de apresentação).
- Formato rejeitado: qualquer `/edit`, `canva.com/design/...`, `canva.com/d/s_...` e — decisão desta fase — também `https://www.canva.com/d/<token>`, que hoje é aceito no backend e rejeitado no front. Passa a ser rejeitado nos dois lados.
- Consequência: o card QA (hoje com `https://www.canva.com/d/mffStCqDX5f8tVO`) fica inválido e precisa receber o link `canva.link/...` correto antes de qualquer envio.

Critérios de aceite: uma única função de validação em uso; card QA com link `canva.link/...`; `codigo_recebido_at` preenchido para o QA; nenhum card real alterado.

---

## FASE 3 — Orquestrador `cross-onboarding-advance`

Edge Function idempotente que avança um card uma etapa por invocação, sempre com gate antes de qualquer escrita.

Máquina de estados:

```text
codigo_validado -> canva_pendente -> canva_pronto -> html_pronto
    -> email_pendente -> email_enviado -> card_movido
```

Migration — tabela `cross_onboarding_steps` (outbox por etapa):
- `id`, `card_id` (FK `representative_cards`), `step` (enum textual das 7 etapas), `status` (`pendente|executando|sucesso|bloqueado|erro|pendencia_manual`), `attempt int default 0`, `gate_result jsonb`, `error text`, `payload jsonb`, `started_at`, `finished_at`, `created_at`, `updated_at`.
- Unicidade `(card_id, step)` → idempotência: reexecutar uma etapa concluída retorna o resultado anterior sem novo efeito.
- GRANTs: `SELECT` para `authenticated`, `ALL` para `service_role`; RLS com leitura para `admin`/`gestor_conta` e escrita apenas `service_role`.

Regras por etapa:
- Gate específico avaliado antes da escrita (código válido e não demonstrativo, card não protegido, não em `test_mode` conflitante, link Canva válido, thread comprovada, etc.).
- Falha de gate → `bloqueado` com motivo legível, sem efeito colateral.
- Falha externa (Jira/Canva/Gmail) → `erro`, `attempt + 1`, retry com backoff no ciclo seguinte, limite de 3 tentativas e depois `pendencia_manual` + notificação.
- Rollback: etapas com efeito externo irreversível (e-mail) não são revertidas — o rollback é registrar pendência e travar as etapas seguintes. Etapas internas (movimentação, gravação de link) são revertíveis por registro em `representative_card_history`.
- Modo `dry_run: true` (padrão): avalia gates e grava simulação em `automation_runs`, sem persistir estado, sem chamadas externas, sem notificações.

Disparo: manual pelo painel (botão no card) e, mais tarde, por cron — mantido desligado até o teste QA passar.

Critérios de aceite: reexecutar a mesma etapa duas vezes não duplica efeito; toda etapa tem status, tentativa, erro e timestamps; dry-run não escreve nada além de `automation_runs`.

---

## FASE 4 — Canva

- Modelo oficial: `https://canva.link/qp4jojog4s01mjl`.
- Ação esperada: duplicar o modelo, substituir `3SAXJF92` pelo código Monnera válido na página 12, publicar como apresentação pública e registrar `design_id`, link público e data em `canva_material_generations` + `representative_cards.canva_public_url`.
- Sem token/conexão Canva disponível (situação atual): a etapa `canva_pendente` fica em `pendencia_manual`, notifica Rafael e Maycon, e o fluxo para. Nunca marcar sucesso simulado, nunca gerar link fictício.
- Entrada manual do link continua válida e satisfaz a etapa, desde que passe na validação unificada da Fase 2.

Critérios de aceite: sem token, a etapa nunca vira `sucesso`; com link manual válido, avança para `canva_pronto` registrando origem `manual`.

---

## FASE 5 — HTML e e-mail

- HTML v2 permanece como está (`ONBOARDING_EMAIL_TEMPLATE_V2`), com os 3 placeholders: nome, código, link Canva. A etapa `html_pronto` renderiza e guarda o snapshot no outbox, falhando se sobrar qualquer `{{...}}`.
- Envio na thread original: `send-onboarding-email` passa a aceitar `thread_id`, `in_reply_to` e `references`, montando os headers `In-Reply-To` e `References` e enviando `threadId` no corpo da API Gmail. Sem thread comprovada → sem envio; vira pendência manual (não criar thread nova silenciosamente).
- Para/CC derivados de `gmail_processed_messages.thread_participants` da thread vinculada, excluindo endereços técnicos (`jira@monnera.atlassian.net`, `no-reply@`, `notifications@`, automações Atlassian) e a própria conta remetente.
- Registro em outbox (`cross_onboarding_steps` + `onboarding_email_sends`), com `message_id` e `thread_id` de retorno.
- Duplicidade: chave `(card_id, codigo_parceiro, status = enviado)` já existente, reforçada pela unicidade da etapa `email_enviado`.
- Allowlist de QA mantida (somente card QA e destinatário `rafael.lucena@monnera.com.br`) até liberação explícita.

Critérios de aceite: e-mail aparece como resposta na thread original; sem destinatário técnico do Jira; segunda tentativa retorna duplicidade sem enviar.

---

## FASE 6 — Movimentação

- Somente após `email_enviado = sucesso` com `message_id` confirmado, mover de `Criação Painel` para `Material Onboarding Cliente`.
- Gate do envio invertido em relação ao comportamento atual: passa a exigir `Criação Painel` + código válido + link Canva válido (hoje exige, erradamente, que o card já esteja em Material Onboarding).
- Registrar em `representative_card_history` e `card_field_provenance` (etapa anterior, nova etapa, origem `cross-onboarding-advance`, `message_id`).
- Notificar Rafael e Maycon com o resultado.
- Nenhuma cobrança, régua ou e-mail adicional junto ao onboarding.

Critérios de aceite: card só se move com `message_id`; histórico e notificação registrados; nenhum segundo e-mail disparado.

---

## Teste controlado

Somente o card `TESTE FASE A QA` (`32d1e94e-ab53-42b3-9118-ab3ad2d07c77`, `test_mode = true`).

1. Preparar: definir `origin_thread_id` de uma thread de teste e substituir o link Canva pelo formato `canva.link/...`.
2. Rodar o orquestrador em dry-run e revisar os gates de todas as 7 etapas em `automation_runs`.
3. Mediante confirmação explícita, e um item por vez: uma tarefa Jira, um código de teste, um Canva real, um e-mail real apenas para `rafael.lucena@monnera.com.br`.
4. Validar thread, headers, histórico e movimentação.

`ORCA LOGÍSTICA` e todos os cards reais permanecem bloqueados por `protected_entities`.

---

## Detalhes técnicos

Arquivos novos:
- `supabase/functions/cross-onboarding-advance/index.ts`
- `supabase/functions/_shared/crossOnboarding.ts` (gates e máquina de estados)
- `supabase/functions/_shared/canvaLink.ts` e `src/lib/canvaLink.ts`
- `src/components/admin/CrossOnboardingSteps.tsx` (painel de etapas no card)

Arquivos alterados:
- `supabase/functions/send-onboarding-email/index.ts` (thread, Para/CC, gate de etapa invertido)
- `src/components/admin/CanvaPublicLinkSection.tsx` (validação unificada)
- `supabase/functions/jira-create-panel-task/index.ts` (ajustes pós-diagnóstico, se necessário)
- `src/pages/admin/AdminLeads.tsx` (montar o painel de etapas no detalhe do card)

Migrations:
1. `representative_cards.codigo_recebido_at` + backfill conservador.
2. `cross_onboarding_steps` com GRANTs, RLS e unicidade `(card_id, step)`.
3. Correção pontual do link Canva do card QA.

Secrets: nenhum novo. Revisar os já existentes da Atlassian conforme a Fase 1. Canva permanece sem token, por decisão.

Dependências: Fase 3 depende da 2; Fase 5 depende da 4 (link válido) e da thread vinculada; Fase 6 depende da 5. A Fase 1 é independente e pode correr em paralelo.

Riscos:
- Endurecer a validação Canva invalida o link atual do card QA (esperado, corrigido na mesma fase).
- Inverter o gate de etapa do envio muda o comportamento atual — mitigado pela allowlist de QA.
- Ausência de token Canva mantém o fluxo travado na etapa 2 por desenho; é pendência de negócio, não bug.
- Reprocessamento sem `origin_thread_id` poderia criar thread nova — bloqueado por gate.

Ordem segura de execução: Fase 1 (diagnóstico) → Fase 2 (dados e validação) → Fase 3 (orquestrador em dry-run) → Fase 4 → Fase 5 → Fase 6 → teste QA passo a passo com confirmação.
