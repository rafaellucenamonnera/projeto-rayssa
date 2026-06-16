
DO $$
DECLARE
  v_panel text := 'painel_mp5q4du9';
  v_prospec text;
  v_ativacao text;
  v_default_user uuid := '918f0ff0-9157-4ba8-9676-92dd514a5c70';
BEGIN
  SELECT value INTO v_prospec
  FROM public.pipeline_stages_config
  WHERE panel_key = v_panel AND lower(label) IN ('prospecção','prospeccao')
  LIMIT 1;

  SELECT value INTO v_ativacao
  FROM public.pipeline_stages_config
  WHERE panel_key = v_panel AND lower(label) IN ('embaixador em ativação','embaixador em ativacao')
  LIMIT 1;

  IF v_prospec IS NULL OR v_ativacao IS NULL THEN
    RAISE EXCEPTION 'Stages obrigatorias nao encontradas (Prospecção/Embaixador em ativação)';
  END IF;

  -- 1. Migrar cards antigos de representative_cards -> ambassador_cards na coluna Prospecção
  INSERT INTO public.ambassador_cards (
    panel_id, stage_id, full_name, phone, email, city, state, region, notes,
    status, source, csv_import_batch_id, responsible_user_id, created_by_user_id,
    parceiro_id, partner_code, created_at, updated_at
  )
  SELECT
    v_panel, v_prospec, full_name, phone, email, city, state, region, notes,
    status, COALESCE(source,'migrado_representative_cards'), csv_import_batch_id,
    responsible_user_id, created_by_user_id, parceiro_id, partner_code,
    created_at, updated_at
  FROM public.representative_cards
  WHERE panel_id = v_panel
  ON CONFLICT DO NOTHING;

  -- 2. Backfill de parceiros_comerciais -> ambassador_cards na coluna Embaixador em ativação
  INSERT INTO public.ambassador_cards (
    panel_id, stage_id, full_name, phone, email,
    parceiro_id, partner_code, responsible_user_id, created_by_user_id, source
  )
  SELECT
    v_panel,
    v_ativacao,
    pc.nome,
    COALESCE(NULLIF(trim(concat_ws(' ', '(' || pc.telefone_ddd || ')', pc.telefone_numero)), '() '), pc.id::text),
    lower(pc.email),
    pc.id,
    pc.codigo_parceiro,
    COALESCE(
      (SELECT pr.user_id FROM public.profiles pr
        JOIN public.user_roles ur ON ur.user_id = pr.user_id
        WHERE pr.ativo AND pr.can_be_responsible AND ur.role IN ('admin','gestor_conta')
        ORDER BY pr.user_id LIMIT 1),
      v_default_user
    ),
    COALESCE(
      (SELECT pr.user_id FROM public.profiles pr
        JOIN public.user_roles ur ON ur.user_id = pr.user_id
        WHERE pr.ativo AND pr.can_be_responsible AND ur.role IN ('admin','gestor_conta')
        ORDER BY pr.user_id LIMIT 1),
      v_default_user
    ),
    'backfill_parceiros'
  FROM public.parceiros_comerciais pc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.ambassador_cards ac
    WHERE ac.panel_id = v_panel
      AND (ac.parceiro_id = pc.id
        OR lower(ac.email) = lower(pc.email))
  )
  ON CONFLICT DO NOTHING;
END $$;
