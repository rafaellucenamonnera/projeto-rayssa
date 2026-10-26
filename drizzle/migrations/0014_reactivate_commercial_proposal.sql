CREATE OR REPLACE FUNCTION public.reactivate_commercial_proposal(p_proposal_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proposal public.commercial_proposals%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Nao autenticado'; END IF;
  SELECT * INTO v_proposal FROM public.commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002'; END IF;
  IF v_proposal.proposal_canceled_at IS NULL THEN RAISE EXCEPTION 'Proposta nao esta cancelada'; END IF;
  UPDATE public.commercial_proposals
     SET proposal_canceled_at = NULL, proposal_canceled_by = NULL, proposal_cancellation_reason = NULL
   WHERE id = p_proposal_id;
  RETURN json_build_object('ok', true);
END; $$;
REVOKE EXECUTE ON FUNCTION public.reactivate_commercial_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reactivate_commercial_proposal(uuid) TO authenticated, service_role;