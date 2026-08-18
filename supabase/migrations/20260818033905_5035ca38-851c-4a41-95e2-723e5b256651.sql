ALTER TABLE public.representative_cards
  ADD COLUMN IF NOT EXISTS canva_public_url text,
  ADD COLUMN IF NOT EXISTS canva_internal_url text;

ALTER TABLE public.canva_material_generations
  ADD COLUMN IF NOT EXISTS public_url text,
  ADD COLUMN IF NOT EXISTS public_url_kind text;

CREATE OR REPLACE FUNCTION public.is_canva_public_link(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT coalesce(p_url, '') <> ''
     AND p_url ~ '^https://(canva\.link/[A-Za-z0-9]+|www\.canva\.com/d/[A-Za-z0-9_-]+)(\?[^ ]*)?$'
     AND p_url !~ '/edit'
     AND p_url !~ 'www\.canva\.com/d/s_';
$$;

CREATE OR REPLACE FUNCTION public.canva_public_link_kind(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN coalesce(p_url,'') = '' THEN NULL
    WHEN p_url LIKE 'https://canva.link/%' THEN 'shortlink'
    WHEN p_url LIKE 'https://www.canva.com/d/%' THEN 'view_url'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.register_canva_material(
  p_card_id uuid,
  p_codigo text,
  p_template_design_id text,
  p_design_id text,
  p_view_url text,
  p_edit_url text,
  p_edited_page integer DEFAULT NULL,
  p_source text DEFAULT 'manual',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_public_url text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.representative_cards%ROWTYPE;
  v_codigo text := upper(trim(coalesce(p_codigo, '')));
  v_public text := trim(coalesce(nullif(trim(coalesce(p_public_url, '')), ''), coalesce(p_view_url, '')));
  v_kind text;
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

  IF NOT public.is_canva_public_link(v_public) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'link_publico_invalido', 'link', v_public);
  END IF;

  v_kind := public.canva_public_link_kind(v_public);

  SELECT coalesce(max(version), 0) + 1 INTO v_version
  FROM public.canva_material_generations WHERE card_id = p_card_id;

  INSERT INTO public.canva_material_generations (
    card_id, cnpj, codigo_monnera, template_design_id, design_id,
    view_url, edit_url, public_url, public_url_kind, edited_page, version, source, test_mode, metadata, created_by
  ) VALUES (
    p_card_id, v_card.cnpj, v_codigo, p_template_design_id, p_design_id,
    p_view_url, p_edit_url, v_public, v_kind, p_edited_page, v_version, coalesce(p_source, 'manual'),
    coalesce(v_card.test_mode, false), coalesce(p_metadata, '{}'::jsonb), auth.uid()
  )
  ON CONFLICT (card_id, codigo_monnera, design_id) DO UPDATE
    SET view_url = EXCLUDED.view_url,
        edit_url = EXCLUDED.edit_url,
        public_url = EXCLUDED.public_url,
        public_url_kind = EXCLUDED.public_url_kind,
        metadata = EXCLUDED.metadata
  RETURNING id, version INTO v_id, v_version;

  UPDATE public.representative_cards
     SET canva_design_id = p_design_id,
         canva_material_url = v_public,
         canva_public_url = v_public,
         canva_internal_url = p_edit_url,
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
      'public_url', v_public,
      'public_url_kind', v_kind,
      'internal_url', p_edit_url,
      'view_url', p_view_url,
      'edited_page', p_edited_page,
      'version', v_version,
      'registrado_em', now(),
      'source', coalesce(p_source, 'manual')
    ),
    NULL, NULL
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'version', v_version, 'design_id', p_design_id,
                            'public_url', v_public, 'public_url_kind', v_kind);
END;
$$;

REVOKE ALL ON FUNCTION public.register_canva_material(uuid, text, text, text, text, text, integer, text, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.register_canva_material(uuid, text, text, text, text, text, integer, text, jsonb, text) TO authenticated, service_role;
DROP FUNCTION IF EXISTS public.register_canva_material(uuid, text, text, text, text, text, integer, text, jsonb);
