
-- Lead comments table
CREATE TABLE public.lead_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  usuario TEXT NOT NULL,
  user_id UUID NOT NULL,
  comentario TEXT NOT NULL,
  data_comentario TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read all comments" ON public.lead_comments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Admins and gestores insert comments" ON public.lead_comments
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Partners read own lead comments" ON public.lead_comments
  FOR SELECT TO authenticated
  USING (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));

CREATE POLICY "Partners insert own lead comments" ON public.lead_comments
  FOR INSERT TO authenticated
  WITH CHECK (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));

-- Reunioes table
CREATE TABLE public.reunioes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  data_reuniao DATE NOT NULL,
  horario_reuniao TIME NOT NULL,
  tipo_reuniao TEXT NOT NULL DEFAULT 'online',
  link_reuniao TEXT,
  observacao TEXT,
  resumo TEXT,
  google_event_id TEXT,
  google_meet_link TEXT,
  realizada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

ALTER TABLE public.reunioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read all reunioes" ON public.reunioes
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Admins and gestores manage reunioes" ON public.reunioes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor_conta'));

CREATE POLICY "Partners read own lead reunioes" ON public.reunioes
  FOR SELECT TO authenticated
  USING (lead_id IN (SELECT l.id FROM leads l JOIN parceiros_comerciais p ON p.id = l.parceiro_id WHERE p.user_id = auth.uid()));
