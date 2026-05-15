# Corrigir salvamento de "Pode ser Responsável por Cards"

## Problema

Ao marcar a permissão para a Isabela Machado (e outros usuários como Rayssa Camporeze e confidercomercialweb), o toast mostra sucesso mas o valor não persiste. Causa raiz: esses usuários existem em `auth.users` mas **não possuem linha em `public.profiles`**. O código atual faz `UPDATE` em `profiles` por `user_id`, que afeta 0 linhas silenciosamente.

## Solução

### 1. Migration — Backfill de profiles ausentes

Inserir linhas em `public.profiles` para os usuários de `auth.users` que ainda não possuem profile, usando `nome` de `raw_user_meta_data` (com fallback para o email), `ativo = true`, `can_be_responsible = false`.

### 2. Frontend — `src/pages/admin/AdminPermissoes.tsx`

Trocar o `update` por `upsert` em `profiles` no `handleSave`, garantindo que mesmo um usuário sem profile receba a permissão corretamente:

```ts
const selected = users.find(u => u.user_id === selectedUserId);
await supabase.from("profiles").upsert(
  {
    user_id: selectedUserId,
    nome: selected?.nome ?? selected?.email ?? "Sem nome",
    can_be_responsible: canBeResponsible,
    ativo: true,
  },
  { onConflict: "user_id" }
);
```

### 3. Validação

- Marcar a permissão para Isabela e salvar.
- Confirmar `profiles.can_be_responsible = true` para ela.
- Confirmar que ela aparece em `get_available_responsible_users()`.

## Escopo

- Sem alteração de RLS, triggers, edge functions ou outras telas.
- Mudança mínima e focada apenas no fluxo de permissões.
