INSERT INTO public.profiles (user_id, nome, ativo, can_be_responsible, primeiro_acesso)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data->>'nome'),''), NULLIF(trim(u.raw_user_meta_data->>'full_name'),''), u.email, 'Sem nome'),
  true,
  false,
  false
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;