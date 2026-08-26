# Corrigir erro "uploaded_by" no upload de anexos (MCP)

## Diagnóstico (verificado)

A tabela `representative_card_attachments` existe com estas colunas:
`id, representative_card_id, storage_path, file_name, mime_type, size_bytes, created_by, created_at, content_sha256, task_id`.

Não existe coluna `uploaded_by`. O autor do anexo é gravado em `created_by`.

Duas ferramentas MCP do painel usam o nome errado:
- `src/lib/mcp/painel/tools/attach-file.ts` — insere `uploaded_by: userId` (causa direta do erro).
- `src/lib/mcp/painel/tools/list-attachments.ts` — seleciona `uploaded_by` (quebraria a leitura).

Todo o resto do projeto já usa `created_by`: `src/lib/cardAttachments.ts` (upload pela interface) e `src/lib/mcp/tools/anexar-arquivo-cliente-cross.ts`.

## Decisão

Alinhar o código ao schema, **sem migração**. Criar a coluna `uploaded_by` duplicaria a informação de autoria já mantida em `created_by` e deixaria dois campos concorrentes para o mesmo dado — pior para auditoria e inconsistente com a interface, que continuaria gravando só `created_by`. A correção mínima e segura é usar `created_by` nas duas ferramentas MCP.

Nenhuma alteração de dados, RLS ou storage é necessária. A política atual ("Admins and gestores manage card attachments") não referencia autoria, então continua válida.

## Alterações

1. `src/lib/mcp/painel/tools/attach-file.ts`: trocar `uploaded_by: userId` por `created_by: userId` no insert, e `uploaded_by` por `created_by` na lista de colunas do `.select(...)`.
2. `src/lib/mcp/painel/tools/list-attachments.ts`: trocar `uploaded_by` por `created_by` no `.select(...)`.

## Validação antes de publicar

- Build limpo.
- Upload de arquivo de teste via `attach_file` em um card do painel `painel_msj9fyji`: retorna `attachment_id`, `content_sha256`, `size_bytes` e URL assinada.
- `list_attachments` retorna o registro com metadados e autoria.
- `attach_file` com `task_id` válido grava o vínculo; com `task_id` inválido retorna `TASK_NOT_FOUND`.
- Sem sessão OAuth: retorna `UNAUTHENTICATED`; com usuário sem papel admin/gestor: bloqueio por RLS.
- Nenhum card real alterado — apenas linhas novas em `representative_card_attachments` do card de teste, removíveis por `delete_attachment`.

Publicação em produção somente após sua aprovação do resultado do teste.
