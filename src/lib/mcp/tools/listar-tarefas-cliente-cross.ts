import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_tarefas_cliente_cross",
  title: "Listar tarefas do cliente Onb Clientes Cross",
  description: "Lista as tarefas de um card do painel Onb Clientes Cross, com prazo, responsável e status.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    status: z.enum(["pendente", "concluida", "todas"]).optional().describe("Filtro de status (padrão: todas)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, status }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const { data: card } = await supabase
      .from("representative_cards")
      .select("id")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    let query = supabase
      .from("representative_card_tasks")
      .select("id, titulo, due_at, assigned_to, status, completed_at, completed_note, created_at")
      .eq("representative_card_id", card_id)
      .order("due_at", { ascending: true });

    if (status && status !== "todas") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return fail(error.message);

    return ok({ total: data?.length ?? 0, tarefas: data ?? [] });
  },
});
