-- Drop the broken policy with the tautological subquery
DROP POLICY IF EXISTS "Parceiros update own contact info" ON public.parceiros_comerciais;

-- Recreate as a simple self-row policy. Sensitive fields are enforced by the
-- BEFORE UPDATE trigger prevent_partner_self_approve which forces OLD values
-- for aprovado, ativo, cpf, codigo_parceiro and slug_consultor when the
-- caller is not an admin.
CREATE POLICY "Parceiros update own contact info"
ON public.parceiros_comerciais
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Ensure the protective trigger exists and is attached
DROP TRIGGER IF EXISTS trg_prevent_partner_self_approve ON public.parceiros_comerciais;
CREATE TRIGGER trg_prevent_partner_self_approve
BEFORE UPDATE ON public.parceiros_comerciais
FOR EACH ROW
EXECUTE FUNCTION public.prevent_partner_self_approve();