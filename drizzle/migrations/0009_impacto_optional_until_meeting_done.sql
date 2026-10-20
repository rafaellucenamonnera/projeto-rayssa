CREATE OR REPLACE FUNCTION public.commercial_lead_v2_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(NEW.panel_id,'comercial') <> 'comercial' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.canal IS NULL AND NEW.origem IN ('link_indicacao','consultor_manual') THEN
      NEW.canal := 'parceiros';
    END IF;
    IF NEW.origem = 'link_indicacao' AND coalesce(NEW.status_lead,'novo_lead') = 'novo_lead' THEN
      NEW.status_lead := 'etapa_comercial_mql';
      NEW.status := 'etapa_comercial_mql';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status_lead IS DISTINCT FROM NEW.status_lead
     AND coalesce(current_setting('app.system_lead_update', true),'') <> 'on'
     AND NEW.status_lead NOT IN ('etapa_comercial_prospects','etapa_comercial_1781718801678','lead_perdido') THEN
    IF NEW.mercado IS NULL OR NEW.tipo_negocio IS NULL THEN
      RAISE EXCEPTION 'Preencha Mercado e Tipo antes de mover o card para esta coluna.' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status_lead NOT IN ('etapa_comercial_mql','novo_lead','reuniao_agendada','reuniao_realizada')
       AND (NEW.impacto IS NULL OR NEW.temperatura IS NULL) THEN
      RAISE EXCEPTION 'Preencha Impacto e Temperatura antes de o card sair de Reunião Realizada.' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END $function$;