
-- 1. Rename panel and drop legacy empty panel
UPDATE public.pipeline_panels SET name = 'Painel Embaixadores' WHERE id = 'painel_mp5q4du9';
DELETE FROM public.pipeline_stages_config WHERE panel_key = 'painel_mp5zfjsx';
DELETE FROM public.pipeline_panels WHERE id = 'painel_mp5zfjsx';

-- 2. ambassador_cards table (mirrors representative_cards)
CREATE TABLE IF NOT EXISTS public.ambassador_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_id text NOT NULL REFERENCES public.pipeline_panels(id) ON DELETE CASCADE,
  stage_id text NOT NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  cnpj text,
  city text,
  state text,
  region text,
  notes text,
  status text,
  source text,
  csv_import_batch_id text,
  responsible_user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  created_by_user_id uuid NOT NULL REFERENCES public.profiles(user_id),
  parceiro_id uuid REFERENCES public.parceiros_comerciais(id) ON DELETE SET NULL,
  partner_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassador_cards_panel_stage_fk FOREIGN KEY (panel_id, stage_id)
    REFERENCES public.pipeline_stages_config(panel_key, value)
);

CREATE INDEX IF NOT EXISTS idx_ambassador_cards_panel_id ON public.ambassador_cards(panel_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_cards_stage_id ON public.ambassador_cards(stage_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_cards_responsible_user_id ON public.ambassador_cards(responsible_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ambassador_cards_panel_email_uniq ON public.ambassador_cards(panel_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS ambassador_cards_panel_phone_uniq ON public.ambassador_cards(panel_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS ambassador_cards_panel_parceiro_uidx ON public.ambassador_cards(panel_id, parceiro_id) WHERE parceiro_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_cards TO authenticated;
GRANT ALL ON public.ambassador_cards TO service_role;

ALTER TABLE public.ambassador_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read ambassador cards"
  ON public.ambassador_cards FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores write ambassador cards"
  ON public.ambassador_cards FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE TRIGGER trg_ambassador_cards_updated_at
  BEFORE UPDATE ON public.ambassador_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. ambassador_card_tasks
CREATE TABLE IF NOT EXISTS public.ambassador_card_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_card_id uuid NOT NULL REFERENCES public.ambassador_cards(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  due_at timestamptz NOT NULL,
  due_date date,
  assigned_to uuid NOT NULL REFERENCES public.profiles(user_id),
  status text NOT NULL DEFAULT 'pendente',
  completed_at timestamptz,
  completed_note text,
  created_by uuid REFERENCES public.profiles(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ambassador_card_tasks_card_id ON public.ambassador_card_tasks(ambassador_card_id);
CREATE INDEX IF NOT EXISTS idx_ambassador_card_tasks_assigned_to ON public.ambassador_card_tasks(assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_card_tasks TO authenticated;
GRANT ALL ON public.ambassador_card_tasks TO service_role;

ALTER TABLE public.ambassador_card_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and gestores read ambassador card tasks"
  ON public.ambassador_card_tasks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE POLICY "Admins and gestores write ambassador card tasks"
  ON public.ambassador_card_tasks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role));

CREATE TRIGGER trg_ambassador_card_tasks_updated_at
  BEFORE UPDATE ON public.ambassador_card_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Replace partner sync trigger: write into ambassador_cards
DROP TRIGGER IF EXISTS trg_sync_parceiro_to_rep_card ON public.parceiros_comerciais;

CREATE OR REPLACE FUNCTION public.sync_parceiro_to_ambassador_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id text := 'painel_mp5q4du9';
  v_stage_id text;
  v_uid uuid := auth.uid();
  v_responsible uuid;
  v_exists boolean;
BEGIN
  -- Lookup stage by normalized label
  SELECT value INTO v_stage_id
  FROM public.pipeline_stages_config
  WHERE panel_key = v_panel_id
    AND lower(unaccent_label(label)) IN ('embaixador em ativacao')
  LIMIT 1;

  -- Fallback: simple lower() match (no unaccent func required)
  IF v_stage_id IS NULL THEN
    SELECT value INTO v_stage_id
    FROM public.pipeline_stages_config
    WHERE panel_key = v_panel_id
      AND lower(label) IN ('embaixador em ativação', 'embaixador em ativacao')
    LIMIT 1;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'Etapa "Embaixador em ativação" não encontrada no painel %', v_panel_id;
  END IF;

  -- Skip if already linked
  SELECT EXISTS (
    SELECT 1 FROM public.ambassador_cards
    WHERE panel_id = v_panel_id AND parceiro_id = NEW.id
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Reuse existing card matched by email
  UPDATE public.ambassador_cards
     SET parceiro_id = NEW.id,
         partner_code = NEW.codigo_parceiro,
         stage_id = v_stage_id
   WHERE panel_id = v_panel_id
     AND parceiro_id IS NULL
     AND lower(email) = lower(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine responsible user (auth user when available, otherwise any active admin/gestor with can_be_responsible)
  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_uid AND ativo = true AND can_be_responsible = true
  ) THEN
    v_responsible := v_uid;
  ELSE
    SELECT p.user_id INTO v_responsible
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.ativo = true AND p.can_be_responsible = true
      AND r.role IN ('admin', 'gestor_conta')
    ORDER BY p.user_id
    LIMIT 1;
  END IF;

  IF v_responsible IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário responsável disponível para criar card de Embaixador';
  END IF;

  INSERT INTO public.ambassador_cards (
    panel_id, stage_id, full_name, phone, email,
    parceiro_id, partner_code,
    responsible_user_id, created_by_user_id, source
  ) VALUES (
    v_panel_id, v_stage_id,
    NEW.nome,
    COALESCE(NULLIF(trim(concat_ws(' ', '(' || NEW.telefone_ddd || ')', NEW.telefone_numero)), '() '), ''),
    NEW.email,
    NEW.id, NEW.codigo_parceiro,
    v_responsible, v_responsible, 'cadastro_publico'
  );

  RETURN NEW;
END;
$$;

-- Drop the helper unaccent_label reference if it doesn't exist; recreate function without it
CREATE OR REPLACE FUNCTION public.sync_parceiro_to_ambassador_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_panel_id text := 'painel_mp5q4du9';
  v_stage_id text;
  v_uid uuid := auth.uid();
  v_responsible uuid;
  v_exists boolean;
BEGIN
  SELECT value INTO v_stage_id
  FROM public.pipeline_stages_config
  WHERE panel_key = v_panel_id
    AND lower(label) IN ('embaixador em ativação', 'embaixador em ativacao')
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'Etapa "Embaixador em ativação" não encontrada no painel %', v_panel_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ambassador_cards
    WHERE panel_id = v_panel_id AND parceiro_id = NEW.id
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  UPDATE public.ambassador_cards
     SET parceiro_id = NEW.id,
         partner_code = NEW.codigo_parceiro,
         stage_id = v_stage_id
   WHERE panel_id = v_panel_id
     AND parceiro_id IS NULL
     AND lower(email) = lower(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_uid AND ativo = true AND can_be_responsible = true
  ) THEN
    v_responsible := v_uid;
  ELSE
    SELECT p.user_id INTO v_responsible
    FROM public.profiles p
    JOIN public.user_roles r ON r.user_id = p.user_id
    WHERE p.ativo = true AND p.can_be_responsible = true
      AND r.role IN ('admin', 'gestor_conta')
    ORDER BY p.user_id
    LIMIT 1;
  END IF;

  IF v_responsible IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário responsável disponível para criar card de Embaixador';
  END IF;

  INSERT INTO public.ambassador_cards (
    panel_id, stage_id, full_name, phone, email,
    parceiro_id, partner_code,
    responsible_user_id, created_by_user_id, source
  ) VALUES (
    v_panel_id, v_stage_id,
    NEW.nome,
    COALESCE(NULLIF(trim(concat_ws(' ', '(' || NEW.telefone_ddd || ')', NEW.telefone_numero)), '() '), ''),
    NEW.email,
    NEW.id, NEW.codigo_parceiro,
    v_responsible, v_responsible, 'cadastro_publico'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_parceiro_to_ambassador_card
  AFTER INSERT ON public.parceiros_comerciais
  FOR EACH ROW EXECUTE FUNCTION public.sync_parceiro_to_ambassador_card();
