-- Ambassador card comments and attachments
CREATE TABLE public.ambassador_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_card_id uuid NOT NULL REFERENCES public.ambassador_cards(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  usuario text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  comentario text NOT NULL,
  data_comentario timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ambassador_card_comments_card_date
  ON public.ambassador_card_comments (ambassador_card_id, data_comentario DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_card_comments TO authenticated;
GRANT ALL ON public.ambassador_card_comments TO service_role;

ALTER TABLE public.ambassador_card_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read ambassador card comments"
ON public.ambassador_card_comments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'leads', 'acessar')
);

CREATE POLICY "Insert own ambassador card comments"
ON public.ambassador_card_comments
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'leads', 'inserir_mensagem')
  )
);

CREATE POLICY "Update own ambassador card comments"
ON public.ambassador_card_comments
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'leads', 'editar_mensagem')
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'leads', 'editar_mensagem')
  )
);

CREATE POLICY "Delete own ambassador card comments"
ON public.ambassador_card_comments
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'leads', 'excluir_mensagem')
  )
);

-- Attachments
CREATE TABLE public.ambassador_card_comment_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.ambassador_card_comments(id) ON DELETE CASCADE,
  ambassador_card_id uuid NOT NULL REFERENCES public.ambassador_cards(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ambassador_card_comment_attachments_comment
  ON public.ambassador_card_comment_attachments (comment_id);
CREATE INDEX idx_ambassador_card_comment_attachments_card
  ON public.ambassador_card_comment_attachments (ambassador_card_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_card_comment_attachments TO authenticated;
GRANT ALL ON public.ambassador_card_comment_attachments TO service_role;

ALTER TABLE public.ambassador_card_comment_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read ambassador card comment attachments"
ON public.ambassador_card_comment_attachments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
  OR public.has_module_permission(auth.uid(), 'leads', 'acessar')
);

CREATE POLICY "Insert own ambassador card comment attachments"
ON public.ambassador_card_comment_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gestor_conta'::public.app_role)
    OR public.has_module_permission(auth.uid(), 'leads', 'inserir_arquivo')
  )
);

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