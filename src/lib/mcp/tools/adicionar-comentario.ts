import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "adicionar_comentario",
  title: "Adicionar comentário no card",
  description: "Registra um comentário no card de lead, na etapa atual do card.",
  inputSchema: {
    lead_id: z.string().describe("UUID do lead."),
    comentario: z.string().describe("Texto do comentário."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, comentario }, ctx) => {
    const userId = requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const texto = comentario.trim();
    if (!texto) return fail("O comentário não pode ficar vazio.");

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, status_lead")
      .eq("id", lead_id)
      .maybeSingle();
    if (leadError) return fail(leadError.message);
    if (!lead) return fail("Lead não encontrado ou sem permissão de acesso.");

    const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", userId).maybeSingle();

    const { data, error } = await supabase
      .from("lead_comments")
      .insert({
        lead_id,
        etapa: lead.status_lead,
        usuario: profile?.nome ?? ctx.getUserEmail() ?? "Agente",
        user_id: userId,
        comentario: texto,
      })
      .select("id, data_comentario")
      .single();

    if (error) return fail(error.message);
    return ok({ criado: true, comentario: data });
  },
});
