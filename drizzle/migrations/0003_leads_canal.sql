ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS canal text;
UPDATE public.leads SET canal = 'parceiros' WHERE canal IS NULL AND origem IN ('link_indicacao','consultor_manual');
ALTER TABLE public.leads ADD CONSTRAINT leads_canal_check CHECK (canal IS NULL OR canal IN ('parceiros','prospeccao','trafego_pago','eventos'));

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
     AND NEW.status_lead NOT IN ('etapa_comercial_prospects','etapa_comercial_1781718801678','lead_perdido')
     AND (NEW.mercado IS NULL OR NEW.tipo_negocio IS NULL OR NEW.impacto IS NULL) THEN
    RAISE EXCEPTION 'Preencha Mercado, Tipo e Impacto antes de mover o card para esta coluna.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $function$;