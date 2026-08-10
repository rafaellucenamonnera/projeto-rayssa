# Corrigir contadores por coluna no painel Onb Clientes Cross

Os cartões de resumo no topo (Cadastro, Criação Painel, Material Onboarding Cliente, Recebimento Dados, Cadastro Campanha) mostram 0 mesmo com cards nas colunas.

## Causa

O cálculo dos totais no topo lê apenas os campos `status_lead`/`status`, usados pelo painel comercial. Os cards deste painel guardam a etapa em `stage_id`, então nenhum card é contado e todos os cartões ficam em 0. O kanban, que já lê `stage_id`, mostra a contagem correta (por isso "Criação Painel" aparece com 1 na coluna e 0 no cartão).

## Correção

- Ajustar o cálculo dos totais por etapa para considerar `stage_id` antes de `status_lead`/`status`, igual à lógica do kanban.
- Com isso os cartões passam a refletir os mesmos números das colunas, inclusive após criar, editar ou arrastar um card (o estado local já é atualizado nessas ações).

## Detalhe técnico

`src/pages/admin/AdminLeads.tsx`, memo `statusCounts` (~linha 1880): trocar
`const s = l.status_lead || l.status || "novo_lead"` por
`const s = l.stage_id || l.status_lead || l.status || "novo_lead"`.

Verificação: typecheck limpo e conferência visual de que os cartões batem com as colunas.
