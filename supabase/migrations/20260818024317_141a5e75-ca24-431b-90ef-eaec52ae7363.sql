
GRANT EXECUTE ON FUNCTION public.register_canva_material(uuid, text, text, text, text, text, integer, text, jsonb) TO postgres;

SELECT public.register_canva_material(
 '32d1e94e-ab53-42b3-9118-ab3ad2d07c77'::uuid,
 'QATEST01',
 'DAHSjY1VKyI',
 'DAHSmv0m7fY',
 'https://www.canva.com/d/c4zxi4vpjmbpv7V',
 'https://www.canva.com/d/0I3CRNXyPOhgmpd',
 12,
 'qa_teste',
 jsonb_build_object(
   'placeholder_encontrado','3SAXJF92',
   'placeholder_esperado','{{CODIGO_CADASTRO_PARCEIRO}}',
   'modelo_link','https://canva.link/qp4jojog4s01mjl',
   'titulo','[QA] Parceiros Baston - TESTE FASE A QA'
 )
);
