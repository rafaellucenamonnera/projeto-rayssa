# Mostrar a coluna atual do card no campo "Pipeline" da visão em Lista

## Problema
Na visão em Lista dos painéis personalizados (ex.: Onb Clientes Cross), o seletor "Pipeline" aparece vazio. O seletor procura a etapa no campo usado pelo Painel Comercial, mas os cards desses painéis guardam a etapa em outro campo (a coluna do Kanban). Como não encontra correspondência, fica em branco.

## Mudança proposta
1. O seletor "Pipeline" passa a mostrar a coluna em que o card está no Kanban (ex.: "Cadastro", "Recebimento Dados").
2. Ao trocar a opção na Lista, o card é movido com o mesmo procedimento do arrastar no Kanban (mesmas validações, confirmações e histórico).
3. Se a etapa do card não existir mais na configuração do painel, o seletor mostra "Sem etapa" em vez de ficar vazio.
4. O Painel Comercial continua igual.

## Detalhes técnicos
- `src/pages/admin/AdminLeads.tsx`, componente `StatusSelect`:
  - valor: `isCustomCrmPanel ? lead.stage_id : (lead.status_lead || lead.status || "novo_lead")`.
  - `onValueChange`: em painéis personalizados, chamar o mesmo manipulador de movimentação usado pelo Kanban (`moveRepresentativeCard` / handler de drop, linha ~2008), mantendo `handleStatusChange` para o comercial.
  - `SelectValue placeholder="Sem etapa"`.
- Sem alteração de banco, permissões ou automações.

## Validação
Abrir o Onb Clientes Cross em Lista, conferir que cada linha mostra a coluna do Kanban, trocar a etapa de um card de teste e confirmar no Kanban.
