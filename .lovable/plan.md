## Contexto
Depois do Bloco 5A aplicado, falta conectar as queries, movimentação, exclusão e update dos cards do painel de Embaixadores à tabela correta (`ambassador_cards` vs `representative_cards`).

## Escopo
Apenas `src/pages/admin/AdminLeads.tsx` — 5 edições cirúrgicas, nenhuma alteração estrutural.

## Mudanças

1. **Query de carregamento condicional**
   Em `loadData`, alterar a query de cards customizados:
   `from(isAmbassadorPanel ? "ambassador_cards" : "representative_cards")`

2. **Normalizar notes como descrição_necessidade**
   No `.map` dos cards customizados em `loadData`, adicionar:
   `descricao_necessidade: card.notes`

3. **Movimentação de cards customizados sem regras comerciais**
   No início de `handleStatusChange`, logo após `const lead = ...`, adicionar early-return:
   - Se `isCustomCrmPanel`, chamar `moveRepresentativeCard(leadId, newStatus)`
   - Atualizar estado local (`stage_id`, `status_lead`) e detalhe aberto
   - Exibir toast de sucesso
   - Retornar imediatamente (sem passar pelas regras de pipeline comercial)

4. **Exclusão da tabela correta**
   Em `handleDelete`:
   - Ajustar mensagens de confirmação/erro/sucesso para dizer "card" ou "lead" conforme o painel
   - Definir `tableName` com lógica: `ambassador_cards` → `representative_cards` → `leads`
   - Executar `delete` na tabela correta via `(supabase as any)`

5. **Update customizado condicional**
   Em `updateRepresentativeCard`, alterar:
   `from(isAmbassadorPanel ? "ambassador_cards" : "representative_cards")`

## Fora de escopo (próximo bloco 5C)
- Criação manual de novos cards
- Formulário de edição de cards
- UI do modal de detalhes do card de Embaixador

## Riscos / Notas
- `isAmbassadorPanel` e `isCustomCrmPanel` já existem no escopo do componente após o Bloco 5A.
- `moveRepresentativeCard` chama `updateRepresentativeCard`; a edição 5 garante que a tabela será a correta no momento da chamada.
- Nenhuma mudança em outros arquivos.