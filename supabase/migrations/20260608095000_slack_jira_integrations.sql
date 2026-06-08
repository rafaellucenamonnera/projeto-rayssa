ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS slack_user_id text,
  ADD COLUMN IF NOT EXISTS slack_username text,
  ADD COLUMN IF NOT EXISTS registration_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS responsible_slack_user_id text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_slack_user_id_key
  ON public.profiles(slack_user_id)
  WHERE slack_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.slack_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_user_id text NOT NULL UNIQUE,
  team_id text NULL,
  name text NOT NULL,
  real_name text NULL,
  email text NULL,
  avatar_url text NULL,
  is_active boolean NOT NULL DEFAULT true,
  profile_user_id uuid NULL REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  registration_status text NOT NULL DEFAULT 'pending',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_users_profile_user_id
  ON public.slack_users(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_users_active_name
  ON public.slack_users(is_active, name);

CREATE TABLE IF NOT EXISTS public.jira_card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  origin_reference text NOT NULL,
  jira_issue_key text NULL,
  jira_issue_id text NULL,
  sync_status text NOT NULL DEFAULT 'pending',
  last_error text NULL,
  synced_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.jira_card_links
  ADD COLUMN IF NOT EXISTS jira_issue_key text,
  ADD COLUMN IF NOT EXISTS jira_issue_id text;

CREATE INDEX IF NOT EXISTS idx_jira_card_links_sync_status
  ON public.jira_card_links(sync_status, created_at);

CREATE TABLE IF NOT EXISTS public.integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  delivery_key text NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS integration_events_delivery_key_unique
  ON public.integration_events(provider, delivery_key)
  WHERE delivery_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_integration_events_recent
  ON public.integration_events(provider, status, created_at DESC);

ALTER TABLE public.slack_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jira_card_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.slack_users TO authenticated;
GRANT SELECT ON public.jira_card_links TO authenticated;
GRANT SELECT ON public.integration_events TO authenticated;
GRANT ALL ON public.slack_users TO service_role;
GRANT ALL ON public.jira_card_links TO service_role;
GRANT ALL ON public.integration_events TO service_role;

DROP POLICY IF EXISTS "Authenticated read active slack users" ON public.slack_users;
CREATE POLICY "Authenticated read active slack users" ON public.slack_users
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins read jira card links" ON public.jira_card_links;
CREATE POLICY "Admins read jira card links" ON public.jira_card_links
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
  );

DROP POLICY IF EXISTS "Admins read integration events" ON public.integration_events;
CREATE POLICY "Admins read integration events" ON public.integration_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notification_deliveries_channel_check') THEN
    ALTER TABLE public.notification_deliveries
      DROP CONSTRAINT notification_deliveries_channel_check;
  END IF;

  ALTER TABLE public.notification_deliveries
    ADD CONSTRAINT notification_deliveries_channel_check CHECK (channel IN ('in_app','email','slack'));
END $$;

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
  v_slack_user_id text;
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

  SELECT slack_user_id INTO v_slack_user_id
  FROM public.profiles
  WHERE user_id = p_recipient_user_id
    AND slack_user_id IS NOT NULL;

  IF v_slack_user_id IS NOT NULL THEN
    INSERT INTO public.notification_deliveries (notification_id, channel, delivery_key, status)
    VALUES (v_notification_id, 'slack', p_delivery_key, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_notification_id;
END;
$$;
