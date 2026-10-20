DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.submit_teste_monnera(jsonb)'::regprocedure);
  d := replace(d, $q$v_qualified      text := 'etapa_comercial_1783879107510';$q$, $q$v_qualified      text := 'etapa_comercial_mql';$q$);
  d := replace(d, 'status_lead                     = v_qualified,',
    $q$status_lead = CASE WHEN status_lead IS NULL OR status_lead IN ('etapa_comercial_prospects','novo_lead','etapa_comercial_1783879107510') THEN v_qualified ELSE status_lead END,$q$);
  IF position('etapa_comercial_mql' in d) = 0 THEN RAISE EXCEPTION 'submit_teste_monnera not patched'; END IF;
  EXECUTE d;

  d := pg_get_functiondef('public.upsert_teste_monnera_started_lead(jsonb)'::regprocedure);
  d := replace(d, $q$'novo_lead', 'comercial', false$q$, $q$'etapa_comercial_mql', 'comercial', false$q$);
  IF position('etapa_comercial_mql' in d) = 0 THEN RAISE EXCEPTION 'started_lead not patched'; END IF;
  EXECUTE d;
END
$mig$;