## Ajuste: adicionar permissão `documentacao.inserir`

### 1. `src/pages/admin/AdminPermissoes.tsx`
Trocar o módulo Documentação para incluir a nova ação:
```ts
{ key: "documentacao", label: "DOCUMENTAÇÃO", actions: ["acessar", "inserir"] }
```

### 2. Migration Supabase
Nova migration que substitui as policies de INSERT criadas anteriormente. Usa `DROP POLICY IF EXISTS` cobrindo todos os nomes possíveis usados até agora, para não quebrar caso o Lovable/Supabase tenha criado com outra nomenclatura:

```sql
-- documentation_articles
DROP POLICY IF EXISTS "Docs articles insert admin only" ON public.documentation_articles;
DROP POLICY IF EXISTS "Documentation articles admin insert" ON public.documentation_articles;
CREATE POLICY "Docs articles insert admin or documentacao.inserir"
ON public.documentation_articles FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'documentacao', 'inserir')
);

-- documentation_attachments
DROP POLICY IF EXISTS "Docs attachments insert admin only" ON public.documentation_attachments;
DROP POLICY IF EXISTS "Documentation attachments admin insert" ON public.documentation_attachments;
CREATE POLICY "Docs attachments insert admin or documentacao.inserir"
ON public.documentation_attachments FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'documentacao', 'inserir')
);

-- storage.objects (bucket documentation-files)
DROP POLICY IF EXISTS "Docs storage insert admin only" ON storage.objects;
DROP POLICY IF EXISTS "Documentation storage admin insert" ON storage.objects;
DROP POLICY IF EXISTS "Documentation files admin insert" ON storage.objects;
CREATE POLICY "Docs storage insert admin or documentacao.inserir"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentation-files'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'documentacao', 'inserir')
  )
);
```

- SELECT das três: continua admin OU `documentacao.acessar` (inalterado).
- UPDATE e DELETE das três: continuam somente admin (inalterado).

### 3. `src/pages/admin/AdminDocumentacao.tsx`
- Acesso à página: admin OU `documentacao.acessar` (inalterado). Quem tem só `inserir` sem `acessar` cai no redirect — ok, pois o menu lateral continua ligado a `acessar`.
- No `useEffect` de checagem, ler também `documentacao.inserir` em `module_permissions` e guardar em `canInsert`. Admin ⇒ `canInsert = true`.
- Botão **Nova documentação**: visível se `isAdmin || canInsert`.
- Input de anexos no formulário: visível se `isAdmin || canInsert`.
- `handleSave`:
  - Guard de criação: `if (!(isAdmin || canInsert)) return;`
  - Guard de edição: `if (editing && !isAdmin) return;`
- Botões **Editar**, **Excluir** artigo e **remover anexo**: inalterados, apenas admin.

### 4. `src/components/AdminSidebar.tsx`
Sem alteração — visibilidade do item continua ligada a `documentacao.acessar`.

### Lógica final
- `acessar`: vê a aba, busca FAQ e abre anexos.
- `inserir`: cria nova documentação e anexa arquivos.
- editar / excluir artigo / remover anexo: continuam somente admin.
