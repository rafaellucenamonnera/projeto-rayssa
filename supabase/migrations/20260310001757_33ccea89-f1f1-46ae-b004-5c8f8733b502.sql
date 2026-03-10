
-- Drop the existing permissive update policy for partners
DROP POLICY IF EXISTS "Parceiros can update own record" ON public.parceiros_comerciais;

-- Recreate with restriction: partners cannot change 'aprovado' or 'ativo' fields
-- Use a trigger to enforce immutability of sensitive fields for non-admin users
CREATE OR REPLACE FUNCTION public.prevent_partner_self_approve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If the user is NOT an admin, prevent changing aprovado or ativo
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    NEW.aprovado := OLD.aprovado;
    NEW.ativo := OLD.ativo;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_partner_self_approve
  BEFORE UPDATE ON public.parceiros_comerciais
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_partner_self_approve();

-- Recreate the partner update policy (same as before)
CREATE POLICY "Parceiros can update own record" ON public.parceiros_comerciais
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Also add admin update policy so admins can update any parceiro (including aprovado)
DROP POLICY IF EXISTS "Admins can update parceiros" ON public.parceiros_comerciais;
CREATE POLICY "Admins can update parceiros" ON public.parceiros_comerciais
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
