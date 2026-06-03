-- ============================================================================
-- Pré-checagem: unicidade de profiles.user_id
-- ============================================================================
DO $$
DECLARE v_dup integer;
BEGIN
  SELECT COUNT(*) INTO v_dup FROM (
    SELECT user_id FROM public.profiles GROUP BY user_id HAVING COUNT(*) > 1
  ) t;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'Existem % user_id duplicados em public.profiles. Resolva antes de aplicar.', v_dup;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_key ON public.profiles(user_id);

-- ============================================================================
-- 1. notifications
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL,
  actor_user_id uuid NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  lead_id uuid NULL,
  task_id uuid NULL,
  comment_id uuid NULL,
  action_url text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS task_id uuid,
  ADD COLUMN IF NOT EXISTS comment_id uuid,
  ADD COLUMN IF NOT EXISTS action_url text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- FKs e checks idempotentes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_recipient_fkey') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_recipient_fkey
      FOREIGN KEY (recipient_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_actor_fkey') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_actor_fkey
      FOREIGN KEY (actor_user_id) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_lead_id_fkey') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_type_check') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check CHECK (type IN (
        'card_responsible_assigned','task_assigned','task_updated',
        'task_deadline_48h','task_deadline_24h','comment_mention'
      ));
  END IF;
END $$;

