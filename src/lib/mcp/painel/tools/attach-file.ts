import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  ALLOWED_EXTENSIONS,
  ATTACHMENT_BUCKET,
  CARD_NOT_FOUND,
  MAX_ATTACHMENT_BYTES,
  MIME_BY_EXTENSION,
  UNAUTH,
  authUser,
  client,
  decodeBase64,
  extensionOf,
  failure,
  guard,
  loadCard,
  logHistory,
  safeFileName,
  sha256Hex,
  success,
} from "../shared";

export default defineTool({
  name: "attach_file",
  title: "Anexar arquivo ao card",
  description:
    "Faz upload de um arquivo (conteúdo em base64) para um card do painel painel_msj9fyji, opcionalmente vinculado a uma tarefa. Máximo de 10 MB.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    file_name: z.string().describe("Nome do arquivo com extensão, ex.: onboarding.html."),
    content_base64: z.string().describe("Conteúdo do arquivo em base64 (aceita data URL)."),
    mime_type: z.string().optional().describe("MIME type; inferido pela extensão quando omitido."),
    task_id: z.string().optional().describe("Opcional: vincula o anexo a uma tarefa do card."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, file_name, content_base64, mime_type, task_id }, ctx) =>
    guard("attach_file", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const nome = safeFileName(file_name);
      if (!nome) return failure("INVALID_FILE_NAME", "Nome de arquivo inválido.", { file_name });
      const ext = extensionOf(nome);
      if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number]))
        return failure("UNSUPPORTED_FILE_TYPE", `Extensão .${ext} não permitida.`, {
          allowed: ALLOWED_EXTENSIONS,
        });

      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(content_base64);
      } catch {
        return failure("INVALID_BASE64", "content_base64 não é um base64 válido.");
      }
      if (!bytes.length) return failure("EMPTY_FILE", "O arquivo enviado está vazio.");
      if (bytes.length > MAX_ATTACHMENT_BYTES)
        return failure("FILE_TOO_LARGE", "O arquivo excede o limite de 10 MB.", { size_bytes: bytes.length });

      if (task_id) {
        const { data: task } = await supabase
          .from("representative_card_tasks")
          .select("id")
          .eq("id", task_id)
          .eq("representative_card_id", card_id)
          .maybeSingle();
        if (!task) return failure("TASK_NOT_FOUND", "Tarefa não encontrada neste card.", { task_id });
      }

      const contentType = mime_type?.trim() || MIME_BY_EXTENSION[ext] || "application/octet-stream";
      const hash = await sha256Hex(bytes);
      const storagePath = `${card_id}/${Date.now()}-${hash.slice(0, 12)}-${nome}`;

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(storagePath, bytes.slice().buffer as ArrayBuffer, { contentType, upsert: false });
      if (uploadError) return failure("UPLOAD_FAILED", uploadError.message, { storage_path: storagePath });

      const { data, error } = await supabase
        .from("representative_card_attachments")
        .insert({
          representative_card_id: card_id,
          task_id: task_id ?? null,
          file_name: nome,
          mime_type: contentType,
          size_bytes: bytes.length,
          storage_path: storagePath,
          content_sha256: hash,
          uploaded_by: userId,
        })
        .select("id, task_id, file_name, mime_type, size_bytes, storage_path, content_sha256, created_at")
        .single();

      if (error) {
        await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
        return failure("CREATE_FAILED", error.message);
      }

      const { data: signed } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(storagePath, 600);

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "anexo_adicionado",
        payload: { ferramenta: "attach_file", attachment_id: data.id, file_name: nome, sha256: hash },
      });

      return success("attach_file", { ...data, url: signed?.signedUrl ?? null, url_expires_in: 600 }, {
        card_id,
        attachment_id: data.id,
      });
    }),
});
