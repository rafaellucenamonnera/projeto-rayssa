# Corrigir conclusão de tarefa pelo agente (MCP)

## Diagnóstico confirmado

Consulta ao banco: a tabela `representative_card_tasks` tem as colunas
`status`, `completed_at`, `completed_note`, `created_by`, `updated_by` — e **não** tem `completed_by`.
A ferramenta `complete_task` (`src/lib/mcp/painel/tools/complete-task.ts`, linha 39) envia `completed_by`, por isso o erro
"Could not find the 'completed_by' column".

Também confirmado: a mesma ferramenta já grava auditoria em `representative_card_history`
com `actor_user_id` (quem executou) e ação `tarefa_concluida`. Ou seja, a autoria da conclusão
**já fica registrada** hoje, mesmo sem a coluna.

## Caminho recomendado: caminho 2 (ajustar a ferramenta)

Como a autoria já é auditada no histórico do card, não é preciso mexer no banco.
Isso evita migração, evita recarregar cache de schema e mantém a tela do card
(que também não usa `completed_by`) idêntica.

## O que muda

- `src/lib/mcp/painel/tools/complete-task.ts`: remover `completed_by` do update.
  A tarefa passa a ser atualizada com `status = 'concluida'`, `completed_at` e `completed_note`.
- Manter o registro no histórico como está (ator, data, observação).
- Nenhuma alteração em cards, telas, automações ou banco de dados.

## Resultado

O agente volta a conseguir concluir a tarefa pelo painel; a tarefa deixa de ficar
visualmente pendente e continua havendo registro de quem concluiu, no histórico do card.

## Alternativa (caso queiram a coluna mesmo assim)

Se preferirem autoria gravada na própria linha da tarefa, o caminho é uma migração
adicionando `completed_by uuid` e preenchendo-a na ferramenta. Isso é redundante com o
histórico e exige migração — só faz sentido se houver relatório que leia direto da tabela.
