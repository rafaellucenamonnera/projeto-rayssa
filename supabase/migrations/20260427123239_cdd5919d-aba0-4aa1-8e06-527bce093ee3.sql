ALTER TABLE public.kit_whatsapp_messages
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS subtitulo text;

ALTER TABLE public.kit_videos
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS subtitulo text;

ALTER TABLE public.kit_argumentos
  ADD COLUMN IF NOT EXISTS pilar text NOT NULL DEFAULT 'Conexão',
  ADD COLUMN IF NOT EXISTS pilar_descricao text;