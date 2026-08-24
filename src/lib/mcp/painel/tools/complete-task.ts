import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
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
  name: "complete_task",
  title: "Concluir tarefa do card",
  description: "Marca uma tarefa de um card do painel painel_msj9fyji como concluída, com observação opcional.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    task_id: z.string().describe("UUID da tarefa."),
    observacao: z.string().optional().describe("Observação de conclusão."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, task_id, observacao }, ctx) =>
    guard("complete_task", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const { data, error } = await supabase
        .from("representative_card_tasks")
        .update({
          status: "concluida",
          completed_at: new Date().toISOString(),
          completed_by: userId,
          completed_note: observacao?.trim() || null,
        })
        .eq("id", task_id)
        .eq("representative_card_id", card_id)
        .select("id, titulo, status, completed_at, completed_note, due_at, assigned_to")
        .maybeSingle();
      if (error) return failure("UPDATE_FAILED", error.message);
      if (!data) return failure("TASK_NOT_FOUND", "Tarefa não encontrada neste card ou sem permissão.", { task_id });

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "tarefa_concluida",
        payload: { ferramenta: "complete_task", task_id, observacao: observacao ?? null },
      });

      return success("complete_task", data, { card_id, task_id });
    }),
});
