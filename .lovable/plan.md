Apply the provided diff to `src/pages/admin/AdminLeads.tsx`:

1. Add new state `allActiveUsers` alongside `usersAll`.
2. In `loadData`, change the profiles query to select `user_id, nome, ativo, can_be_responsible`, filter `ativo=true`, then:
   - `allActiveUsers` ← all active users (used for resolving responsible names in export/display).
   - `usersAll` ← only those with `can_be_responsible = true` (used in selectors when assigning responsible).
3. In `createRepresentativeCard`, add a guard that rejects `responsible_user_id` not present in `usersAll` (i.e., user lacks permission to be responsible).
4. Pass `allActiveUsers` (instead of `usersAll`) to `LeadExportButton` so exported names still resolve for historical responsibles even if their permission was revoked.

No other files change. Migration for `can_be_responsible` already applied in prior steps.