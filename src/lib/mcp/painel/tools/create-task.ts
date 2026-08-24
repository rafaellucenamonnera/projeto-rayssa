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
  name: "create_task",
  title: "Criar tarefa no card",
  description:
    "Cria uma tarefa vinculada a um card do painel painel_msj9fyji, com título, descrição, prazo e responsável.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    titulo: z.string().describe("Título da tarefa."),
    descricao: z.string().optional().describe("Descrição/detalhamento da tarefa."),
    due_at: z.string().optional().describe("Prazo em ISO 8601, ex.: 2026-08-20T14:00:00Z."),
    assigned_to: z.string().optional().describe("UUID do responsável (padrão: usuário autenticado)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, titulo, descricao, due_at, assigned_to }, ctx) =>
    guard("create_task", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const texto = titulo.trim();
      if (!texto) return failure("INVALID_INPUT", "titulo é obrigatório.");

      let prazo: string | null = null;
      if (due_at) {
        const parsed = new Date(due_at);
        if (Number.isNaN(parsed.getTime()))
          return failure("INVALID_INPUT", "due_at inválido. Use ISO 8601.", { due_at });
        prazo = parsed.toISOString();
      }

      const { data, error } = await supabase
        .from("representative_card_tasks")
        .insert({
          representative_card_id: card_id,
          titulo: texto,
          descricao: descricao?.trim() || null,
          due_at: prazo,
          assigned_to: assigned_to?.trim() || userId,
          status: "pendente",
          created_by: userId,
        })
        .select("id, representative_card_id, titulo, descricao, due_at, assigned_to, status, created_at")
        .single();

      if (error) return failure("CREATE_FAILED", error.message);

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "tarefa_criada",
        payload: { ferramenta: "create_task", task_id: data.id, titulo: texto },
      });

      return success("create_task", data, { card_id, task_id: data.id });
    }),
});
