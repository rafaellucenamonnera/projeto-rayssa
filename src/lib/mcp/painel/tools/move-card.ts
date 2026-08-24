import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CARD_FIELDS,
  CARD_NOT_FOUND,
  PANEL_ID,
  UNAUTH,
  authUser,
  client,
  failure,
  guard,
  loadCard,
  logHistory,
  stageLabels,
  success,
} from "../shared";

const normalize = (v: string) =>
  v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export default defineTool({
  name: "move_card",
  title: "Mover card de etapa",
  description:
    "Move um card do painel painel_msj9fyji para outra etapa, quando o agente solicitar. Aceita stage_id ou o rótulo da etapa. Não executa automações.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    stage_id: z.string().describe("Etapa de destino: stage_id ou rótulo (ex.: \"Recebimento Dados\")."),
    motivo: z.string().optional().describe("Motivo/observação registrada no histórico."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, stage_id, motivo }, ctx) =>
    guard("move_card", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, card_id, "id, stage_id");
      if (!card) return CARD_NOT_FOUND(card_id);

      const stages = await stageLabels(supabase);
      const alvo = normalize(stage_id);
      const stage = stages.find((s) => normalize(s.value) === alvo || normalize(s.label ?? "") === alvo);
      if (!stage)
        return failure("STAGE_NOT_FOUND", `Etapa "${stage_id}" não existe neste painel.`, {
          stages: stages.map((s) => ({ stage_id: s.value, label: s.label })),
        });

      const origem = String(card.stage_id);
      const { data, error } = await supabase
        .from("representative_cards")
        .update({ stage_id: stage.value })
        .eq("id", card_id)
        .eq("panel_id", PANEL_ID)
        .select(CARD_FIELDS)
        .maybeSingle();
      if (error) return failure("MOVE_FAILED", error.message);
      if (!data) return CARD_NOT_FOUND(card_id);

      await logHistory(supabase, {
        cardId: card_id,
        userId,
        action: "card_movido",
        sourceStageId: origem,
        destinationStageId: stage.value,
        payload: { ferramenta: "move_card", motivo: motivo ?? null, stage_label: stage.label },
      });

      return success("move_card", data, {
        card_id,
        from_stage_id: origem,
        to_stage_id: stage.value,
        to_stage_label: stage.label,
      });
    }),
});
