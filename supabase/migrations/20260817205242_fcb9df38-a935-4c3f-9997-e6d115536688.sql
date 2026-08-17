-- 1. Tarefas: descrição, autor da edição e exclusão lógica
ALTER TABLE public.representative_card_tasks
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 2. Histórico operacional (imutável)
CREATE TABLE IF NOT EXISTS public.representative_card_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  actor_user_id uuid,
  actor_label text NOT NULL DEFAULT 'sistema',
  action text NOT NULL,
  source_stage_id text,
  destination_stage_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS representative_card_history_card_idx
  ON public.representative_card_history (representative_card_id, created_at DESC);

GRANT SELECT, INSERT ON public.representative_card_history TO authenticated;
GRANT ALL ON public.representative_card_history TO service_role;

ALTER TABLE public.representative_card_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and gestores read card history" ON public.representative_card_history;
CREATE POLICY "Admins and gestores read card history"
  ON public.representative_card_history FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

DROP POLICY IF EXISTS "Admins and gestores insert card history" ON public.representative_card_history;
CREATE POLICY "Admins and gestores insert card history"
  ON public.representative_card_history FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

-- Sem policies de UPDATE/DELETE: trilha imutável para authenticated.

-- 3. Observações operacionais
CREATE TABLE IF NOT EXISTS public.representative_card_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS representative_card_notes_card_uniq
  ON public.representative_card_notes (representative_card_id);

GRANT SELECT, INSERT, UPDATE ON public.representative_card_notes TO authenticated;
GRANT ALL ON public.representative_card_notes TO service_role;

ALTER TABLE public.representative_card_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and gestores read card notes" ON public.representative_card_notes;
CREATE POLICY "Admins and gestores read card notes"
  ON public.representative_card_notes FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

DROP POLICY IF EXISTS "Admins and gestores write card notes" ON public.representative_card_notes;
CREATE POLICY "Admins and gestores write card notes"
  ON public.representative_card_notes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

DROP POLICY IF EXISTS "Admins and gestores update card notes" ON public.representative_card_notes;
CREATE POLICY "Admins and gestores update card notes"
  ON public.representative_card_notes FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

DROP TRIGGER IF EXISTS representative_card_notes_touch ON public.representative_card_notes;
CREATE TRIGGER representative_card_notes_touch
  BEFORE UPDATE ON public.representative_card_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Bloqueio do card
ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS blocked_source text,
  ADD COLUMN IF NOT EXISTS unblocked_at timestamptz;

-- 5. Trigger de mudança de etapa (bloqueia card travado e registra histórico)
CREATE OR REPLACE FUNCTION public.representative_card_guard_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND COALESCE(OLD.is_blocked, false) = true THEN
    RAISE EXCEPTION 'Card bloqueado: resolva o bloqueio antes de mover de etapa.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS representative_cards_guard_stage ON public.representative_cards;
CREATE TRIGGER representative_cards_guard_stage
  BEFORE UPDATE ON public.representative_cards
  FOR EACH ROW EXECUTE FUNCTION public.representative_card_guard_stage_change();

CREATE OR REPLACE FUNCTION public.representative_card_log_stage_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_label text;
BEGIN
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    SELECT nome INTO v_label FROM public.profiles WHERE user_id = v_uid;

    INSERT INTO public.representative_card_history (
      representative_card_id, actor_user_id, actor_label, action,
      source_stage_id, destination_stage_id, payload
    ) VALUES (
      NEW.id, v_uid, COALESCE(v_label, 'sistema'), 'stage_changed',
      OLD.stage_id, NEW.stage_id,
      jsonb_build_object('cliente', NEW.full_name, 'cnpj', NEW.cnpj)
    );
  END IF;

  IF COALESCE(NEW.is_blocked, false) IS DISTINCT FROM COALESCE(OLD.is_blocked, false) THEN
    SELECT nome INTO v_label FROM public.profiles WHERE user_id = v_uid;

    INSERT INTO public.representative_card_history (
      representative_card_id, actor_user_id, actor_label, action,
      source_stage_id, destination_stage_id, payload
    ) VALUES (
      NEW.id, v_uid, COALESCE(v_label, 'sistema'),
      CASE WHEN NEW.is_blocked THEN 'block_created' ELSE 'block_resolved' END,
      OLD.stage_id, NEW.stage_id,
      jsonb_build_object('motivo', NEW.blocked_reason, 'origem', NEW.blocked_source, 'cliente', NEW.full_name, 'cnpj', NEW.cnpj)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS representative_cards_log_stage ON public.representative_cards;
CREATE TRIGGER representative_cards_log_stage
  AFTER UPDATE ON public.representative_cards
  FOR EACH ROW EXECUTE FUNCTION public.representative_card_log_stage_change();

-- 6. Notificações Cross
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS representative_card_id uuid REFERENCES public.representative_cards(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'card_responsible_assigned','task_assigned','task_updated','task_deadline_48h','task_deadline_24h',
    'comment_mention','lead_auto_lost','commercial_proposal_opened','commercial_proposal_accepted',
    'cross_card_created','cross_card_updated','cross_stage_changed','cross_task_created','cross_task_updated',
    'cross_task_completed','cross_task_deleted','cross_attachment_added','cross_attachment_removed',
    'cross_block_created','cross_block_resolved','cross_note_updated'
  ])
);

CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_lead_id uuid DEFAULT NULL::uuid,
  p_task_id uuid DEFAULT NULL::uuid,
  p_comment_id uuid DEFAULT NULL::uuid,
  p_action_url text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL::uuid,
  p_delivery_key text DEFAULT NULL::text,
  p_representative_card_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id uuid;
  v_exists boolean;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL
     AND NOT (
       EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin')
       OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'gestor_conta')
     ) THEN
    RAISE EXCEPTION 'Sem permissão para criar notificações';
  END IF;

  IF p_recipient_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = p_recipient_user_id AND ativo = true
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (
    recipient_user_id, actor_user_id, type, title, message,
    lead_id, task_id, comment_id, action_url, metadata, representative_card_id
  ) VALUES (
    p_recipient_user_id,
    COALESCE(p_actor_user_id, v_uid),
    p_type, p_title, p_message,
    p_lead_id, p_task_id, p_comment_id, p_action_url,
    COALESCE(p_metadata, '{}'::jsonb),
    p_representative_card_id
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.notification_deliveries (notification_id, channel, delivery_key, status, sent_at)
  VALUES (v_notification_id, 'in_app', p_delivery_key, 'sent', now())
  ON CONFLICT ON CONSTRAINT notification_deliveries_unique_key DO NOTHING;

  RETURN v_notification_id;
END;
$function$;

-- 7. Registro de histórico a partir do app (respeita RLS de leitura, aceita ator nulo = sistema)
CREATE OR REPLACE FUNCTION public.log_representative_card_event(
  p_card_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_source_stage_id text DEFAULT NULL,
  p_destination_stage_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_label text;
  v_id uuid;
BEGIN
  IF v_uid IS NOT NULL
     AND NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'gestor_conta'::app_role)) THEN
    RAISE EXCEPTION 'Sem permissão para registrar histórico';
  END IF;

  SELECT nome INTO v_label FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.representative_card_history (
    representative_card_id, actor_user_id, actor_label, action,
    source_stage_id, destination_stage_id, payload
  ) VALUES (
    p_card_id, v_uid, COALESCE(v_label, 'sistema'), p_action,
    p_source_stage_id, p_destination_stage_id, COALESCE(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;