import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { fail, ok, requireAuth } from "../helpers";

export default defineTool({
  name: "listar_responsaveis",
  title: "Listar responsáveis disponíveis",
  description: "Lista os usuários que podem ser responsáveis por um card (para preencher responsible_user_id).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.rpc("get_available_responsible_users");
    if (error) return fail(error.message);
    return ok(data ?? []);
  },
});
