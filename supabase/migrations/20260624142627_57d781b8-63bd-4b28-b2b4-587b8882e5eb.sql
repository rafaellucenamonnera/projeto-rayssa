-- Add idempotent columns for PDF idempotency + acceptance cancellation
ALTER TABLE public.commercial_proposals
  ADD COLUMN IF NOT EXISTS pdf_processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acceptance_canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS acceptance_canceled_by uuid,
  ADD COLUMN IF NOT EXISTS acceptance_cancellation_reason text,
  ADD COLUMN IF NOT EXISTS version int,
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_status text,
  ADD COLUMN IF NOT EXISTS pdf_error text;

-- Adjust get_public_commercial_proposal: aceito ativo = accepted_at NOT NULL AND acceptance_canceled_at IS NULL
CREATE OR REPLACE FUNCTION public.get_public_commercial_proposal(p_token text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal public.commercial_proposals%ROWTYPE;
  v_was_unopened boolean := false;
  v_lead_name text;
BEGIN
  SELECT * INTO v_proposal
  FROM public.commercial_proposals
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  v_was_unopened := v_proposal.opened_at IS NULL;

  UPDATE public.commercial_proposals
     SET opened_at = COALESCE(opened_at, now()),
         last_opened_at = now(),
         open_count = open_count + 1
   WHERE id = v_proposal.id
   RETURNING * INTO v_proposal;

  IF v_was_unopened AND v_proposal.created_by_user_id IS NOT NULL THEN
    SELECT nome_fantasia INTO v_lead_name FROM public.leads WHERE id = v_proposal.lead_id;
    PERFORM public.create_notification(
      v_proposal.created_by_user_id,
      'commercial_proposal_opened',
      'Proposta comercial aberta',
      format('A proposta "%s" foi aberta pelo cliente.', COALESCE(v_proposal.proposal_name, v_lead_name, 'Cliente Monnera')),
      v_proposal.lead_id,
      NULL,
      NULL,
      format('/admin/painel-comercial?card=%s', v_proposal.lead_id),
      jsonb_build_object('proposal_id', v_proposal.id, 'proposal_name', v_proposal.proposal_name),
      NULL,
      'proposal_opened:' || v_proposal.id::text
    );
  END IF;

  RETURN json_build_object(
    'id', v_proposal.id,
    'lead_id', v_proposal.lead_id,
    'proposal_name', v_proposal.proposal_name,
    'payload', v_proposal.payload,
    'omit_financials', v_proposal.omit_financials,
    'omit_financials_reason', v_proposal.omit_financials_reason,
    'accepted', (v_proposal.accepted_at IS NOT NULL AND v_proposal.acceptance_canceled_at IS NULL),
    'accepted_at', v_proposal.accepted_at,
    'acceptance_canceled_at', v_proposal.acceptance_canceled_at,
    'acceptance_cancellation_reason', v_proposal.acceptance_cancellation_reason,
    'opened_at', v_proposal.opened_at,
    'last_opened_at', v_proposal.last_opened_at,
    'open_count', v_proposal.open_count,
    'created_at', v_proposal.created_at
  );
END;
$function$;

-- Adjust accept_commercial_proposal: bloquear aceite se acceptance_canceled_at IS NOT NULL
CREATE OR REPLACE FUNCTION public.accept_commercial_proposal(p_token text, p_accepted_by_name text, p_accepted_by_email text, p_accepted_ip text DEFAULT NULL::text, p_accepted_user_agent text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_proposal public.commercial_proposals%ROWTYPE;
  v_lead_name text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RAISE EXCEPTION 'Token invalido';
  END IF;
  IF p_accepted_by_name IS NULL OR length(trim(p_accepted_by_name)) = 0 THEN
    RAISE EXCEPTION 'Nome obrigatorio';
  END IF;
  IF p_accepted_by_email IS NULL OR p_accepted_by_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email invalido';
  END IF;

  SELECT * INTO v_proposal
  FROM public.commercial_proposals
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002';
  END IF;

  IF v_proposal.acceptance_canceled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Aceite cancelado. Solicite uma nova proposta comercial.';
  END IF;

  IF v_proposal.accepted_at IS NOT NULL THEN
    RETURN json_build_object(
      'already_accepted', true,
      'accepted_at', v_proposal.accepted_at,
      'lead_id', v_proposal.lead_id,
      'proposal_name', v_proposal.proposal_name
    );
  END IF;

  UPDATE public.commercial_proposals
     SET accepted_at = now(),
         accepted_by_name = trim(p_accepted_by_name),
         accepted_by_email = lower(trim(p_accepted_by_email)),
         accepted_ip = p_accepted_ip,
         accepted_user_agent = p_accepted_user_agent
   WHERE id = v_proposal.id
   RETURNING * INTO v_proposal;

  IF v_proposal.created_by_user_id IS NOT NULL THEN
    SELECT nome_fantasia INTO v_lead_name FROM public.leads WHERE id = v_proposal.lead_id;
    PERFORM public.create_notification(
      v_proposal.created_by_user_id,
      'commercial_proposal_accepted',
      'Proposta comercial aceita',
      format('A proposta "%s" foi aceita por %s.',
        COALESCE(v_proposal.proposal_name, v_lead_name, 'Cliente Monnera'),
        v_proposal.accepted_by_name),
      v_proposal.lead_id,
      NULL,
      NULL,
      format('/admin/painel-comercial?card=%s', v_proposal.lead_id),
      jsonb_build_object(
        'proposal_id', v_proposal.id,
        'proposal_name', v_proposal.proposal_name,
        'accepted_by_name', v_proposal.accepted_by_name,
        'accepted_by_email', v_proposal.accepted_by_email
      ),
      NULL,
      'proposal_accepted:' || v_proposal.id::text
    );
  END IF;

  RETURN json_build_object(
    'already_accepted', false,
    'accepted_at', v_proposal.accepted_at,
    'lead_id', v_proposal.lead_id,
    'proposal_name', v_proposal.proposal_name
  );
END;
$function$;

-- RPC: cancel_commercial_proposal_acceptance
CREATE OR REPLACE FUNCTION public.cancel_commercial_proposal_acceptance(p_proposal_id uuid, p_reason text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_proposal public.commercial_proposals%ROWTYPE;
  v_reason text := trim(coalesce(p_reason, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado';
  END IF;
  IF NOT (public.has_role(v_uid, 'admin'::app_role) OR public.has_role(v_uid, 'gestor_conta'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissao para cancelar aceite';
  END IF;
  IF length(v_reason) < 5 THEN
    RAISE EXCEPTION 'Motivo do cancelamento e obrigatorio (minimo 5 caracteres)';
  END IF;

  SELECT * INTO v_proposal FROM public.commercial_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta nao encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_proposal.accepted_at IS NULL THEN
    RAISE EXCEPTION 'Proposta nao possui aceite registrado';
  END IF;
  IF v_proposal.acceptance_canceled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Aceite ja cancelado';
  END IF;

  UPDATE public.commercial_proposals
     SET acceptance_canceled_at = now(),
         acceptance_canceled_by = v_uid,
         acceptance_cancellation_reason = v_reason
   WHERE id = p_proposal_id
   RETURNING * INTO v_proposal;

  RETURN json_build_object(
    'ok', true,
    'acceptance_canceled_at', v_proposal.acceptance_canceled_at,
    'acceptance_cancellation_reason', v_proposal.acceptance_cancellation_reason
  );
END;
$function$;