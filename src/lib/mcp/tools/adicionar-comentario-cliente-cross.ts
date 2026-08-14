import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "adicionar_comentario_cliente_cross",
  title: "Adicionar comentário no cliente Onb Clientes Cross",
  description: "Registra um comentário no histórico de um card do painel Onb Clientes Cross, na etapa atual do card.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    comentario: z.string().describe("Texto do comentário."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, comentario }, ctx) => {
    const userId = requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const texto = comentario.trim();
    if (!texto) return fail("O comentário não pode ficar vazio.");

    const { data: card, error: cardError } = await supabase
      .from("representative_cards")
      .select("id, stage_id")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (cardError) return fail(cardError.message);
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", userId).maybeSingle();

    const { data, error } = await supabase
      .from("representative_card_comments")
      .insert({
        representative_card_id: card_id,
        user_id: userId,
        etapa: card.stage_id,
        usuario: profile?.nome ?? ctx.getUserEmail() ?? "Agente",
        comentario: texto,
      })
      .select("id, comentario, data_comentario")
      .single();

    if (error) return fail(error.message);
    return ok({ criado: true, comentario: data });
  },
});
