import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_leads",
  title: "Listar leads",
  description:
    "Busca cards de lead do CRM por texto (nome fantasia, razão social, CNPJ, responsável, e-mail), painel e etapa.",
  inputSchema: {
    busca: z.string().optional().describe("Texto livre para buscar por nome, CNPJ, responsável ou e-mail."),
    panel_id: z.string().optional().describe("ID do painel, ex.: comercial."),
    stage_id: z.string().optional().describe("Etapa do funil, ex.: novo_lead."),
    limite: z.number().int().optional().describe("Quantidade de registros (padrão 25, máximo 100)."),
    offset: z.number().int().optional().describe("Deslocamento para paginação."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, panel_id, stage_id, limite, offset }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limite ?? 25, 1), 100);
    const from = Math.max(offset ?? 0, 0);

    let query = supabase
      .from("leads")
      .select(
        "id, nome_fantasia, razao_social, cnpj, cidade, nome_responsavel, telefone_responsavel, email_responsavel, status_lead, panel_id, consultor, data_cadastro",
      )
      .order("data_cadastro", { ascending: false })
      .range(from, from + take - 1);

    if (panel_id) query = query.eq("panel_id", panel_id);
    if (stage_id) query = query.eq("status_lead", stage_id);
    if (busca?.trim()) {
      const term = busca.trim().replace(/[%,()]/g, " ");
      query = query.or(
        [
          `nome_fantasia.ilike.%${term}%`,
          `razao_social.ilike.%${term}%`,
          `cnpj.ilike.%${term}%`,
          `nome_responsavel.ilike.%${term}%`,
          `email_responsavel.ilike.%${term}%`,
        ].join(","),
      );
    }

    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok({ total_retornado: data?.length ?? 0, leads: data ?? [] });
  },
});
