## Apply diff to `src/pages/admin/AdminLeads.tsx`

Add a "+ Card" flow and responsible-user filter to dynamic CRM panels (Representantes / Embaixadores), without touching the existing comercial/sucesso/onboarding/campanhas flows.

### Changes in `src/pages/admin/AdminLeads.tsx`

**State**
- `usersAll: { user_id; nome }[]`
- `newCardOpen`, `savingNewCard`, `newCardData` (full_name, phone, email, city, state, region, company, responsible_user_id)
- `filterResponsibleUser: "all"`

**Derived flags**
- `painelTitleNormalized = painelTitle.toLowerCase()`
- `isRepresentantesOuEmbaixadoresPanel` — title contains "representante" or "embaixador"
- `isCustomCrmPanel` — above AND `currentPanelId` not in the 4 fixed ids

**Data load (`loadData`)**
- Add a 5th parallel query: `profiles.select("user_id,nome").order("nome")` → `setUsersAll`.

**`createRepresentativeCard`** (new)
- Validates name/phone/email + email format.
- Duplicate check: `leads.select(id).or("email_responsavel.eq.<email>,telefone_responsavel.eq.<phone>")`.
- Inserts a new lead with `status_lead = pipelineStages[0].value`, synthetic `cnpj`, default ERP/qty, plus `panel_id`, `state`, `region`, `company`, `responsible_user_id`.
- On success: toast, close dialog, reset form, `loadData()`.

**Filters**
- `filtered` and `filteredExceptStatus`: null-safe `nome_fantasia`, plus `isCustomCrmPanel && filterResponsibleUser !== "all"` → match `l.responsible_user_id`.

**UI**
- Header: render "+ Card" green button when `isCustomCrmPanel`.
- Filter row: when `isCustomCrmPanel`, replace consultor filter with a "responsável" select populated from `usersAll`.
- New `<Dialog open={newCardOpen}>` with the form inputs + Salvar button.

### Out of scope
- No changes to LeadImportDialog (already done last turn).
- No styling/layout overhaul, no other panels touched.

### Blocker — DB schema mismatch (please decide)

The diff inserts these columns on `leads`, but they don't exist in the current schema:
- `panel_id`
- `state`
- `region`
- `company`

Plus `cnpj = "REP-..."` is rejected by trigger `validate_lead_insert` (must be 14 digits or empty/null).

Two options:

1. **Add a migration** for `leads`: `panel_id text`, `state text`, `region text`, `company text`, and relax `validate_lead_insert` to allow non-14-digit `cnpj` (or just send `cnpj=null` for representante cards).
2. **Ship the UI now without those fields** — drop `state`/`region`/`company`/`panel_id` from the insert payload and send `cnpj: null`. The "+ Card" form still works for name/phone/email/city/responsável. The custom panel routing already works via URL alone (no `panel_id` column needed for filtering, since each panel has its own pipeline_stages and we filter by `status_lead`).

I recommend **option 2** (lean MVP, no schema risk). Confirm before I implement, and I'll trim those fields. Otherwise say "option 1" and I'll generate the migration first.
