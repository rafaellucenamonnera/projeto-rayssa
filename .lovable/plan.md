# Deploy + Publish

## 1. Atualizar `admin-create-user` (CORS)
Adicionar `https://parceiros.monnera.com.br` e `https://monneraparceiros.lovable.app` à lista `allowedOrigins` em `supabase/functions/admin-create-user/index.ts` (hoje só tem `monneracomercial.lovable.app`; o fallback `.lovable.app` cobre lovable mas não o domínio custom).

## 2. Atualizar `supabase/config.toml`
```toml
project_id = "bapxuzodzgahscatvofs"

[functions.admin-create-user]
verify_jwt = true

[functions.register-partner]
verify_jwt = false
```

## 3. Deploy
Deploy de `admin-create-user` e `register-partner` via `supabase--deploy_edge_functions`.

## 4. Publicar frontend
Chamar `preview_ui--publish` (site info já relevante — título/descrição Monnera Parceiros).

## 5. Validação
- Abrir `/admin/usuarios` no domínio publicado e confirmar carregamento sem erro de CORS.
- Abrir `/cadastro` e testar cadastro com email já existente (resposta esperada: sucesso, parceiro pendente).
- Conferir logs de `admin-create-user` e `register-partner` para 200.
