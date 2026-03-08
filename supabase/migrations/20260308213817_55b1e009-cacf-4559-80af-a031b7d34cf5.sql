-- Allow only admins to delete leads
CREATE POLICY "Admins can delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow only admins to delete parceiros_comerciais
CREATE POLICY "Admins can delete parceiros" ON public.parceiros_comerciais
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));