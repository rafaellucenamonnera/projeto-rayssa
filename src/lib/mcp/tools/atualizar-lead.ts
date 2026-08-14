import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "atualizar_lead",
  title: "Atualizar card de lead",
  description: "Atualiza campos cadastrais de um card de lead existente. Só envie os campos que devem mudar.",
  inputSchema: {
    lead_id: z.string().describe("UUID do lead."),
    nome_fantasia: z.string().optional(),
    razao_social: z.string().optional(),
    cnpj: z.string().optional(),
    cidade: z.string().optional(),
    quantidade_lojas: z.number().int().optional(),
    nome_responsavel: z.string().optional(),
    telefone_responsavel: z.string().optional(),
    email_responsavel: z.string().optional(),
    erp_utilizado: z.string().optional(),
    descricao_necessidade: z.string().optional(),
    valor_mensalidade: z.number().optional(),
    valor_campanhas: z.number().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, cnpj, email_responsavel, ...rest }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) updates[key] = typeof value === "string" ? value.trim() : value;
    }
    if (cnpj !== undefined) updates.cnpj = onlyDigits(cnpj);
    if (email_responsavel !== undefined) updates.email_responsavel = email_responsavel.trim().toLowerCase() || null;

    if (Object.keys(updates).length === 0) return fail("Nenhum campo informado para atualização.");

    const { data, error } = await supabase.from("leads").update(updates).eq("id", lead_id).select("id").maybeSingle();
    if (error) return fail(error.message);
    if (!data) return fail("Lead não encontrado ou sem permissão para editar.");
    return ok({ atualizado: true, lead_id, campos: Object.keys(updates) });
  },
});
