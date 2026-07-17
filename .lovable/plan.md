## Busca global performática no filtro "Filtrar por empresa"

Escopo restrito a `src/pages/admin/AdminLeads.tsx`. Sem tocar em schema, RPCs, outros painéis ou fluxo do Kanban.

---

### 1. Payload mínimo do Kanban
Acrescentar ao select incremental por etapa (mesmos campos hoje) os dois abaixo, mantendo sem `select("*")`:
- `telefone_responsavel`
- `email_responsavel`

### 2. Helpers locais
No topo do módulo:
```ts
const normalizeSearchTerm = (v: string) => v.trim().replace(/\s+/g, " ").toLowerCase();
const onlyDigits = (v: string) => v.replace(/\D/g, "");
const escapePostgrestLike = (v: string) => v.replace(/[%_*\\]/g, m => `\\${m}`);
```

### 3. Debounce do termo
Novos estados + effect de 300 ms:
```ts
const [debouncedFilterEmpresa, setDebouncedFilterEmpresa] = useState("");
const [searchingEmpresa, setSearchingEmpresa] = useState(false);
```
`useEffect` observa `filterEmpresa`, seta `searchingEmpresa=true`, e após 300 ms grava o termo normalizado em `debouncedFilterEmpresa`.

### 4. Busca server-side por etapa (ramo comercial)
Criar helper `applyEmpresaSearch(query)` que, quando `debouncedFilterEmpresa.length >= 2`, monta `.or(...)`:
- Termos: `[termo, ...split(" ")]`, únicos, `length >= 2`, no máx. 5.
- Campos: `nome_fantasia, razao_social, cnpj, nome_responsavel, telefone_responsavel, email_responsavel`.
- Extra numérico: se `onlyDigits(term).length >= 2`, adiciona `cnpj.ilike.%N%` e `telefone_responsavel.ilike.%N%`.
- Usa `escapePostgrestLike` em cada valor.

Aplicar o mesmo helper nas 3 chamadas por etapa:
1. `count/head:true`
2. `.range()` inicial paginado
3. `loadMoreCommercialStage` (`.range()` da próxima página)

Passar o termo como parâmetro nas funções para o `loadMoreCommercialStage` respeitar o filtro ativo.

### 5. Recarga reativa ao debounce
Ajustar (ou criar) o `useEffect` de recarga comercial para depender de `debouncedFilterEmpresa`, `filterConsultor`, `filterDataInicio`, `filterDataFim` — nunca `filterEmpresa` cru — evitando 1 query por tecla.

### 6. Filtro local não pode anular o server-side
Em `filtered` e `filteredExceptStatus`, quando `isCommercialPanel && !isCustomCrmPanel`, **pular** a checagem em memória de `filterEmpresa`. Outros painéis mantêm o filtro local atual.

Ao recarregar o ramo comercial por mudança de filtro/busca, garantir que `leads`, `stageTotals`, `stageLoadedPages` e `stageLoadingMore` sejam reconstruídos a partir da nova query, sem manter restos da busca anterior.

### 7. UX discreta
Envolver o `<Input>` de "Filtrar por empresa..." num wrapper `relative` e mostrar `Buscando...` (span absoluto, `text-[10px] text-muted-foreground`) enquanto `searchingEmpresa && filterEmpresa.trim().length >= 2`.

---

### Fora do escopo
- Migration/`unaccent` (limitação de acentos aceita nesta rodada).
- Kanban virtualizado, RPCs, painéis não-comerciais.
- Alterações em `lead_stage_history`, `commercial_proposals`, `reunioes` além de continuarem buscando somente para os IDs já carregados.

### Validação
1. `npm run build` limpo.
2. Buscar `Vida Farmácias` e `vida` acha card fora dos 30 iniciais via `razao_social`.
3. Busca por CNPJ, telefone (com máscara ou só dígitos), e-mail e responsável retorna cards.
4. Badges refletem total filtrado real por coluna (`count/head:true` com o `.or`).
5. "Carregar mais" respeita o filtro ativo, sem duplicar IDs.
6. Limpar campo restaura carregamento incremental normal.
7. Sem query nova a cada tecla (só após 300 ms).
