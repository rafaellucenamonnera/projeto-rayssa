-- 1. Estado do polling Jira (cursor, lease, modo somente leitura)
CREATE TABLE public.jira_sync_state (
  id text PRIMARY KEY DEFAULT 'jira_polling',
  last_issue_updated_at timestamptz,
  last_issue_key text,
  locked_until timestamptz,
  paused boolean NOT NULL DEFAULT false,
  read_only boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jira_sync_state TO authenticated;
GRANT ALL ON public.jira_sync_state TO service_role;
ALTER TABLE public.jira_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read jira sync state" ON public.jira_sync_state
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
INSERT INTO public.jira_sync_state (id) VALUES ('jira_polling');

-- 2. Proteção permanente de cards
ALTER TABLE public.representative_cards ADD COLUMN IF NOT EXISTS is_protected boolean NOT NULL DEFAULT false;

CREATE TABLE public.protected_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  cnpj_normalizado text,
  motivo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT protected_entities_target_chk CHECK (card_id IS NOT NULL OR cnpj_normalizado IS NOT NULL)
);
CREATE UNIQUE INDEX protected_entities_card_uk ON public.protected_entities (card_id) WHERE card_id IS NOT NULL;
CREATE UNIQUE INDEX protected_entities_cnpj_uk ON public.protected_entities (cnpj_normalizado) WHERE cnpj_normalizado IS NOT NULL;
GRANT SELECT ON public.protected_entities TO authenticated;
GRANT ALL ON public.protected_entities TO service_role;
ALTER TABLE public.protected_entities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read protected entities" ON public.protected_entities
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_card_protected(_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.representative_cards c
    LEFT JOIN public.protected_entities p
      ON p.card_id = c.id
      OR (p.cnpj_normalizado IS NOT NULL AND p.cnpj_normalizado = regexp_replace(coalesce(c.cnpj, ''), '\D', '', 'g'))
    WHERE c.id = _card_id
      AND (c.is_protected OR p.id IS NOT NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.representative_card_guard_protected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_card_protected(OLD.id) THEN
    IF NEW.codigo_monnera IS DISTINCT FROM OLD.codigo_monnera
       OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
       OR NEW.jira_issue_key IS DISTINCT FROM OLD.jira_issue_key
       OR NEW.canva_public_url IS DISTINCT FROM OLD.canva_public_url THEN
      RAISE EXCEPTION 'Card protegido: alterações operacionais bloqueadas (%).', OLD.full_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_representative_card_guard_protected ON public.representative_cards;
CREATE TRIGGER trg_representative_card_guard_protected
  BEFORE UPDATE ON public.representative_cards
  FOR EACH ROW EXECUTE FUNCTION public.representative_card_guard_protected();

-- Seed: ORCA LOGÍSTICA protegida por card_id e CNPJ
UPDATE public.representative_cards SET is_protected = true WHERE id = 'f76d5bfa-680b-47e2-9f11-ca443ee2c40b';
INSERT INTO public.protected_entities (card_id, cnpj_normalizado, motivo)
VALUES ('f76d5bfa-680b-47e2-9f11-ca443ee2c40b', '04690956000113', 'ORCA LOGÍSTICA — card intocável por decisão operacional');

-- 3. Código Monnera único por painel (impede reuso entre CNPJs)
CREATE UNIQUE INDEX IF NOT EXISTS representative_cards_panel_codigo_uk
  ON public.representative_cards (panel_id, codigo_monnera)
  WHERE codigo_monnera IS NOT NULL;