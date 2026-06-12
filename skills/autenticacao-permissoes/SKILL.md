---
name: autenticacao-permissoes
description: Use esta skill sempre que uma tarefa envolver autenticacao, roles de usuario, permissoes de painel, guards de rota, acesso de admin vs gestor vs parceiro, criacao de usuarios, primeiro acesso ou qualquer logica de controle de acesso no sistema Monnera. Ela define os papeis, fluxos de autenticacao e regras de permissao do projeto.
---

# Autenticacao e Permissoes Monnera

## Papeis de Usuario

### admin
- Acesso irrestrito a todos os paineis e funcionalidades
- Pode criar e gerenciar usuarios internos e parceiros
- Acessa `AdminUsuarios`, `AdminPermissoes`, `AdminParceiros`

### gestor_conta
- Usuario interno com acesso restrito a paineis especificos
- Permissoes por painel via `user_panel_permissions`
- Nao pode criar usuarios

### parceiro
- Empresa ou pessoa que indica leads
- Sem `user_roles` — ausencia de role indica parceiro
- Acesso apenas ao `PainelParceiro`
- Ve somente seus proprios leads

## Hook de Autenticacao

```ts
import { useAuth } from "@/hooks/useAuth";

const { user, session, roles, loading, isAdmin, isGestorConta, isInternalUser, signOut } = useAuth();
```

- `isAdmin`: true se tem role `admin`
- `isGestorConta`: true se tem role `gestor_conta`
- `isInternalUser`: true se e admin ou gestor_conta
- Parceiro: `isAdmin = false`, `isGestorConta = false`

## Tabelas de Autenticacao

### user_roles
```
user_id: uuid FK → auth.users
role: "admin" | "gestor_conta"
```

### profiles
Perfil complementar dos usuarios internos.
- Vinculado por `user_id`
- Referenciado em tarefas, comentarios e notificacoes

### user_panel_permissions
Controla acesso de `gestor_conta` a paineis especificos.
```
user_id: uuid
panel_id: uuid FK → pipeline_panels
can_access: boolean
```

## Hook de Permissoes de Painel

```ts
import { usePanelPermissions } from "@/hooks/usePanelPermissions";

const { allowedPanelIds, canAccessPanel, loading } = usePanelPermissions();

// Verificar acesso a um painel especifico
if (!canAccessPanel(panelId)) return <Redirect to="/sem-acesso" />;
```

Comportamento:
- Admin: acessa todos os paineis automaticamente
- Gestor: acessa apenas paineis com `can_access = true` em `user_panel_permissions`
- Parceiro: nao usa este hook

## Layout Admin

`src/layouts/AdminLayout.tsx` — envolve todas as paginas admin.
- Verifica `isInternalUser` antes de renderizar
- Redireciona para login se nao autenticado
- Exibe `AdminSidebar` com links filtrados por permissao

## Sidebar Admin

`src/components/AdminSidebar.tsx`
- Exibe links de navegacao do painel admin
- Filtra itens por role (ex: link de usuarios so para admin)

## Paginas Admin

| Arquivo | Descricao | Quem acessa |
|---|---|---|
| `AdminLogin.tsx` | Login interno | Todos |
| `AdminDashboard.tsx` | Dashboard principal | admin, gestor |
| `AdminLeads.tsx` | Gestao de leads | admin, gestor |
| `AdminParceiros.tsx` | Gestao de parceiros | admin |
| `AdminUsuarios.tsx` | Gestao de usuarios internos | admin |
| `AdminPermissoes.tsx` | Permissoes por painel | admin |
| `AdminPipelineEdit.tsx` | Configurar etapas do pipeline | admin |
| `AdminFinanceiro.tsx` | Dados financeiros | admin, gestor |
| `AdminKitVendas.tsx` | Gerenciar kit de vendas | admin |
| `AdminIntegracoes.tsx` | Configurar integracoes | admin |
| `AdminContatos.tsx` | Gestao de contatos | admin, gestor |

## Criacao de Usuarios

Edge Function: `admin-create-user`
- Cria usuario no Supabase Auth
- Cria perfil em `profiles`
- Atribui role em `user_roles`
- Envia email de primeiro acesso

Edge Function: `delete-orphan-user`
- Remove usuarios sem perfil valido
- Usado em rollback de criacao com erro

## Fluxo de Autenticacao do Parceiro

1. Admin cria parceiro → email enviado automaticamente
2. Parceiro acessa link de primeiro acesso → `PrimeiroAcesso.tsx`
3. Parceiro define senha
4. Login em `LoginParceiro.tsx` → redireciona para `PainelParceiro.tsx`

Reset de senha:
1. `EsqueciSenha.tsx` → envia email com link
2. `ResetarSenha.tsx` → define nova senha via token da URL

## Fluxo de Autenticacao Interno

1. Admin/gestor acessa `AdminLogin.tsx`
2. Login com email/password Supabase
3. `useAuth` carrega roles do usuario
4. `AdminLayout` verifica `isInternalUser`
5. `usePanelPermissions` carrega paineis acessiveis

## Seguranca

- RLS ativo em todas as tabelas sensiveis
- Parceiros filtrados por `parceiro_id` em todas as queries
- Gestores filtrados por `user_panel_permissions`
- Tokens de conversao publica em `leads.completion_token` — uuid unico por lead
- Nunca expor dados de outros parceiros no frontend

## Checklist de Autenticacao

Ao implementar qualquer feature com acesso controlado:
- [ ] A rota esta protegida pelo `AdminLayout` ou guard equivalente?
- [ ] O papel do usuario foi verificado antes de renderizar a feature?
- [ ] Queries de leads filtram por `parceiro_id` quando o usuario e parceiro?
- [ ] Queries de paineis verificam `user_panel_permissions` para gestores?
- [ ] Dados sensiveis nao estao expostos para roles sem permissao?
