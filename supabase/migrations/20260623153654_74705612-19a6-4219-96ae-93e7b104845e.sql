
-- 1) Tabela
CREATE TABLE public.commercial_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  proposal_name text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  omit_financials boolean NOT NULL DEFAULT false,
  omit_financials_reason text,
  public_url text,
  created_by_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  opened_at timestamptz,
  open_count integer NOT NULL DEFAULT 0,
  last_opened_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  accepted_by_email text,
  accepted_ip text,
  accepted_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX commercial_proposals_lead_id_idx ON public.commercial_proposals(lead_id);
CREATE INDEX commercial_proposals_token_idx ON public.commercial_proposals(token);
CREATE INDEX commercial_proposals_created_by_idx ON public.commercial_proposals(created_by_user_id);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_proposals TO authenticated;
GRANT ALL ON public.commercial_proposals TO service_role;

-- 3) RLS
ALTER TABLE public.commercial_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commercial_proposals_select"
  ON public.commercial_proposals FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY "commercial_proposals_insert"
  ON public.commercial_proposals FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
  );

CREATE POLICY "commercial_proposals_update"
  ON public.commercial_proposals FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
    OR created_by_user_id = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY "commercial_proposals_delete"
  ON public.commercial_proposals FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor_conta'::app_role)
  );

-- 4) updated_at trigger
CREATE TRIGGER commercial_proposals_set_updated_at
  BEFORE UPDATE ON public.commercial_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Estender tipos de notificação
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'card_responsible_assigned',
    'task_assigned',
    'task_updated',
    'task_deadline_48h',
    'task_deadline_24h',
    'comment_mention',
    'lead_auto_lost',
    'commercial_proposal_opened',
    'commercial_proposal_accepted'
  ]));

-- 6) RPC pública: get_public_commercial_proposal
CREATE OR REPLACE FUNCTION public.get_public_commercial_proposal(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    'accepted', v_proposal.accepted_at IS NOT NULL,
    'accepted_at', v_proposal.accepted_at,
    'opened_at', v_proposal.opened_at,
    'last_opened_at', v_proposal.last_opened_at,
    'open_count', v_proposal.open_count,
    'created_at', v_proposal.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_commercial_proposal(text) TO anon, authenticated;

-- 7) RPC pública: accept_commercial_proposal
CREATE OR REPLACE FUNCTION public.accept_commercial_proposal(
  p_token text,
  p_accepted_by_name text,
  p_accepted_by_email text,
  p_accepted_ip text DEFAULT NULL,
  p_accepted_user_agent text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.accept_commercial_proposal(text, text, text, text, text) TO anon, authenticated;
