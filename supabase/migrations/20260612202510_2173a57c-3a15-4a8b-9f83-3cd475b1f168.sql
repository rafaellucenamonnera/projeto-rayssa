
-- success_customers
DROP POLICY IF EXISTS "Authenticated users can read success customers" ON public.success_customers;
CREATE POLICY "Admins and gestores can read success customers"
  ON public.success_customers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );

-- assignments
DROP POLICY IF EXISTS "Authenticated users can read success customer assignments" ON public.success_customer_assignments;
CREATE POLICY "Admins and gestores can read success customer assignments"
  ON public.success_customer_assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );

-- feedback history
DROP POLICY IF EXISTS "Authenticated users can read success customer feedback" ON public.success_customer_feedback_history;
CREATE POLICY "Admins and gestores can read success customer feedback"
  ON public.success_customer_feedback_history FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  );
