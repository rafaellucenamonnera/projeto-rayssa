# Corrigir criação de tarefas no Jira (erro 502 / "projeto não existe")

## O que foi verificado

Consultei o Jira do site monnera.atlassian.net (projetos visíveis com ação `create`):

| Projeto | id | key | Tipos disponíveis |
| --- | --- | --- | --- |
| Monnera Board | 10038 | **MB** | Tarefa (10042), Subtarefa (10043), Bug (10047), Epic (10000), Forms (10039) |

Ou seja: o id `10038` e o tipo `10042` (Tarefa) **existem e são válidos** no projeto MB. O texto "Projeto: I0038 / Tipo: I0042" na prévia é apenas a exibição do id técnico, não um valor corrompido.

Não existem hoje os secrets `JIRA_PROJECT_KEY` nem `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID`: os valores estão fixos no código (`supabase/functions/jira-create-panel-task/index.ts` e `_shared/jira.ts`).

Consequência: como o alvo está correto, a mensagem "O projeto não existe, ou você não tem direito neste projeto para criar questões" indica que **a conta usada pelos secrets `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN` não tem a permissão "Criar itens" no projeto MB** (ou o token pertence a outra conta/site). Essa hipótese ainda não está confirmada — a verificação dela é o primeiro passo da implementação, feita por leitura, sem criar nada.

## O que será feito

1. **Configuração por secret, com validação**
   - Passam a ser lidos `JIRA_PROJECT_KEY` (padrão `MB`) e `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID` (padrão `10042`).
   - O payload passa a usar `project: { key: <JIRA_PROJECT_KEY> }` e `issuetype: { id: <tipo> }`.
   - Antes do POST, a função faz duas leituras: `GET /rest/api/3/project/{key}` e `GET /rest/api/3/issue/createmeta` para o projeto. Isso confirma, na mesma chamada, se o projeto existe, se a conta o enxerga, se pode criar itens nele e se o tipo informado é permitido.

2. **Diagnóstico da conta de serviço**
   - Endpoint de verificação somente-leitura (`?check=1`) que responde: conta autenticada (`/myself`), projeto visível, permissão `CREATE_ISSUES` (`/mypermissions`), tipos permitidos. Nenhum token, e-mail ou header é devolvido.

3. **Erros separados e com status correto** (nada de 502 para configuração/rejeição):

   | Situação | status | mensagem |
   | --- | --- | --- |
   | Secret ausente/ inválido | 422 | Configuração Jira incompleta: `<nome do secret>` |
   | Projeto inexistente | 422 | Projeto Jira `<key>` não existe |
   | Conta sem acesso ao projeto | 403 | Conta de serviço sem acesso ao projeto `<key>` |
   | Sem permissão de criar itens | 403 | Conta de serviço sem permissão para criar itens em `<key>` |
   | Tipo de item inválido | 422 | Tipo de item `<id>` não permitido em `<key>` (lista os permitidos) |
   | Campos obrigatórios inválidos | 400 | Campo a campo, conforme resposta do Jira |
   | Credenciais inválidas | 401 | Credenciais Atlassian inválidas ou expiradas |
   | Indisponibilidade do Jira (5xx/timeout) | 502 | Jira indisponível — apenas neste caso |

4. **Sem alteração de comportamento no resto**: texto da tarefa, responsável (`JIRA_ASSIGNEE_ACCOUNT_ID`), regras de etapa, deduplicação, prévia e fluxo do card permanecem exatamente como estão. A prévia continua sem efeitos; passa a exibir também a chave do projeto e o nome do tipo, além dos ids.

5. **Nada é criado nem alterado**: nenhum projeto criado, nenhum card existente tocado, nenhuma tarefa real durante a validação.

6. **Validação**: `npm run build` e execução do endpoint de verificação e da prévia (dry-run).

## Detalhes técnicos

- `supabase/functions/jira-create-panel-task/index.ts`: leitura dos secrets com defaults, pré-checagem (`/project/{key}`, `/mypermissions?projectKey=`, `/issue/createmeta`), mapeamento de status, `error_kind` por categoria; `record_automation_run` recebe a categoria.
- `supabase/functions/_shared/jira.ts`: constantes passam a ler os mesmos secrets (mantendo a JQL por id quando disponível).
- `src/components/admin/JiraTaskDialog.tsx`: exibe a categoria, o status e a mensagem; prévia mostra `MB (10038)` e `Tarefa (10042)`.
- Sem migrations.

## Configuração no Supabase Secrets (após implementação)

- `JIRA_PROJECT_KEY = MB` (chave real confirmada no site monnera.atlassian.net).
- `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID = 10042` (tipo "Tarefa" do projeto MB).
- `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN`: precisam pertencer a uma conta com permissão **Criar itens** no projeto MB. Se a verificação apontar falta de permissão, é necessário conceder essa permissão à conta no Jira — não há correção possível no código.
- `JIRA_ASSIGNEE_ACCOUNT_ID`: mantido como está.
