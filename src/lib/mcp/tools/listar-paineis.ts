import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_paineis",
  title: "Listar painéis e etapas",
  description: "Lista os painéis do CRM (comercial, onboarding, Onb Clientes Cross etc.) e as etapas de cada um.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const [panels, stages] = await Promise.all([
      supabase.from("pipeline_panels").select("id, name, sort_order").order("sort_order"),
      supabase.from("pipeline_stages_config").select("panel_key, value, label, sort_order").order("sort_order"),
    ]);
    if (panels.error) return fail(panels.error.message);
    if (stages.error) return fail(stages.error.message);
    const result = (panels.data ?? []).map((p) => ({
      panel_id: p.id,
      nome: p.name,
      etapas: (stages.data ?? [])
        .filter((s) => s.panel_key === p.id)
        .map((s) => ({ stage_id: s.value, label: s.label })),
    }));
    return ok(result);
  },
});
