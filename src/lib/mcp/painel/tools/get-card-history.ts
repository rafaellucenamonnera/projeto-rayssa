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
  stageLabels,
  success,
} from "../shared";

export default defineTool({
  name: "get_card_history",
  title: "Histórico do card",
  description:
    "Retorna o histórico auditável de um card do painel painel_msj9fyji (movimentações, edições, tarefas e anexos), do mais recente para o mais antigo. Somente leitura.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    limit: z.number().int().optional().describe("Quantidade de eventos (padrão 100, máximo 500)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id, limit }, ctx) =>
    guard("get_card_history", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const take = Math.min(Math.max(limit ?? 100, 1), 500);
      const { data, error } = await supabase
        .from("representative_card_history")
        .select("id, action, actor_user_id, actor_label, source_stage_id, destination_stage_id, payload, created_at")
        .eq("representative_card_id", card_id)
        .order("created_at", { ascending: false })
        .limit(take);
      if (error) return failure("QUERY_FAILED", error.message);

      const labels = new Map((await stageLabels(supabase)).map((s) => [s.value, s.label]));
      const eventos = (data ?? []).map((e) => ({
        ...e,
        source_stage_label: e.source_stage_id ? labels.get(e.source_stage_id) ?? e.source_stage_id : null,
        destination_stage_label: e.destination_stage_id
          ? labels.get(e.destination_stage_id) ?? e.destination_stage_id
          : null,
      }));

      return success("get_card_history", eventos, { card_id, total: eventos.length });
    }),
});
