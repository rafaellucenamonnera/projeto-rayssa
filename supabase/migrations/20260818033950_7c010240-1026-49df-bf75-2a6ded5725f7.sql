UPDATE public.representative_cards
   SET canva_public_url = 'https://www.canva.com/d/mffStCqDX5f8tVO',
       canva_internal_url = 'https://www.canva.com/d/s_4WDbw4bwOiBSS',
       canva_material_url = 'https://www.canva.com/d/mffStCqDX5f8tVO',
       updated_at = now()
 WHERE id = '32d1e94e-ab53-42b3-9118-ab3ad2d07c77';

UPDATE public.canva_material_generations
   SET public_url = 'https://www.canva.com/d/mffStCqDX5f8tVO',
       public_url_kind = 'view_url',
       edit_url = 'https://www.canva.com/d/s_4WDbw4bwOiBSS'
 WHERE card_id = '32d1e94e-ab53-42b3-9118-ab3ad2d07c77';

SELECT public.log_representative_card_event(
  '32d1e94e-ab53-42b3-9118-ab3ad2d07c77'::uuid,
  'canva_link_publico_atualizado',
  jsonb_build_object(
    'design_id','DAHSmv0m7fY',
    'public_url','https://www.canva.com/d/mffStCqDX5f8tVO',
    'public_url_kind','view_url',
    'internal_url','https://www.canva.com/d/s_4WDbw4bwOiBSS',
    'codigo','QATEST01',
    'registrado_em', now()
  ), NULL, NULL);
