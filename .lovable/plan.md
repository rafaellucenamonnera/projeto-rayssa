# Corrigir a resolução da issue Jira em `cross-onboarding-advance`

Escopo: apenas a rotina que resolve/valida a issue. Nenhuma tarefa Jira, card, e-mail ou Canva será criado ou alterado.

## O que a investigação já mostrou (somente leitura)

1. Endpoint chamado: `GET {ATLASSIAN_SITE_URL}/rest/api/3/issue/MB-4838?fields=summary,description,labels,updated[,JIRA_CODE_FIELD_ID]` (`supabase/functions/_shared/jira.ts`, `getIssue`).
2. URL base: `ATLASSIAN_SITE_URL` com barras finais removidas e o path concatenado — não há duplicação de `/rest/api`. A mesma montagem é usada por `jira-create-panel-task`.
3. Sim, usa `/rest/api/3/issue/MB-4838` (chave URL-encoded).
4. A chave gravada no card está limpa: `MB-4838`, 7 caracteres, hex `4d422d34383338` — sem espaço, sem crase.
5. Autenticação: Basic com `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN`, idêntica à função de criação.
6. A função não converte outros erros em 404: `jiraGet` propaga o status real.
7. O erro real registrado em `automation_runs` para o card QA é:

```text
Jira 404: {"errorMessages":["事务不存在或者您没有查看的权限。"],"errors":{}}
```

Traduzido: "a issue não existe ou você não tem permissão para visualizá-la". Duas evidências importantes: o Jira respondeu de fato 404 (não é erro mascarado) e a mensagem veio em chinês, ou seja, a conta autenticada pelo `ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` tem locale chinês — não é a conta `rafael.lucena@monnera.com.br` usada pelo MCP, que lê a issue normalmente.

Conclusão da causa provável (a confirmar pelo diagnóstico abaixo, ainda não confirmada): a Edge Function autentica com uma conta Atlassian diferente da usada pelo MCP, e essa conta não enxerga a issue MB-4838 no projeto MB. O código de montagem de URL e endpoint está correto.

## O que será implementado

### 1. Modo diagnóstico somente leitura

Adicionar a `cross-onboarding-advance` um parâmetro `?diag=<ISSUE_KEY>` (restrito a admin) que executa apenas leituras e retorna, sem avançar nada:

- URL base normalizada em uso (host apenas, sem token);
- `GET /rest/api/3/myself` — accountId, e-mail e locale da conta autenticada pela função;
- `GET /rest/api/3/issue/<KEY>` — código HTTP real e corpo resumido;
- `GET /rest/api/3/issue/<KEY>` sem o parâmetro `fields` (descarta campo customizado inválido como causa);
- `GET /rest/api/3/search/jql?jql=key=<KEY>` — verifica se a chave aparece na busca da conta;
- `GET /rest/api/3/mypermissions?issueKey=<KEY>&permissions=BROWSE_PROJECTS`.

### 2. Resolução mais robusta da issue (sem mudar o fluxo)

Em `getIssue` (`_shared/jira.ts`), quando a chamada com `fields` falhar:

- repetir uma vez sem o parâmetro `fields` (protege contra `JIRA_CODE_FIELD_ID` inválido);
- se ainda falhar com 404, tentar `search/jql` com `key = <KEY>` e usar o resultado quando a issue vier;
- somente após essas tentativas propagar o erro.

Isso reaproveita a issue já existente e nunca cria tarefa nova.

### 3. Mensagem de bloqueio mais precisa

Em `jiraLinkGate` (`_shared/crossOnboarding.ts`), diferenciar:

- 404/403 → "issue não visível pela conta de integração (verificar permissão ou credenciais)";
- 401 → "credenciais Atlassian inválidas";
- demais → mensagem atual.

O card continua bloqueado nesses casos; nada avança.

### 4. Execução do diagnóstico e relatório

Depois do deploy, rodar apenas `?diag=MB-4838` e reportar: endpoint usado, código HTTP real, resposta resumida, chave resolvida, responsável e status Jira. Se o diagnóstico confirmar que a conta da função não tem acesso, a correção final é de credenciais/permissão (alinhar `ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` à conta que enxerga o projeto MB, ou conceder Browse Projects à conta atual) — nesse caso eu informo exatamente qual conta está sendo usada e paro, sem prosseguir para Canva, HTML, e-mail ou movimentação.

## Fora de escopo

Nenhuma alteração em Canva, e-mail, HTML v2, movimentação de etapa, criação de tarefa Jira ou refatoração do orquestrador.
