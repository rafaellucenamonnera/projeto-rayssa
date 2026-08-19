REVOKE ALL ON FUNCTION public.is_card_protected(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_card_protected(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.representative_card_guard_protected() FROM PUBLIC, anon, authenticated;