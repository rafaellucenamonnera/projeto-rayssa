# Aceitar anexos .doc e .docx nos cards

Hoje os anexos de card aceitam apenas PDF, Excel/CSV e JPG/PNG. A restrição está no código do app (frontend e ferramenta MCP), não no armazenamento.

## O que foi verificado

- O bucket `representative-card-attachments` não tem lista de tipos permitidos nem limite de tamanho configurados no armazenamento — ou seja, nenhuma política de Storage precisa ser alterada para liberar Word.
- A validação bloqueante está em três pontos do código: a lista de extensões permitidas, o seletor de arquivos do painel e a ferramenta MCP.

## Alterações

1. `src/lib/cardAttachments.ts`: incluir `doc` e `docx` na lista de extensões permitidas e ajustar a mensagem de erro para citar Word.
2. `src/components/admin/CardAttachments.tsx`: incluir `.doc,.docx` e os MIME types `application/msword` e `application/vnd.openxmlformats-officedocument.wordprocessingml.document` no atributo de seleção de arquivos, e atualizar o texto de ajuda.
3. `src/lib/mcp/tools/anexar-arquivo-cliente-cross.ts`: incluir `doc`/`docx` na lista fixa de formatos e mapear os MIME types correspondentes para o upload.
4. Regenerar o manifesto MCP.

Limite de 10 MB e verificação de duplicidade por SHA-256 permanecem como estão.

## Depois de implementar

Publicar o projeto para que a Edge Function MCP atualizada entre no ar, e testar o upload de um `.docx` em um card do painel Onb Clientes Cross.
