import { supabase } from "@/integrations/supabase/client";

export const CARD_ATTACHMENTS_BUCKET = "representative-card-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = ["pdf", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "doc", "docx"];

export interface CardAttachment {
  id: string;
  representative_card_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export const validateAttachment = (file: File): string | null => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
    return `Formato não permitido em "${file.name}". Use PDF, Excel (xls/xlsx/csv) ou imagem (jpg/png).`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `O arquivo "${file.name}" excede o limite de 10 MB.`;
  }
  return null;
};

export const listCardAttachments = async (cardId: string): Promise<CardAttachment[]> => {
  const { data, error } = await (supabase as any)
    .from("representative_card_attachments")
    .select("id, representative_card_id, storage_path, file_name, mime_type, size_bytes, created_at")
    .eq("representative_card_id", cardId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CardAttachment[];
};

export const uploadCardAttachment = async (cardId: string, file: File): Promise<void> => {
  const invalid = validateAttachment(file);
  if (invalid) throw new Error(invalid);
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${cardId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(CARD_ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const auth = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("representative_card_attachments").insert({
    representative_card_id: cardId,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    created_by: auth.data.user?.id || null,
  });
  if (error) {
    await supabase.storage.from(CARD_ATTACHMENTS_BUCKET).remove([path]);
    throw error;
  }
};

export const removeCardAttachment = async (attachment: CardAttachment): Promise<void> => {
  const { error } = await (supabase as any)
    .from("representative_card_attachments")
    .delete()
    .eq("id", attachment.id);
  if (error) throw error;
  await supabase.storage.from(CARD_ATTACHMENTS_BUCKET).remove([attachment.storage_path]);
};

export const getCardAttachmentUrl = async (attachment: CardAttachment): Promise<string> => {
  const { data, error } = await supabase.storage
    .from(CARD_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storage_path, 60 * 10);
  if (error || !data?.signedUrl) throw error || new Error("Não foi possível gerar o link do arquivo.");
  return data.signedUrl;
};

export const formatBytes = (bytes?: number | null): string => {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
