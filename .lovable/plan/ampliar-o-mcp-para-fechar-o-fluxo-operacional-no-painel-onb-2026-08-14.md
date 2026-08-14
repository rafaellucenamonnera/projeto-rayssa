# Ampliar o MCP para fechar o fluxo operacional no painel Onb Clientes Cross

Escopo desta entrega: apenas CRM (cards, etapas, anexos, comentários, tarefas). Gmail, WhatsApp, SFTP e Google Drive ficam fora deste ciclo.

## O que já existe hoje

- `mover_cliente_cross_etapa` — move o card para qualquer etapa do painel, aceitando o rótulo ("Aguardando Informações") ou o `stage_id`.
- `anexar_arquivo_cliente_cross` — upload base64 (PDF, Excel/CSV, JPG/PNG, até 10 MB).
- `listar_anexos_cliente_cross` — lista anexos com link temporário.
- `listar_paineis` — já devolve todas as etapas de todos os painéis, incluindo "Aguardando Informações" com o `stage_id`.

Essas três ferramentas só aparecem para o agente depois de publicar o app e reconectar o servidor MCP no Codex.

## Fase 1 — Cards e etapas

Novas ferramentas MCP:

- `listar_clientes_cross` — busca por CNPJ, razão social/nome do parceiro, focal, contratante Monnera ou vendedor; filtro opcional por etapa; paginação (padrão 25, máx. 100). Retorna id, nome, CNPJ, etapa (id + rótulo), responsável e data de atualização.
- `obter_cliente_cross` — detalhe completo de um card: todos os campos cadastrais, etapa atual, comentários, tarefas e anexos.
- `listar_etapas_cross` — lista dedicada das etapas do painel (id, rótulo, ordem), para o agente resolver "Aguardando Informações" sem depender de `listar_paineis`.

## Fase 2 — Anexos com deduplicação

- Guardar o hash SHA-256 do conteúdo em cada anexo (nova coluna em `representative_card_attachments`).
- `anexar_arquivo_cliente_cross` passa a calcular o hash; se o mesmo conteúdo já existir no card, não sobe de novo — devolve o anexo existente marcado como duplicado.
- `listar_anexos_cliente_cross` passa a expor o hash, para o agente conferir antes de enviar.

## Fase 3 — Histórico e tarefas

- Nova tabela de tarefas para cards do painel (título, prazo, responsável, status, conclusão), no mesmo formato das tarefas dos cards de embaixador, com as mesmas regras de acesso (admin e gestor de conta).
- Aba **Tarefas** do card Cross passa a usar essa tabela (hoje ela tenta usar a tabela de leads e falha).
- Novas ferramentas MCP: `adicionar_comentario_cliente_cross`, `listar_comentarios_cliente_cross`, `criar_tarefa_cliente_cross`, `listar_tarefas_cliente_cross` (criar tarefa exige título e prazo; responsável opcional, padrão = usuário autenticado).

## Detalhes técnicos

- Painel Cross: `panel_id = painel_msj9fyji`, cards em `representative_cards`, comentários em `representative_card_comments`, anexos em `representative_card_attachments` + bucket `representative-card-attachments`.
- Toda ferramenta usa `supabaseForUser(ctx)` — as RLS existentes continuam valendo; nada roda com chave de serviço.
- Migração necessária: coluna de hash nos anexos + tabela de tarefas dos cards do painel (com GRANTs e RLS espelhando as políticas de comentários).
- Ao final: regenerar o manifesto MCP, publicar o app e reconectar o servidor no Codex para o agente enxergar as novas ferramentas.

## Validação

Com um card real do painel: buscar por CNPJ, abrir o detalhe, mover para "Aguardando Informações", anexar um PDF duas vezes (segunda deve ser detectada como duplicada), comentar, criar tarefa e conferir tudo aparecendo na interface do card.
