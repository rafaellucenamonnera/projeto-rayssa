import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "criar_tarefa",
  title: "Criar tarefa no card",
  description: "Cria uma tarefa vinculada a um card de lead, com prazo e responsável.",
  inputSchema: {
    lead_id: z.string().describe("UUID do lead."),
    titulo: z.string().describe("Título da tarefa."),
    due_at: z.string().describe("Prazo em ISO 8601, ex.: 2026-08-20T14:00:00Z."),
    assigned_to: z.string().optional().describe("UUID do usuário responsável (padrão: usuário autenticado)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ lead_id, titulo, due_at, assigned_to }, ctx) => {
    const userId = requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const prazo = new Date(due_at);
    if (Number.isNaN(prazo.getTime())) return fail("Prazo inválido. Use o formato ISO 8601.");

    const { data, error } = await supabase
      .from("lead_tasks")
      .insert({
        lead_id,
        titulo: titulo.trim(),
        due_at: prazo.toISOString(),
        due_date: prazo.toISOString().slice(0, 10),
        status: "pendente",
        assigned_to: assigned_to ?? userId,
        created_by: userId,
      })
      .select("id, titulo, due_at, status")
      .single();

    if (error) return fail(error.message);
    return ok({ criada: true, tarefa: data });
  },
});
