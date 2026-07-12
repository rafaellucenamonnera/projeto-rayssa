
-- Documentation FAQ tables

CREATE TABLE public.documentation_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentation_articles TO authenticated;
GRANT ALL ON public.documentation_articles TO service_role;

ALTER TABLE public.documentation_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docs articles read for admin or documentacao.acessar"
ON public.documentation_articles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'documentacao', 'acessar')
);

CREATE POLICY "Docs articles insert admin only"
ON public.documentation_articles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Docs articles update admin only"
ON public.documentation_articles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Docs articles delete admin only"
ON public.documentation_articles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.documentation_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.documentation_articles(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentation_attachments TO authenticated;
GRANT ALL ON public.documentation_attachments TO service_role;

ALTER TABLE public.documentation_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Docs attachments read for admin or documentacao.acessar"
ON public.documentation_attachments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'documentacao', 'acessar')
);

CREATE POLICY "Docs attachments insert admin only"
ON public.documentation_attachments
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Docs attachments update admin only"
ON public.documentation_attachments
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Docs attachments delete admin only"
ON public.documentation_attachments
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX idx_documentation_attachments_article_id ON public.documentation_attachments(article_id);

-- updated_at trigger

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

-- storage.objects policies for bucket documentation-files

CREATE POLICY "Docs storage read for admin or documentacao.acessar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentation-files'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'documentacao', 'acessar')
  )
);

CREATE POLICY "Docs storage insert admin only"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentation-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Docs storage update admin only"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentation-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'documentation-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Docs storage delete admin only"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentation-files'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
