
-- Drop the broken policy
DROP POLICY IF EXISTS "Parceiros can update own record" ON public.parceiros_comerciais;

-- Create a simple replacement policy (trigger handles field restrictions)
CREATE POLICY "Parceiros can update own record"
  ON public.parceiros_comerciais
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
