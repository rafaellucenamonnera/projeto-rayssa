import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  ATTACHMENT_BUCKET,
  CARD_NOT_FOUND,
  UNAUTH,
  authUser,
  client,
  failure,
  guard,
  loadCard,
  success,
} from "../shared";

export default defineTool({
  name: "get_attachment_url",
  title: "Obter link temporário de anexo",
  description:
    "Gera um link assinado temporário para download de um anexo de card do painel painel_msj9fyji. Somente leitura.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    attachment_id: z.string().describe("UUID do anexo."),
    expires_in: z.number().int().optional().describe("Validade do link em segundos (padrão 600, máximo 3600)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, attachment_id, expires_in }, ctx) =>
    guard("get_attachment_url", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const { data: attachment, error } = await supabase
        .from("representative_card_attachments")
        .select("id, file_name, mime_type, size_bytes, storage_path, content_sha256, created_at")
        .eq("id", attachment_id)
        .eq("representative_card_id", card_id)
        .maybeSingle();
      if (error) return failure("QUERY_FAILED", error.message);
      if (!attachment)
        return failure("ATTACHMENT_NOT_FOUND", "Anexo não encontrado neste card ou sem permissão.", { attachment_id });

      const ttl = Math.min(Math.max(expires_in ?? 600, 60), 3600);
      const { data: signed, error: signError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(attachment.storage_path, ttl);
      if (signError) return failure("SIGN_URL_FAILED", signError.message);

      return success(
        "get_attachment_url",
        { ...attachment, url: signed?.signedUrl ?? null, url_expires_in: ttl },
        { card_id, attachment_id },
      );
    }),
});
