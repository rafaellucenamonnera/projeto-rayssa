## Escopo desta rodada

Somente os quick wins de maior impacto. **Não** mexo em: carregamento incremental do Kanban, botão "Carregar mais" por coluna, renderização parcial por coluna, propostas por chunk no `AdminLeads`. Isso fica para a Fase 2.

## Restrições

Nada muda em: schema, RLS, automações, financeiro, propostas, permissões, drag/drop, layout geral do Kanban, mensagens de follow-up.

---

## 1. Modal do card com abas / seções sob demanda (`AdminLeads.tsx`)

Hoje o modal monta ao mesmo tempo: `LeadProposalsHistory`, `LeadReuniao`, `LeadContatos`, `LeadTasks`/`AmbassadorCardTasks`, `LeadComments`/`AmbassadorCardComments` e `TesteMonneraSection`. Cada um dispara suas próprias queries.

Ajuste:

- Novo estado `activeSection` iniciando em `"detalhes"`, resetado ao trocar de card.
- Barra de abas dentro do `DialogContent`:
  - **Detalhes** — dados cadastrais, endereço, dados de implantação, financeiro, contrato, dossiê, link do Teste Monnera. **Sem** `TesteMonneraSection`.
  - **Conversa** — `LeadComments` / `AmbassadorCardComments`
  - **Tarefas** — `LeadTasks` / `AmbassadorCardTasks`
  - **Reuniões** — `LeadReuniao`
  - **Contatos** — `LeadContatos`
  - **Propostas** — `LeadProposalsHistory`
  - **Teste Monnera** — `TesteMonneraSection`. Aba renderizada apenas quando:
    ```ts
    ["comercial", "comerc"].includes(currentPanelId)
      && !!detailLead?.teste_monnera_last_diagnostic_id
    ```
- Cada componente pesado só é montado quando sua seção está ativa (`{activeSection === "conversa" && <LeadComments ... />}`). Ao trocar de aba, o anterior é desmontado — assumo aceitável para reduzir carga. Se você preferir preservar estado ao voltar, digo e substituo por `hidden` + montagem tardia após primeiro acesso.
- Header do card, badges de status e ações de topo ficam sempre visíveis, fora do sistema de abas.

Impacto: abrir um card deixa de disparar 5–7 queries paralelas dos filhos, e o `TesteMonneraSection` só monta sob demanda.

## 2. Componentes internos com fetches sob demanda

### `LeadComments.tsx`

- Não carregar usuários para menção no mount. Adicionar `mentionUsersLoaded` + `ensureMentionUsersLoaded()`.
- Disparar `ensureMentionUsersLoaded` quando o textarea de novo comentário recebe `focus` ou quando o usuário digita `@`.
- Comentários em si continuam carregando na abertura da aba (o componente agora só monta quando "Conversa" é aberta).

### `LeadTasks.tsx`

- Carregar tarefas sempre.
- Só carregar a lista de usuários quando `canCreateTask === true` **e** o `Select` de responsável é acionado pela primeira vez (`onFocus`/`onOpenChange`). Se `canCreateTask === false`, não carrega usuários.

### `LeadProposalsHistory.tsx`

- Como agora só monta na aba "Propostas", o fetch inicial já fica lazy. Se estiver usando `.select("*")` para colunas desnecessárias, reduzo o select aos campos usados na UI (sem alterar semântica).

`LeadReuniao` e `LeadContatos` ficam lazy pelo mecanismo de abas; nenhuma mudança interna.

## 3. `AdminDashboard.tsx` com contagens via `count/head:true`

Hoje `fetchAllRows` traz todos os leads apenas para contar. Substituir por queries de contagem:

### Contagens por etapa e total

- Para cada `stage` de `pipelineStages`, em paralelo (`Promise.all`):
  ```ts
  supabase.from("leads")
    .select("id", { count: "exact", head: true })
    .eq("panel_id", selectedPanel)
    .eq("status_lead", stage.value)
    // + filtros consultor / responsavel / data quando ativos
  ```
  → alimenta `statusCounts[stage.value]`.

- **`totalLeads`**: query dedicada com `count/head:true`, aplicando `panel_id = selectedPanel` + os mesmos filtros de consultor/responsável/data, **sem** filtro de status. Isso inclui `lead_perdido` e quaisquer etapas fora do `pipelineStages` atual. Não somo `statusCounts` para evitar drift.

