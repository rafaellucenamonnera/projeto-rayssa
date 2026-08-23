import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CARD_FIELDS,
  PANEL_ID,
  UNAUTH,
  authUser,
  client,
  digitsOnly,
  failure,
  guard,
  stageLabels,
  success,
} from "../shared";

export default defineTool({
  name: "find_cards_by_cnpj",
  title: "Pesquisar cards por CNPJ",
  description:
    "Consulta cards do painel painel_msj9fyji por CNPJ (aceita com ou sem máscara, normaliza para 14 dígitos) e retorna todos os encontrados. Não decide duplicidade nem altera dados.",
  inputSchema: {
    cnpj: z.string().describe("CNPJ com ou sem máscara."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ cnpj }, ctx) =>
    guard("find_cards_by_cnpj", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const digits = digitsOnly(cnpj);
      if (digits.length !== 14) {
        return failure("INVALID_CNPJ", "CNPJ inválido: são necessários 14 dígitos.", {
          received: cnpj,
          normalized: digits,
        });
      }

      const supabase = client(ctx);
      const { data, error } = await supabase
        .from("representative_cards")
        .select(CARD_FIELDS)
        .eq("panel_id", PANEL_ID)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) return failure("QUERY_FAILED", error.message);

      const stages = await stageLabels(supabase);
      const labels = new Map(stages.map((s) => [s.value, s.label]));

      const cards = (data ?? [])
        .filter((c: Record<string, unknown>) => digitsOnly(String(c.cnpj ?? "")) === digits)
        .map((c: Record<string, unknown>) => ({
          ...c,
          card_id: c.id,
          stage_label: labels.get(String(c.stage_id)) ?? c.stage_id,
        }));

      return success("find_cards_by_cnpj", cards, { cnpj: digits, matches: cards.length });
    }),
});
