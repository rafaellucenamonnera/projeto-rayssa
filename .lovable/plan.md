# Expor anexos e movimentação de etapa no MCP

## Situação atual (verificada)

As três ferramentas que faltavam **já existem no código e no manifesto** do servidor MCP deste app (`.lovable/mcp/manifest.json` lista 15 ferramentas):

- `mover_cliente_cross_etapa` — move o card para qualquer etapa do painel Onb Clientes Cross, aceitando o rótulo (ex.: "Aguardando Informações") ou o `stage_id`.
- `anexar_arquivo_cliente_cross` — upload de PDF, Excel/CSV, JPG/PNG até 10 MB em base64.
- `listar_anexos_cliente_cross` — lista anexos do card com link temporário de download.

O endpoint publicado (`/functions/v1/mcp`) responde, mas exige OAuth, então a lista de ferramentas que o agente do Codex enxerga só é atualizada depois de um novo publish + reconexão. Enquanto isso, o agente continua vendo a versão antiga (12 ferramentas) — daí a sensação de que as limitações permanecem.

## O que fazer

1. Publicar o app para implantar a versão atual do servidor MCP (as ferramentas novas só entram no ar no publish).
2. No Codex, atualizar/reconectar o servidor MCP (`https://bapxuzodzgahscatvofs.supabase.co/functions/v1/mcp`) para ele recarregar a lista de ferramentas.
3. Validar ponta a ponta com um card real do painel Onb Clientes Cross:
   - mover para "Aguardando Informações" via `mover_cliente_cross_etapa`;
   - anexar um PDF de teste via `anexar_arquivo_cliente_cross`;
   - confirmar com `listar_anexos_cliente_cross` e conferir o anexo aparecendo no card na interface.

## Detalhes técnicos

- Storage: bucket `representative-card-attachments`, registro em `representative_card_attachments` — mesmas RLS usadas pela interface, então o agente só faz o que o usuário autenticado pode fazer.
- Etapas: resolvidas em `pipeline_stages_config` por `panel_key = painel_msj9fyji`, comparando `value` e `label` sem acento/caixa.
- Nenhuma alteração de schema é necessária.

Se após o publish e a reconexão o agente ainda não listar as três ferramentas, o próximo passo é inspecionar o manifesto servido pelo endpoint autenticado e corrigir o registro em `src/lib/mcp/index.ts`.
