# Webhook Jira — nome do header e teste de conexão

## Nome exato do header (já implementado na função)

A Edge Function `jira-code-webhook` aceita duas formas de autenticação:

1. Header secreto simples (recomendado para o Jira):
   - Nome do header: `x-jira-webhook-secret`
   - Valor: exatamente o mesmo `JIRA_WEBHOOK_SECRET` salvo no Lovable
2. Assinatura HMAC-SHA256 (alternativa, para automações próprias):
   - `x-jira-signature`: `sha256=<hex>` de HMAC-SHA256 sobre `"<timestamp>.<corpo bruto>"`
   - `x-jira-timestamp`: epoch em segundos

Sem um desses conjuntos, a resposta é HTTP 401. Nomes de header são case-insensitive; o segredo nunca é lido do corpo do payload.

Configuração no Jira (Automation → Send web request), projeto MB, gatilho "Issue updated", tipo Tarefa:
- URL: `https://bapxuzodzgahscatvofs.functions.supabase.co/jira-code-webhook`
- Header: `x-jira-webhook-secret` = valor do `JIRA_WEBHOOK_SECRET`
- Método POST, corpo JSON com `issue.key` e o campo do código.

## Ajuste necessário antes do teste de conexão

Hoje não existe modo de teste. Um payload válido sem card correspondente responde HTTP 202 (ignorado), e não 200 — o que dificulta validar a entrega sem tocar em card.

Alteração mínima em `supabase/functions/jira-code-webhook/index.ts`:
- Após autenticar com sucesso, se o corpo contiver `{"ping": true}` (ou `"test_delivery": true`), responder HTTP 200 com `{ ok: true, mode: "ping" }`, registrar em `automation_runs` com etapa `jira_code_webhook` e status `sucesso`, origem `jira_webhook`, e encerrar sem consultar nem alterar nenhum card.
- Nenhuma outra regra do fluxo muda: busca de card, validação de código, idempotência, divergência e notificações permanecem iguais.

## Roteiro de verificação (sem alterar o card QA)

1. Entrega válida: POST com header correto e corpo `{"ping": true}` → esperado HTTP 200.
2. Segredo inválido: mesmo POST com header errado → esperado HTTP 401 e registro de erro em `automation_runs`.
3. Conferir nos logs da função e no painel "Saúde das automações" que nenhum card foi alterado (nenhuma execução com `card_id` preenchido no período do teste).
4. Conferir no banco que `TESTE FASE A QA` segue com `codigo_monnera` e etapa inalterados.

Só após esses três resultados o teste real no card `TESTE FASE A QA` é autorizado, em mensagem separada.

## Escopo técnico

- Arquivo alterado: `supabase/functions/jira-code-webhook/index.ts` (apenas o bloco de ping).
- Sem migrations, sem mudanças de UI, sem novos segredos.
