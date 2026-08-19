# Validação pré-publicação — correção do bundle da função `mcp`

## Contexto já verificado (somente leitura, sem execução)

- `supabase/functions/mcp/deno.json` existe e fixa `vite` em `npm:vite@7.3.1` para a resolução de peer dependency da função.
- `package.json` contém o override `rolldown: 1.2.4` e a dependência `vite: ^7.3.1`.
- Vite resolvido no projeto: **7.3.1** (confirmado em `node_modules`).
- `rolldown` **não está presente** em `node_modules` — ele só aparecia na árvore de resolução do bundler Deno via peer `vite@8`, que agora está travada em 7.3.1.
- Último registro de build: `build OK` em 2026-08-19T14:26:41Z.

## Roteiro de validação a executar (após aprovação)

1. `npm ci` — reinstalação limpa a partir do lockfile, confirmando que os overrides resolvem sem conflito.
2. `npm run build` — build de produção do frontend; qualquer erro é corrigido antes de seguir.
3. Typecheck com `tsgo` — sem erros de TypeScript.
4. Reconfirmar versões resolvidas após a instalação: `vite` = 7.3.1 e nenhum `rolldown` fora de 1.2.4.
5. Deploy da função `mcp`. Observação: no ambiente de desenvolvimento a função MCP é retida e só é implantada no publish; nesse caso a validação de bundle acontece no próprio publish, e os logs serão lidos logo após.
6. Leitura dos logs da função `mcp` para confirmar boot sem erro e ausência de falha de bundle.

## Garantias durante a validação

- Nenhuma outra Edge Function é editada ou reimplantada; apenas `mcp`.
- Nenhum card, tarefa Jira, e-mail de onboarding ou material Canva é criado ou alterado — nenhuma dessas rotas é acionada pelos comandos acima.
- O cron `jira-sync-panel-tasks` permanece em modo somente leitura (`dry_run`), sem persistir vínculos ou códigos.
- Nenhuma migration é aplicada.

## Resultado esperado

Build e typecheck sem erros, versões confirmadas e logs da `mcp` limpos. Com isso, a publicação pode ser refeita.
