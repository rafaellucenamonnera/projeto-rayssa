
-- Add address fields to leads table
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS endereco_rua text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_estado text,
  ADD COLUMN IF NOT EXISTS endereco_cep text;

-- Create contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  numero_proposta text,
  arquivo_proposta_url text,
  contrato_pdf_url text,
  data_geracao timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read all contracts"
  ON public.contracts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins can manage contracts"
  ON public.contracts FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores can insert contracts"
  ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Gestores can update contracts"
  ON public.contracts FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'gestor_conta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor_conta'::app_role));
