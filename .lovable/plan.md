## Objetivo
Corrigir o erro `parse_clients` causado pelo proxy do Apps Script devolvendo JSON (normal ou serializado) em vez de CSV puro. Atualizar `sync-drive-clients` para detectar e decodificar a resposta, redeployar e testar o botão Atualizar no Painel Sucesso.

## Escopo (apenas Edge Function `sync-drive-clients`)
Nada de frontend, schema, tabelas, RLS ou secrets.

## Alterações em `supabase/functions/sync-drive-clients/index.ts`

1. **Versão**
   - `FUNCTION_VERSION = "sucesso_deterministic_columns_v3_proxy_json_decode"`.

2. **Decoder do proxy** (novo helper `decodeProxyPayload`)
   - Lê a resposta como texto.
   - Detecta o formato em ordem:
     a. **JSON estrito**: `JSON.parse(text)` funciona.
     b. **JSON serializado/blob** ao estilo `{success:true,sheets:{clients:{rows:[[...],[...]]}}}` sem aspas — usar uma normalização tolerante (regex que envolve chaves identificadoras em aspas) e então `JSON.parse`.
     c. **Fallback CSV puro** (modo `public_csv` ou proxy antigo): usa `parseCsvRows`.
   - Saída unificada: `{ clients: string[][], revenue?: string[][], status?: string[][], csat?: string[][], health?: string[][] }`.
   - Quando vier JSON com formato `{ sheets: { clients: { rows: [...] } } }`, extrai `rows` diretamente como matriz 2D (sem passar por CSV).
   - Quando o JSON contiver apenas a aba pedida (chamada por aba), retorna sua `rows`.

3. **`readProxyRows` / `readSheetsFromProxy`**
   - `readProxyRows(sheet, gid)` passa o texto por `decodeProxyPayload`; se vier objeto com `sheets[<sheet>].rows`, devolve essas linhas; caso contrário, devolve resultado CSV.
   - `readSheetsFromProxy` mantém contrato atual (`{ clientsRows }`) usando o novo decoder.
   - Preserva `clientsRows.slice(1)` e parsing determinístico A/B/C (sem mudanças).

4. **Resposta de erro**
   - `operationalError` continua com `version`, `error`, `source`, `debug`.
   - Adicionar campo `clients_in_sheet` (= `clientsRows.length - 1`, mínimo 0) no retorno de `parse_clients` quando `clients.length === 0`.
   - Manter `debug.clients_sample = clientsRows.slice(0, 5)` no mesmo caminho.

5. **Sem outras alterações** em parser, auxiliares, contadores, CORS, secrets ou config.

## Deploy
- Redeployar somente `sync-drive-clients` via `supabase--deploy_edge_functions`.

## Teste
- Chamar `POST /functions/v1/sync-drive-clients` autenticado a partir do preview.
- Copiar o JSON completo retornado com:
  - `version`
  - `success`
  - `error`
  - `source`
  - `debug.step`
  - `debug.rows_read`
  - `debug.clients_sample`
  - `clients_in_sheet`

## Critérios de aceite
- Versão publicada: `sucesso_deterministic_columns_v3_proxy_json_decode`.
- Resposta operacional `success:false` sempre inclui `version` + `clients_in_sheet` no caminho `parse_clients`.
- Botão Atualizar no Painel Sucesso retorna `success:true` quando o proxy entrega rows válidas; caso contrário devolve JSON com os campos acima para diagnóstico.
