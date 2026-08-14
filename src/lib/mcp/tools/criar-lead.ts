import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, onlyDigits, requireAuth } from "../helpers";

export default defineTool({
  name: "criar_lead",
  title: "Criar card de lead",
  description:
    "Cria um novo card de lead no funil comercial. Exige o embaixador (parceiro_id, obtido em listar_embaixadores).",
  inputSchema: {
    nome_fantasia: z.string().describe("Nome fantasia da empresa."),
    nome_responsavel: z.string().describe("Nome do contato responsável."),
    telefone_responsavel: z.string().describe("Telefone do responsável."),
    parceiro_id: z.string().describe("UUID do Embaixador Monnera responsável pela indicação."),
    email_responsavel: z.string().optional(),
    razao_social: z.string().optional(),
    cnpj: z.string().optional(),
    cidade: z.string().optional(),
    quantidade_lojas: z.number().int().optional(),
    erp_utilizado: z.string().optional(),
    descricao_necessidade: z.string().optional(),
    panel_id: z.string().optional().describe("Painel do card (padrão: comercial)."),
    stage_id: z.string().optional().describe("Etapa inicial (padrão: novo_lead)."),
    origem: z.string().optional().describe("Origem do lead (padrão: agente_codex)."),
    responsible_user_id: z.string().optional().describe("Usuário responsável pelo card."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const stage = input.stage_id?.trim() || "novo_lead";

    const payload = {
      nome_fantasia: input.nome_fantasia.trim(),
      razao_social: input.razao_social?.trim() || null,
      cnpj: onlyDigits(input.cnpj),
      cidade: input.cidade?.trim() || null,
      quantidade_lojas: input.quantidade_lojas ?? null,
      nome_responsavel: input.nome_responsavel.trim(),
      telefone_responsavel: input.telefone_responsavel.trim(),
      email_responsavel: input.email_responsavel?.trim().toLowerCase() || null,
      erp_utilizado: input.erp_utilizado?.trim() || null,
      descricao_necessidade: input.descricao_necessidade?.trim() || null,
      parceiro_id: input.parceiro_id,
      panel_id: input.panel_id?.trim() || "comercial",
      status: stage,
      status_lead: stage,
      origem: input.origem?.trim() || "agente_codex",
      ...(input.responsible_user_id ? { responsible_user_id: input.responsible_user_id } : {}),
    };

    const { data, error } = await supabase.from("leads").insert(payload).select("id, nome_fantasia, status_lead, panel_id").single();
    if (error) {
      if (error.message.includes("duplicate key")) return fail("Já existe um lead com esses dados (CNPJ ou e-mail duplicado).");
      return fail(error.message);
    }
    return ok({ criado: true, lead: data });
  },
});
