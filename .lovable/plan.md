# Ajuste do fluxo Cross: Gmail como fonte do código, Jira não bloqueante

Regras recebidas aceitas integralmente. Nada será executado (tarefa, e-mail, Canva, movimentação, alteração de card) antes da aprovação.

## 1. O que está confirmado hoje (leitura do código e dos logs)

- O gate que quebra o fluxo é `jiraLinkGate` em `supabase/functions/_shared/crossOnboarding.ts`, chamado em `cross-onboarding-advance/index.ts` sempre que o card já tem `jira_issue_key`. Ele executa `getIssue` (GET `/rest/api/3/issue/...`) e, em qualquer erro, retorna `bloqueado`, interrompendo o avanço.
- `entryGate` também bloqueia com "Vínculo Jira ausente" quando o card está em Material Onboarding Cliente sem `jira_issue_key`.
- O diagnóstico já executado mostrou `/myself` respondendo **401** com as credenciais dos secrets: `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN` estão inválidas ou expiradas. Não houve alteração na rotina de criação da tarefa (`jira-create-panel-task`); o 401/404 vem das credenciais, não do código de criação.
- `getIssue` em `_shared/jira.ts` recebeu uma cascata de tentativas (fields → sem fields → search/jql). É aditiva: não altera a criação de tarefa nem o polling.

## 2. Alterações propostas (mínimas, sem refatorar integrações)

### 2.1 `supabase/functions/_shared/crossOnboarding.ts`
- `jiraLinkGate` passa a ser **não bloqueante**: erro de leitura da issue registra observação no trace/auditoria e retorna `{ ok: true }`. Nenhuma etapa depende mais da resolução da issue.
- `entryGate`: remover a exigência de `jira_issue_key` para avançar a partir de Material Onboarding Cliente. O gate obrigatório passa a ser exclusivamente o **código Monnera válido** (`validateCodeForCard`), como já está.
- Nada mais muda nesse arquivo: allowlists, gates de Canva, e-mail, destinatários e `buildRecipients` ficam idênticos.

### 2.2 `supabase/functions/cross-onboarding-advance/index.ts`
- O bloco `gate_jira` deixa de retornar `blocked`; passa a gravar apenas `status: "observacao"` no trace quando a leitura falhar.
- Nenhuma outra etapa, ordem, RPC ou efeito é alterado.

### 2.3 Nada é alterado em
- `jira-create-panel-task` (criação da tarefa para Lívia, com anti-duplicidade) — preservado como está.
- `jira-sync-panel-tasks` (polling) — permanece existindo, mas continua sendo apenas complemento; não substitui o processamento do e-mail.
- `gmail-baston-sync` — filtros, origens, domínios, cron de 2h, conta de leitura, modo `triage`, `thread_id`/`message_id` e evidências permanecem exatamente como estão.
- `triage-request-info` e a régua de cobrança (thread original, participantes válidos, exclusão de endereços técnicos, Denise/Deise só como último recurso, 48h, sem limite de 4 destinatários) — preservados.
- Canva: `CanvaPublicLinkSection`, `register_canva_material` e `canva_material_generations` — preservados sem refatoração. A duplicação automática via MCP **não é executável pelo backend** (o MCP Canva é ferramenta de sessão, não está disponível na Edge Function). Isso fica registrado como **pendência técnica**, sem afirmar que a automação está funcionando; o link público manual continua sendo o caminho ativo.

## 3. Gmail como fonte do código Monnera

Já é o caminho implementado e permanece:
`gmail-baston-sync` lê a thread → extrai/valida o código (8 caracteres, A-Z0-9, sem hífen, blocklist de demonstrativos) → grava evidência em `gmail_processed_messages` → liberação/associação grava `codigo_monnera` no card (`apply_monnera_code_to_card`) → `cross-onboarding-advance` valida o código e move Criação Painel → Material Onboarding Cliente.
Com a mudança acima, esse caminho não depende mais de nenhuma leitura de issue no Jira.

## 4. ORCA LOGÍSTICA

Nenhuma ação. Não haverá alteração de `is_protected`, `protected_entities`, allowlists, simulação, movimentação, tarefa, e-mail ou qualquer campo. A ORCA permanece fora da allowlist de execução real.

## 5. Teste previsto

Exclusivamente no card **TESTE FASE A QA** (`32d1e94e-…`), em `dry_run` primeiro, para confirmar que o trace mostra `gate_jira: observacao` e que a próxima etapa passa a ser avaliada pelo código Monnera. Execução real só após sua autorização explícita.

## 6. Diff resumido a aplicar

```text
_shared/crossOnboarding.ts
  - jiraLinkGate: catch → block(...)      => catch → { ok: true, note }
  - entryGate: bloqueio "Vínculo Jira ausente" em Material Onboarding => removido
cross-onboarding-advance/index.ts
  - if (!jira.ok) { ...; return finish(blocked) }  => registra observação e segue
```

Nenhum outro arquivo, migration ou secret é tocado.
