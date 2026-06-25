
## Alteração única em `supabase/functions/render-commercial-proposal-pdf/index.ts`

Nenhum outro arquivo é tocado. Sem mudanças em frontend, gerador, proposta pública, assets, package.json, migrations, RLS, schema, layout, fluxo de aceite ou regras do painel comercial.

### 1. CORS dinâmico
- Remover `Access-Control-Allow-Origin: "*"` fixo.
- Calcular `ALLOWED_ORIGINS = { new URL(PUBLIC_APP_URL).origin, "http://localhost:8080" }`.
- Função `buildCorsHeaders(req)`:
  - `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Vary: Origin`
  - `Access-Control-Allow-Origin` só é refletido quando o header `Origin` da requisição estiver em `ALLOWED_ORIGINS`.
- `OPTIONS` continua respondendo `200 ok` com esses headers. Todas as respostas (sucesso e erro) usam `buildCorsHeaders(req)`.

### 2. Autorização (antes de qualquer query/alteração)
- Ler `Authorization: Bearer <token>`.
- Sem token → **401** `{ error: "Unauthorized" }`.
- Se `token === SUPABASE_SERVICE_ROLE_KEY` → autorizado.
- Caso contrário, tratar como JWT Supabase:
  - `userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: Bearer ... } } })`
  - `const { data, error } = await userClient.auth.getUser(token)`
  - `error` ou `!data.user` → **401**.
  - Buscar `user_roles` por `user_id`.
  - Se não houver papel `admin` nem `gestor_conta` → **403** `{ error: "Forbidden" }`.
- Só após autorizado a função segue: parse do body, leitura da proposta, idempotência, PDFShift, upload, updates.

### 3. Inalterado
- Idempotência (`ready`, `pending` < 5min, `failed` sem `force`).
- `force: true` para retry.
- Chamada PDFShift (`/v3/convert/pdf`, mesmos parâmetros).
- Upload em `propostas/{lead_id}/proposta-v{version}-{token}.pdf`.
- Updates de `pdf_status`, `pdf_error`, `pdf_processing_started_at`, `pdf_attempts`, `pdf_path`, `pdf_generated_at`.
- Formato das respostas JSON consumido pelo frontend.

### Validação
- Sem header `Authorization` → 401.
- Token inválido (JWT que falha em `getUser`) → 401.
- JWT válido sem papel admin/gestor → 403.
- Admin/gestor → gera/regera PDF normalmente.
- Service role (chamadas server-side) → gera PDF normalmente.
- `/proposta/:token` e regeneração via painel continuam funcionando.
- Nenhuma mudança visual.
