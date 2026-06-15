
-- 1) Business-days counter (Mon..Fri, ignora finais de semana)
CREATE OR REPLACE FUNCTION public.business_days_between(p_from timestamptz, p_to timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*), 0)::int
  FROM generate_series(
    date_trunc('day', p_from)::date,
    date_trunc('day', p_to)::date - 1,
    interval '1 day'
  ) d
  WHERE EXTRACT(ISODOW FROM d) < 6;
$$;

-- 2) Função principal: move leads inativos do painel comercial para lead_perdido
CREATE OR REPLACE FUNCTION public.move_inactive_commercial_leads_to_lost()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead record;
  v_moved int := 0;
  v_recipient uuid;
BEGIN
  FOR v_lead IN
    SELECT l.id, l.nome_fantasia, l.status_lead, l.responsible_user_id,
           h.data_entrada,
           public.business_days_between(h.data_entrada, now()) AS dias_uteis
    FROM public.leads l
    JOIN public.lead_stage_history h
      ON h.lead_id = l.id AND h.data_saida IS NULL
    WHERE l.status_lead NOT IN ('lead_perdido', 'lead_convertido', 'contrato_assinado')
  LOOP
    IF v_lead.dias_uteis > 10 THEN
      UPDATE public.leads
      SET status_lead = 'lead_perdido',
          motivo_perda = COALESCE(NULLIF(motivo_perda, ''),
            'Inatividade automática: mais de 10 dias úteis sem mover do estágio')
      WHERE id = v_lead.id;

      -- Notifica responsável
      IF v_lead.responsible_user_id IS NOT NULL THEN
        PERFORM public.create_notification(
          v_lead.responsible_user_id,
          'lead_perdido_automatico',
          'Lead movido para perdido por inatividade',
          format('O lead "%s" ficou mais de 10 dias úteis no mesmo estágio e foi movido para lead perdido.', v_lead.nome_fantasia),
          v_lead.id, NULL, NULL,
          format('/admin/painel/comercial?lead=%s', v_lead.id),
          jsonb_build_object('dias_uteis', v_lead.dias_uteis),
          NULL,
          'auto_lost_' || v_lead.id::text
        );
      END IF;

      -- Notifica usuários com permissão receber_notificacao_lead_perdido
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
          'lead_perdido_automatico',
          'Lead movido para perdido por inatividade',
          format('O lead "%s" ficou mais de 10 dias úteis no mesmo estágio e foi movido para lead perdido.', v_lead.nome_fantasia),
          v_lead.id, NULL, NULL,
          format('/admin/painel/comercial?lead=%s', v_lead.id),
          jsonb_build_object('dias_uteis', v_lead.dias_uteis),
          NULL,
          'auto_lost_' || v_lead.id::text || '_' || v_recipient::text
        );
      END LOOP;

      v_moved := v_moved + 1;
    END IF;
  END LOOP;

  RETURN v_moved;
END;
$$;

GRANT EXECUTE ON FUNCTION public.move_inactive_commercial_leads_to_lost() TO service_role;

-- 3) Agendamento via pg_cron (tolerante a erro)
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.unschedule('move-inactive-commercial-leads-to-lost');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    PERFORM cron.schedule(
      'move-inactive-commercial-leads-to-lost',
      '0 8 * * *',
      $cron$ SELECT public.move_inactive_commercial_leads_to_lost(); $cron$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível; agende manualmente move_inactive_commercial_leads_to_lost()';
  END;
END $$;
