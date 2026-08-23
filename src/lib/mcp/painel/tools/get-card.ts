import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CARD_NOT_FOUND,
  PANEL_ID,
  UNAUTH,
  authUser,
  client,
  guard,
  loadCard,
  stageLabels,
  success,
} from "../shared";

export default defineTool({
  name: "get_card",
  title: "Consultar card por ID",
  description:
    "Retorna todos os campos de um card do painel painel_msj9fyji, incluindo etapa, tarefas, comentários e anexos. Somente leitura.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    include_tasks: z.boolean().optional().describe("Incluir tarefas (padrão true)."),
    include_attachments: z.boolean().optional().describe("Incluir anexos (padrão true)."),
    include_notes: z.boolean().optional().describe("Incluir comentários/observações (padrão true)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, include_tasks, include_attachments, include_notes }, ctx) =>
    guard("get_card", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "*");
      if (!card) return CARD_NOT_FOUND(card_id);

      const stages = await stageLabels(supabase);
      const stage = stages.find((s) => s.value === card.stage_id);

      const data: Record<string, unknown> = {
        card_id,
        panel_id: PANEL_ID,
        stage: stage
          ? { stage_id: stage.value, label: stage.label, sort_order: stage.sort_order }
          : { stage_id: card.stage_id },
        card,
      };

      if (include_tasks !== false) {
        const { data: tasks } = await supabase
          .from("representative_card_tasks")
          .select("id, titulo, descricao, due_at, assigned_to, status, completed_at, completed_note, created_at, updated_at")
          .eq("representative_card_id", card_id)
          .is("deleted_at", null)
          .order("due_at", { ascending: true });
        data.tasks = tasks ?? [];
      }

      if (include_notes !== false) {
        const { data: notes } = await supabase
          .from("representative_card_comments")
          .select("id, usuario, comentario, etapa, data_comentario")
          .eq("representative_card_id", card_id)
          .order("data_comentario", { ascending: false })
          .limit(100);
        data.notes = notes ?? [];
      }

      if (include_attachments !== false) {
        const { data: attachments } = await supabase
          .from("representative_card_attachments")
          .select("id, task_id, file_name, mime_type, size_bytes, content_sha256, created_at")
          .eq("representative_card_id", card_id)
          .order("created_at", { ascending: false });
        data.attachments = attachments ?? [];
      }

      return success("get_card", data, { card_id });
    }),
});
