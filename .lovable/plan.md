Plan: AdminLeads.tsx — Block 5A (of 5+)

Context
AdminLeads.tsx drives the commercial pipeline UI (kanban/list, card creation, editing, detail dialogs, filters, and panel routing). It already supports both the standard leads table and custom CRM panels via isCustomCrmPanel branching. This block wires in the new Ambassador Panel ("Painel Embaixadores") and prepares the component for upcoming task/crud changes.

Changes in  1. Add import for AmbassadorCardTasks below the existing LeadTasks import.
  2. Add a constant AMBASSADOR_PANEL_ID = "painel_mp5q4du9" immediately after the PipelineStage type.
  3. Update the newCardData state shape: replace responsible_user_id and canal_tracao with cnpj and notes.
  4. Update the editFormData type and initial value: add cnpj between nome_responsavel and responsible_user_id.
  5. Add isAmbassadorPanel detector below the isCustomCrmPanel check.

Out of scope for 5A
- Query changes, manual card creation logic, editing logic, and card movement handling for the ambassador panel will be covered in Block 5B (to follow).

Implementation notes
- All edits are surgical line-level replacements/additions in AdminLeads.tsx.
- No structural refactors; existing flows for comercial/onboarding/campanhas panels remain untouched.
- After 5A is applied, the component will compile and behave identically for existing panels, with the new ambassador detector ready for 5B.