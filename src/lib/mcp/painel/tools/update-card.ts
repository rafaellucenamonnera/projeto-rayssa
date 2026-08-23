import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  CARD_FIELDS,
  CARD_NOT_FOUND,
  PANEL_ID,
  UNAUTH,
  authUser,
  client,
  digitsOnly,
  failure,
  guard,
  loadCard,
  success,
  logHistory,
} from "../shared";

export default defineTool({
  name: "update_card",
  title: "Atualizar campos do card",
  description:
    "Atualiza campos de um card do painel painel_msj9fyji. Envie apenas os campos que devem mudar. Para trocar de etapa use move_card.",
  inputSchema: {
    card_id: z.string().describe("UUID do card."),
    razao_social: z.string().optional(),
    cnpj: z.string().optional(),
    nome_contato_parceiro: z.string().optional(),
    telefone_parceiro: z.string().optional(),
    email_parceiro: z.string().optional(),
    contratante: z.string().optional(),
    responsavel: z.string().optional().describe("UUID do responsável."),
    codigo_monnera: z.string().optional(),
    jira_issue_key: z.string().optional(),
    jira_url: z.string().optional().describe("URL da issue Jira (registrada no histórico como evidência)."),
    observacao: z.string().optional().describe("Anotações do card (até 500 caracteres)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) =>
    guard("update_card", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const card = await loadCard(supabase, input.card_id, "id, stage_id");
      if (!card) return CARD_NOT_FOUND(input.card_id);

      if ((input.observacao?.length ?? 0) > 500)
        return failure("INVALID_INPUT", "observacao deve ter no máximo 500 caracteres.");

      const updates: Record<string, unknown> = {};
      if (input.razao_social !== undefined) updates.full_name = input.razao_social.trim();
      if (input.nome_contato_parceiro !== undefined)
        updates.focal_name = input.nome_contato_parceiro.trim() || null;
      if (input.telefone_parceiro !== undefined) {
        updates.focal_phone = input.telefone_parceiro.trim() || null;
        updates.phone = input.telefone_parceiro.trim() || "";
      }
      if (input.email_parceiro !== undefined) {
        const email = input.email_parceiro.trim().toLowerCase();
        updates.focal_email = email || null;
        updates.email = email;
      }
      if (input.contratante !== undefined) updates.contratante_monnera = input.contratante.trim() || null;
      if (input.responsavel !== undefined) updates.responsible_user_id = input.responsavel.trim() || null;
      if (input.codigo_monnera !== undefined) updates.codigo_monnera = input.codigo_monnera.trim() || null;
      if (input.jira_issue_key !== undefined) updates.jira_issue_key = input.jira_issue_key.trim() || null;
      if (input.observacao !== undefined) updates.notes = input.observacao.trim() || null;

      if (input.cnpj !== undefined) {
        const cnpj = digitsOnly(input.cnpj);
        if (cnpj.length !== 14) return failure("INVALID_CNPJ", "CNPJ inválido: são necessários 14 dígitos.", { cnpj });
        updates.cnpj = cnpj;
      }

      if (Object.keys(updates).length === 0 && !input.jira_url)
        return failure("INVALID_INPUT", "Nenhum campo informado para atualização.");

      let data: Record<string, unknown> | null = null;
      if (Object.keys(updates).length > 0) {
        const result = await supabase
          .from("representative_cards")
          .update(updates)
          .eq("id", input.card_id)
          .eq("panel_id", PANEL_ID)
          .select(CARD_FIELDS)
          .maybeSingle();
        if (result.error) return failure("UPDATE_FAILED", result.error.message);
        if (!result.data) return CARD_NOT_FOUND(input.card_id);
        data = result.data as Record<string, unknown>;
      } else {
        data = await loadCard(supabase, input.card_id);
      }

      await logHistory(supabase, {
        cardId: input.card_id,
        userId,
        action: "card_atualizado",
        payload: { ferramenta: "update_card", campos: Object.keys(updates), jira_url: input.jira_url ?? null },
      });

      return success("update_card", data, { card_id: input.card_id, updated_fields: Object.keys(updates) });
    }),
});
