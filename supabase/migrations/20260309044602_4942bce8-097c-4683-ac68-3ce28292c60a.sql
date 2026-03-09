-- Add proposta_url column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proposta_url text;

-- Create storage bucket for proposals
INSERT INTO storage.buckets (id, name, public)
VALUES ('propostas', 'propostas', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to propostas bucket
CREATE POLICY "Authenticated users can upload propostas"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'propostas');

-- Allow authenticated users to read propostas
CREATE POLICY "Authenticated users can read propostas"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'propostas');

-- Allow admins to delete propostas
CREATE POLICY "Admins can delete propostas"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'propostas' AND public.has_role(auth.uid(), 'admin'));