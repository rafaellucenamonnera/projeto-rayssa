
# Plano — Card Sucesso com expandir/recolher e receita dinâmica

Sem refatoração estrutural. Apenas extensões em arquivos já existentes.

## 1. Sync (`supabase/functions/sync-drive-clients/index.ts`)

A planilha de Saúde tem colunas mensais a partir da coluna **O** (jun/25) até a última (hoje **X** = mar/26). A regra é sempre: **última coluna mensal = receita atual**, **penúltima coluna mensal = receita anterior**.

- Detectar dinamicamente o intervalo de colunas mensais no header (a partir da coluna `O`, header com formato `mmm./aa`, ex.: `mar./26`).
- Pegar as **duas últimas** colunas válidas dessa faixa (ignorando colunas vazias à direita).
- Para cada linha (cliente), extrair:
  - `revenue_current` = valor numérico da última coluna (parse "R$ 6.643" → 6643).
  - `revenue_previous` = valor da penúltima coluna.
  - `revenue_variation` = (current − previous) / previous (null se previous = 0).
  - `revenue_current_month` / `revenue_previous_month` = textos do header (ex.: "mar./26", "fev./26").
- Persistir em `leads`: já existem `revenue_current`, `revenue_previous`, `revenue_variation`. Adicionar 2 novas colunas: `revenue_current_month` e `revenue_previous_month` (text, nullable).
- Manter sincronização atual de Status / Impacto / Mensalidade / Campanha intacta.

## 2. Migration

Adicionar somente:
- `leads.revenue_current_month text`
- `leads.revenue_previous_month text`

(Os campos numéricos `revenue_current`, `revenue_previous`, `revenue_variation` já existem.)

## 3. Card kanban (`src/components/admin/PipelineKanban.tsx`)

Aplicar somente quando `showCsInsteadOfPartner` (modo Sucesso). Modo comercial fica intacto.

### Estado
- Adicionar `expandedCardId: string | null` (similar ao `selectedCardId`).
- Handler `onDoubleClick` no card: alterna `expandedCardId` entre `l.id` e `null`.
- Clique simples: mantém comportamento atual (selecionar / abrir modal no segundo clique).

### Card fechado (modo Sucesso, padrão)
Mantido conforme hoje, mas com conteúdo enxuto:
- Faixa de Status no topo (cor + nome do cliente) — **mantida**.
- Linha "Ação: <responsável>" — mantida.
- Linha "CS: <consultor>" — mantida.
- Faixa de Impacto (fundo + borda) — **mantida**, mas o conteúdo dentro dela passa a ser:
  - Label "Impacto: <nível>" (como hoje).
  - **Substituir** as 3 pílulas (Mensalidade / Campanha / Pagamento) por **uma única linha**:
    - `Receita: R$ X.XXX` em destaque.
    - Seta ↑ verde se `revenue_variation > 0`, ↓ vermelha se `< 0`, → cinza se 0/sem dado.
    - `+12%` ao lado da seta (mesma cor).
    - Tooltip com "Atual: mar/26 vs Anterior: fev/26" usando `revenue_current_month` / `revenue_previous_month`.
- **Removidos do card fechado**: pílulas Mensalidade/Campanha/Pagamento, blocos "Campanha atual / mês anterior", CSAT, badges Status/Impacto duplicadas.

### Card expandido (após duplo clique)
Mostra tudo que existe hoje após a linha de receita:
- As 3 pílulas Mensalidade / Campanha / Pagamento (com variações ↑↓).
- Bloco "Campanha atual (mês X)" + "Mês anterior (mês Y)" com badges de status (já implementado por `showCampaignStatus`).
- CSAT (se existir).
- Pequeno ícone/botão "Recolher" no canto superior direito da área expandida (reusa o estilo dos botões existentes).

### UX
- Ao expandir, o card cresce verticalmente dentro da coluna do kanban (sem modal).
- Duplo clique novamente recolhe.
- Sem alteração no drag-and-drop, no clique simples ou nos botões Editar/Excluir/Clonar/Responsável.

## 4. Tipos / dados

- Adicionar `revenue_current`, `revenue_previous`, `revenue_variation`, `revenue_current_month`, `revenue_previous_month` em `KanbanLeadCardData`.
- Em `AdminLeads.tsx`, incluir esses campos no `select` do fetch de leads do painel Sucesso (sem mudar filtros nem layout da página).

## 5. Fora de escopo (não mexer)

- Modo comercial / outros painéis (mantém visual atual).
- Filtros, lista, exportação, modal de detalhe.
- Quaisquer outras tabelas, RLS, edge functions além do sync.

## Resumo de arquivos tocados
- `supabase/functions/sync-drive-clients/index.ts` — detecção dinâmica das 2 últimas colunas mensais e gravação dos novos campos.
- Migration — 2 colunas novas em `leads`.
- `src/components/admin/PipelineKanban.tsx` — estado de expansão, duplo clique, layout do card fechado/expandido.
- `src/pages/admin/AdminLeads.tsx` — incluir novos campos no select do painel Sucesso.