-- ============================================================================
-- 2. notification_deliveries
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL,
  channel text NOT NULL,
  delivery_key text NULL,
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamptz NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_deliveries
  ADD COLUMN IF NOT EXISTS notification_id uuid,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS delivery_key text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notification_deliveries_notification_fkey') THEN
    ALTER TABLE public.notification_deliveries
      ADD CONSTRAINT notification_deliveries_notification_fkey
      FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notification_deliveries_channel_check') THEN
    ALTER TABLE public.notification_deliveries
      ADD CONSTRAINT notification_deliveries_channel_check CHECK (channel IN ('in_app','email'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notification_deliveries_status_check') THEN
    ALTER TABLE public.notification_deliveries
      ADD CONSTRAINT notification_deliveries_status_check CHECK (status IN ('pending','sent','failed','skipped'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notification_deliveries_unique_key') THEN
    ALTER TABLE public.notification_deliveries
      ADD CONSTRAINT notification_deliveries_unique_key UNIQUE (notification_id, channel, delivery_key);
  END IF;
END $$;

-- ============================================================================
-- 3. Evolução de lead_tasks
-- ============================================================================
ALTER TABLE public.lead_tasks
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS reminder_48h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_tasks_assigned_to_fkey') THEN
    ALTER TABLE public.lead_tasks
      ADD CONSTRAINT lead_tasks_assigned_to_fkey
      FOREIGN KEY (assigned_to) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.lead_tasks
SET due_at = (due_date::timestamp + time '23:59') AT TIME ZONE 'America/Sao_Paulo'
WHERE due_at IS NULL AND due_date IS NOT NULL;

-- ============================================================================
-- 4. lead_task_participants
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_task_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_task_participants
  ADD COLUMN IF NOT EXISTS task_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_task_participants_task_fkey') THEN
    ALTER TABLE public.lead_task_participants
      ADD CONSTRAINT lead_task_participants_task_fkey
      FOREIGN KEY (task_id) REFERENCES public.lead_tasks(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_task_participants_user_fkey') THEN
    ALTER TABLE public.lead_task_participants
      ADD CONSTRAINT lead_task_participants_user_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_task_participants_unique') THEN
    ALTER TABLE public.lead_task_participants
      ADD CONSTRAINT lead_task_participants_unique UNIQUE (task_id, user_id);
  END IF;
END $$;

-- ============================================================================
-- 5. lead_comment_mentions
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  mentioned_user_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_comment_mentions
  ADD COLUMN IF NOT EXISTS comment_id uuid,
  ADD COLUMN IF NOT EXISTS lead_id uuid,
  ADD COLUMN IF NOT EXISTS mentioned_user_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_comment_mentions_comment_fkey') THEN
    ALTER TABLE public.lead_comment_mentions
      ADD CONSTRAINT lead_comment_mentions_comment_fkey
      FOREIGN KEY (comment_id) REFERENCES public.lead_comments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_comment_mentions_lead_fkey') THEN
    ALTER TABLE public.lead_comment_mentions
      ADD CONSTRAINT lead_comment_mentions_lead_fkey
      FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_comment_mentions_mentioned_fkey') THEN
    ALTER TABLE public.lead_comment_mentions
      ADD CONSTRAINT lead_comment_mentions_mentioned_fkey
      FOREIGN KEY (mentioned_user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_comment_mentions_created_by_fkey') THEN
    ALTER TABLE public.lead_comment_mentions
      ADD CONSTRAINT lead_comment_mentions_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='lead_comment_mentions_unique') THEN
    ALTER TABLE public.lead_comment_mentions
      ADD CONSTRAINT lead_comment_mentions_unique UNIQUE (comment_id, mentioned_user_id);
  END IF;
END $$;

-- ============================================================================
-- 6. FKs opcionais em notifications -> lead_tasks/lead_comments
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_task_id_fkey') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_task_id_fkey
      FOREIGN KEY (task_id) REFERENCES public.lead_tasks(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_comment_id_fkey') THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_comment_id_fkey
      FOREIGN KEY (comment_id) REFERENCES public.lead_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 7. Índices
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON public.notifications(recipient_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_lead
  ON public.notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status
  ON public.notification_deliveries(channel, status, created_at);
CREATE INDEX IF NOT EXISTS idx_lead_tasks_assigned_due
  ON public.lead_tasks(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS idx_lead_task_participants_user
  ON public.lead_task_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_comment_mentions_user
  ON public.lead_comment_mentions(mentioned_user_id);

-- ============================================================================
-- 8. GRANTs
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_deliveries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_task_participants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_comment_mentions TO authenticated;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.notification_deliveries TO service_role;
GRANT ALL ON public.lead_task_participants TO service_role;
GRANT ALL ON public.lead_comment_mentions TO service_role;

-- ============================================================================
-- 9. RLS
-- ============================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_task_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_comment_mentions ENABLE ROW LEVEL SECURITY;

-- notifications
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins and gestores insert notifications" ON public.notifications;
CREATE POLICY "Admins and gestores insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

-- notification_deliveries
DROP POLICY IF EXISTS "Users read deliveries of own notifications" ON public.notification_deliveries;
CREATE POLICY "Users read deliveries of own notifications" ON public.notification_deliveries
  FOR SELECT TO authenticated
  USING (
    notification_id IN (
      SELECT id FROM public.notifications WHERE recipient_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins and gestores manage deliveries" ON public.notification_deliveries;
CREATE POLICY "Admins and gestores manage deliveries" ON public.notification_deliveries
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

-- lead_task_participants
DROP POLICY IF EXISTS "Users read own task participation" ON public.lead_task_participants;
CREATE POLICY "Users read own task participation" ON public.lead_task_participants
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

DROP POLICY IF EXISTS "Admins and gestores manage task participants" ON public.lead_task_participants;
CREATE POLICY "Admins and gestores manage task participants" ON public.lead_task_participants
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

-- lead_comment_mentions
DROP POLICY IF EXISTS "Users read own mentions" ON public.lead_comment_mentions;
CREATE POLICY "Users read own mentions" ON public.lead_comment_mentions
  FOR SELECT TO authenticated
  USING (
    mentioned_user_id = auth.uid()
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

DROP POLICY IF EXISTS "Admins and gestores manage mentions" ON public.lead_comment_mentions;
CREATE POLICY "Admins and gestores manage mentions" ON public.lead_comment_mentions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

-- ============================================================================
-- 10. Funções
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_lead_id uuid DEFAULT NULL,
  p_task_id uuid DEFAULT NULL,
  p_comment_id uuid DEFAULT NULL,
  p_action_url text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT NULL,
  p_delivery_key text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_exists boolean;
BEGIN
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
    lead_id, task_id, comment_id, action_url, metadata
  ) VALUES (
    p_recipient_user_id,
    COALESCE(p_actor_user_id, auth.uid()),
    p_type, p_title, p_message,
    p_lead_id, p_task_id, p_comment_id, p_action_url,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_notification_id;

  INSERT INTO public.notification_deliveries (notification_id, channel, delivery_key, status, sent_at)
  VALUES (v_notification_id, 'in_app', p_delivery_key, 'sent', now());

  INSERT INTO public.notification_deliveries (notification_id, channel, delivery_key, status)
  VALUES (v_notification_id, 'email', p_delivery_key, 'pending');

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, uuid, uuid, uuid, text, jsonb, uuid, text
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE id = p_notification_id
    AND recipient_user_id = auth.uid()
    AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notification_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE recipient_user_id = auth.uid()
    AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;