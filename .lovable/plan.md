## Apply diff to `src/components/admin/LeadImportDialog.tsx`

Add a `customCrmMode` to the existing CSV importer so it can also be used for dynamic panels (e.g. "Representantes"), without breaking the default lead import flow.

### Changes

**Props (`LeadImportDialogProps`)**
- Add optional: `customCrmMode?: boolean`, `users?: { user_id: string; nome: string }[]`, `panelId?: string`, `firstStageId?: string`.

**Constants**
- Rename `REQUIRED_COLUMNS` → `REQUIRED_COLUMNS_DEFAULT`.
- Add aliases: `"nome completo" → nome_completo`, `"e-mail" → e_mail`, `"região de atuação" → regiao`.

**Parsing (`handleFileSelect`)**
- `requiredColumns` now switches between `["nome_completo","telefone","e_mail"]` (custom mode) and the default list.
- In `customCrmMode`, push a synthetic row that maps representante fields onto the existing `ParsedRow` shape:
  - `nome_fantasia`/`razao_social`/`nome_responsavel` ← `nome_completo`
  - `cnpj` ← synthetic placeholder `REP-${Date.now()}-${i}` (satisfies the 14-digit DB validator? — see Open question)
  - `telefone_responsavel` ← `telefone`, `email_responsavel` ← `e_mail`
  - `erp_utilizado = "Não informado"`, `quantidade_lojas = 1`, others null.

**Insert (`handleImport`)**
- In custom mode, resolve `responsible_user_id` from `users` by matching `parceiro_nome`.
- Skip the "nenhum consultor encontrado" guard when in custom mode.
- Insert payload adds `responsible_user_id`, `panel_id` (custom only), `status_lead = firstStageId || "novo_lead"` (custom only); `parceiro_id` set to `null` in custom mode.

**UI**
- Dialog title switches to "Importar CSV de Representantes" in custom mode.
- Required-columns help text switches between the two column sets.

### Out of scope
- No changes to callers (`AdminLeads.tsx` etc.) — they keep working because all new props are optional.
- No DB/RLS/migration changes.
- No styling changes.

### Open question (please confirm before I implement)
The DB trigger `validate_lead_insert` enforces `cnpj` as exactly 14 numeric digits when not null/empty. The diff sets `cnpj = "REP-..."`, which **will be rejected** by Postgres. Two options:

1. Send `cnpj: null` in custom mode (recommended, requires no DB change).
2. Keep the synthetic placeholder and relax the trigger (DB migration needed).

I'll go with option 1 unless you prefer option 2.
