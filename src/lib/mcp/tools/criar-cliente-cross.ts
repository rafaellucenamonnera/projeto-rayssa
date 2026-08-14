import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "criar_cliente_cross",
  title: "Criar cliente no painel Onb Clientes Cross",
  description:
    "Cria um card de cliente no painel Onb Clientes Cross com dados do parceiro, focal, contratante Monnera e vendedor. CNPJ é único neste painel.",
  inputSchema: {
    nome_parceiro: z.string().describe("Nome do parceiro."),
    cnpj: z.string().describe("CNPJ do parceiro (14 dígitos)."),
    focal_nome: z.string().optional(),
    focal_telefone: z.string().optional(),
    focal_email: z.string().optional(),
    contratante_monnera: z.string().optional(),
    vendedor_nome: z.string().optional(),
    vendedor_telefone: z.string().optional(),
    vendedor_email: z.string().optional(),
    anotacoes: z.string().optional().describe("Anotações livres, até 500 caracteres."),
    stage_id: z.string().optional().describe("Etapa inicial (padrão: primeira etapa do painel)."),
    responsible_user_id: z.string().optional().describe("Usuário responsável (padrão: usuário autenticado)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const userId = requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const cnpj = onlyDigits(input.cnpj);
    if (!cnpj || cnpj.length !== 14) return fail("CNPJ inválido: informe 14 dígitos.");
    if ((input.anotacoes?.length ?? 0) > 500) return fail("As anotações devem ter no máximo 500 caracteres.");

    const { data: existente } = await supabase
      .from("representative_cards")
      .select("id, full_name")
      .eq("panel_id", CROSS_PANEL_ID)
      .eq("cnpj", cnpj)
      .maybeSingle();
    if (existente) return fail(`Já existe um cliente com este CNPJ: ${existente.full_name}.`);

    let stage = input.stage_id?.trim();
    if (!stage) {
      const { data: primeira } = await supabase
        .from("pipeline_stages_config")
        .select("value")
        .eq("panel_key", CROSS_PANEL_ID)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      stage = primeira?.value;
    }
    if (!stage) return fail("Não foi possível determinar a etapa inicial do painel.");

    const { data, error } = await supabase
      .from("representative_cards")
      .insert({
        panel_id: CROSS_PANEL_ID,
        stage_id: stage,
        full_name: input.nome_parceiro.trim(),
        cnpj,
        phone: input.focal_telefone?.trim() || "",
        email: input.focal_email?.trim().toLowerCase() || "",
        focal_name: input.focal_nome?.trim() || null,
        focal_phone: input.focal_telefone?.trim() || null,
        focal_email: input.focal_email?.trim().toLowerCase() || null,
        contratante_monnera: input.contratante_monnera?.trim() || null,
        vendor_name: input.vendedor_nome?.trim() || null,
        vendor_phone: input.vendedor_telefone?.trim() || null,
        vendor_email: input.vendedor_email?.trim().toLowerCase() || null,
        notes: input.anotacoes?.trim() || null,
        source: "agente_codex",
        responsible_user_id: input.responsible_user_id ?? userId,
        created_by_user_id: userId,
      })
      .select("id, full_name, cnpj, stage_id")
      .single();

    if (error) {
      if (error.message.includes("cnpj")) return fail("Já existe um cliente com este CNPJ.");
      return fail(error.message);
    }
    return ok({ criado: true, cliente: data });
  },
});
