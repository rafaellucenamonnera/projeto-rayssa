
-- Tables
CREATE TABLE public.kit_whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kit_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  video_url text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kit_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL DEFAULT 'Portfólio Monnera',
  pdf_url text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.kit_argumentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objecao text NOT NULL,
  resposta text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kit_whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kit_argumentos ENABLE ROW LEVEL SECURITY;

-- Read for any authenticated user
CREATE POLICY "Authenticated read whatsapp" ON public.kit_whatsapp_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage whatsapp" ON public.kit_whatsapp_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read videos" ON public.kit_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage videos" ON public.kit_videos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read portfolio" ON public.kit_portfolio FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage portfolio" ON public.kit_portfolio FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read argumentos" ON public.kit_argumentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage argumentos" ON public.kit_argumentos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kit_whatsapp_updated BEFORE UPDATE ON public.kit_whatsapp_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kit_videos_updated BEFORE UPDATE ON public.kit_videos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kit_portfolio_updated BEFORE UPDATE ON public.kit_portfolio FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kit_argumentos_updated BEFORE UPDATE ON public.kit_argumentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public bucket for kit assets
INSERT INTO storage.buckets (id, name, public) VALUES ('kit-vendas', 'kit-vendas', true);

CREATE POLICY "Public read kit-vendas" ON storage.objects FOR SELECT USING (bucket_id = 'kit-vendas');
CREATE POLICY "Admins upload kit-vendas" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kit-vendas' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update kit-vendas" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'kit-vendas' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete kit-vendas" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'kit-vendas' AND has_role(auth.uid(), 'admin'::app_role));
