## Fase 2 — Performance no Painel Comercial

Escopo restrito a 4 arquivos. Sem tocar em schema, permissões, propostas públicas ou financeiro. Fase 1 permanece intacta.

---

### 1. `src/pages/admin/AdminLeads.tsx` — carregamento incremental por coluna

Aplicado **apenas** quando `["comercial","comerc"].includes(currentPanelId)` e não houver painel customizado. Outros painéis mantêm o fluxo atual de `loadData()`.

**Novos estados:**
```ts
const [stageTotals, setStageTotals] = useState<Record<string, number>>({});
const [stageLoadedPages, setStageLoadedPages] = useState<Record<string, number>>({});
const [stageLoadingMore, setStageLoadingMore] = useState<Record<string, boolean>>({});
const STAGE_PAGE_SIZE = 30;
```

**Carga inicial (`loadData` no ramo comercial):**
- Sem `.select("*")` global de leads.
- Para cada `stage` de `pipelineStages` em paralelo:
  1. `supabase.from("leads").select("id", { count: "exact", head: true }).eq("panel_id", currentPanelId).eq("status_lead", stage.value)` → alimenta `stageTotals[stage.value]`.
  2. `supabase.from("leads").select("<campos do card>").eq("panel_id", currentPanelId).eq("status_lead", stage.value).order("data_cadastro", { ascending: false }).range(0, STAGE_PAGE_SIZE - 1)`.
- **Campos do card:** exatamente os lidos pelo `PipelineKanban`, incluindo pelo menos:
  `id, panel_id, nome_fantasia, razao_social, nome_responsavel, status_lead, valor_setup, valor_mensalidade, valor_campanhas, proposta_url, numero_proposta, qtd_parcelas, quantidade_lojas, parceiro_id, data_cadastro, updated_at, valor_mensalidade_anterior, valor_campanhas_anterior, valor_pagamento, valor_pagamento_anterior, juros_recebidos, multas_recebidas, receita_taxa_boleto, revenue_total, campaign_status_current, campaign_status_previous, campaign_status_current_month, campaign_status_previous_month, csat_current, csat_previous, csat_variation, csat_direction, health_status, impact_level, consultor, revenue_current, revenue_previous, revenue_variation, revenue_current_month, revenue_previous_month, dados_completos, responsible_user_id, responsible_slack_user_id`.
- **Merge sem duplicar por `id`** ao popular `leads`:
  ```ts
  setLeads(prev => [...prev, ...novos.filter(n => !prev.some(p => p.id === n.id))]);
  ```
- Inicializa `stageLoadedPages[stage.value] = 1`.
- `lead_stage_history`, `commercial_proposals` e `reunioes` passam a ser buscados **apenas para os IDs carregados**, em chunks de ~200 via `.in("lead_id", chunk)`. Reexecuta incremental quando novos IDs chegam.

**`loadMoreCommercialStage(stageValue)`:**
- Guarda por `stageLoadingMore[stageValue]`.
- `page = stageLoadedPages[stageValue] ?? 1`, offset `page * STAGE_PAGE_SIZE`.
- `.range(offset, offset + STAGE_PAGE_SIZE - 1)` com mesmo `select` e filtros.
- Merge dedupe por `id` (mesmo padrão acima).
- Incrementa `stageLoadedPages[stageValue]`.
- Fetch incremental de history/proposals/reunioes só para novos IDs.

**Abrir card:**
- `supabase.from("leads").select("*").eq("id", id).single()`.
- Setar `detailLead` com o retorno completo.
- Merge no card local: `setLeads(prev => prev.map(l => l.id === id ? { ...l, ...full } : l))`.

**Editar card:** local (`setLeads` + `setDetailLead`). Nada de `loadData()`.

**Mover card (`moveTo` no ramo comercial):**
- Atualiza `status_lead` local.
- `setStageTotals(prev => ({ ...prev, [from]: Math.max(0, (prev[from] ?? 1) - 1), [to]: (prev[to] ?? 0) + 1 }))`.
- **Não** chamar `loadData()`.

Clone/import/troca de painel: comportamento herdado da Fase 1.

### 2. `src/components/admin/PipelineKanban.tsx`

Props opcionais novas:
```ts
stageTotals?: Record<string, number>;
stageLoadingMore?: Record<string, boolean>;
onLoadMoreStage?: (stageValue: string) => void;
```

- Badge da coluna: `stageTotals?.[stage.value] ?? items.length`.
- Renderiza apenas `items` recebidos.
- Se `onLoadMoreStage` presente e `items.length < (stageTotals?.[stage.value] ?? items.length)`, renderiza no fim da coluna:
  - Label: `Carregar mais (${total - items.length})`.
  - `disabled` + `Carregando...` quando `stageLoadingMore?.[stage.value]`.
  - `onClick={() => onLoadMoreStage(stage.value)}`.
- Drag/drop, seleção, edição, exclusão, follow-up: inalterados.

### 3. `src/components/admin/LeadComments.tsx`

- Remover fetch automático de usuários de menção no mount.
- Estados `mentionUsersLoaded`, `loadingMentionUsers`.
- `ensureMentionUsersLoaded()` retorna cedo se já carregado/carregando.
- Disparar em `onFocus` do textarea e ao digitar `@`.

### 4. `src/components/admin/LeadTasks.tsx` (revalidar obrigatoriamente)

- Se ainda houver fetch de usuários no mount, remover.
- Implementar `usersLoaded`, `loadingUsers`, `ensureUsersLoaded()`.
- Disparar apenas no `onOpenChange`/`onFocus` do `Select` de responsável, respeitando `canCreateTask === true`.
- Evitar chamadas duplicadas via as duas flags.

---

### Fora do escopo
Kanban virtualizado, RPC de agregação, mudanças de schema/policies, painéis não-comerciais, financeiro, propostas públicas.

### Validação
1. `npm run build` limpo.
2. `/admin/painel/comercial`: colunas com >1000 cards mostram total real no badge; só 30 cards por coluna inicialmente.
3. "Carregar mais (N)" carrega +30 na coluna clicada; sem full reload; botão desabilita com "Carregando...".
4. Nenhum card duplicado após múltiplos "Carregar mais" nem após mover/editar/reabrir painel.
5. Abrir card mostra todos os campos.
6. Editar campo não recarrega painel.
7. Mover card ajusta imediatamente os badges de origem/destino.
8. Aba Conversa: usuários de menção só buscam ao focar textarea ou digitar `@`.
9. Aba Tarefas: usuários só buscam ao abrir o Select de responsável.
10. Outros painéis (não comerciais) mantêm comportamento antigo.
