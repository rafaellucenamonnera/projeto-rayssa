
ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS canva_design_id text,
  ADD COLUMN IF NOT EXISTS canva_material_url text,
  ADD COLUMN IF NOT EXISTS canva_material_codigo text,
  ADD COLUMN IF NOT EXISTS canva_material_version integer,
  ADD COLUMN IF NOT EXISTS canva_material_source text,
  ADD COLUMN IF NOT EXISTS canva_material_generated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.canva_material_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  cnpj text,
  codigo_monnera text NOT NULL,
  template_design_id text NOT NULL,
  design_id text NOT NULL,
  view_url text,
  edit_url text,
  edited_page integer,
  version integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'manual',
  test_mode boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS canva_material_generations_unique
  ON public.canva_material_generations (card_id, codigo_monnera, design_id);

GRANT SELECT, INSERT ON public.canva_material_generations TO authenticated;
GRANT ALL ON public.canva_material_generations TO service_role;
ALTER TABLE public.canva_material_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "canva_material_generations_read" ON public.canva_material_generations;
CREATE POLICY "canva_material_generations_read"
  ON public.canva_material_generations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "canva_material_generations_insert" ON public.canva_material_generations;
CREATE POLICY "canva_material_generations_insert"
  ON public.canva_material_generations FOR INSERT TO authenticated WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.register_canva_material(
  p_card_id uuid,
  p_codigo text,
  p_template_design_id text,
  p_design_id text,
  p_view_url text,
  p_edit_url text,
  p_edited_page integer DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_version integer;
  v_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.representative_cards WHERE id = p_card_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_nao_encontrado');
  END IF;

  IF coalesce(v_card.is_blocked, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_bloqueado', 'motivo', v_card.blocked_reason);
  END IF;

  IF v_codigo = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_ausente');
  END IF;

  IF v_codigo LIKE 'MNR-%' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_formato_nao_confirmado');
  END IF;

  IF v_codigo !~ '^[A-Z0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_invalido');
  END IF;

  IF v_codigo IN ('3SAXJF92', 'UB5PXGDB', 'XXXXXXXX') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_demonstrativo_bloqueado');
  END IF;

  IF v_codigo = 'QATEST01' AND NOT coalesce(v_card.test_mode, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_teste_em_card_real');
  END IF;

  IF coalesce(v_card.codigo_monnera, '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_sem_codigo_confirmado');
  END IF;

  IF upper(v_card.codigo_monnera) <> v_codigo THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codigo_divergente_do_card');
  END IF;

  SELECT coalesce(max(version), 0) + 1 INTO v_version
  FROM public.canva_material_generations WHERE card_id = p_card_id;

  INSERT INTO public.canva_material_generations (
    card_id, cnpj, codigo_monnera, template_design_id, design_id,
    view_url, edit_url, edited_page, version, source, test_mode, metadata, created_by
  ) VALUES (
    p_card_id, v_card.cnpj, v_codigo, p_template_design_id, p_design_id,
    p_view_url, p_edit_url, p_edited_page, v_version, coalesce(p_source, 'manual'),
    coalesce(v_card.test_mode, false), coalesce(p_metadata, '{}'::jsonb), auth.uid()
  )
  ON CONFLICT (card_id, codigo_monnera, design_id) DO UPDATE
    SET view_url = EXCLUDED.view_url,
        edit_url = EXCLUDED.edit_url,
        metadata = EXCLUDED.metadata
  RETURNING id, version INTO v_id, v_version;

  UPDATE public.representative_cards
     SET canva_design_id = p_design_id,
         canva_material_url = p_view_url,
         canva_material_codigo = v_codigo,
         canva_material_version = v_version,
         canva_material_source = coalesce(p_source, 'manual'),
         canva_material_generated_at = now(),
         updated_at = now()
   WHERE id = p_card_id;

  PERFORM public.log_representative_card_event(
    p_card_id,
    'canva_material_gerado',
    jsonb_build_object(
      'design_id', p_design_id,
      'template_design_id', p_template_design_id,
      'codigo', v_codigo,
      'view_url', p_view_url,
      'edited_page', p_edited_page,
      'version', v_version,
      'source', coalesce(p_source, 'manual')
    ),
    NULL, NULL
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'design_id', p_design_id, 'view_url', p_view_url);
END;
$$;

REVOKE ALL ON FUNCTION public.register_canva_material(uuid, text, text, text, text, text, integer, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.register_canva_material(uuid, text, text, text, text, text, integer, text, jsonb) TO authenticated, service_role;
