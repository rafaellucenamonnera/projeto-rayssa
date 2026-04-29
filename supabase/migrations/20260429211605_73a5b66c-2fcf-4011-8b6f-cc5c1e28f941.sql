CREATE TABLE IF NOT EXISTS public.pipeline_panels (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pipeline_panels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "internal read pipeline panels" ON public.pipeline_panels;
CREATE POLICY "internal read pipeline panels" ON public.pipeline_panels FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role));

DROP POLICY IF EXISTS "admins manage pipeline panels" ON public.pipeline_panels;
CREATE POLICY "admins manage pipeline panels" ON public.pipeline_panels FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

INSERT INTO public.pipeline_panels (id, name, sort_order)
VALUES
  ('comercial', 'Painel Comercial', 1),
  ('onboarding', 'Painel Onboarding / Integração', 2),
  ('sucesso', 'Painel Sucesso', 3),
  ('campanhas', 'Painel Criação Campanhas', 4)
ON CONFLICT (id) DO NOTHING;