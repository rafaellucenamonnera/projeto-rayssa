import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "obter_lead",
  title: "Detalhe do lead",
  description: "Retorna o card completo de um lead, com comentários e tarefas.",
  inputSchema: { lead_id: z.string().describe("UUID do lead.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ lead_id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", lead_id).maybeSingle();
    if (error) return fail(error.message);
    if (!lead) return fail("Lead não encontrado ou sem permissão de acesso.");

    const [comentarios, tarefas] = await Promise.all([
      supabase
        .from("lead_comments")
        .select("id, etapa, usuario, comentario, data_comentario")
        .eq("lead_id", lead_id)
        .order("data_comentario", { ascending: false })
        .limit(50),
      supabase
        .from("lead_tasks")
        .select("id, titulo, status, due_at, due_date, assigned_to, completed_at")
        .eq("lead_id", lead_id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    return ok({ lead, comentarios: comentarios.data ?? [], tarefas: tarefas.data ?? [] });
  },
});
