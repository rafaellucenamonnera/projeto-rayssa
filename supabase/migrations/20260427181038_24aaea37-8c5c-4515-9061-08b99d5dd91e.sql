CREATE TABLE public.kit_redes_sociais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  link TEXT NOT NULL,
  comentario TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.kit_redes_sociais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read redes_sociais"
ON public.kit_redes_sociais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage redes_sociais"
ON public.kit_redes_sociais FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER kit_redes_sociais_set_updated_at
BEFORE UPDATE ON public.kit_redes_sociais
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();