# Corrigir "Não foi possível salvar as permissões"

## Causa identificada

O erro não vem do painel novo (Onb Clientes Cross). Verifiquei no banco:

- O painel `Onb Clientes Cross` existe normalmente em `pipeline_panels`.
- As tabelas `module_permissions` e `user_panel_permissions` têm as chaves únicas corretas para o salvamento.

O que falha é a chamada à função de backend `admin-create-user` (usada apenas para gravar a marcação "Responsáveis por tarefas"). No console do preview ela retorna "Failed to send a request to the Edge Function" — a mesma falha já aparece ao carregar a lista de usuários, que hoje cai no modo alternativo. Como a tela trata esse erro junto com o salvamento das permissões, ela mostra a mensagem de falha mesmo quando os módulos e os painéis já foram gravados.

## Correção

1. Gravar a marcação "Responsáveis por tarefas" direto na tabela de perfis (o administrador já tem permissão para isso pelas regras de acesso), sem depender da função de backend.
2. Separar os erros: se o salvamento de módulos ou de painéis falhar, mostrar a mensagem de erro com o motivo real; se apenas a marcação de responsável falhar, mostrar aviso e confirmar que as permissões foram salvas.
3. Manter a chamada à função apenas como fallback opcional, sem bloquear o sucesso.
4. Verificação: salvar permissões com "Onb Clientes Cross" marcado, recarregar a página e confirmar que a marcação persiste.

## Detalhes técnicos

- `src/pages/admin/AdminPermissoes.tsx`, `handleSave`:
  - substituir `supabase.functions.invoke("admin-create-user", { method: "PATCH", ... })` por `supabase.from("profiles").update({ can_be_responsible }).eq("user_id", selectedUserId)`.
  - checar `error` de `module_permissions` e `panelError` separadamente e exibir `error.message` no toast.
- Sem migração de banco: políticas de `profiles` já permitem UPDATE para `has_role(auth.uid(), 'admin')`.
