import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_embaixadores",
  title: "Listar Embaixadores Monnera",
  description: "Lista os Embaixadores Monnera ativos e aprovados, com id e código, para vincular a novos leads.",
  inputSchema: {
    busca: z.string().optional().describe("Filtra por nome, e-mail ou código do embaixador."),
    limite: z.number().int().optional().describe("Quantidade de registros (padrão 50, máximo 200)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const take = Math.min(Math.max(limite ?? 50, 1), 200);
    let query = supabase
      .from("parceiros_comerciais")
      .select("id, codigo_parceiro, nome, email, slug_consultor, ativo, aprovado")
      .eq("ativo", true)
      .eq("aprovado", true)
      .order("nome")
      .limit(take);

    if (busca?.trim()) {
      const term = busca.trim().replace(/[%,()]/g, " ");
      query = query.or(
        [`nome.ilike.%${term}%`, `email.ilike.%${term}%`, `codigo_parceiro.ilike.%${term}%`].join(","),
      );
    }

    const { data, error } = await query;
    if (error) return fail(error.message);
    return ok(data ?? []);
  },
});
