import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export default defineTool({
  name: "mover_cliente_cross_etapa",
  title: "Mover cliente do painel Onb Clientes Cross de etapa",
  description:
    "Move um card do painel Onb Clientes Cross para outra etapa. Aceita o stage_id ou o nome da etapa (ex.: \"Aguardando Informações\").",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    etapa: z
      .string()
      .describe("Etapa de destino: stage_id (ex.: etapa_painel_msj9fyji_1786676252012) ou o rótulo, ex.: Aguardando Informações."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ card_id, etapa }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const { data: stages, error: stagesError } = await supabase
      .from("pipeline_stages_config")
      .select("value, label, sort_order")
      .eq("panel_key", CROSS_PANEL_ID)
      .order("sort_order");
    if (stagesError) return fail(stagesError.message);

    const alvo = normalize(etapa);
    const stage = (stages ?? []).find(
      (s) => normalize(s.value) === alvo || normalize(s.label) === alvo,
    );
    if (!stage) {
      const disponiveis = (stages ?? []).map((s) => `${s.label} (${s.value})`).join(", ");
      return fail(`Etapa "${etapa}" não existe no painel Onb Clientes Cross. Disponíveis: ${disponiveis}`);
    }

    const { data, error } = await supabase
      .from("representative_cards")
      .update({ stage_id: stage.value })
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .select("id, full_name, cnpj, stage_id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão para editar.");
    return ok({ movido: true, etapa: stage.label, cliente: data });
  },
});
