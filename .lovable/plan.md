Aplicar o diff fornecido em `src/pages/admin/AdminPermissoes.tsx`:

1. Adicionar `loading: authLoading` do `useAuth` e exibir spinner enquanto auth carrega (evita redirect prematuro para `/admin` antes de `isAdmin` ser resolvido).
2. Adicionar estado `loadUsersError` para mensagem de erro persistente na UI.
3. Em `loadUsers`, detectar erros de auth (401/403/"Não autorizado"/"Acesso negado") e exibir mensagem amigável sem cair no fallback de profiles.
4. Renderizar bloco de erro com botões "Tentar novamente" (chama `loadUsers`) e "Recarregar permissões" (`window.location.reload()`).

Sem mudanças de backend, edge function ou esquema. Apenas UI/UX defensiva para o problema conhecido do proxy de fetch do preview da Lovable.