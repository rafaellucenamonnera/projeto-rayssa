
-- Allow admins and gestores to update their own comments
CREATE POLICY "Admins and gestores update own comments"
ON public.lead_comments
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid()) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
)
WITH CHECK (
  (user_id = auth.uid()) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
);

-- Allow admins and gestores to delete their own comments
CREATE POLICY "Admins and gestores delete own comments"
ON public.lead_comments
FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid()) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
);

-- Partners can update own comments
CREATE POLICY "Partners update own comments"
ON public.lead_comments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() AND
  lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid())
)
WITH CHECK (
  user_id = auth.uid() AND
  lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid())
);

-- Partners can delete own comments
CREATE POLICY "Partners delete own comments"
ON public.lead_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() AND
  lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid())
);
