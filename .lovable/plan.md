## Objetivo

Compor os indicadores dos cards do Painel Sucesso a partir da aba **Painel de Saúde** da planilha (`gid=409080197`), trazendo:

- **Coluna A — Razão Social** → chave de vínculo (já existe na lógica `lookupBySimilarity`).
- **Coluna B — Status do cliente** → alimenta filtro existente "Status Cliente" + **tarja superior colorida no card** com nome do cliente sobre ela.
- **Coluna C — Impacto** → alimenta filtro existente "Impacto" + **faixa de fundo colorida atrás dos indicadores Mensalidade/Campanha/Pagamento**.

A infraestrutura já existe parcialmente: o backend (`sync-drive-clients`) e o front (`AdminLeads.tsx` + `PipelineKanban.tsx`) já têm campos `health_status` e `impact_level`, filtros e variável `HEALTH_GID`. Faltam: configurar o GID correto, ajustar parser para o cabeçalho real da aba, definir paleta padronizada de cores e renderizar os elementos visuais nos cards.

## Mudanças

### 1. Sincronização (backend)

**`supabase/functions/sync-drive-clients/index.ts`**
- Setar default `HEALTH_GID = "409080197"` (hoje vazio, exige variável de ambiente).
- Ajustar o parser da aba Painel de Saúde:
  - As linhas 1–3 do CSV são metadados/legenda; a linha real de cabeçalho é a 4 (`Contratante | Status | Impacto | …`).
  - Saltar linhas até encontrar a primeira que contenha "contratante" como header (ou usar `findIndex` no CSV cru antes do `parseCsv`).
- No `pick(...)`, garantir leitura de `contratante`, `status`, `impacto` (já compatível, basta o cabeçalho correto).
- Normalizar valores: remover emojis/acentos antes de gravar (`status`: CHURN, EVENTUAL, CRITICO, RISCO, ATENCAO, MONITORAR, SAUDAVEL, RECENTE; `impacto`: ALTO, MEDIO, BAIXO, MINIMO).

> Sem mudanças de schema — colunas `health_status` e `impact_level` já existem em `leads`.

### 2. Paleta padronizada (frontend)

Criar arquivo `src/lib/healthStatusColors.ts` (constantes únicas) para evitar divergência entre filtro e card:

```text
Status:
  CHURN      → vermelho-escuro
  EVENTUAL   → laranja
  CRÍTICO    → vermelho
  RISCO      → âmbar
  ATENÇÃO    → amarelo
  MONITORAR  → azul
  SAUDÁVEL   → verde
  RECENTE    → ciano

Impacto:
  ALTO    → vermelho
  MÉDIO   → laranja
  BAIXO   → amarelo
  MÍNIMO  → cinza
```

Funções `healthStatusColor(status)` e `impactColor(impact)` retornando `{ bg, text, border, hex }` em tokens HSL semânticos.

### 3. Card no Kanban

**`src/components/admin/PipelineKanban.tsx`** (apenas painel Sucesso, ativado por `showCampaignStatus`):

- **Tarja superior (status)**: faixa horizontal de ~22px no topo do card, fundo na cor do status, com `nome_fantasia` em cima (texto branco/contraste alto). Substitui o `<p class="truncate">{nome_fantasia}</p>` atual nesse modo.
- **Faixa de impacto**: ao redor do bloco de badges Mensalidade/Campanha/Pagamento, aplicar `background` suave (cor do impacto com baixa opacidade) + borda lateral mais saturada, com legenda discreta "Impacto: ALTO" no canto.
- Ajustar funções locais `healthStatusClass` e `impactClass` para usar a paleta central — remover lógica duplicada.

### 4. Filtros (AdminLeads)

**`src/pages/admin/AdminLeads.tsx`** (linhas ~1022–1050):

- Trocar os `<SelectItem>` por versões com bolinha colorida (`<span class="size-2 rounded-full" style={bg}>`) à esquerda do label, usando a mesma paleta central. Os filtros já funcionam — só falta sinalizar visualmente a cor.
- Garantir ordem fixa dos status (CHURN → EVENTUAL → CRÍTICO → RISCO → ATENÇÃO → MONITORAR → SAUDÁVEL → RECENTE) em vez de `Set` da base.

### 5. Re-sync

Após deploy, rodar `sync-drive-clients` manualmente (botão existente) para popular `health_status` e `impact_level` em todos os cards do painel Sucesso.

## Não inclui

- Nenhuma alteração em outros painéis (Leads/Pipeline/Financeiro).
- Sem mudanças nos demais campos do card (CS, mensalidade, CSAT, etc.).
- Sem refator estrutural — apenas adicionar arquivo de paleta e ajustar render condicional.

## Resumo de arquivos

- `supabase/functions/sync-drive-clients/index.ts` — default `HEALTH_GID`, ajuste parser cabeçalho.
- `src/lib/healthStatusColors.ts` *(novo)* — paleta única.
- `src/components/admin/PipelineKanban.tsx` — tarja superior + faixa de impacto.
- `src/pages/admin/AdminLeads.tsx` — bolinhas coloridas nos filtros + ordenação fixa.
