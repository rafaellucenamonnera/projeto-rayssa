import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_comentarios_cliente_cross",
  title: "Listar histórico do cliente Onb Clientes Cross",
  description: "Lista os comentários (histórico) de um card do painel Onb Clientes Cross, do mais recente para o mais antigo.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    limite: z.number().int().optional().describe("Quantidade de comentários (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, limite }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const { data: card } = await supabase
      .from("representative_cards")
      .select("id")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    const take = Math.min(Math.max(limite ?? 50, 1), 200);

    const { data, error } = await supabase
      .from("representative_card_comments")
      .select("id, usuario, comentario, etapa, data_comentario")
      .eq("representative_card_id", card_id)
      .order("data_comentario", { ascending: false })
      .limit(take);
    if (error) return fail(error.message);

    return ok({ total: data?.length ?? 0, comentarios: data ?? [] });
  },
});
