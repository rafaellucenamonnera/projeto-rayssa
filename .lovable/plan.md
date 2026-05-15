## Plano

O diff filtra `profiles.can_be_responsible = true` para listar quem pode ser responsável por cards no CRM customizado, mas essa coluna ainda não existe.

### 1. Migration
- `ALTER TABLE public.profiles ADD COLUMN can_be_responsible boolean NOT NULL DEFAULT false;`
- Backfill: marcar como `true` todos os profiles que já são admin ou gestor_conta (via `user_roles`), para não quebrar fluxos existentes.

### 2. UI mínima de gestão (`src/pages/admin/AdminUsuarios.tsx`)
- Adicionar um Switch/Checkbox "Pode ser responsável por cards" na linha de cada usuário.
- Update direto em `profiles.can_be_responsible` (apenas admin via RLS existente).

### 3. Aplicar o diff em `src/pages/admin/AdminLeads.tsx`
- Novo state `allActiveUsers` (todos ativos, para mapa de exibição/export).
- `usersAll` passa a conter apenas os elegíveis (`can_be_responsible = true`) — usado nos seletores de responsável.
- Validação extra em `createRepresentativeCard` confirmando que o `responsible_user_id` está na lista elegível.
- `LeadExportButton` recebe `allActiveUsers` para resolver nomes de qualquer responsável histórico.

### 4. Fora do escopo
- Não alterar leads/painel comercial.
- Sem novos componentes além do toggle no AdminUsuarios.
- Sem mudanças em RLS (admin já gerencia profiles).

### Ordem
1. Migration (coluna + backfill).
2. Aplicar diff no AdminLeads.
3. Toggle em AdminUsuarios.
4. Smoke test: abrir painel custom → criar card → confirmar que só usuários marcados aparecem na lista de responsável.
