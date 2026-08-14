import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "buscar_cliente_cross_por_cnpj",
  title: "Buscar cliente Cross por CNPJ",
  description:
    "Busca exata por CNPJ (comparando apenas dígitos) no painel Onb Clientes Cross. Retorna todos os cards com aquele CNPJ, sinalizando duplicidade. Somente leitura.",
  inputSchema: {
    cnpj: z.string().describe("CNPJ do parceiro, com ou sem máscara."),
    panel_id: z
      .string()
      .optional()
      .describe(`Opcional. Somente o painel Onb Clientes Cross (${CROSS_PANEL_ID}) é permitido.`),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ cnpj, panel_id }, ctx) => {
    requireAuth(ctx);
    if (panel_id && panel_id !== CROSS_PANEL_ID) {
      return fail(`Esta ferramenta consulta apenas o painel ${CROSS_PANEL_ID}.`);
    }

    const digits = onlyDigits(cnpj);
    if (!digits) return fail("CNPJ inválido: informe ao menos um dígito.");

    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("representative_cards")
      .select(
        "id, full_name, cnpj, stage_id, notes, focal_name, focal_phone, focal_email, contratante_monnera, vendor_name, vendor_phone, vendor_email, responsible_user_id, created_at, updated_at",
      )
      .eq("panel_id", CROSS_PANEL_ID)
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) return fail(error.message);

    const encontrados = (data ?? []).filter((c) => onlyDigits(c.cnpj) === digits);

    const { data: stages } = await supabase
      .from("pipeline_stages_config")
      .select("value, label")
      .eq("panel_key", CROSS_PANEL_ID);
    const labels = new Map((stages ?? []).map((s) => [s.value, s.label]));

    const clientes = encontrados.map((c) => ({
      card_id: c.id,
      nome_parceiro: c.full_name,
      cnpj: c.cnpj,
      focal_nome: c.focal_name,
      focal_email: c.focal_email,
      focal_telefone: c.focal_phone,
      contratante_monnera: c.contratante_monnera,
      vendedor_nome: c.vendor_name,
      vendedor_email: c.vendor_email,
      vendedor_telefone: c.vendor_phone,
      stage_id: c.stage_id,
      stage_label: labels.get(c.stage_id) ?? c.stage_id,
      etapa: labels.get(c.stage_id) ?? c.stage_id,
      anotacoes: c.notes,
      responsavel_user_id: c.responsible_user_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    return ok({
      cnpj_consultado: digits,
      encontrados: clientes.length,
      duplicado: clientes.length > 1,
      clientes,
    });
  },
});
