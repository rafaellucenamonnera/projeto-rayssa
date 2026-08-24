import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { CARD_NOT_FOUND, UNAUTH, authUser, client, failure, guard, loadCard, success } from "../shared";

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas do card",
  description: "Lista as tarefas de um card do painel painel_msj9fyji, com status, prazo e responsável. Somente leitura.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    status: z.enum(["pendente", "concluida", "todas"]).optional().describe("Filtro de status (padrão: todas)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, status }, ctx) =>
    guard("list_tasks", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      let query = supabase
        .from("representative_card_tasks")
        .select("id, representative_card_id, titulo, descricao, due_at, assigned_to, status, completed_at, completed_note, created_by, created_at, updated_at")
        .eq("representative_card_id", card_id)
        .is("deleted_at", null)
        .order("due_at", { ascending: true });
      if (status && status !== "todas") query = query.eq("status", status);

      const { data, error } = await query;
      if (error) return failure("QUERY_FAILED", error.message);

      return success("list_tasks", data ?? [], { card_id, total: data?.length ?? 0 });
    }),
});
