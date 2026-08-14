import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "obter_cliente_cross",
  title: "Detalhe do cliente Onb Clientes Cross",
  description:
    "Retorna o card completo de um cliente do painel Onb Clientes Cross, com etapa, comentários, tarefas e anexos.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const { data: card, error } = await supabase
      .from("representative_cards")
      .select("*")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (error) return fail(error.message);
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    const [{ data: stage }, { data: comentarios }, { data: tarefas }, { data: anexos }] = await Promise.all([
      supabase
        .from("pipeline_stages_config")
        .select("value, label, sort_order")
        .eq("panel_key", CROSS_PANEL_ID)
        .eq("value", card.stage_id)
        .maybeSingle(),
      supabase
        .from("representative_card_comments")
        .select("id, usuario, comentario, etapa, data_comentario")
        .eq("representative_card_id", card_id)
        .order("data_comentario", { ascending: false })
        .limit(50),
      supabase
        .from("representative_card_tasks")
        .select("id, titulo, due_at, assigned_to, status, completed_at, completed_note")
        .eq("representative_card_id", card_id)
        .order("due_at", { ascending: true }),
      supabase
        .from("representative_card_attachments")
        .select("id, file_name, mime_type, size_bytes, content_sha256, created_at")
        .eq("representative_card_id", card_id)
        .order("created_at", { ascending: false }),
    ]);

    return ok({
      cliente: card,
      etapa: stage ? { stage_id: stage.value, label: stage.label, ordem: stage.sort_order } : { stage_id: card.stage_id },
      comentarios: comentarios ?? [],
      tarefas: tarefas ?? [],
      anexos: anexos ?? [],
    });
  },
});