- **`signedContractsCount`**: `statusCounts["contrato_assinado"] ?? 0`. Se a etapa não existir no painel corrente, cai para 0 naturalmente.

### Ranking (top 10)

- **Nesta Fase 1**, mantenho `fetchAllRows` sobre `leads` com payload mínimo: `id, parceiro_id, status_lead, nome_responsavel`. Filtros iguais aos das contagens.
- Justificativa explícita: é aceitável nesta fase porque o payload por linha é pequeno; **a agregação real por parceiro (via RPC/agregação server-side) fica para uma fase posterior**.
- `nome_responsavel` sai desse array leve, garantindo que o filtro "Responsável" continue populado com todos os valores atuais do painel.

### Métricas de tempo médio por etapa

- Derivadas do mesmo array leve (id → status_lead) + `stageMap` de `lead_stage_history` (ordenada por `data_entrada asc`).
- Sem mudança semântica em relação ao comportamento atual.

### Leads mais tempo na mesma etapa (lista operacional)

- Query em `lead_stage_history` com `data_saida is null`, `etapa in stageValues`, ordenada por `data_entrada asc`, `.limit(100)`.
- Depois `supabase.from("leads").in("id", ids).select("id, nome_fantasia, status_lead, parceiro_id, data_cadastro")` com os mesmos filtros de painel/consultor/responsável/data.
- Deixo claro no cabeçalho da seção que é uma lista operacional limitada a 100 itens, **não** uma base para totais exatos.

`selectedPanel` respeitado em todas as queries. Nenhum `fetchAllRows` grande sobre `leads` sobra além do payload mínimo do ranking.

## 4. Evitar `loadData()` completo após pequenas alterações (`AdminLeads.tsx`)

Auditoria das chamadas atuais:

| Linha | Contexto | Ação |
|---|---|---|
| 429 | Após clonar card (`handleClone`) | Substituir por insert local no `setLeads` usando o `data` retornado do clone |
| 455 | Após `sync-drive-clients` | **Manter** (global) |
| 582 | Efeito de troca de painel | **Manter** (troca de painel) |
| 887 | Após mover para "Criação de Campanhas" (já faz `setLeads(...)` na 883) | **Remover** o `void loadData()` — estado local já reflete |
| 1527 | Fallback do novo cadastro quando `data` vem vazio | **Manter** (fallback) |
| 1773 | `onImported` do `LeadImportDialog` | **Manter** (importação em massa) |

Edições de campo simples, financeiro, parcelas pagas, número da proposta, follow-up e status_lead já são atualizadas localmente via `setLeads(prev => prev.map(...))` + `setDetailLead(...)` — confirmado nos trechos 679, 997, 1041, 1192, 1209, 1240, 1431. Não removo mais nada além dos dois casos acima.

## Detalhes técnicos

- Nenhuma nova dependência; abas usam o componente `Tabs` do shadcn já disponível.
- Componentes internos permanecem tipados como hoje.
- Todos os fetches novos do dashboard mantêm `panel_id = selectedPanel` e os filtros atuais.
- `loadData()` em `AdminLeads` continua existindo — só reduzo os call sites redundantes.

## Validação

1. `npm run build` roda limpo.
2. Abrir `/admin/painel/comercial`, abrir um card e navegar entre as abas — cada uma carrega ao ser aberta; `Teste Monnera` só aparece quando o painel é comercial/comerc **e** o lead tem diagnóstico.
3. Editar campo simples do card e confirmar que o painel não pisca/recarrega.
4. Clonar card e confirmar que aparece imediatamente, sem full reload.
5. Abrir `/admin`, trocar painel, aplicar filtros de consultor/responsável/data. Conferir:
   - `Total de Leads` bate com o número de linhas do painel comercial (inclui `lead_perdido`).
   - Contagem por etapa bate com cada coluna do Kanban.
   - Filtro "Responsável" mostra todos os nomes do painel.
   - Seção de leads parados mostra até 100 itens.

## Fora do escopo (Fase 2)

- `visibleCardsPerColumn` + `Carregar mais` no `PipelineKanban`.
- `stageCounts` / `stageLoadedPages` / `stageLoadingMore` em `AdminLeads`.
- Propostas buscadas apenas para cards carregados, com chunk por IDs.
- Loadings finos por área.
- Substituir o `fetchAllRows` do ranking por RPC/agregação server-side.
