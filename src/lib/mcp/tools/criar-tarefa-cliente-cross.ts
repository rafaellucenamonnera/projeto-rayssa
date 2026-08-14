import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "criar_tarefa_cliente_cross",
  title: "Criar tarefa no cliente Onb Clientes Cross",
  description: "Cria uma tarefa vinculada a um card do painel Onb Clientes Cross, com prazo e responsável.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    titulo: z.string().describe("Título da tarefa."),
    due_at: z.string().describe("Prazo em ISO 8601, ex.: 2026-08-20T14:00:00Z."),
    assigned_to: z.string().optional().describe("UUID do responsável (padrão: usuário autenticado)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, titulo, due_at, assigned_to }, ctx) => {
    const userId = requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const texto = titulo.trim();
    if (!texto) return fail("Informe o título da tarefa.");

    const prazo = new Date(due_at);
    if (Number.isNaN(prazo.getTime())) return fail("Prazo inválido. Use o formato ISO 8601.");

    const { data: card, error: cardError } = await supabase
      .from("representative_cards")
      .select("id")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (cardError) return fail(cardError.message);
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    const { data, error } = await supabase
      .from("representative_card_tasks")
      .insert({
        representative_card_id: card_id,
        titulo: texto,
        due_at: prazo.toISOString(),
        assigned_to: assigned_to ?? userId,
        status: "pendente",
        created_by: userId,
      })
      .select("id, titulo, due_at, assigned_to, status")
      .single();

    if (error) return fail(error.message);
    return ok({ criada: true, tarefa: data });
  },
});
