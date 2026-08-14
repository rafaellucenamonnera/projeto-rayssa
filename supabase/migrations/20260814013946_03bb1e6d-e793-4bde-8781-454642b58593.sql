ALTER TABLE public.representative_card_comments
  ADD COLUMN IF NOT EXISTS etapa TEXT,
  ADD COLUMN IF NOT EXISTS usuario TEXT,
  ADD COLUMN IF NOT EXISTS comentario TEXT,
  ADD COLUMN IF NOT EXISTS data_comentario TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.representative_card_comments SET comentario = COALESCE(comentario, comment);
ALTER TABLE public.representative_card_comments ALTER COLUMN "comment" DROP NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.representative_card_comments TO authenticated;
GRANT ALL ON public.representative_card_comments TO service_role;

DROP POLICY IF EXISTS "Read representative card comments" ON public.representative_card_comments;
CREATE POLICY "Read representative card comments" ON public.representative_card_comments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'acessar'::text));

DROP POLICY IF EXISTS "Insert own representative card comments" ON public.representative_card_comments;
CREATE POLICY "Insert own representative card comments" ON public.representative_card_comments
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'inserir_mensagem'::text)));

DROP POLICY IF EXISTS "Update own representative card comments" ON public.representative_card_comments;
CREATE POLICY "Update own representative card comments" ON public.representative_card_comments
  FOR UPDATE TO authenticated
  USING ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'editar_mensagem'::text)))
  WITH CHECK ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'editar_mensagem'::text)));

DROP POLICY IF EXISTS "Delete own representative card comments" ON public.representative_card_comments;
CREATE POLICY "Delete own representative card comments" ON public.representative_card_comments
  FOR DELETE TO authenticated
  USING ((user_id = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'excluir_mensagem'::text)));

CREATE TABLE IF NOT EXISTS public.representative_card_comment_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID NOT NULL REFERENCES public.representative_card_comments(id) ON DELETE CASCADE,
  representative_card_id UUID NOT NULL REFERENCES public.representative_cards(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.representative_card_comment_attachments TO authenticated;
GRANT ALL ON public.representative_card_comment_attachments TO service_role;
ALTER TABLE public.representative_card_comment_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read representative card comment attachments" ON public.representative_card_comment_attachments;
CREATE POLICY "Read representative card comment attachments" ON public.representative_card_comment_attachments
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'acessar'::text));

DROP POLICY IF EXISTS "Insert own representative card comment attachments" ON public.representative_card_comment_attachments;
CREATE POLICY "Insert own representative card comment attachments" ON public.representative_card_comment_attachments
  FOR INSERT TO authenticated
  WITH CHECK ((created_by = auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR has_module_permission(auth.uid(), 'leads'::text, 'inserir_arquivo'::text)));

DROP POLICY IF EXISTS "Delete own representative card comment attachments" ON public.representative_card_comment_attachments;
CREATE POLICY "Delete own representative card comment attachments" ON public.representative_card_comment_attachments
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor_conta'::app_role) OR (created_by = auth.uid()));