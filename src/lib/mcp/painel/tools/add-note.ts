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
  name: "add_note",
  title: "Adicionar observação no card",
  description:
    "Registra uma observação/comentário no histórico de um card do painel painel_msj9fyji, sempre vinculada à etapa atual.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    texto: z.string().describe("Texto da observação (até 500 caracteres)."),
    autor: z.string().optional().describe("Rótulo do autor exibido no histórico (padrão: usuário autenticado)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, texto, autor }, ctx) =>
    guard("add_note", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const conteudo = texto.trim();
      if (!conteudo) return failure("INVALID_INPUT", "texto não pode ficar vazio.");
      if (conteudo.length > 500) return failure("INVALID_INPUT", "texto deve ter no máximo 500 caracteres.");

      const card = await loadCard(supabase, card_id, "id, stage_id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", userId)
        .maybeSingle();

      const { data, error } = await supabase
        .from("representative_card_comments")
        .insert({
          representative_card_id: card_id,
          user_id: userId,
          etapa: String(card.stage_id),
          usuario: autor?.trim() || profile?.nome || ctx.getUserEmail() || "Agente MCP",
          comentario: conteudo,
        })
        .select("id, usuario, comentario, etapa, data_comentario")
        .single();
      if (error) return failure("CREATE_FAILED", error.message);

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "observacao_registrada",
        payload: { ferramenta: "add_note", comment_id: data.id },
      });

      return success("add_note", data, { card_id, note_id: data.id });
    }),
});
