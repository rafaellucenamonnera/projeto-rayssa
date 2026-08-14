# Auditoria do MCP Cross — o que já existe e o que falta

Verifiquei o código do servidor MCP (22 ferramentas registradas) e as etapas reais do painel `painel_msj9fyji` no banco.

## Já executado

- **Cards Cross**: `listar_clientes_cross` (busca por CNPJ, nome do parceiro, focal, contratante, vendedor + filtro por etapa) e `obter_cliente_cross` (card completo com etapa, comentários, tarefas e anexos).
- **Etapas**: `listar_etapas_cross` retorna os stage_ids reais e `mover_cliente_cross_etapa` movimenta o card. As 8 etapas existem no banco, incluindo "Aguardando Informações" (`etapa_painel_msj9fyji_1786676252012`). Nenhum ID inventado.
- **Comentários**: `adicionar_comentario_cliente_cross` e `listar_comentarios_cliente_cross`.
- **Anexos**: `anexar_arquivo_cliente_cross` (base64, valida formato e 10 MB, calcula SHA-256 e bloqueia duplicado) e `listar_anexos_cliente_cross` (com hash e URL assinada).
- **Tarefas**: `criar_tarefa_cliente_cross` e `listar_tarefas_cliente_cross`.

Observação importante: o endpoint só reflete tudo isso após **publicar o projeto** e reconectar o agente no Codex.

## Lacunas em relação ao pedido

1. Não existe ferramenta separada `buscar_cliente_cross_por_cnpj` (hoje só via `listar_clientes_cross`).
2. O nome esperado `listar_etapas_cliente_cross` não existe (a ferramenta se chama `listar_etapas_cross`).
3. Não existe `listar_historico_cliente_cross` (histórico de movimentação de etapas); hoje só há comentários.
4. `listar_clientes_cross` não devolve `anotacoes` nem `created_at`, e usa `etapa_label` em vez de `stage_label`.
5. `anexar_arquivo_cliente_cross` não aceita `mime_type`, `origem`, `thread_id` nem `sha256` do chamador, e não aplica o padrão de nome `AAAA-MM-DD_HHMM_Nome_Original.ext`.
6. `criar_tarefa_cliente_cross` não aceita `descricao` nem `status` (a tabela de tarefas não tem coluna de descrição).

## Plano de ajuste

**1. Ferramentas de busca**
- Criar `buscar_cliente_cross_por_cnpj` (entrada: `cnpj`; normaliza dígitos; retorna 0, 1 ou N cards com o conjunto mínimo de campos).
- Renomear `listar_etapas_cross` para `listar_etapas_cliente_cross`.
- Padronizar o retorno de card em todas as ferramentas de listagem/busca: `card_id`, `nome_parceiro`, `cnpj`, `focal_nome`, `focal_email`, `focal_telefone`, `stage_id`, `stage_label`, `anotacoes`, `created_at`, `updated_at`.

**2. Histórico**
- Criar `listar_historico_cliente_cross`, combinando comentários, movimentações de etapa, anexos e tarefas em uma linha do tempo única ordenada por data, com `tipo` de evento.
- Registrar automaticamente um comentário de sistema a cada movimentação feita por `mover_cliente_cross_etapa`, para que o histórico de etapa fique auditável.

**3. Anexos**
- Adicionar entradas opcionais `mime_type`, `origem`, `thread_id` e `sha256` em `anexar_arquivo_cliente_cross`.
- Se `sha256` vier informado, validar contra o hash calculado e recusar divergência.
- Renomear o arquivo salvo para `AAAA-MM-DD_HHMM_Nome_Original.ext` (data/hora no fuso de São Paulo).
- Guardar `origem` e `thread_id` como metadados do anexo.

**4. Tarefas**
- Aceitar `descricao` e `status` em `criar_tarefa_cliente_cross`, e devolver esses campos em `listar_tarefas_cliente_cross`.

## Detalhes técnicos

- Migração no banco: colunas `origem` e `thread_id` em `representative_card_attachments`; coluna `descricao` em `representative_card_tasks`.
- Arquivos: novos `src/lib/mcp/tools/buscar-cliente-cross-por-cnpj.ts` e `listar-historico-cliente-cross.ts`; ajustes em `listar-clientes-cross.ts`, `listar-etapas-cross.ts` (renomeada), `anexar-arquivo-cliente-cross.ts`, `criar-tarefa-cliente-cross.ts`, `listar-tarefas-cliente-cross.ts`, `mover-cliente-cross-etapa.ts` e `src/lib/mcp/index.ts`.
- A UI de tarefas (`RepresentativeCardTasks.tsx`) exibirá a descrição quando existir.
- Ao final: regenerar o manifesto MCP, rodar o typecheck e publicar para o endpoint refletir as mudanças.
