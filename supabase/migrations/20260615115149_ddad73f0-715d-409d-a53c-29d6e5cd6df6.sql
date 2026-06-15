
ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS parceiro_id uuid REFERENCES public.parceiros_comerciais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS partner_code text;

CREATE UNIQUE INDEX IF NOT EXISTS representative_cards_panel_parceiro_uidx
  ON public.representative_cards (panel_id, parceiro_id)
  WHERE parceiro_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_parceiro_to_representative_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_id text;
  v_panel_id text := 'painel_mp5q4du9';
  v_uid uuid := auth.uid();
  v_exists boolean;
  v_eligible boolean;
BEGIN
  IF NEW.aprovado IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.aprovado, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT value INTO v_stage_id
  FROM public.pipeline_stages_config
  WHERE panel_key = v_panel_id
    AND lower(label) IN ('embaixador em ativação', 'embaixador em ativacao')
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'Etapa "Embaixador em ativação" não encontrada no painel %', v_panel_id;
  END IF;

  -- Already linked
  SELECT EXISTS (
    SELECT 1 FROM public.representative_cards
    WHERE panel_id = v_panel_id AND parceiro_id = NEW.id
  ) INTO v_exists;
  IF v_exists THEN
    RETURN NEW;
  END IF;

  -- Reuse existing card matched by email
  UPDATE public.representative_cards
     SET parceiro_id = NEW.id,
         partner_code = NEW.codigo_parceiro
   WHERE panel_id = v_panel_id
     AND parceiro_id IS NULL
     AND lower(email) = lower(NEW.email);
  IF FOUND THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Aprovação de Embaixador requer usuário autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_uid AND ativo = true AND can_be_responsible = true
  ) INTO v_eligible;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'Usuário aprovador não está habilitado como responsável (profile ativo + can_be_responsible).';
  END IF;

  INSERT INTO public.representative_cards (
    panel_id, stage_id, full_name, phone, email,
    parceiro_id, partner_code,
    responsible_user_id, created_by_user_id, source
  ) VALUES (
    v_panel_id, v_stage_id,
    NEW.nome,
    COALESCE(NULLIF(trim(concat_ws(' ', '(' || NEW.telefone_ddd || ')', NEW.telefone_numero)), '() '), ''),
    NEW.email,
    NEW.id, NEW.codigo_parceiro,
    v_uid, v_uid, 'parceiro_aprovado'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_parceiro_to_rep_card ON public.parceiros_comerciais;
CREATE TRIGGER trg_sync_parceiro_to_rep_card
AFTER INSERT OR UPDATE OF aprovado ON public.parceiros_comerciais
FOR EACH ROW
EXECUTE FUNCTION public.sync_parceiro_to_representative_card();

DO $$
DECLARE
  v_stage_id text;
  v_panel_id text := 'painel_mp5q4du9';
  v_admin uuid;
BEGIN
  SELECT value INTO v_stage_id
  FROM public.pipeline_stages_config
  WHERE panel_key = v_panel_id
    AND lower(label) IN ('embaixador em ativação', 'embaixador em ativacao')
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION 'Backfill: etapa "Embaixador em ativação" não encontrada no painel %', v_panel_id;
  END IF;

  SELECT p.user_id INTO v_admin
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'admin'
  WHERE p.ativo = true AND p.can_be_responsible = true
  ORDER BY p.user_id
  LIMIT 1;

  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Backfill: nenhum admin elegível (profile ativo + can_be_responsible + role admin) encontrado';
  END IF;

  -- Step A: link existing cards by email
  UPDATE public.representative_cards rc
     SET parceiro_id = pc.id,
         partner_code = pc.codigo_parceiro
    FROM public.parceiros_comerciais pc
   WHERE rc.panel_id = v_panel_id
     AND rc.parceiro_id IS NULL
     AND pc.ativo = true AND pc.aprovado = true
     AND lower(rc.email) = lower(pc.email);

  -- Step B: insert remaining
  INSERT INTO public.representative_cards (
    panel_id, stage_id, full_name, phone, email,
    parceiro_id, partner_code,
    responsible_user_id, created_by_user_id, source
  )
  SELECT
    v_panel_id, v_stage_id,
    pc.nome,
    COALESCE(NULLIF(trim(concat_ws(' ', '(' || pc.telefone_ddd || ')', pc.telefone_numero)), '() '), ''),
    pc.email,
    pc.id, pc.codigo_parceiro,
    v_admin, v_admin, 'parceiro_backfill'
  FROM public.parceiros_comerciais pc
  WHERE pc.ativo = true AND pc.aprovado = true
    AND NOT EXISTS (
      SELECT 1 FROM public.representative_cards rc
      WHERE rc.panel_id = v_panel_id
        AND (rc.parceiro_id = pc.id OR lower(rc.email) = lower(pc.email))
    );
END $$;
