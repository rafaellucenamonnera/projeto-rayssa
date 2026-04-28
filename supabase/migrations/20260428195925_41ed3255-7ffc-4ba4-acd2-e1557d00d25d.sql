-- Revogar EXECUTE de anon/public em funções internas (mantém authenticated)
DO $$
DECLARE
  r record;
  public_functions text[] := ARRAY[
    'register_lead_public',
    'lookup_parceiro_by_slug',
    'lookup_parceiro_by_code',
    'complete_lead_by_token',
    'get_lead_by_completion_token',
    'has_any_admin'
  ];
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname <> ALL(public_functions)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;',
                   r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;',
                   r.proname, r.args);
  END LOOP;
END $$;

-- Garantir que as funções públicas continuam acessíveis a anon (link de indicação)
GRANT EXECUTE ON FUNCTION public.register_lead_public(uuid, text, text, text, text, integer, text, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_parceiro_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_parceiro_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_lead_by_token(uuid, jsonb, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_by_completion_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_admin() TO anon, authenticated;