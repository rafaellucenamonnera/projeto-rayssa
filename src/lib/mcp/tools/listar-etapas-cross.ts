import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_etapas_cross",
  title: "Listar etapas do painel Onb Clientes Cross",
  description:
    "Lista todas as etapas do painel Onb Clientes Cross (stage_id, rótulo e ordem), incluindo \"Aguardando Informações\".",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("pipeline_stages_config")
      .select("value, label, sort_order")
      .eq("panel_key", CROSS_PANEL_ID)
      .order("sort_order");
    if (error) return fail(error.message);

    return ok({
      panel_id: CROSS_PANEL_ID,
      etapas: (data ?? []).map((s) => ({ stage_id: s.value, label: s.label, ordem: s.sort_order })),
    });
  },
});
