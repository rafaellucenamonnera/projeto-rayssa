
-- Create parceiros_comerciais table
CREATE TABLE public.parceiros_comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_parceiro TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  telefone_ddd TEXT NOT NULL,
  telefone_numero TEXT NOT NULL,
  data_cadastro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros_comerciais(id) ON DELETE CASCADE,
  nome_fantasia TEXT NOT NULL,
  razao_social TEXT NOT NULL,
  cnpj TEXT NOT NULL,
  cidade TEXT NOT NULL,
  quantidade_lojas INTEGER NOT NULL,
  nome_responsavel TEXT NOT NULL,
  telefone_responsavel TEXT NOT NULL,
  email_responsavel TEXT NOT NULL,
  erp_utilizado TEXT NOT NULL,
  quantidade_funcionarios INTEGER,
  valor_campanhas NUMERIC,
  descricao_necessidade TEXT,
  status TEXT NOT NULL DEFAULT 'novo_lead',
  data_cadastro TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create links_parceiros table
CREATE TABLE public.links_parceiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id UUID NOT NULL REFERENCES public.parceiros_comerciais(id) ON DELETE CASCADE,
  codigo_link TEXT NOT NULL UNIQUE,
  url_link TEXT NOT NULL,
  data_criacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ativo BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS on all tables
ALTER TABLE public.parceiros_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.links_parceiros ENABLE ROW LEVEL SECURITY;

-- Public can insert parceiros (self-registration)
CREATE POLICY "Anyone can register as parceiro"
  ON public.parceiros_comerciais FOR INSERT
  WITH CHECK (true);

-- Public can read parceiros by codigo_parceiro (for link validation)
CREATE POLICY "Anyone can read parceiros"
  ON public.parceiros_comerciais FOR SELECT
  USING (true);

-- Public can insert leads (lead registration via link)
CREATE POLICY "Anyone can register leads"
  ON public.leads FOR INSERT
  WITH CHECK (true);

-- Public can read leads
CREATE POLICY "Anyone can read leads"
  ON public.leads FOR SELECT
  USING (true);

-- Public can insert links
CREATE POLICY "Anyone can insert links"
  ON public.links_parceiros FOR INSERT
  WITH CHECK (true);

-- Public can read links
CREATE POLICY "Anyone can read links"
  ON public.links_parceiros FOR SELECT
  USING (true);

-- Create function to generate unique partner code
CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  code TEXT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := 'MNR' || upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM public.parceiros_comerciais WHERE codigo_parceiro = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;
