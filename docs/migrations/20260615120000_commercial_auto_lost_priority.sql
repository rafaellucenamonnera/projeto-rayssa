-- =====================================================================
-- Migration: commercial_auto_lost_priority
-- Target project: dpnffarviyumpavjxhti (Supabase Comercial)
-- DO NOT apply to: bapxuzodzgahscatvofs
--
-- HOW TO APPLY (manual, local CLI):
--   1. Copy this file to supabase/migrations/ in your local checkout
--      pointed at the dpnffarviyumpavjxhti project:
--        cp docs/migrations/20260615120000_commercial_auto_lost_priority.sql \
--           supabase/migrations/
--   2. supabase link --project-ref dpnffarviyumpavjxhti
--   3. supabase db push
--
-- Purpose:
--   Auto-mark commercial leads as `lead_perdido` after >10 BUSINESS days
--   in the current stage. Base date: lead_stage_history.data_entrada.
--   Notifies creator, responsible user, and users with the permission
--   `receber_notificacao_lead_perdido`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Audit columns on public.leads (idempotent, no backfill)
-- ---------------------------------------------------------------------
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS created_by_user_id  uuid,
  ADD COLUMN IF NOT EXISTS responsible_user_id uuid,
  ADD COLUMN IF NOT EXISTS auto_lost_at        timestamptz,
  ADD COLUMN IF NOT EXISTS auto_lost_reason    text;

CREATE INDEX IF NOT EXISTS idx_leads_auto_lost_at     ON public.leads (auto_lost_at);
CREATE INDEX IF NOT EXISTS idx_leads_created_by_user  ON public.leads (created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_responsible_user ON public.leads (responsible_user_id);

-- ---------------------------------------------------------------------
-- 2) Permission key in module_permissions
-- ---------------------------------------------------------------------
INSERT INTO public.module_permissions (modulo, chave, descricao)
SELECT 'leads', 'receber_notificacao_lead_perdido',
       'Recebe notificações quando um lead comercial é movido automaticamente para Lead Perdido por inatividade.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_permissions
  WHERE chave = 'receber_notificacao_lead_perdido'
);

-- ---------------------------------------------------------------------
-- 3) Helper: business days between two timestamps (Mon-Fri, BRT, no holidays)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.business_days_between(p_start timestamptz, p_end timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT GREATEST(0, COUNT(*)::int)
  FROM generate_series(
        (p_start AT TIME ZONE 'America/Sao_Paulo')::date + 1,
        (p_end   AT TIME ZONE 'America/Sao_Paulo')::date,
        interval '1 day'
       ) AS d
  WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

-- ---------------------------------------------------------------------
-- 4) Core function: move inactive commercial leads to lead_perdido
-- ---------------------------------------------------------------------
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
  -- Flexible commercial panel detection: panel id/key equals 'comercial'|'comerc'
  -- OR (when the column exists) panel name contains 'comercial'. Does not depend
  -- on a panel_type column, which may not exist in every environment.
  FOR v_lead IN
    EXECUTE format($q$
      SELECT l.id,
             l.nome_fantasia,
             l.created_by_user_id,
             l.responsible_user_id,
             h.etapa,
             h.data_entrada
        FROM public.leads l
        JOIN public.lead_stage_history h
          ON h.lead_id = l.id
         AND h.data_saida IS NULL
        JOIN public.pipeline_panels p
          ON p.%I::text = l.panel_id::text
       WHERE l.status_lead <> 'lead_perdido'
         AND l.auto_lost_at IS NULL
         AND h.etapa IN (
               'novo_lead','contato_realizado','reuniao_agendada',
               'reuniao_realizada','proposta_enviada','contrato_enviado'
             )
         AND public.business_days_between(h.data_entrada, now()) > 10
         AND (
               lower(p.%I::text) IN ('comercial','comerc')
               %s
             )
    $q$,
      -- prefer panel_key when present, otherwise id
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='pipeline_panels'
           AND column_name='panel_key'
      ) THEN 'panel_key' ELSE 'id' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='pipeline_panels'
           AND column_name='panel_key'
      ) THEN 'panel_key' ELSE 'id' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='pipeline_panels'
           AND column_name='name'
      ) THEN $$OR lower(coalesce(p.name,'')) LIKE '%comercial%'$$ ELSE '' END
    )


  LOOP
    UPDATE public.leads
       SET status_lead      = 'lead_perdido',
           motivo_perda     = COALESCE(NULLIF(motivo_perda, ''),
                                       'Inatividade automática: mais de 10 dias úteis na etapa ' || v_lead.etapa),
           auto_lost_at     = now(),
           auto_lost_reason = 'SLA de 10 dias úteis excedido na etapa ' || v_lead.etapa
     WHERE id = v_lead.id
       AND auto_lost_at IS NULL;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_count := v_count + 1;
    v_dkey  := 'lead_auto_lost:' || v_lead.id::text;

    -- Creator
    IF v_lead.created_by_user_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_lead.created_by_user_id,
        'lead_auto_lost',
        'Lead movido automaticamente para Lead Perdido',
        format('O lead "%s" ficou mais de 10 dias úteis sem movimentação e foi movido para Lead Perdido.', v_lead.nome_fantasia),
        v_lead.id, NULL, NULL,
        '/admin/leads/' || v_lead.id::text,
        jsonb_build_object('etapa_anterior', v_lead.etapa, 'data_entrada', v_lead.data_entrada),
        NULL,
        v_dkey || ':creator'
      );
    END IF;

    -- Responsible (if different)
    IF v_lead.responsible_user_id IS NOT NULL
       AND v_lead.responsible_user_id IS DISTINCT FROM v_lead.created_by_user_id THEN
      PERFORM public.create_notification(
        v_lead.responsible_user_id,
        'lead_auto_lost',
        'Lead movido automaticamente para Lead Perdido',
        format('O lead "%s" ficou mais de 10 dias úteis sem movimentação e foi movido para Lead Perdido.', v_lead.nome_fantasia),
        v_lead.id, NULL, NULL,
        '/admin/leads/' || v_lead.id::text,
        jsonb_build_object('etapa_anterior', v_lead.etapa, 'data_entrada', v_lead.data_entrada),
        NULL,
        v_dkey || ':responsible'
      );
    END IF;

    -- Users holding the permission
    FOR v_recipient IN
      SELECT DISTINCT upp.user_id
        FROM public.user_panel_permissions upp
       WHERE upp.permission_key = 'receber_notificacao_lead_perdido'
         AND upp.user_id IS DISTINCT FROM v_lead.created_by_user_id
         AND upp.user_id IS DISTINCT FROM v_lead.responsible_user_id
    LOOP
      PERFORM public.create_notification(
        v_recipient,
        'lead_auto_lost',
        'Lead movido automaticamente para Lead Perdido',
        format('O lead "%s" ficou mais de 10 dias úteis sem movimentação e foi movido para Lead Perdido.', v_lead.nome_fantasia),
        v_lead.id, NULL, NULL,
        '/admin/leads/' || v_lead.id::text,
        jsonb_build_object('etapa_anterior', v_lead.etapa, 'data_entrada', v_lead.data_entrada),
        NULL,
        v_dkey || ':perm:' || v_recipient::text
      );
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_inactive_commercial_leads_to_lost() TO service_role;

-- ---------------------------------------------------------------------
-- 5) Daily schedule via pg_cron (tolerant: never fails the migration)
--    03:00 BRT = 06:00 UTC
-- ---------------------------------------------------------------------
DO $outer$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron not available: %', SQLERRM;
    RETURN;
  END;

  BEGIN
    PERFORM cron.unschedule('move-inactive-commercial-leads');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

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
