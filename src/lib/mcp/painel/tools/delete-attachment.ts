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
  logHistory,
  success,
} from "../shared";

export default defineTool({
  name: "delete_attachment",
  title: "Excluir anexo do card",
  description:
    "Remove definitivamente um anexo de um card do painel painel_msj9fyji, apagando o arquivo do armazenamento e o registro.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    attachment_id: z.string().describe("UUID do anexo."),
    motivo: z.string().optional().describe("Motivo da exclusão (registrado no histórico)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, attachment_id, motivo }, ctx) =>
    guard("delete_attachment", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const { data: attachment } = await supabase
        .from("representative_card_attachments")
        .select("id, file_name, storage_path, content_sha256")
        .eq("id", attachment_id)
        .eq("representative_card_id", card_id)
        .maybeSingle();
      if (!attachment)
        return failure("ATTACHMENT_NOT_FOUND", "Anexo não encontrado neste card ou sem permissão.", { attachment_id });

      const { error } = await supabase
        .from("representative_card_attachments")
        .delete()
        .eq("id", attachment_id)
        .eq("representative_card_id", card_id);
      if (error) return failure("DELETE_FAILED", error.message);

      const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([attachment.storage_path]);

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "anexo_removido",
        payload: {
          ferramenta: "delete_attachment",
          attachment_id,
          file_name: attachment.file_name,
          sha256: attachment.content_sha256,
          motivo: motivo ?? null,
        },
      });

      return success(
        "delete_attachment",
        {
          attachment_id,
          file_name: attachment.file_name,
          removed_from_storage: !storageError,
          storage_warning: storageError?.message ?? null,
        },
        { card_id, attachment_id },
      );
    }),
});
