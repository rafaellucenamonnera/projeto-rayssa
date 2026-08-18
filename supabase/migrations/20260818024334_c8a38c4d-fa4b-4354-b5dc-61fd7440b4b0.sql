
UPDATE public.representative_cards
   SET stage_id = 'etapa_painel_msj9fyji_3', updated_at = now()
 WHERE id = '32d1e94e-ab53-42b3-9118-ab3ad2d07c77'
   AND test_mode = true
   AND canva_design_id = 'DAHSmv0m7fY';

SELECT public.log_representative_card_event(
  '32d1e94e-ab53-42b3-9118-ab3ad2d07c77'::uuid,
  'movido_material_onboarding',
  jsonb_build_object('motivo','material_canva_gerado','design_id','DAHSmv0m7fY','codigo','QATEST01','origem','qa_teste'),
  'etapa_painel_msj9fyji_1',
  'etapa_painel_msj9fyji_3'
);
