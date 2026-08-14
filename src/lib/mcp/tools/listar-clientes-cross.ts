import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_clientes_cross",
  title: "Listar clientes do painel Onb Clientes Cross",
  description:
    "Lista/busca cards de cliente do painel Onb Clientes Cross por CNPJ, nome do parceiro, focal, contratante Monnera ou vendedor, com filtro opcional por etapa, paginação explícita e detecção de CNPJs duplicados.",
  inputSchema: {
    busca: z.string().optional().describe("Texto livre: CNPJ, nome do parceiro, focal, contratante ou vendedor."),
    etapa: z.string().optional().describe("Filtra por stage_id da etapa."),
    limite: z.number().int().optional().describe("Quantidade de registros (padrão 25, máximo 200)."),
    offset: z.number().int().optional().describe("Deslocamento para paginação."),
    agrupar_por_cnpj: z
      .boolean()
      .optional()
      .describe("Se true, retorna também os CNPJs com mais de um card (duplicidades) na página consultada."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, etapa, limite, offset, agrupar_por_cnpj }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const take = Math.min(Math.max(limite ?? 25, 1), 200);
    const skip = Math.max(offset ?? 0, 0);

    let query = supabase
      .from("representative_cards")
      .select(
        "id, full_name, cnpj, stage_id, notes, focal_name, focal_phone, focal_email, contratante_monnera, vendor_name, vendor_phone, vendor_email, responsible_user_id, created_at, updated_at",
        { count: "exact" },
      )
      .eq("panel_id", CROSS_PANEL_ID)
      .order("created_at", { ascending: true })
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
      anotacoes: c.notes,
      responsavel_user_id: c.responsible_user_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    const total = count ?? clientes.length;
    const resposta: Record<string, unknown> = {
      total,
      offset: skip,
      limite: take,
      retornados: clientes.length,
      tem_mais: skip + clientes.length < total,
      proximo_offset: skip + clientes.length < total ? skip + clientes.length : null,
      clientes,
    };

    if (agrupar_por_cnpj) {
      const grupos = new Map<string, string[]>();
      for (const c of clientes) {
        const key = onlyDigits(c.cnpj) ?? "";
        if (!key) continue;
        grupos.set(key, [...(grupos.get(key) ?? []), c.card_id]);
      }
      resposta.duplicidades_cnpj = Array.from(grupos.entries())
        .filter(([, ids]) => ids.length > 1)
        .map(([cnpj, card_ids]) => ({ cnpj, quantidade: card_ids.length, card_ids }));
    }

    return ok(resposta);
  },
});

