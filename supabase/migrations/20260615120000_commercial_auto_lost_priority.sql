-- Automacao do Painel Comercial:
-- - cards parados por mais de 10 dias uteis em etapas comerciais vao para Lead Perdido
-- - notifica criador/responsavel e usuarios com permissao explicita

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid,
  ADD COLUMN IF NOT EXISTS auto_lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_lost_reason text;

CREATE INDEX IF NOT EXISTS idx_leads_commercial_auto_lost
  ON public.leads(panel_id, status_lead, auto_lost_at);

CREATE INDEX IF NOT EXISTS idx_leads_created_by_user_id
  ON public.leads(created_by_user_id);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_type_check') THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
  END IF;

  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check CHECK (type IN (
      'card_responsible_assigned',
      'task_assigned',
      'task_updated',
      'task_deadline_48h',
      'task_deadline_24h',
      'comment_mention',
      'lead_auto_lost'
    ));
END $$;

INSERT INTO public.module_permissions (user_id, modulo, acao, permitido)
SELECT ur.user_id, 'leads', 'receber_notificacao_lead_perdido', true
FROM public.user_roles ur
WHERE ur.role::text = 'admin'
  AND NOT EXISTS (
    SELECT 1
    FROM public.module_permissions mp
    WHERE mp.user_id = ur.user_id
      AND mp.modulo = 'leads'
      AND mp.acao = 'receber_notificacao_lead_perdido'
  );

CREATE OR REPLACE FUNCTION public.business_days_between_dates(
  p_start timestamptz,
  p_end timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM generate_series(
    ((p_start AT TIME ZONE 'America/Sao_Paulo')::date + 1),
    ((p_end AT TIME ZONE 'America/Sao_Paulo')::date),
    interval '1 day'
  ) AS d(day)
  WHERE EXTRACT(ISODOW FROM d.day) BETWEEN 1 AND 5;
$$;

REVOKE ALL ON FUNCTION public.business_days_between_dates(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.business_days_between_dates(timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_commercial_panel(p_panel_id text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_exists boolean := false;
  v_has_name boolean := false;
BEGIN
  IF p_panel_id IN ('comercial', 'comerc') THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pipeline_panels'
      AND column_name = 'name'
  ) INTO v_has_name;

  IF v_has_name THEN
    EXECUTE
      'SELECT EXISTS (
        SELECT 1
        FROM public.pipeline_panels
        WHERE id = $1
          AND name ILIKE ''%comercial%''
      )'
      INTO v_exists
      USING p_panel_id;
  END IF;

  RETURN COALESCE(v_exists, false);
END;
$$;

REVOKE ALL ON FUNCTION public.is_commercial_panel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_commercial_panel(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.move_inactive_commercial_leads_to_lost()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moved_count integer := 0;
  v_lead record;
  v_recipient record;
  v_notification_id uuid;
  v_reason text := 'Movido automaticamente para Lead Perdido por inatividade superior a 10 dias úteis na etapa comercial.';
BEGIN
  FOR v_lead IN
    SELECT
      l.id,
      l.nome_fantasia,
      l.created_by_user_id,
      l.responsible_user_id,
      h.etapa,
      h.data_entrada,
      public.business_days_between_dates(h.data_entrada, now()) AS business_days
    FROM public.leads l
    JOIN public.lead_stage_history h
      ON h.lead_id = l.id
     AND h.data_saida IS NULL
    WHERE public.is_commercial_panel(l.panel_id)
      AND l.auto_lost_at IS NULL
      AND l.status_lead::text IN (
        'novo_lead',
        'contato_realizado',
        'reuniao_agendada',
        'reuniao_realizada',
        'proposta_enviada',
        'proposta_comercial',
        'contrato_enviado'
      )
      AND public.business_days_between_dates(h.data_entrada, now()) > 10
  LOOP
    UPDATE public.leads
    SET status_lead = 'lead_perdido'::public.lead_status,
        motivo_perda = v_reason,
        auto_lost_at = now(),
        auto_lost_reason = v_reason
    WHERE id = v_lead.id
      AND status_lead::text = v_lead.etapa
      AND auto_lost_at IS NULL;

    IF FOUND THEN
      v_moved_count := v_moved_count + 1;

      FOR v_recipient IN
        SELECT DISTINCT recipient_user_id
        FROM (
          SELECT v_lead.created_by_user_id AS recipient_user_id
          UNION
          SELECT v_lead.responsible_user_id AS recipient_user_id
          UNION
          SELECT mp.user_id AS recipient_user_id
          FROM public.module_permissions mp
          WHERE mp.modulo = 'leads'
            AND mp.acao = 'receber_notificacao_lead_perdido'
            AND mp.permitido = true
        ) recipients
        WHERE recipient_user_id IS NOT NULL
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.notifications n
          WHERE n.recipient_user_id = v_recipient.recipient_user_id
            AND n.lead_id = v_lead.id
            AND n.type = 'lead_auto_lost'
            AND n.metadata->>'auto_lost_at' IS NOT NULL
        ) THEN
          v_notification_id := public.create_notification(
            v_recipient.recipient_user_id,
            'lead_auto_lost',
            'Lead movido para perdido',
            format(
              'O card %s foi movido automaticamente para Lead Perdido após %s dias úteis sem movimentação na etapa.',
              COALESCE(v_lead.nome_fantasia, 'sem título'),
              v_lead.business_days
            ),
            v_lead.id,
            NULL,
            NULL,
            '/admin/painel/comercial?card=' || v_lead.id::text,
            jsonb_build_object(
              'stage', v_lead.etapa,
              'business_days', v_lead.business_days,
              'auto_lost_at', now()
            ),
            NULL,
            'lead-auto-lost-' || v_lead.id::text || '-' || v_recipient.recipient_user_id::text
          );
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN v_moved_count;
END;
$$;

REVOKE ALL ON FUNCTION public.move_inactive_commercial_leads_to_lost() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_inactive_commercial_leads_to_lost() TO service_role;

DO $do$
BEGIN
  CREATE SCHEMA IF NOT EXISTS extensions;
  CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

  IF EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'commercial-auto-lost-daily'
  ) THEN
    PERFORM cron.unschedule('commercial-auto-lost-daily');
  END IF;

  PERFORM cron.schedule(
    'commercial-auto-lost-daily',
    '0 11 * * 1-5',
    $$SELECT public.move_inactive_commercial_leads_to_lost();$$
  );
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'pg_cron não está disponível ou não pôde ser configurado automaticamente. Agende public.move_inactive_commercial_leads_to_lost() no Supabase Cron. Erro: %', SQLERRM;
END $do$;
