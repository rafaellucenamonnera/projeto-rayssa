import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { CROSS_PANEL_ID, fail, ok, requireAuth } from "../helpers";

const BUCKET = "representative-card-attachments";

export default defineTool({
  name: "listar_anexos_cliente_cross",
  title: "Listar anexos do cliente Onb Clientes Cross",
  description: "Lista os anexos de um card do painel Onb Clientes Cross, com link temporário para download.",
  inputSchema: {
    card_id: z.string().describe("UUID do card do cliente."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ card_id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);

    const { data: card } = await supabase
      .from("representative_cards")
      .select("id")
      .eq("id", card_id)
      .eq("panel_id", CROSS_PANEL_ID)
      .maybeSingle();
    if (!card) return fail("Card não encontrado no painel Onb Clientes Cross ou sem permissão de acesso.");

    const { data, error } = await supabase
      .from("representative_card_attachments")
      .select("id, file_name, mime_type, size_bytes, storage_path, content_sha256, created_at")
      .eq("representative_card_id", card_id)
      .order("created_at", { ascending: false });
    if (error) return fail(error.message);

    const anexos = await Promise.all(
      (data ?? []).map(async (a) => {
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(a.storage_path, 60 * 10);
        return {
          id: a.id,
          file_name: a.file_name,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
          created_at: a.created_at,
          hash_sha256: a.content_sha256,
          url: signed?.signedUrl ?? null,
        };
      }),
    );

    return ok({ total: anexos.length, anexos });
  },
});
