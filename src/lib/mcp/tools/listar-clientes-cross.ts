import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_clientes_cross",
  title: "Listar clientes do painel Onb Clientes Cross",
  description:
    "Busca cards de cliente do painel Onb Clientes Cross por CNPJ, nome do parceiro, focal, contratante Monnera ou vendedor, com filtro opcional por etapa.",
  inputSchema: {
    busca: z.string().optional().describe("Texto livre: CNPJ, nome do parceiro, focal, contratante ou vendedor."),
    etapa: z.string().optional().describe("Filtra por stage_id da etapa."),
    limite: z.number().int().optional().describe("Quantidade de registros (padrão 25, máximo 100)."),
    offset: z.number().int().optional().describe("Deslocamento para paginação."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, etapa, limite, offset }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const take = Math.min(Math.max(limite ?? 25, 1), 100);
    const skip = Math.max(offset ?? 0, 0);

    let query = supabase
      .from("representative_cards")
      .select(
        "id, full_name, cnpj, stage_id, focal_name, focal_phone, focal_email, contratante_monnera, vendor_name, responsible_user_id, updated_at",
        { count: "exact" },
      )
      .eq("panel_id", CROSS_PANEL_ID)
      .order("updated_at", { ascending: false })
      .range(skip, skip + take - 1);

    if (etapa) query = query.eq("stage_id", etapa);

    if (busca?.trim()) {
      const termo = busca.trim();
      const digits = onlyDigits(termo);
      const like = `%${termo}%`;
      const filtros = [
        `full_name.ilike.${like}`,
        `focal_name.ilike.${like}`,
        `focal_email.ilike.${like}`,
        `contratante_monnera.ilike.${like}`,
        `vendor_name.ilike.${like}`,
        `vendor_email.ilike.${like}`,
      ];
      if (digits) filtros.push(`cnpj.ilike.%${digits}%`);
      query = query.or(filtros.join(","));
    }

    const { data, error, count } = await query;
    if (error) return fail(error.message);

    const { data: stages } = await supabase
      .from("pipeline_stages_config")
      .select("value, label")
      .eq("panel_key", CROSS_PANEL_ID);
    const labels = new Map((stages ?? []).map((s) => [s.value, s.label]));

    const clientes = (data ?? []).map((c) => ({
      ...c,
      etapa_label: labels.get(c.stage_id) ?? c.stage_id,
    }));

    return ok({ total: count ?? clientes.length, retornados: clientes.length, clientes });
  },
});
