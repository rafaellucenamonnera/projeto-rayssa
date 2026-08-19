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

1. **Configuração por secret, com nomes únicos**
   - Secrets lidos: `JIRA_PROJECT_KEY` (padrão `MB`), `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID` (padrão `10042`), `ATLASSIAN_SITE_URL`, `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`, `JIRA_ASSIGNEE_ACCOUNT_ID`.
   - Convenção única em todos os arquivos: `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN`. Nenhum fallback silencioso para `JIRA_EMAIL` ou outra conta — secret ausente é erro explícito.
   - Payload da criação real, sem substituições: `project: { key: "MB" }` (chave, nunca o id) e `issuetype: { id: "10042" }` (id, nunca o nome).

2. **Pré-checagem somente leitura, nesta ordem**

   ```text
   1. Verificar secrets presentes
   2. GET /rest/api/3/myself
   3. GET /rest/api/3/project/MB
   4. GET /rest/api/3/mypermissions?projectKey=MB&permissions=CREATE_ISSUES
   5. GET /rest/api/3/issue/createmeta?projectKeys=MB&issuetypeIds=10042&expand=projects.issuetypes.fields
   6. Exibir diagnóstico
   7. Somente após confirmação manual do administrador, permitir a criação real
   ```

   - Autorizado apenas quando `permissions.CREATE_ISSUES.havePermission === true`. O `createmeta` sozinho não vale como prova de permissão; serve para confirmar o tipo dentro do projeto e os campos obrigatórios.
   - O `createmeta` é sempre chamado com `projectKeys` e `issuetypeIds` explícitos e `expand=projects.issuetypes.fields`, para evitar resposta paginada ou genérica.

3. **Endpoint de diagnóstico protegido (`?check=1`)**
   - Exige sessão Supabase válida e papel de administrador (mesma checagem `has_role` já usada na função). Sem sessão → 401; sem papel → 403.
   - Executa **apenas** `/myself`, `/project/{key}`, `/mypermissions`, `/createmeta`. Nunca executa `POST /rest/api/3/issue`.
   - Retorna somente: nome de exibição da conta Jira, chave/nome do projeto, `havePermission`, tipos permitidos. Nunca token, e-mail, headers ou qualquer secret.

4. **Erros separados e com status correto** (502 apenas para indisponibilidade real):

   | Situação | resposta do Jira | status devolvido | mensagem |
   | --- | --- | --- | --- |
   | Secret ausente/inválido | — | 422 | Configuração Jira incompleta: `<nome do secret>` |
   | Credenciais inválidas | 401 | 401 | Credenciais Atlassian inválidas ou expiradas |
   | Projeto não visível ou inexistente | 404 em `/project/MB` | 422 | Projeto Jira `<key>` não existe ou não é visível para a conta de serviço |
   | Conta sem acesso ao projeto | 403 no projeto | 403 | Conta de serviço sem acesso ao projeto `<key>` |
   | Sem permissão de criar itens | `havePermission === false` | 403 | Conta de serviço sem permissão CREATE_ISSUES em `<key>` |
   | Tipo de item inválido | ausente no createmeta | 422 | Tipo `<id>` não permitido em `<key>` (lista os permitidos) |
   | Campos obrigatórios inválidos | 400 no POST | 400 | Campo a campo, conforme resposta do Jira |
   | Jira 5xx, timeout ou falha de rede | 5xx/timeout | 502 | Jira indisponível |

5. **Sem alteração de comportamento no resto**: texto da tarefa, responsável (`JIRA_ASSIGNEE_ACCOUNT_ID`), regras de etapa, deduplicação e fluxo do card permanecem exatamente como estão.

6. **Prévia**: continua sem efeitos e sem acionar criação — nenhuma chamada de POST a partir do frontend. Passa a exibir `Projeto: MB (ID 10038)` e `Tipo: Tarefa (ID 10042)`, eliminando a leitura ambígua "I0038 / I0042".

7. **Nada é criado nem alterado**: nenhum projeto criado, nenhum card existente tocado, nenhuma tarefa real durante a validação.

8. **Validação**: `npm run build` e execução do `?check=1` e da prévia (dry-run).

## Detalhes técnicos

- `supabase/functions/jira-create-panel-task/index.ts`: leitura dos secrets (sem fallback), ramo `?check=1` com autenticação e `has_role('admin')`, pré-checagem na ordem definida, mapeamento status→categoria (`error_kind`), `record_automation_run` recebendo a categoria; nenhum POST no ramo de diagnóstico.
- `supabase/functions/_shared/jira.ts`: passa a usar exclusivamente `ATLASSIAN_EMAIL`/`ATLASSIAN_API_TOKEN` e os mesmos secrets de projeto/tipo (JQL continua por id `10038`/`10042`).
- `src/components/admin/JiraTaskDialog.tsx`: exibe categoria, status e mensagem; prévia com `MB (ID 10038)` e `Tarefa (ID 10042)`; botão de diagnóstico chamando `?check=1`.
- Sem migrations.


## Configuração no Supabase Secrets (após implementação)

- `JIRA_PROJECT_KEY = MB` (chave real confirmada no site monnera.atlassian.net).
- `JIRA_IMPLEMENTATION_ISSUE_TYPE_ID = 10042` (tipo "Tarefa" do projeto MB).
- `ATLASSIAN_EMAIL` / `ATLASSIAN_API_TOKEN`: precisam pertencer a uma conta com permissão **Criar itens** no projeto MB. Se a verificação apontar falta de permissão, é necessário conceder essa permissão à conta no Jira — não há correção possível no código.
- `JIRA_ASSIGNEE_ACCOUNT_ID`: mantido como está.
