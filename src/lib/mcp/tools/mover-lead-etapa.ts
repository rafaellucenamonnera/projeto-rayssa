import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "mover_lead_etapa",
  title: "Mover lead de etapa",
  description:
    "Move um card de lead para outra etapa do funil. Ao mover para lead_perdido, o motivo da perda é obrigatório.",
  inputSchema: {
    lead_id: z.string().describe("UUID do lead."),
    stage_id: z.string().describe("Etapa de destino, ex.: reuniao_agendada."),
    motivo_perda: z.string().optional().describe("Obrigatório quando a etapa for lead_perdido."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, stage_id, motivo_perda }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const stage = stage_id.trim();

    if (stage === "lead_perdido" && !motivo_perda?.trim()) {
      return fail("Informe o motivo da perda para mover o card para lead_perdido.");
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, panel_id")
      .eq("id", lead_id)
      .maybeSingle();
    if (leadError) return fail(leadError.message);
    if (!lead) return fail("Lead não encontrado ou sem permissão de acesso.");

    const { data: stageRow } = await supabase
      .from("pipeline_stages_config")
      .select("value")
      .eq("panel_key", lead.panel_id)
      .eq("value", stage)
      .maybeSingle();
    if (!stageRow) return fail(`Etapa "${stage}" não existe no painel ${lead.panel_id}.`);

    const updates: Record<string, unknown> = { status: stage, status_lead: stage };
    if (motivo_perda?.trim()) updates.motivo_perda = motivo_perda.trim();

    const { error } = await supabase.from("leads").update(updates).eq("id", lead_id);
    if (error) return fail(error.message);
    return ok({ movido: true, lead_id, stage_id: stage });
  },
});
