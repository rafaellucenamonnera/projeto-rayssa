import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CARD_NOT_FOUND, UNAUTH, authUser, client, failure, guard, loadCard, success } from "../shared";

export default defineTool({
  name: "list_attachments",
  title: "Listar anexos do card",
  description:
    "Lista os anexos de um card do painel painel_msj9fyji (opcionalmente filtrando por tarefa), com metadados e hash. Somente leitura.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    task_id: z.string().optional().describe("Opcional: filtra anexos vinculados a uma tarefa."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, task_id }, ctx) =>
    guard("list_attachments", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      let query = supabase
        .from("representative_card_attachments")
        .select("id, representative_card_id, task_id, file_name, mime_type, size_bytes, storage_path, content_sha256, uploaded_by, created_at")
        .eq("representative_card_id", card_id)
        .order("created_at", { ascending: false });
      if (task_id) query = query.eq("task_id", task_id);

      const { data, error } = await query;
      if (error) return failure("QUERY_FAILED", error.message);

      return success("list_attachments", data ?? [], { card_id, task_id: task_id ?? null, total: data?.length ?? 0 });
    }),
});
