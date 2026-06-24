
-- 1) create_notification: bloquear chamadores autenticados sem privilégio
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_user_id uuid, p_type text, p_title text, p_message text,
  p_lead_id uuid DEFAULT NULL::uuid, p_task_id uuid DEFAULT NULL::uuid,
  p_comment_id uuid DEFAULT NULL::uuid, p_action_url text DEFAULT NULL::text,
  p_metadata jsonb DEFAULT '{}'::jsonb, p_actor_user_id uuid DEFAULT NULL::uuid,
  p_delivery_key text DEFAULT NULL::text
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
  -- Bloquear usuários autenticados que não sejam staff interno.
  -- Chamadores internos (triggers / SECURITY DEFINER públicas / service_role)
  -- têm auth.uid() NULL e seguem permitidos.
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
    lead_id, task_id, comment_id, action_url, metadata
  ) VALUES (
    p_recipient_user_id,
    COALESCE(p_actor_user_id, v_uid),
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
$function$;

-- 2) has_role: remover guarda que retornava false em consultas entre usuários
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;

-- 3) Storage: restringir upload no bucket lead-comment-attachments ao escopo do lead
DROP POLICY IF EXISTS "Authenticated upload attachments storage" ON storage.objects;

CREATE POLICY "Authenticated upload attachments storage"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'lead-comment-attachments'
  AND owner = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id::text = (storage.foldername(name))[1]
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'gestor_conta'::app_role)
        OR l.responsible_user_id = auth.uid()
        OR l.parceiro_id IN (
          SELECT pc.id FROM public.parceiros_comerciais pc WHERE pc.user_id = auth.uid()
        )
      )
  )
);
