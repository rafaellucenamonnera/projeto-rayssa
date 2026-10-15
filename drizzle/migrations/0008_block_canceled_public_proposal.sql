CREATE OR REPLACE FUNCTION public.get_public_commercial_proposal(p_token text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_proposal public.commercial_proposals%ROWTYPE;
  v_was_unopened boolean := false;
  v_lead_name text;
BEGIN
  SELECT * INTO v_proposal FROM public.commercial_proposals WHERE token = p_token LIMIT 1;
  IF NOT FOUND OR v_proposal.proposal_canceled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002';
  END IF;
  v_was_unopened := v_proposal.opened_at IS NULL;
  UPDATE public.commercial_proposals
     SET opened_at = COALESCE(opened_at, now()), last_opened_at = now(), open_count = open_count + 1
   WHERE id = v_proposal.id RETURNING * INTO v_proposal;
  IF v_was_unopened AND v_proposal.created_by_user_id IS NOT NULL THEN
    SELECT nome_fantasia INTO v_lead_name FROM public.leads WHERE id = v_proposal.lead_id;
    PERFORM public.create_notification(
      v_proposal.created_by_user_id, 'commercial_proposal_opened', 'Proposta comercial aberta',
      format('A proposta "%s" foi aberta pelo cliente.', COALESCE(v_proposal.proposal_name, v_lead_name, 'Cliente Monnera')),
      v_proposal.lead_id, NULL, NULL, format('/admin/painel-comercial?card=%s', v_proposal.lead_id),
      jsonb_build_object('proposal_id', v_proposal.id, 'proposal_name', v_proposal.proposal_name),
      NULL, 'proposal_opened:' || v_proposal.id::text);
  END IF;
  RETURN json_build_object(
    'id', v_proposal.id, 'lead_id', v_proposal.lead_id, 'proposal_name', v_proposal.proposal_name,
    'payload', v_proposal.payload, 'omit_financials', v_proposal.omit_financials,
    'omit_financials_reason', v_proposal.omit_financials_reason,
    'accepted', (v_proposal.accepted_at IS NOT NULL AND v_proposal.acceptance_canceled_at IS NULL),
    'accepted_at', v_proposal.accepted_at, 'acceptance_canceled_at', v_proposal.acceptance_canceled_at,
    'acceptance_cancellation_reason', v_proposal.acceptance_cancellation_reason,
    'opened_at', v_proposal.opened_at, 'last_opened_at', v_proposal.last_opened_at,
    'open_count', v_proposal.open_count, 'created_at', v_proposal.created_at);
END;
$fn$;