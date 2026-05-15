## Objetivo
Aplicar o diff do `src/App.tsx` adicionando a rota dinâmica `/admin/painel/:panelId` que reaproveita `AdminLeads`, permitindo abrir qualquer painel criado dinamicamente em `AdminPipelineEdit`.

## Mudanças

### 1. `src/App.tsx`
Adicionar a linha:
```tsx
<Route path="painel/:panelId" element={<AdminLeads />} />
```
logo após `<Route path="painel-campanhas" element={<AdminLeads />} />`, exatamente como no diff. Nada mais é alterado.

### 2. `src/pages/admin/AdminLeads.tsx` (mínimo necessário para a rota funcionar)
- Ler `useParams<{ panelId?: string }>()` além do `useLocation` atual.
- Quando `panelId` existir:
  - Buscar `pipeline_panels` pelo `id` para obter o `name` e usá-lo como `painelTitle` (fallback: "Painel").
  - Carregar `pipeline_stages_config` filtrado por `panel_key = panelId` para popular os estágios/colunas exibidos (em vez do mapeamento fixo de `painelTitleMap`).
- Quando não houver `panelId`, manter 100% do comportamento atual (rotas estáticas `painel-comercial`, `painel-onboarding`, etc. continuam funcionando como hoje).

### 3. `src/components/AdminSidebar.tsx`
- Carregar `pipeline_panels` (ordenados por `sort_order`) via `useEffect`.
- Para cada painel retornado pelo banco que **não** corresponda a um dos 4 painéis fixos já listados (comercial, onboarding, sucesso, campanhas — match por `name` case-insensitive), adicionar item extra apontando para `/admin/painel/{panel.id}`.
- Aplicar o mesmo filtro de permissão: admin vê tudo; não-admin só vê se `canAccessPanel(panel.id)` retornar true (o hook `usePanelPermissions` já usa `panel_id` como chave, então funciona para painéis dinâmicos).

## Fora de escopo
- Não alterar `usePanelPermissions`, RLS, schema do banco, nem o fluxo de criação de painéis em `AdminPipelineEdit` (já implementado).
- Não mexer em estilos/layout.

## Detalhes técnicos
- A rota dinâmica fica **dentro** de `<Route path="/admin" element={<AdminLayout />}>`, então `AdminLayout` (com sidebar) é preservado.
- `useParams` em `AdminLeads` retorna `undefined` para rotas estáticas, então o branch dinâmico fica isolado.
- Os estágios dinâmicos vêm de `pipeline_stages_config.panel_key = panelId`. Se a tabela retornar vazia, mostrar mensagem "Nenhuma coluna configurada para este painel".
