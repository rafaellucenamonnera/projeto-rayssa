Apply the provided migration that hardens the `can_be_responsible` permission with a server-side helper function and validation triggers.

## What the migration does

1. **Column safety net**: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_be_responsible boolean NOT NULL DEFAULT false` (idempotent — already added previously, will no-op).
2. **Backfill**: marks existing admin/gestor_conta users as `can_be_responsible = true` (only rows still false).
3. **`get_available_responsible_users()`**: SECURITY DEFINER SQL function returning `(user_id, nome)` for active eligible users, ordered by name. Useful for UI selectors without exposing the full profiles table.
4. **`validate_responsible_user_eligibility()`** + 2 BEFORE INSERT/UPDATE triggers on `leads.responsible_user_id` and `representative_cards.responsible_user_id`: rejects any save where the chosen responsible is not active + flagged `can_be_responsible`.

## Considerations

- The `has_role()` function in this project has a guard `IF _user_id <> auth.uid() THEN RETURN false`. During the backfill UPDATE there is no `auth.uid()`, so `has_role(user_id, 'admin')` will return **false for every row** and the backfill will mark **nothing**. Since admin/gestor were already backfilled by the prior migration, this is harmless, but worth noting — the statement is effectively a no-op.
- The new triggers will block any historical lead/card whose `responsible_user_id` points to a user that is not currently `can_be_responsible = true`, the next time that row is updated. Since we already backfilled admin/gestor as eligible, this should be safe, but any past assignment to a non-admin/non-gestor user will fail to update until either (a) that user is flagged eligible, or (b) the responsible is changed.
- `validate_responsible_user_eligibility` is not marked SECURITY DEFINER and does not set `search_path`. It only reads `public.profiles`, which is fine — RLS does not apply to triggers running in the row owner's context. Adding `SET search_path = public` would be slightly safer; I will add it during implementation.
- No frontend changes needed — `AdminLeads`, `AdminUsuarios`, `AdminPermissoes` already filter selectors by `can_be_responsible`. The new RPC `get_available_responsible_users` is created but not yet wired; we can leave it unused (harmless) or migrate the selectors to it later.

## Plan

1. Run the migration as provided, with one tweak: add `SET search_path = public` to `validate_responsible_user_eligibility` for consistency with other functions.
2. Do not modify the unrelated backfill statement — leave it in (no-op but matches the diff intent).
3. No frontend edits in this step.
4. Smoke test: try saving a card/lead with an ineligible responsible → should error; with an eligible one → should succeed.