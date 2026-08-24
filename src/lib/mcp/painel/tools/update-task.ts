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
  name: "update_task",
  title: "Atualizar tarefa do card",
  description:
    "Atualiza título, descrição, prazo ou responsável de uma tarefa de um card do painel painel_msj9fyji. Para concluir ou reabrir use complete_task/reopen_task.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    task_id: z.string().describe("UUID da tarefa."),
    titulo: z.string().optional(),
    descricao: z.string().optional(),
    due_at: z.string().optional().describe("Prazo em ISO 8601."),
    assigned_to: z.string().optional().describe("UUID do responsável."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, task_id, titulo, descricao, due_at, assigned_to }, ctx) =>
    guard("update_task", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const updates: Record<string, unknown> = {};
      if (titulo !== undefined) {
        if (!titulo.trim()) return failure("INVALID_INPUT", "titulo não pode ficar vazio.");
        updates.titulo = titulo.trim();
      }
      if (descricao !== undefined) updates.descricao = descricao.trim() || null;
      if (assigned_to !== undefined) updates.assigned_to = assigned_to.trim() || null;
      if (due_at !== undefined) {
        const parsed = new Date(due_at);
        if (Number.isNaN(parsed.getTime()))
          return failure("INVALID_INPUT", "due_at inválido. Use ISO 8601.", { due_at });
        updates.due_at = parsed.toISOString();
      }
      if (Object.keys(updates).length === 0)
        return failure("INVALID_INPUT", "Nenhum campo informado para atualização.");

      const { data, error } = await supabase
        .from("representative_card_tasks")
        .update(updates)
        .eq("id", task_id)
        .eq("representative_card_id", card_id)
        .select("id, titulo, descricao, due_at, assigned_to, status, completed_at, completed_note")
        .maybeSingle();
      if (error) return failure("UPDATE_FAILED", error.message);
      if (!data) return failure("TASK_NOT_FOUND", "Tarefa não encontrada neste card ou sem permissão.", { task_id });

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "tarefa_atualizada",
        payload: { ferramenta: "update_task", task_id, campos: Object.keys(updates) },
      });

      return success("update_task", data, { card_id, task_id, updated_fields: Object.keys(updates) });
    }),
});
