## Objetivo
Corrigir o erro de FK no painel de embaixadores (`painel_mp5q4du9`) criando persistência dedicada para comentários/anexos de `ambassador_cards`. Sem alterar `lead_comments`, `lead_comment_attachments` ou o fluxo dos demais painéis.

## 1) Migration — `supabase/migrations/<ts>_ambassador_card_comments.sql`

### `public.ambassador_card_comments`
- `id uuid pk default gen_random_uuid()`
- `ambassador_card_id uuid not null references public.ambassador_cards(id) on delete cascade`
- `etapa text not null`
- `usuario text not null`
- `user_id uuid not null references public.profiles(user_id) on delete cascade`
- `comentario text not null`
- `data_comentario timestamptz not null default now()`
- Índice: `(ambassador_card_id, data_comentario desc)`

### `public.ambassador_card_comment_attachments`
- `id uuid pk default gen_random_uuid()`
- `comment_id uuid not null references public.ambassador_card_comments(id) on delete cascade`
- `ambassador_card_id uuid not null references public.ambassador_cards(id) on delete cascade`
- `storage_path text not null`
- `file_name text not null`
- `mime_type text not null`
- `size_bytes integer not null`
- `created_by uuid not null references public.profiles(user_id) on delete cascade`
- `created_at timestamptz not null default now()`
- Índices: `(comment_id)`, `(ambassador_card_id)`

### GRANTs (ambas)
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated;
GRANT ALL ON public.<t> TO service_role;
```

### RLS (ENABLE nas duas)
Policies usam `public.has_role(auth.uid(),'admin'::public.app_role)`, `public.has_role(auth.uid(),'gestor_conta'::public.app_role)` e `public.has_module_permission(auth.uid(),'leads',<acao>)`.

`ambassador_card_comments`:
- SELECT: admin OR gestor_conta OR `has_module_permission('leads','acessar')`.
- INSERT: `user_id = auth.uid()` AND (admin OR gestor OR `inserir_mensagem`).
- UPDATE: `user_id = auth.uid()` AND (admin OR gestor OR `editar_mensagem`).
- DELETE: `user_id = auth.uid()` AND (admin OR gestor OR `excluir_mensagem`).

`ambassador_card_comment_attachments`:
- SELECT: admin OR gestor OR `has_module_permission('leads','acessar')`.
- INSERT: `created_by = auth.uid()` AND (admin OR gestor OR `inserir_arquivo`).
- DELETE (explícita):

```sql
DROP POLICY IF EXISTS "Users can delete own ambassador card comment attachments"
  ON public.ambassador_card_comment_attachments;

CREATE POLICY "Users can delete own ambassador card comment attachments"
ON public.ambassador_card_comment_attachments
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  OR created_by = auth.uid()
);
```

Sem bucket novo. Reutiliza o bucket privado `lead-comment-attachments`; policies de storage não são alteradas.

## 2) Novo componente — `src/components/admin/AmbassadorCardComments.tsx`

Props: `cardId`, `currentStage`, `userName`, `canInsertMessage`, `canEditMessage`, `canDeleteMessage`, `canInsertFile`.

- Lista `ambassador_card_comments` (filtro `ambassador_card_id = cardId`, order `data_comentario desc`) com join `ambassador_card_comment_attachments(id, storage_path, file_name, mime_type, size_bytes)`.
- Insere com `ambassador_card_id`, `etapa=currentStage`, `usuario=userName`, `user_id=auth.uid()`, `comentario` (500 chars).
- UI: textarea `maxLength={500}` + contador `X/500`; botão fixo **"Salvar"** com ícone `Send`; exibe `usuario` + data/hora pt-BR; edição inline do próprio comentário (respeita `canEditMessage`); exclusão com confirmação (respeita `canDeleteMessage`); sem menções e sem notificações.
- Anexos (respeita `canInsertFile`): upload no bucket `lead-comment-attachments` com `storage_path = ambassador_cards/{cardId}/{commentId}/{uuid}.{ext}`; `file_name` preserva o nome original; insere metadados em `ambassador_card_comment_attachments` (`created_by=auth.uid()`); download/preview via `createSignedUrl`.
- Validação local dentro do componente (sem depender de `campaignFlow.ts` nem `CommentAttachments.tsx`): PDF, JPG/JPEG, PNG, DOC, DOCX; até 10 MB por arquivo; até 5 anexos por comentário.
- Toasts com mensagem real: `Erro ao adicionar comentário: {error.message}`, `Erro ao editar comentário: {error.message}`, `Erro ao excluir comentário: {error.message}`, `Erro ao anexar arquivo: {error.message}`.
- Acesso via `(supabase as any).from("ambassador_card_comments")` e `(supabase as any).from("ambassador_card_comment_attachments")` até `types.ts` ser regenerado.

## 3) Ajuste em `src/pages/admin/AdminLeads.tsx`

Adicionar `import { AmbassadorCardComments } from "@/components/admin/AmbassadorCardComments";`. Substituir o bloco “Histórico de Conversa” (linhas ~2626–2639) por:

```tsx
{isAmbassadorPanel ? (
  <AmbassadorCardComments
    cardId={detailLead.id}
    currentStage={detailLead.status_lead || detailLead.stage_id || "prospeccao"}
    userName={currentUserName}
    canInsertMessage={canInsertMessage}
    canEditMessage={canEditMessage}
    canDeleteMessage={canDeleteMessage}
    canInsertFile={canInsertFile}
  />
) : (
  <LeadComments
    leadId={detailLead.id}
    currentStage={detailLead.status_lead || "novo_lead"}
    userName={currentUserName}
    actionBasePath={currentPanelPath}
    canInsertMessage={canInsertMessage}
    canEditMessage={canEditMessage}
    canDeleteMessage={canDeleteMessage}
    canInsertFile={canInsertFile}
  />
)}
```

Remover a prop `submitLabel` do uso do `LeadComments`. `LeadComments.tsx` não é modificado.

## Fora de escopo
`lead_comments`, `lead_comment_attachments`, demais painéis, kanban, drag&drop, tarefas, clonagem, automações, permissões existentes, RLS de `leads`, criação de bucket, policies de storage.

## Validação
- Migration aplicada; `types.ts` regenerado.
- `npm run build`.
- Smoke em `/admin/painel/painel_mp5q4du9`: abrir card → salvar comentário sem anexo (mostra usuário/data/hora) → editar → excluir → anexar PDF/JPG/PNG/DOC/DOCX. Painel comercial segue usando `LeadComments` inalterado.
