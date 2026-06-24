ALTER TABLE public.commercial_proposals
  ADD COLUMN IF NOT EXISTS proposal_canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_canceled_by uuid,
  ADD COLUMN IF NOT EXISTS proposal_cancellation_reason text;

CREATE OR REPLACE FUNCTION public.cancel_commercial_proposal(p_proposal_id uuid, p_reason text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_proposal public.commercial_proposals%ROWTYPE;
  v_reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;
  IF length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Motivo do cancelamento e obrigatorio (minimo 5 caracteres)';
  END IF;

  SELECT * INTO v_proposal FROM public.commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposal.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta ja aceita. Use cancelamento de aceite.';
  END IF;
  IF v_proposal.proposal_canceled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Proposta ja cancelada';
  END IF;

  UPDATE public.commercial_proposals
     SET proposal_canceled_at = now(),
         proposal_canceled_by = v_uid,
         proposal_cancellation_reason = v_reason
   WHERE id = p_proposal_id
   RETURNING * INTO v_proposal;

  RETURN json_build_object(
    'ok', true,
    'proposal_canceled_at', v_proposal.proposal_canceled_at,
    'proposal_cancellation_reason', v_proposal.proposal_cancellation_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_commercial_proposal(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_commercial_proposal(uuid, text) TO authenticated, service_role;