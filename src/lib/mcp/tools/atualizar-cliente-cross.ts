import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "atualizar_cliente_cross",
  title: "Atualizar cliente do painel Onb Clientes Cross",
  description: "Atualiza dados ou etapa de um card do painel Onb Clientes Cross. Só envie os campos que devem mudar.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
    nome_parceiro: z.string().optional(),
    cnpj: z.string().optional(),
    focal_nome: z.string().optional(),
    focal_telefone: z.string().optional(),
    focal_email: z.string().optional(),
    contratante_monnera: z.string().optional(),
    vendedor_nome: z.string().optional(),
    vendedor_telefone: z.string().optional(),
    vendedor_email: z.string().optional(),
    anotacoes: z.string().optional().describe("Anotações livres, até 500 caracteres."),
    stage_id: z.string().optional().describe("Nova etapa do card."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    if ((input.anotacoes?.length ?? 0) > 500) return fail("As anotações devem ter no máximo 500 caracteres.");

    const updates: Record<string, unknown> = {};
    if (input.nome_parceiro !== undefined) updates.full_name = input.nome_parceiro.trim();
    if (input.focal_nome !== undefined) updates.focal_name = input.focal_nome.trim() || null;
    if (input.focal_telefone !== undefined) {
      updates.focal_phone = input.focal_telefone.trim() || null;
      updates.phone = input.focal_telefone.trim() || "";
    }
    if (input.focal_email !== undefined) {
      updates.focal_email = input.focal_email.trim().toLowerCase() || null;
      updates.email = input.focal_email.trim().toLowerCase() || "";
    }
    if (input.contratante_monnera !== undefined) updates.contratante_monnera = input.contratante_monnera.trim() || null;
    if (input.vendedor_nome !== undefined) updates.vendor_name = input.vendedor_nome.trim() || null;
    if (input.vendedor_telefone !== undefined) updates.vendor_phone = input.vendedor_telefone.trim() || null;
    if (input.vendedor_email !== undefined) updates.vendor_email = input.vendedor_email.trim().toLowerCase() || null;
    if (input.anotacoes !== undefined) updates.notes = input.anotacoes.trim() || null;
    if (input.stage_id !== undefined) updates.stage_id = input.stage_id.trim();

    if (input.cnpj !== undefined) {
      const cnpj = onlyDigits(input.cnpj);
      if (!cnpj || cnpj.length !== 14) return fail("CNPJ inválido: informe 14 dígitos.");
      const { data: existente } = await supabase
        .from("representative_cards")
        .select("id")
        .eq("panel_id", CROSS_PANEL_ID)
        .eq("cnpj", cnpj)
        .neq("id", input.card_id)
        .maybeSingle();
      if (existente) return fail("Já existe outro cliente com este CNPJ.");
      updates.cnpj = cnpj;
    }

    if (Object.keys(updates).length === 0) return fail("Nenhum campo informado para atualização.");

    const { data, error } = await supabase
      .from("representative_cards")
      .update(updates)
      .eq("id", input.card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .select("id, full_name, cnpj, stage_id")
      .maybeSingle();

    if (error) return fail(error.message);
    if (!data) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão para editar.");
    return ok({ atualizado: true, cliente: data });
  },
});
