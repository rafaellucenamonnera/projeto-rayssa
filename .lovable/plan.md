Aplicar o diff fornecido em `src/pages/admin/AdminUsuarios.tsx`:

1. Adicionar estado `loadError` para mensagem de erro persistente.
2. Em `loadUsers`, resetar o erro no início e setar `loadError` em ambos os ramos do catch (auth vs. backend indisponível) com mensagens amigáveis.
3. Renderizar bloco de alerta (após o `loading`) usando `Alert`/`AlertDescription` com botões "Tentar novamente" (chama `loadUsers`) e "Atualizar usuários" (`window.location.reload()`).

Sem mudanças de backend ou esquema. Apenas UI/UX defensiva, espelhando o padrão já aplicado em `AdminPermissoes`.