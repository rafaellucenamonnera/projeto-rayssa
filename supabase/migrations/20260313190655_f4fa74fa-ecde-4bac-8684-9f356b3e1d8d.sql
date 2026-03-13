CREATE TRIGGER prevent_partner_self_approve_trigger
BEFORE UPDATE ON public.parceiros_comerciais
FOR EACH ROW
EXECUTE FUNCTION public.prevent_partner_self_approve();