CREATE TABLE IF NOT EXISTS public.representative_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_card_id UUID NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.representative_card_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_card_id UUID NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  meeting_date TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.representative_card_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_card_id UUID NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES public.profiles(user_id),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rcc_card ON public.representative_card_comments(representative_card_id);
CREATE INDEX IF NOT EXISTS idx_rcm_card ON public.representative_card_meetings(representative_card_id);
CREATE INDEX IF NOT EXISTS idx_rcd_card ON public.representative_card_dossiers(representative_card_id);

ALTER TABLE public.representative_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_card_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.representative_card_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores manage representative comments"
ON public.representative_card_comments
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores manage representative meetings"
ON public.representative_card_meetings
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores manage representative dossiers"
ON public.representative_card_dossiers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE TRIGGER update_representative_card_meetings_updated_at
BEFORE UPDATE ON public.representative_card_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_representative_card_dossiers_updated_at
BEFORE UPDATE ON public.representative_card_dossiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();