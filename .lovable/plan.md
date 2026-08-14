# Verificação do servidor MCP e ajustes em listar_clientes_cross

## Estado atual (verificado no código)

A Edge Function do endpoint `/functions/v1/mcp` é gerada automaticamente a partir de `src/lib/mcp/index.ts` (22 ferramentas registradas). Situação das ferramentas pedidas:

| Ferramenta | Existe? |
| --- | --- |
| `listar_clientes_cross` | Sim |
| `obter_cliente_cross` | Sim (busca por `card_id`) |
| `buscar_cliente_cross_por_cnpj` | Não existe |
| `listar_anexos_cliente_cross` | Sim |
| `listar_tarefas_cliente_cross` | Sim |

`listar_clientes_cross` já é somente leitura, restrita ao painel `painel_msj9fyji`, com paginação. Faltam apenas os parâmetros `panel_id` e `cnpj` (hoje só existe `busca` e `etapa`) e um campo de retorno chamado `etapa`.

## Tabelas e colunas que serão utilizadas (somente leitura)

`public.representative_cards`
- `id` → `card_id`
- `full_name` → `nome_parceiro`
- `cnpj` → `cnpj`
- `stage_id` → `stage_id`
- `focal_name` → `focal_nome`
- `focal_email` → `focal_email`
- `focal_phone` → `focal_telefone`
- `notes`, `contratante_monnera`, `vendor_name/phone/email`, `responsible_user_id`, `created_at`, `updated_at` (já retornados hoje)
- filtro fixo: `panel_id = 'painel_msj9fyji'`

`public.pipeline_stages_config`
- `panel_key`, `value`, `label` → tradução de `stage_id` em `etapa` / `stage_label`

Nenhuma outra tabela é lida ou escrita.

## Alterações propostas

1. `src/lib/mcp/tools/listar-clientes-cross.ts`
   - Novos parâmetros: `panel_id` (opcional; se enviado e diferente de `painel_msj9fyji`, retorna erro claro e não consulta nada), `cnpj` (filtro exato por dígitos), `stage_id` (alias de `etapa`, mantendo `etapa` por compatibilidade).
   - Retorno passa a incluir `etapa` (rótulo legível), mantendo `stage_id` e `stage_label`.
   - Tratamento de erro: mensagens seguras via `fail()`, sem vazar detalhes internos além da mensagem do banco; nenhum log de token, chave ou dados sensíveis.

2. Novo `src/lib/mcp/tools/buscar-cliente-cross-por-cnpj.ts`
   - Entrada: `cnpj` (obrigatório), retorna todos os cards do painel com aquele CNPJ (útil para checagem de duplicidade) com os mesmos campos padronizados.
   - Registro em `src/lib/mcp/index.ts` (23 ferramentas).

3. Regenerar o manifesto MCP e publicar/implantar a função `mcp`.

## Garantias

- Autenticação idêntica às demais ferramentas: `requireAuth(ctx)` + `supabaseForUser(ctx)`, ou seja, RLS roda como o usuário autenticado via OAuth.
- Nenhum uso de service_role ou chave privilegiada.
- `annotations: { readOnlyHint: true }`; nenhuma operação de criação, atualização, movimentação ou exclusão.
