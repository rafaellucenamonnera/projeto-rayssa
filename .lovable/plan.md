Apply the provided diff to `src/pages/admin/AdminLeads.tsx` to support dynamic panels via the `/admin/painel/:panelId` route.

## Changes

**`src/pages/admin/AdminLeads.tsx`**
- Add `useParams` to the `react-router-dom` import.
- Read `panelId` from the URL via `useParams()` as `dynamicPanelId`.
- Add `allPanels` state; derive `dynamicPanelName` from it.
- `painelTitle` now resolves to: dynamic panel name → static `painelTitleMap[location.pathname]` → "Painel Comercial".
- `currentPanelId` now prefers `dynamicPanelId` over the static `panelIdByPath` mapping.
- In the existing `loadClonePermissionAndPanels` effect, populate both `availablePanels` and `allPanels` from the same `pipeline_panels` query (no extra request).

## Out of scope
- No DB, RLS, routing, or sidebar changes (already done in earlier turns).
- No styling/layout changes.
- Static panel paths keep working unchanged.