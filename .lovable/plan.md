## Objetivo

No painel **Sucesso** (`/admin/painel-sucesso`), o "Consultor Comercial / Parceiro" não representa o dono do cliente — quem cuida da conta é o **CS** (coluna *Carteira* da planilha de Clientes, já salva em `leads.consultor`). O nome do parceiro deve sair do card e o filtro deve passar a operar sobre o CS. O campo "responsável" continua existindo, mas como figura **transitória** (ação atual) — não como dono.

## Escopo (apenas painel Sucesso)

Nada muda nos demais painéis (Comercial etc.), que continuam usando parceiro/consultor comercial normalmente.

## 1. Card do Kanban (`PipelineKanban.tsx`)

- Adicionar prop opcional `showCsInsteadOfPartner?: boolean` (default `false`) e nova prop `consultor?: string` no tipo do lead.
- Quando `showCsInsteadOfPartner` for `true`:
  - **Trocar** o texto azul que hoje mostra `parceirosMap[parceiro_id]` pelo valor de `l.consultor` (CS da Carteira), com label "CS:" antes do nome.
  - Se o lead tiver `nome_responsavel` preenchido (responsável transitório), exibi-lo como uma **badge discreta** ("Ação: <nome>") logo abaixo, deixando claro que é temporário. Se vazio, simplesmente não aparece.

## 2. Filtros (`AdminLeads.tsx`, linhas 970-981)

Quando `currentPanelId === "sucesso"`:

- Substituir o `<Select>` "Todos Consultores" por um novo **"Todos CS"**:
  - Opções geradas a partir de `Array.from(new Set(leads.map(l => l.consultor).filter(Boolean)))`, ordenadas alfabeticamente.
  - Estado novo `filterCs` (string, default `"all"`).
  - Filtro: `if (currentPanelId === "sucesso" && filterCs !== "all" && (l.consultor || "") !== filterCs) return false;` — substitui o filtro `filterConsultor` apenas neste painel.
- Nos demais painéis o filtro "Consultor" original continua intacto.

## 3. Passagem do CS para o Kanban

- No `<PipelineKanban …>` (linha ~1125) passar `showCsInsteadOfPartner={currentPanelId === "sucesso"}`.
- Garantir que `consultor` está sendo selecionado no `loadData` dos leads (já consta na tabela; apenas conferir o `select` da query).

## 4. Cabeçalhos / labels visíveis

- Substituir o termo "Parceiro" / "Consultor Comercial" por "CS" apenas em rótulos visuais do painel Sucesso (cards de stat, filtros, headers de coluna do modo Lista quando aplicável). Nada de renomear tabelas ou colunas no banco.

## 5. Sem alterações de schema

- `leads.consultor` já existe e o sync `sync-drive-clients` já popula com o valor da coluna *Carteira*. Nada a migrar.
- `parceiro_id` continua sendo o "parceiro do sistema" (Rafael Lucena por padrão para origem `google_drive`) — apenas deixa de ser exibido no painel Sucesso.

## Detalhes técnicos

- `PipelineKanban.tsx`: ajustar interface `KanbanLeadCardData` adicionando `consultor?: string | null;` e renderizar condicionalmente o trecho da linha 293.
- `AdminLeads.tsx`:
  - Novo state `const [filterCs, setFilterCs] = useState<string>("all");`
  - No bloco de filtros, render condicional: `currentPanelId === "sucesso"` → mostra "Todos CS"; caso contrário mantém o select "Consultor" atual.
  - Adicionar `consultor: l.consultor` no objeto passado para `<PipelineKanban leads={…}>` se ainda não estiver incluso no spread.

## Fora de escopo

- Não vamos criar novos parceiros para cada CS nem mexer em `parceiro_id` — o pedido é exibição/filtro, não atribuição.
- Não vamos alterar painéis Comercial/Pipeline.
