-- Tabela de contatos vinculados ao lead
CREATE TABLE public.lead_contatos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL,
  nome text NOT NULL,
  cargo text,
  email text,
  telefone text,
  observacao text,
  principal boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_contatos_lead_id ON public.lead_contatos(lead_id);

ALTER TABLE public.lead_contatos ENABLE ROW LEVEL SECURITY;

-- Validações básicas
CREATE OR REPLACE FUNCTION public.validate_lead_contato()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS NULL OR length(trim(NEW.nome)) = 0 THEN
    RAISE EXCEPTION 'Nome do contato é obrigatório';
  END IF;
  IF length(NEW.nome) > 200 THEN
    RAISE EXCEPTION 'Nome excede 200 caracteres';
  END IF;
  IF NEW.email IS NOT NULL AND NEW.email <> '' AND NEW.email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  IF NEW.telefone IS NOT NULL AND length(NEW.telefone) > 30 THEN
    RAISE EXCEPTION 'Telefone excede 30 caracteres';
  END IF;
  IF NEW.cargo IS NOT NULL AND length(NEW.cargo) > 120 THEN
    RAISE EXCEPTION 'Cargo excede 120 caracteres';
  END IF;
  IF NEW.observacao IS NOT NULL AND length(NEW.observacao) > 500 THEN
    RAISE EXCEPTION 'Observação excede 500 caracteres';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_lead_contato
BEFORE INSERT OR UPDATE ON public.lead_contatos
FOR EACH ROW EXECUTE FUNCTION public.validate_lead_contato();

CREATE TRIGGER trg_lead_contatos_updated_at
BEFORE UPDATE ON public.lead_contatos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: Admin/Gestor gerenciam tudo
CREATE POLICY "Admins and gestores read all contatos"
ON public.lead_contatos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores insert contatos"
ON public.lead_contatos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores update contatos"
ON public.lead_contatos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores delete contatos"
ON public.lead_contatos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

-- RLS: Consultor gerencia contatos do próprio lead
CREATE POLICY "Partners read own lead contatos"
ON public.lead_contatos FOR SELECT TO authenticated
USING (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));

CREATE POLICY "Partners insert own lead contatos"
ON public.lead_contatos FOR INSERT TO authenticated
WITH CHECK (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));

CREATE POLICY "Partners update own lead contatos"
ON public.lead_contatos FOR UPDATE TO authenticated
USING (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()))
WITH CHECK (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));

CREATE POLICY "Partners delete own lead contatos"
ON public.lead_contatos FOR DELETE TO authenticated
USING (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));