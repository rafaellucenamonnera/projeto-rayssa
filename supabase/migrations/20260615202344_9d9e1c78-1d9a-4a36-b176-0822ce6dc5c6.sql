
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
  v_allowed   text[] := ARRAY[
    'novo_lead','contato_realizado','reuniao_agendada','reuniao_realizada',
    'proposta_enviada','proposta_comercial','contrato_enviado'
  ];
BEGIN
  FOR v_lead IN
    SELECT l.id, l.nome_fantasia, l.responsible_user_id,
           h.etapa, h.data_entrada,
           public.business_days_between_dates(h.data_entrada, now()) AS dias_uteis
      FROM public.leads l
      JOIN public.lead_stage_history h
        ON h.lead_id = l.id AND h.data_saida IS NULL
     WHERE l.auto_lost_at IS NULL
       AND l.status_lead = ANY(v_allowed)
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
