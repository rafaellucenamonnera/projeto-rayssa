# Habilitar `listar_clientes_cross` para o agente

## Diagnóstico

A ferramenta **já existe no código e no manifesto** do servidor MCP: o manifesto atual lista 22 ferramentas, incluindo `listar_clientes_cross`, `obter_cliente_cross`, `listar_etapas_cross`, comentários, tarefas e anexos do painel Cross. A função `mcp` gerada em `supabase/functions/mcp/index.ts` também já contém essa ferramenta.

O que falta é a implantação: o deploy da função MCP foi retido no ambiente de desenvolvimento e só acontece no **publish**. Enquanto o app não for publicado novamente, o endpoint em produção continua servindo a versão antiga (sem as ferramentas do painel Cross), e o Codex segue exibindo a lista antiga em cache.

## O que precisa acontecer

1. **Publicar o app.** Isso implanta a versão atual da função `mcp` com as 22 ferramentas.
2. **Reconectar o servidor no Codex** (remover e adicionar de novo a URL de conexão), para o agente recarregar a lista de ferramentas — só reiniciar a sessão normalmente não invalida o cache.
3. **Eu valido depois do publish**: conferir que o endpoint anuncia `listar_clientes_cross` e as demais ferramentas do painel Cross, e checar os logs da função caso alguma retorne erro.

## Ajuste que farei junto (para a varredura sem duplicidade)

Para a varredura completa do painel ficar segura, `listar_clientes_cross` ganha:

- retorno padronizado com `card_id`, `nome_parceiro`, `cnpj`, `focal_nome`, `focal_email`, `focal_telefone`, `stage_id`, `stage_label`, `anotacoes`, `created_at`, `updated_at`;
- paginação explícita no retorno (`total`, `offset`, `limite`, `tem_mais`), para o agente percorrer todos os cards sem perder nenhum;
- opção de agrupar por CNPJ, sinalizando quais CNPJs têm mais de um card (detecção de duplicidade em uma chamada só).

## Detalhes técnicos

- Arquivo alterado: `src/lib/mcp/tools/listar-clientes-cross.ts`; nenhuma mudança de banco.
- Após o ajuste: regenerar o manifesto MCP, rodar o typecheck e publicar.
- Reforço: a função MCP só vai ao ar no publish; qualquer alteração futura em ferramenta exige novo publish.
