## Objetivo

Adicionar a aba **Documentação** no admin com FAQ indexada (título, pergunta, resposta, tags, nome de anexos), controle de acesso via `module_permissions`, e bucket privado para anexos.

## 1. Banco de dados (migration)

Criar `supabase/migrations/<timestamp>_admin_documentacao.sql`:

- Tabela `documentation_articles` (title, question, answer, tags[], is_active, created_by, updated_by, timestamps).
- Tabela `documentation_attachments` (article_id, storage_path unique, file_name, mime_type, size_bytes, created_by, created_at).
- GRANTs para `authenticated` e `service_role` (sem `anon`).
- Função e trigger próprios para `updated_at`, com DROP defensivo antes de criar o trigger:

```sql
CREATE OR REPLACE FUNCTION public.tg_documentation_articles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentation_articles_updated_at
  ON public.documentation_articles;

CREATE TRIGGER trg_documentation_articles_updated_at
BEFORE UPDATE ON public.documentation_articles
FOR EACH ROW EXECUTE FUNCTION public.tg_documentation_articles_updated_at();
```

- RLS ativa em ambas as tabelas:
  - SELECT: `public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_module_permission(auth.uid(),'documentacao','acessar')`.
  - INSERT/UPDATE/DELETE: somente admin.
- Policies em `storage.objects` para o bucket `documentation-files` (na mesma migration SQL):
  - SELECT: admin OU `documentacao.acessar`.
  - INSERT/UPDATE/DELETE: somente admin.

Bucket privado `documentation-files` criado via tool `supabase--storage_create_bucket` com `public=false`. Se já existir, garantir `public=false` via `supabase--storage_update_bucket`. As policies do storage permanecem no SQL da migration.

## 2. Rota e menu

- `src/App.tsx`: `const AdminDocumentacao = lazy(() => import("./pages/admin/AdminDocumentacao"))` e `<Route path="documentacao" element={<AdminDocumentacao />} />` dentro do bloco `/admin`.
- `src/components/AdminSidebar.tsx`:
  - Importar `BookOpen`.
  - Ler `user` de `useAuth()`.
  - `useState canAccessDocumentation`; admin ⇒ true; caso contrário consultar `module_permissions` (modulo=`documentacao`, acao=`acessar`, permitido=true).
  - Adicionar item **Documentação** no grupo **Configurações**, logo abaixo de **Edição de Painel**.
  - Se o não-admin só tiver documentação, o grupo Configurações aparece só com esse item.

## 3. Permissões UI

Em `src/pages/admin/AdminPermissoes.tsx`, adicionar módulo:

```ts
{ key: "documentacao", label: "DOCUMENTAÇÃO", actions: ["acessar"] }
```

## 4. Página `src/pages/admin/AdminDocumentacao.tsx`

- Controle de acesso: admin sempre; não-admin precisa de `documentacao.acessar=true`, senão `navigate("/admin")`.
- Layout dark theme padrão do projeto.
  - Título: "Documentação".
  - Subtítulo: "Manuais, respostas rápidas e arquivos de apoio para uso do painel comercial."
  - Campo de busca (placeholder informado).
- Lista de artigos em accordion (shadcn `Accordion`):
  - Pergunta como título; título como subtítulo; badge "Inativa" para admin quando `is_active=false`.
  - Resposta com `whitespace-pre-wrap`; tags como badges; anexos com botão que abre signed URL (`createSignedUrl(path, 3600)`) em nova aba.
  - Não-admin: só vê ativos e sem botões de gestão.
- Busca local filtrando por título/pergunta/resposta/tags/nome de anexos.
- Gestão (admin):
  - Botões **Nova documentação**, **Editar**, **Excluir**, remover anexo individual.
  - Dialog com formulário: título, pergunta, resposta, tags (CSV), checkbox `is_active`, input de anexos múltiplos.
  - Tipos: pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx. Limite 15 MB por arquivo.
  - Ao salvar:
    - se for novo artigo: `insert` em `documentation_articles`;
    - se estiver editando: `update` por `id` em `documentation_articles`;
    - depois fazer upload de cada anexo em `${articleId}/${crypto.randomUUID()}.${ext}` e `insert` em `documentation_attachments`.
  - Excluir artigo remove registros e arquivos do storage.

## 5. Seed opcional

- `scripts/seed-documentacao.mjs`:
  - Usa `SUPABASE_URL`/`VITE_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
  - `DOCUMENTACAO_SOURCE_DIR` (default `C:\Users\Rafael Lucena\OneDrive\Documentos\Vendas Monnera\output\pdf`).
  - Upsert por `title` nos artigos e por `storage_path` nos anexos (upsert vive apenas no seed).
  - Envia os dois PDFs para `materiais-iniciais/...` no bucket privado e cria os artigos "Playbook Meio de Funil Monnera" e "Playbook Topo de Funil Monnera" com os textos/tags especificados.
- `package.json`: adicionar `"seed:documentacao": "node scripts/seed-documentacao.mjs"`.
- Observação: `SUPABASE_SERVICE_ROLE_KEY` não é acessível no ambiente Lovable Cloud; o seed é executado localmente pelo usuário. Alternativamente, criar os artigos e enviar os PDFs manualmente pela UI depois que a aba estiver publicada.

## 6. Validação

- `npm run build`.
- Testes manuais: admin vê a aba abaixo de Edição de Painel, cria/edita/exclui FAQ, anexa arquivos, abre via signed URL; não-admin sem permissão é redirecionado; com permissão vê a aba somente-leitura.

## Fora de escopo

Sem IA, OCR ou extração de texto de PDFs/imagens. Sem alterações em pipeline, cards, propostas ou financeiro. Arquivos permanecem privados.
