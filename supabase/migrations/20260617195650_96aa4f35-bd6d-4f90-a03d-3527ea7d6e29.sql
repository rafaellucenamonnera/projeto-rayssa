CREATE OR REPLACE FUNCTION public.reset_commercial_lead_stage_timer_from_leads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status_lead IS DISTINCT FROM NEW.status_lead THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.reset_commercial_lead_stage_timer(OLD.id);
    RETURN OLD;
  END IF;

  PERFORM public.reset_commercial_lead_stage_timer(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_commercial_lead_stage_timer_from_leads() FROM PUBLIC, anon, authenticated;