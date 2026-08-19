# Corrigir a integração de criação de tarefas no Jira

## Verificação prévia (feita, somente leitura)

Consulta ao site monnera.atlassian.net, projetos com ação `create`:

| Projeto | ID | Chave | Tipos disponíveis |
| --- | --- | --- | --- |
| Monnera Board | 10038 | MB | Tarefa (10042), Subtarefa (10043), Bug (10047), Epic (10000), Forms (10039) |

Portanto `MB` é a chave real e `10042` (Tarefa) é um tipo válido nesse projeto. O texto "I0038 / I0042" na prévia é apenas a renderização dos IDs técnicos, não um valor corrompido.

Hoje esses valores estão fixos no código, não em secrets. Como o alvo está correto, a mensagem "O projeto não existe, ou você não tem direito neste projeto para criar questões" aponta para falta de acesso/permissão da conta usada em `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN`. Essa hipótese será confirmada pelo diagnóstico, sem criar nada.

## Arquivos reais encontrados

Integração Jira no backend:

- `supabase/functions/_shared/jira.ts` — único lugar que monta as credenciais (`jiraEnv`), com `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`; hoje ainda carrega as constantes fixas `JIRA_PROJECT_ID = "10038"` e `JIRA_ISSUE_TYPE_ID = "10042"`, que serão **removidas como fonte ativa** (ver seção de secrets); helpers de leitura (GET).
- `supabase/functions/jira-create-panel-task/index.ts` — criação manual da tarefa; hoje redeclara `JIRA_PROJECT_ID`/`JIRA_ISSUE_TYPE_ID` e monta as credenciais localmente; envia `project: { id: "10038" }`.
- `supabase/functions/jira-sync-panel-tasks/index.ts`, `supabase/functions/jira-sync-card-code/index.ts`, `supabase/functions/jira-code-webhook/index.ts`, `supabase/functions/_shared/jiraCodeSync.ts` — somente leitura/sincronização; não declaram credenciais próprias (usam `_shared/jira.ts`).

Frontend:

- `src/components/admin/JiraTaskDialog.tsx` — prévia e confirmação; linha 273 exibe `Projeto/Tipo: {project} / {issue_type}`.
- `src/pages/admin/AdminLeads.tsx`, `src/components/admin/CardOriginTimeline.tsx`, `src/pages/admin/AdminTriagemGmail.tsx` — apenas leem campos `jira_*` do card; não serão alterados.

Confirmações:

- Não existem arquivos duplicados de integração Jira: só `_shared/jira.ts` e `jira-create-panel-task/index.ts` constroem autenticação.
- Não existe nenhuma ocorrência de `JIRA_EMAIL` ou `JIRA_API_TOKEN` no projeto.

## Arquivos que serão modificados

1. `supabase/functions/_shared/jira.ts`
2. `supabase/functions/jira-create-panel-task/index.ts`
3. `src/components/admin/JiraTaskDialog.tsx`

Nenhum outro arquivo. Sem migrations. Sem novos componentes.

## Convenção única de secrets

`ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_PROJECT_KEY`, `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID`, `JIRA_ASSIGNEE_ACCOUNT_ID`.

Padrões: `JIRA_PROJECT_KEY = MB`, `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID = 10042`. Nenhum outro nome é aceito e não há fallback silencioso para outra conta: secret ausente vira erro explícito.

## Pré-validação Jira (somente GET, nesta ordem)

```text
1. Verificar secrets presentes
2. GET /rest/api/3/myself
3. GET /rest/api/3/project/MB
4. GET /rest/api/3/mypermissions?projectKey=MB&permissions=CREATE_ISSUES
5. GET /rest/api/3/issue/createmeta?projectKeys=MB&issuetypeIds=10042&expand=projects.issuetypes.fields
6. Exibir diagnóstico
7. Somente após confirmação manual do administrador, permitir a criação real
```

A permissão é considerada válida apenas quando `permissions.CREATE_ISSUES.havePermission === true`. O `createmeta` não confirma permissão: ele serve para confirmar que o tipo `10042` existe dentro do projeto `MB` e quais campos são obrigatórios — por isso é chamado sempre com `projectKeys`, `issuetypeIds` e `expand=projects.issuetypes.fields`, evitando resposta genérica ou paginada.

## Endpoint de diagnóstico `?check=1`

- Exige sessão Supabase válida (401 sem sessão) e papel autorizado — admin ou gestor interno via `has_role` (403 sem papel).
- Executa somente as quatro chamadas GET acima. Nunca chama `POST /rest/api/3/issue`.
- Não cria nem altera tarefa, card ou projeto.
- Não retorna token, e-mail, `Authorization`, headers ou qualquer secret.
- Retorna apenas: usuário Jira resumido (displayName e active), projeto (chave e nome), `havePermission`, tipo permitido (id e nome) e status geral do diagnóstico.

## Payload da criação real

```json
{
  "fields": {
    "project": { "key": "MB" },
    "issuetype": { "id": "10042" }
  }
}
```

A chave do projeto é sempre `MB`; `10038` é apenas o ID técnico e nunca é usado como chave. O tipo é sempre o ID `10042`, nunca o nome. Os demais campos (summary, description, labels, assignee) permanecem exatamente como estão hoje.

## Mapeamento de erros

| Situação | Status devolvido | Mensagem |
| --- | --- | --- |
| Secret ausente ou inválido | 422 | Configuração Jira incompleta: `<nome do secret>` |
| Jira 401 | 401 | Credenciais Atlassian inválidas ou expiradas |
| Projeto 404 ou não visível | 422 | Projeto Jira `<key>` não existe ou não é visível para a conta de serviço |
| Acesso negado ou `CREATE_ISSUES` falso | 403 | Conta de serviço sem permissão para criar itens em `<key>` |
| Tipo não permitido no projeto | 422 | Tipo `<id>` não permitido em `<key>` (lista os tipos permitidos) |
| Campos rejeitados pelo Jira (400 no POST) | 400 | Detalhe campo a campo, conforme resposta do Jira |
| Timeout, falha de rede ou Jira 5xx | 502 | Jira indisponível |

Nenhuma dessas categorias, exceto indisponibilidade real, devolve 502. Nenhuma mensagem inclui credenciais.

## Prévia

Sem efeitos e sem chamada de criação. Passa a exibir:

```text
Projeto: MB (ID 10038)
Tipo: Tarefa (ID 10042)
```

Nunca `I0038` nem `I0042`.

## Preservado integralmente

Texto atual da tarefa, responsável configurado (`JIRA_ASSIGNEE_ACCOUNT_ID`), regras de etapa, deduplicação por card/CNPJ/thread, prévia sem efeitos e fluxo atual do card. Nenhum card existente é alterado. Nenhum projeto é criado.

## Validação após implementação

`npm run build`, depois execução do `?check=1` com usuário admin — somente GETs, nenhuma tarefa real criada. O resultado do diagnóstico dirá quais secrets precisam ser ajustados e se a conta de serviço precisa receber a permissão "Criar itens" no projeto MB (ajuste no Jira, sem correção possível em código).
