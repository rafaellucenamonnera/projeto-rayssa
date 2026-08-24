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
  name: "reopen_task",
  title: "Reabrir tarefa do card",
  description: "Reabre uma tarefa concluída de um card do painel painel_msj9fyji, voltando o status para pendente.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    task_id: z.string().describe("UUID da tarefa."),
    motivo: z.string().optional().describe("Motivo da reabertura (registrado no histórico)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, task_id, motivo }, ctx) =>
    guard("reopen_task", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const { data, error } = await supabase
        .from("representative_card_tasks")
        .update({ status: "pendente", completed_at: null, completed_by: null, completed_note: null })
        .eq("id", task_id)
        .eq("representative_card_id", card_id)
        .select("id, titulo, status, due_at, assigned_to")
        .maybeSingle();
      if (error) return failure("UPDATE_FAILED", error.message);
      if (!data) return failure("TASK_NOT_FOUND", "Tarefa não encontrada neste card ou sem permissão.", { task_id });

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "tarefa_reaberta",
        payload: { ferramenta: "reopen_task", task_id, motivo: motivo ?? null },
      });

      return success("reopen_task", data, { card_id, task_id });
    }),
});
