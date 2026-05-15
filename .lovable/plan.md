## Apply diff to `src/components/admin/LeadExportButton.tsx`

Extend the existing CSV export button to support the custom CRM panel (Representantes / Embaixadores) with a simplified column set.

### What changes
- Add optional `customCrmMode?: boolean` and `users?: Record<string, string>` props.
- Extend the `Lead` interface with representative fields: `full_name`, `phone`, `email`, `state`, `region`, `responsible_user_id`.
- Define `CSV_HEADERS_REPRESENTATIVE` and keep `CSV_HEADERS_DEFAULT`.
- In `handleExport`, branch the row mapping and header list based on `customCrmMode`.
  - Custom mode exports: Nome completo, Telefone, E-mail, Cidade, Estado, Região de atuação, Responsável, Status.
  - Default mode remains unchanged (all standard lead columns).
- Update the downloaded filename prefix from `leads_monnera_` to `representantes_monnera_` when in custom mode.
- Update the success toast to say "registros exportados" instead of "leads exportados".

### Out of scope
- No changes to AdminLeads.tsx or LeadImportDialog (already handled in previous turns).
- No database migrations — this is a pure frontend presentation change.
