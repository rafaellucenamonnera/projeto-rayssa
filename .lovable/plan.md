## Escopo desta rodada (Fase 1 — quick wins)

Não mexo em: Kanban incremental, "Carregar mais" por coluna, chunking de propostas. Fica para Fase 2.

---

## 1. Modal do card com abas sob demanda (`AdminLeads.tsx`)

- Novo estado `activeSection` iniciando em `"detalhes"`, resetado ao trocar de card.
- Abas dentro do `DialogContent`:
  - **Detalhes** — cadastrais, endereço, implantação, financeiro, contrato, dossiê, link do Teste Monnera. **Sem** `TesteMonneraSection`.
  - **Conversa** — `LeadComments` / `AmbassadorCardComments`
  - **Tarefas** — `LeadTasks` / `AmbassadorCardTasks`
  - **Reuniões** — `LeadReuniao`
  - **Contatos** — `LeadContatos`
  - **Propostas** — `LeadProposalsHistory`
  - **Teste Monnera** — só quando `["comercial","comerc"].includes(currentPanelId) && !!detailLead?.teste_monnera_last_diagnostic_id`
- Componentes pesados só montam quando a aba está ativa. Header/badges/ações de topo continuam fora das abas.

## 2. Fetches internos sob demanda

- **`LeadComments`** — `mentionUsersLoaded` + `ensureMentionUsersLoaded()` disparado por `focus` no textarea ou digitação de `@`.
- **`LeadTasks`** — usuários só carregam quando `canCreateTask === true` e o `Select` de responsável é aberto (`onFocus`/`onOpenChange`).
- **`LeadProposalsHistory`** — se ainda houver `.select("*")`, reduzir para os campos usados na UI; se já estiver explícito, não alterar.

## 3. `AdminDashboard.tsx` — contagens via `count/head:true` (regra revisada)

### Contagens por etapa
- Para cada `stage` das etapas visíveis/ativas de `pipeline_stages_config` para `selectedPanel`, em paralelo:
  ```ts
  supabase.from("leads")
    .select("id", { count: "exact", head: true })
    .eq("panel_id", selectedPanel)
    .eq("status_lead", stage.value)
    // + filtros de consultor/responsável/data ativos
  ```
  → alimenta `statusCounts[stage.value]`.

### Total de Leads (regra obrigatória)
- **`totalLeads` = soma de `statusCounts[stage.value]` de todas as etapas visíveis/ativas** carregadas de `pipeline_stages_config` para `selectedPanel` — a mesma lista que alimenta os cards de `Pipeline Comercial`.
- Inclui `lead_perdido` se estiver na configuração visível/ativa.
- **Não** contar etapas inativas, ocultas ou fora da configuração do painel.
- **Não** usar `count` geral sem status. Garante que `Total de Leads` bata exatamente com a soma das colunas do `Pipeline Comercial`.

### Embaixadores Monnera (regra obrigatória)
- Contagem de `id` distintos do painel `/admin/parceiros`.
- Buscar `parceiros_comerciais.id` com payload mínimo apenas do campo `id`.
- Usar `fetchAllRows` (não query simples) para evitar truncamento em 1000 linhas.
- Ignorar `id` vazio/null; métrica = `new Set(idsValidos).size`.
- **Não** contar por CPF. **Não** usar `count` simples se houver risco de limite/paginação divergente.

### Taxa de Conversão (regra obrigatória)
- `signedContractsCount = statusCounts["contrato_assinado"] ?? 0`.
- `taxaConversao = totalLeads > 0 ? signedContractsCount / totalLeads : 0`.
- Exibir `0%` quando `totalLeads === 0`. Mesmo denominador do card Total de Leads.

### Ranking (top 10) — Fase 1
- Mantém `fetchAllRows` sobre `leads` com payload mínimo: `id, parceiro_id, status_lead, nome_responsavel, data_cadastro`. Filtros iguais.
- Aceitável nesta fase por payload pequeno. **Agregação real por parceiro via RPC/server-side fica para Fase 2.**
- `nome_responsavel` preserva o filtro "Responsável" com todos os valores do painel.

### Tempo médio por etapa
- Derivado do mesmo array leve + `stageMap` de `lead_stage_history`. Sem mudança semântica.

### Leads mais tempo na mesma etapa (lista operacional)
- Query em `lead_stage_history` (`data_saida is null`, `etapa in stageValues`, ordenada por `data_entrada asc`, `.limit(100)`).
- Join com `leads.in("id", ids)` selecionando `id, nome_fantasia, status_lead, parceiro_id, data_cadastro` com os mesmos filtros.
- Cabeçalho: lista operacional limitada a 100 itens, **não** base de totais.

## 4. Evitar `loadData()` após pequenas edições (`AdminLeads.tsx`)

| Linha | Contexto | Ação |
|---|---|---|
| 429 | `handleClone` | Substituir por insert local no `setLeads` usando `data` do clone |
| 455 | `sync-drive-clients` | **Manter** |
| 582 | Troca de painel | **Manter** |
| 887 | Mover para "Criação de Campanhas" (já faz `setLeads` na 883) | **Remover** o `void loadData()` |
| 1527 | Fallback do novo cadastro | **Manter** |
| 1773 | `onImported` do `LeadImportDialog` | **Manter** |

Edições de campo simples/financeiro/parcelas/proposta/follow-up/status já são locais via `setLeads(prev => prev.map(...))` + `setDetailLead(...)`.

## Detalhes técnicos

- Sem novas dependências; abas via `Tabs` do shadcn.
- Todos os fetches novos do dashboard mantêm `panel_id = selectedPanel` + filtros atuais.
- `loadData()` em `AdminLeads` continua existindo — só reduzo call sites redundantes.

## Validação

1. `npm run build` limpo.
2. `/admin/painel/comercial`: abrir card, alternar abas — cada uma carrega ao abrir; `Teste Monnera` só quando painel `comercial`/`comerc` **e** lead com diagnóstico.
3. Editar campo simples: painel não pisca/recarrega.
4. Clonar card: aparece imediatamente sem full reload.
5. `/admin`: `Total de Leads` = soma exata das colunas visíveis/ativas de `Pipeline Comercial` (se etapas somam 1.324, card mostra 1.324).
6. `Embaixadores Monnera` = IDs distintos de `parceiros_comerciais`, igual ao painel `/admin/parceiros`.
7. `Taxa de Conversão` = `contrato_assinado / totalLeads`, `0%` quando `totalLeads === 0`.
8. Filtro "Responsável" continua populado.
9. Seção "leads mais tempo na etapa" até 100 itens.

## Fora do escopo (Fase 2)

- `visibleCardsPerColumn` + "Carregar mais" no `PipelineKanban`.
- `stageCounts` / `stageLoadedPages` / `stageLoadingMore` em `AdminLeads`.
- Propostas por chunk de IDs carregados.
- RPC/agregação server-side substituindo `fetchAllRows` do ranking.
