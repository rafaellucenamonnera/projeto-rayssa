# Aplicar correções de paginação e rodar build

Reissue do plano anterior + validação de build/typecheck.

## Escopo
Somente 3 arquivos:
- `src/pages/admin/AdminLeads.tsx`
- `src/components/admin/PipelineKanban.tsx`
- `src/pages/admin/AdminDashboard.tsx`

## Mudanças

### 1. Helper `fetchAllRows` (AdminLeads.tsx e AdminDashboard.tsx)
Loop `.range(from, from + 999)` até `batch.length < pageSize`. Retorna array acumulado.

### 2. AdminLeads.tsx
- Substituir a query de `representative_cards` / `leads` por `fetchAllRows(() => query)`.
- Substituir `lead_stage_history` (`data_saida IS NULL`) por `fetchAllRows`.
- Consumidores usam o array direto (sem `.data`).
- Adicionar `chunkArray(items, 500)` e buscar `commercial_proposals` em blocos via loop sobre `chunkArray(leadIds)`, acumulando em `proposalRows`.

### 3. PipelineKanban.tsx
- `formatCount = v => new Intl.NumberFormat("pt-BR").format(v)`.
- Trocar `{items.length}` na contagem da coluna por `{formatCount(items.length)}`.

### 4. AdminDashboard.tsx
- `formatCount` idem.
- Extrair `buildLeadsQuery()` com `.eq("panel_id", selectedPanel)` obrigatório + filtros de status/consultor/responsável/datas.
- Substituir busca principal e `stalledRes` por `fetchAllRows(...)` no `Promise.all`.
- `leadIdSet` a partir de `leadsData`; `stalledData` filtrado por esse set; detalhes de parados vêm do próprio `leadsData`.
- `navigateToLeadsByStatus` → `/admin/painel/${selectedPanel}?status=...`.
- Card "Total de Leads" navega para `/admin/painel/${selectedPanel}`.
- Aplicar `formatCount(...)` em `totalParceiros`, `totalLeads`, `count` de cada etapa e ranking (`r.total`, `r.convertidos`, `r.assinados`).

## Detalhes técnicos

Para não estourar o typecheck do supabase-js com strings de `.select()` complexas, o helper aceita o retorno do builder como `any` e retorna `T[]` via generic:
```ts
const fetchAllRows = async <T,>(buildQuery: () => any, pageSize = 1000): Promise<T[]> => { ... };
```
Cada chamada de `buildQuery` cria um novo builder para que `.range()` não seja aplicado em cima de um filtro anterior.

## Validação
- `npm run build` (o harness roda typecheck automaticamente; corrijo qualquer erro que aparecer, mantendo o mesmo comportamento).
- Smoke test manual (usuário): `/admin/painel/comercial` mostra contagem real formatada em colunas com >1000 cards; `/admin` bate com o painel comercial; clique em etapa abre `/admin/painel/comercial?status=...`.

## Fora de escopo
Schema, migrations, RLS, pipeline, drag/drop, financeiro, propostas, permissões.
