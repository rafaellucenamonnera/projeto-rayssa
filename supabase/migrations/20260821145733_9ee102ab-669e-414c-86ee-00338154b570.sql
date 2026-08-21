GRANT SELECT, INSERT, UPDATE ON public.cross_onboarding_steps TO authenticated;
GRANT ALL ON public.cross_onboarding_steps TO service_role;

CREATE POLICY cross_onboarding_steps_insert_internal
ON public.cross_onboarding_steps
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY cross_onboarding_steps_update_internal
ON public.cross_onboarding_steps
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));