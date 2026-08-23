import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CARD_FIELDS,
  PANEL_ID,
  UNAUTH,
  authUser,
  client,
  digitsOnly,
  guard,
  stageLabels,
  success,
} from "../shared";

export default defineTool({
  name: "list_cards",
  title: "Listar cards do painel",
  description:
    "Lista e pesquisa cards do painel painel_msj9fyji por nome, CNPJ, e-mail ou etapa, com paginação. Somente leitura.",
  inputSchema: {
    query: z.string().optional().describe("Texto livre: razão social, contato, e-mail, CNPJ ou contratante."),
    nome: z.string().optional().describe("Pesquisa por nome/razão social do parceiro."),
    email: z.string().optional().describe("Pesquisa por e-mail (focal ou vendedor)."),
    cnpj: z.string().optional().describe("Pesquisa por CNPJ (com ou sem máscara)."),
    stage_id: z.string().optional().describe("Filtra por etapa (stage_id ou rótulo exato)."),
    limit: z.number().int().optional().describe("Registros por página (padrão 25, máximo 200)."),
    offset: z.number().int().optional().describe("Deslocamento para paginação (padrão 0)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) =>
    guard("list_cards", async () => {
      if (!authUser(ctx)) return UNAUTH();
      const supabase = client(ctx);

      const take = Math.min(Math.max(input.limit ?? 25, 1), 200);
      const skip = Math.max(input.offset ?? 0, 0);

      let query = supabase
        .from("representative_cards")
        .select(CARD_FIELDS, { count: "exact" })
        .eq("panel_id", PANEL_ID)
        .order("created_at", { ascending: false })
        .range(skip, skip + take - 1);

      const stages = await stageLabels(supabase);
      if (input.stage_id) {
        const alvo = input.stage_id.trim().toLowerCase();
        const stage = stages.find(
          (s) => s.value.toLowerCase() === alvo || (s.label ?? "").toLowerCase() === alvo,
        );
        query = query.eq("stage_id", stage?.value ?? input.stage_id.trim());
      }
      if (input.nome?.trim()) query = query.ilike("full_name", `%${input.nome.trim()}%`);
      if (input.email?.trim()) {
        const like = `%${input.email.trim()}%`;
        query = query.or(`focal_email.ilike.${like},email.ilike.${like},vendor_email.ilike.${like}`);
      }
      const cnpjDigits = digitsOnly(input.cnpj);
      if (cnpjDigits) query = query.ilike("cnpj", `%${cnpjDigits}%`);

      if (input.query?.trim()) {
        const termo = input.query.trim().replace(/[,()]/g, " ");
        const like = `%${termo}%`;
        const filtros = [
          `full_name.ilike.${like}`,
          `focal_name.ilike.${like}`,
          `focal_email.ilike.${like}`,
          `email.ilike.${like}`,
          `contratante_monnera.ilike.${like}`,
          `vendor_name.ilike.${like}`,
          `vendor_email.ilike.${like}`,
        ];
        const digits = digitsOnly(termo);
        if (digits) filtros.push(`cnpj.ilike.%${digits}%`);
        query = query.or(filtros.join(","));
      }

      const { data, error, count } = await query;
      if (error) return { content: [], isError: true, ...JSON.parse("{}") } && (await Promise.resolve(
        (await import("../shared")).failure("QUERY_FAILED", error.message)
      ));

      const labels = new Map(stages.map((s) => [s.value, s.label]));
      const cards = (data ?? []).map((c: Record<string, unknown>) => ({
        ...c,
        card_id: c.id,
        stage_label: labels.get(String(c.stage_id)) ?? c.stage_id,
      }));

      const total = count ?? cards.length;
      return success("list_cards", cards, {
        total,
        limit: take,
        offset: skip,
        returned: cards.length,
        has_more: skip + cards.length < total,
        next_offset: skip + cards.length < total ? skip + cards.length : null,
      });
    }),
});
