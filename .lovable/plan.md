## Plano: Configurar Secrets e Redeployar Edge Function

### Objetivo
Configurar os secrets solicitados no Supabase e garantir que a edge function `sync-drive-clients` esteja deployada com o estado atual do código.

### Passos

1. **Adicionar Secrets ao Supabase**
   - `GOOGLE_SHEETS_SPREADSHEET_ID` = `14wK-h06tExCMqKRx-EW-JsXUFHX7XTZTOsucJ1LkNgE`
   - `GOOGLE_SHEETS_PROXY_URL` = `https://script.google.com/macros/s/AKfycby-701y4H5tuLWJibIkfG9QRk97HoiPWa5magdKJ32xw0CE-FB1LeyOjxFvKp0gCGd8/exec`
   - `GOOGLE_SHEETS_PROXY_TOKEN` = `monnera_sucesso_2026_x7Kp92LmQ4vB18sT`

2. **Redeployar Edge Function**
   - Executar deploy da função `sync-drive-clients` para garantir que o ambiente receba qualquer alteração de código já existente e os novos secrets.

### Observação Técnica
A edge function `sync-drive-clients` (código atual em `supabase/functions/sync-drive-clients/index.ts`) utiliza `GOOGLE_SHEETS_SPREADSHEET_ID`, mas **não referencia `GOOGLE_SHEETS_PROXY_URL` nem `GOOGLE_SHEETS_PROXY_TOKEN`** — ela acessa o Google Sheets via URL pública de exportação CSV (`https://docs.google.com/spreadsheets/d/.../export?format=csv`).  
Os secrets serão persistidos no ambiente, mas a função só os consumirá se o código for atualizado posteriormente para chamar o proxy.

### Restrições Respeitadas
- Nenhuma criação de tabela.
- Nenhuma alteração de RLS.
- Nenhuma alteração de schema.