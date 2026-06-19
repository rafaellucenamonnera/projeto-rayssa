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
  VALUES (v_notification_id, 'in_app', p_delivery_key, 'sent', now())
  ON CONFLICT ON CONSTRAINT notification_deliveries_unique_key DO NOTHING;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, uuid, uuid, uuid, text, jsonb, uuid, text
) TO authenticated, service_role;

UPDATE public.notification_deliveries
SET
  status = 'skipped',
  error = 'Email notifications disabled for in-app operational notifications'
WHERE channel = 'email'
  AND status = 'pending';