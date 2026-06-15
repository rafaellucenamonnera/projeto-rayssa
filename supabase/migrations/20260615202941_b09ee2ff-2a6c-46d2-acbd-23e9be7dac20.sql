
-- 1) Trigger: bypass when system flag is set
CREATE OR REPLACE FUNCTION public.protect_lead_anon_token_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- System bypass: only set inside SECURITY DEFINER system functions
  IF current_setting('app.system_lead_update', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL THEN
    NEW.parceiro_id              := OLD.parceiro_id;
    NEW.completion_token         := OLD.completion_token;
    NEW.origem                   := OLD.origem;
    NEW.data_cadastro            := OLD.data_cadastro;
    NEW.valor_mensalidade        := OLD.valor_mensalidade;
    NEW.percentual_consultor     := OLD.percentual_consultor;
    NEW.qtd_parcelas             := OLD.qtd_parcelas;
    NEW.parcelas_pagas           := OLD.parcelas_pagas;
    NEW.valor_campanhas          := OLD.valor_campanhas;
    NEW.status                   := OLD.status;
    NEW.status_lead              := OLD.status_lead;
    NEW.motivo_perda             := OLD.motivo_perda;
    NEW.data_contrato_assinado   := OLD.data_contrato_assinado;
    NEW.proposta_url             := OLD.proposta_url;
    NEW.numero_proposta          := OLD.numero_proposta;
    NEW.contrato_url             := OLD.contrato_url;

    IF OLD.dados_completos = true THEN
      NEW.dados_completos := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Auto-lost function sets the bypass flag
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
  PERFORM set_config('app.system_lead_update', 'on', true);

  FOR v_lead IN
    SELECT l.id, l.nome_fantasia, l.responsible_user_id,
           h.etapa, h.data_entrada,
           public.business_days_between_dates(h.data_entrada, now()) AS dias_uteis
      FROM public.leads l
      JOIN public.lead_stage_history h
        ON h.lead_id = l.id AND h.data_saida IS NULL
     WHERE l.status_lead = ANY(v_allowed)
       AND public.is_commercial_panel(l.panel_id)
       AND public.business_days_between_dates(h.data_entrada, now()) > 10
  LOOP
    UPDATE public.leads
       SET status_lead      = 'lead_perdido',
           motivo_perda     = COALESCE(NULLIF(motivo_perda,''),
                              'Inatividade automatica: mais de 10 dias uteis na etapa ' || v_lead.etapa),
           auto_lost_at     = now(),
           auto_lost_reason = 'SLA de 10 dias uteis excedido na etapa ' || v_lead.etapa
     WHERE id = v_lead.id;

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
