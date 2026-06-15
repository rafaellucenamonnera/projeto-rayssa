
-- =====================================================================
-- commercial_auto_lost_priority (rewrite for bapxuzodzgahscatvofs)
-- =====================================================================

-- 1) Audit columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS auto_lost_at     timestamptz,
  ADD COLUMN IF NOT EXISTS auto_lost_reason text;

CREATE INDEX IF NOT EXISTS idx_leads_auto_lost_at ON public.leads (auto_lost_at);

-- 2) Helper: business days between two timestamps (Mon-Fri, BRT, no holidays)
CREATE OR REPLACE FUNCTION public.business_days_between_dates(p_start timestamptz, p_end timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM generate_series(
    ((p_start AT TIME ZONE 'America/Sao_Paulo')::date),
    ((p_end   AT TIME ZONE 'America/Sao_Paulo')::date - 1),
    interval '1 day'
  ) d
  WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

-- 3) Helper: is panel id the commercial pipeline?
CREATE OR REPLACE FUNCTION public.is_commercial_panel(p_panel_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pipeline_panels p
    WHERE p.id::text = p_panel_id
      AND (lower(p.id::text) IN ('comercial','comerc')
           OR lower(coalesce(p.name,'')) LIKE '%comercial%')
  );
$$;

-- 4) Core: move inactive commercial leads to lead_perdido (>10 business days)
CREATE OR REPLACE FUNCTION public.move_inactive_commercial_leads_to_lost()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead      record;
  v_recipient uuid;
  v_count     integer := 0;
  v_dkey      text;
BEGIN
  FOR v_lead IN
    SELECT l.id, l.nome_fantasia, l.responsible_user_id,
           h.etapa, h.data_entrada,
           public.business_days_between_dates(h.data_entrada, now()) AS dias_uteis
      FROM public.leads l
      JOIN public.lead_stage_history h
        ON h.lead_id = l.id AND h.data_saida IS NULL
     WHERE l.auto_lost_at IS NULL
       AND l.status_lead NOT IN ('lead_perdido','lead_convertido','contrato_assinado')
       AND public.is_commercial_panel(l.panel_id)
       AND public.business_days_between_dates(h.data_entrada, now()) > 10
  LOOP
    UPDATE public.leads
       SET status_lead      = 'lead_perdido',
           motivo_perda     = COALESCE(NULLIF(motivo_perda,''),
                              'Inatividade automatica: mais de 10 dias uteis na etapa ' || v_lead.etapa),
           auto_lost_at     = now(),
           auto_lost_reason = 'SLA de 10 dias uteis excedido na etapa ' || v_lead.etapa
     WHERE id = v_lead.id AND auto_lost_at IS NULL;

    IF NOT FOUND THEN CONTINUE; END IF;

    v_count := v_count + 1;
    v_dkey  := 'lead_auto_lost:' || v_lead.id::text;

    IF v_lead.responsible_user_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_lead.responsible_user_id,
        'lead_auto_lost',
        'Lead movido automaticamente para Lead Perdido',
        format('O lead "%s" ficou mais de 10 dias uteis sem movimentacao e foi movido para Lead Perdido.', v_lead.nome_fantasia),
        v_lead.id, NULL, NULL,
        format('/admin/painel/comercial?lead=%s', v_lead.id),
        jsonb_build_object('etapa_anterior', v_lead.etapa, 'dias_uteis', v_lead.dias_uteis),
        NULL,
        v_dkey || ':responsible'
      );
    END IF;

    FOR v_recipient IN
      SELECT DISTINCT mp.user_id
        FROM public.module_permissions mp
       WHERE mp.modulo = 'leads'
         AND mp.acao = 'receber_notificacao_lead_perdido'
         AND mp.permitido = true
         AND (v_lead.responsible_user_id IS NULL OR mp.user_id <> v_lead.responsible_user_id)
    LOOP
      PERFORM public.create_notification(
        v_recipient,
        'lead_auto_lost',
        'Lead movido automaticamente para Lead Perdido',
        format('O lead "%s" ficou mais de 10 dias uteis sem movimentacao e foi movido para Lead Perdido.', v_lead.nome_fantasia),
        v_lead.id, NULL, NULL,
        format('/admin/painel/comercial?lead=%s', v_lead.id),
        jsonb_build_object('etapa_anterior', v_lead.etapa, 'dias_uteis', v_lead.dias_uteis),
        NULL,
        v_dkey || ':perm:' || v_recipient::text
      );
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.business_days_between_dates(timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_commercial_panel(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.move_inactive_commercial_leads_to_lost() TO service_role;

-- 5) pg_cron schedule (tolerant)
DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available: %', SQLERRM;
    RETURN;
  END;

  BEGIN PERFORM cron.unschedule('move-inactive-commercial-leads'); EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN
    PERFORM cron.schedule(
      'move-inactive-commercial-leads',
      '0 6 * * *',
      'SELECT public.move_inactive_commercial_leads_to_lost();'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron job: %', SQLERRM;
  END;
END
$outer$;
