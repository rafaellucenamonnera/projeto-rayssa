import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

const BUCKET = "representative-card-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["pdf", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "doc", "docx"];

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

function decodeBase64(input: string): Uint8Array {
  const clean = input.includes(",") && input.startsWith("data:") ? input.slice(input.indexOf(",") + 1) : input;
  const binary = atob(clean.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default defineTool({
  name: "anexar_arquivo_cliente_cross",
  title: "Anexar arquivo ao cliente do painel Onb Clientes Cross",
  description:
    "Envia um anexo (PDF, Excel/CSV ou imagem JPG/PNG, até 10 MB) para um card do painel Onb Clientes Cross. O conteúdo do arquivo deve vir em base64. Arquivos idênticos já anexados no card não são duplicados (verificação por hash SHA-256).",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    file_name: z.string().describe("Nome do arquivo com extensão, ex.: contrato.pdf."),
    conteudo_base64: z.string().describe("Conteúdo do arquivo codificado em base64 (aceita data URL)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, file_name, conteudo_base64 }, ctx) => {
    const userId = requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const ext = file_name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED.includes(ext)) {
      return fail(`Formato não permitido em "${file_name}". Use PDF, Excel (xls/xlsx/csv) ou imagem (jpg/png).`);
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(conteudo_base64);
    } catch {
      return fail("Conteúdo base64 inválido.");
    }
    if (!bytes.length) return fail("O arquivo está vazio.");
    if (bytes.length > MAX_BYTES) return fail("O arquivo excede o limite de 10 MB.");

    const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
    const hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: card, error: cardError } = await supabase
      .from("representative_cards")
      .select("id")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (cardError) return fail(cardError.message);
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    const { data: existente } = await supabase
      .from("representative_card_attachments")
      .select("id, file_name, size_bytes, created_at")
      .eq("representative_card_id", card_id)
      .eq("content_sha256", hash)
      .maybeSingle();
    if (existente) {
      return ok({ anexado: false, duplicado: true, hash, anexo: existente });
    }

    const safeName = file_name.replace(/[^\w.\-]+/g, "_");
    const path = `${card_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const contentType = MIME[ext] ?? "application/octet-stream";

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadError) return fail(uploadError.message);

    const { data, error } = await supabase
      .from("representative_card_attachments")
      .insert({
        representative_card_id: card_id,
        storage_path: path,
        file_name,
        mime_type: contentType,
        size_bytes: bytes.length,
        created_by: userId,
        content_sha256: hash,
      })
      .select("id, file_name, size_bytes, created_at")
      .single();

    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      return fail(error.message);
    }
    return ok({ anexado: true, duplicado: false, hash, anexo: data });
  },
});
