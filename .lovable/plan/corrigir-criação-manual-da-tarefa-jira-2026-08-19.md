# Corrigir criação manual da tarefa Jira

## Causa confirmada (diagnóstico)

O erro não vem do Jira. A tarefa nunca chega a ser criada.

Registros em `automation_runs` (19/08, 19:04 e 19:05, origem `manual`, card ZARB DISTRIBUIDORA) mostram:

```text
status: ignorado
error:  "Card não está na etapa Criação Painel."
```

A função `jira-create-panel-task` valida a etapa comparando o texto do `stage_id` com o trecho `criacao_painel`. As etapas deste painel não usam texto descritivo:

| Etapa (label)      | value no banco               |
| ------------------ | ---------------------------- |
| Cadastro           | etapa_painel_msj9fyji_1      |
| Criação Painel     | etapa_painel_msj9fyji_2      |
| Material Onboarding| etapa_painel_msj9fyji_3      |

O card ZARB está em `etapa_painel_msj9fyji_2`, ou seja, **está** em Criação Painel, mas a verificação nunca reconhece isso. A função responde HTTP 400 e o `supabase.functions.invoke` do painel converte isso na mensagem genérica “Edge Function returned a non-2xx status code”. A falha acontece já na prévia, e também na confirmação — nenhum efeito colateral ocorreu (sem tarefa, sem `jira_issue_key`, sem movimentação de card).

Secrets já configurados: `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_ASSIGNEE_ACCOUNT_ID`. A validade das credenciais e as permissões no projeto MB ainda não foram exercitadas, porque a requisição nunca chegou ao Jira — serão verificadas no teste controlado do card `TESTE FASE A QA` (que hoje já tem `MB-4838`; o teste usará um card de QA sem tarefa vinculada).

Observação adicional encontrada no mesmo diagnóstico (fora do escopo desta correção, sinalizada para decisão): o polling `jira-sync-panel-tasks` falha com `Jira 410 — /rest/api/2/search removida, migrar para /rest/api/3/search/jql`.

## O que será corrigido

1. **Validação de etapa por configuração, não por texto do id**
   A função passa a ler `pipeline_stages_config` (`panel_key = painel_msj9fyji`) e a comparar o `label` normalizado da etapa do card com “Criação Painel”. Mantém-se o bloqueio para qualquer outra etapa.

2. **Erro real visível no painel**
   O frontend passa a ler o corpo da resposta de erro (`FunctionsHttpError.context.json()`) e exibe: status HTTP, mensagem da função, e — quando houver — o status/código retornado pelo Jira. As categorias ficam distintas: autenticação (401), permissão (403), pré-requisito/payload (400), duplicidade (409), Jira/servidor (502/500). Nenhum token, e-mail de conta ou header é exibido.

3. **Responsável obrigatório e explícito**
   O `accountId` continua vindo apenas de `JIRA_ASSIGNEE_ACCOUNT_ID`. Ausente ou recusado pelo Jira → erro “Responsável Jira não configurado ou não autorizado.” e nenhuma tarefa criada.

4. **Prévia sem efeitos**
   Confirmado no código atual e mantido: a prévia não cria issue, não grava `jira_issue_key`, não altera card nem etapa. A única escrita na prévia hoje é o log em `automation_runs` quando há bloqueio — esse log passa a marcar `origin: manual_preview`, para não se confundir com tentativas reais.

5. **Confirmação**
   Sem mudança de comportamento: revalidação de bloqueios e deduplicação no servidor (card, CNPJ, thread), criação única, gravação de `jira_issue_key`, provenance, histórico do card e `automation_runs`, atribuição à Lívia, retorno da chave.

## Testes controlados (nenhuma tarefa real fora do QA)

- Prévia do card ZARB: deve exibir a prévia liberada, **sem** criar nada.
- Prévia de card em outra etapa: bloqueio com mensagem clara.
- Card já com `jira_issue_key`: erro de duplicidade 409 legível.
- Simulação de responsável ausente: mensagem específica.
- Criação real: apenas em um card de QA dedicado, após sua autorização explícita.

Durante a implementação e os testes: nenhuma tarefa real, nenhum card movido, nenhum Canva gerado, nenhum e-mail enviado.

## Detalhes técnicos

- `supabase/functions/jira-create-panel-task/index.ts`: substituição do teste `stage_id.includes("criacao_painel")` por consulta a `pipeline_stages_config` com normalização de acento/caixa; propagação de `jira_status` e `jira_error_code` no JSON de erro; `origin` diferenciado no `record_automation_run` da prévia.
- `src/components/admin/JiraTaskDialog.tsx`: tratamento de `FunctionsHttpError` lendo `context.json()` em `loadPreview`, `handleConfirm`, `openSync` e `confirmSync`; renderização de status HTTP + mensagem + código Jira.
- Sem migrations. Sem novos secrets.
