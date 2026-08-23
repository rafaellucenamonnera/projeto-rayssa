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
  logHistory,
  stageLabels,
  success,
} from "../shared";

export default defineTool({
  name: "create_card",
  title: "Criar card no painel",
  description:
    "Cria um card no painel painel_msj9fyji com os dados enviados pelo agente. Não dispara automações, e-mails nem integrações.",
  inputSchema: {
    razao_social: z.string().describe("Razão social / nome do parceiro."),
    cnpj: z.string().describe("CNPJ com ou sem máscara (14 dígitos)."),
    nome_contato_parceiro: z.string().optional().describe("Nome do contato focal."),
    telefone_parceiro: z.string().optional(),
    email_parceiro: z.string().optional(),
    contratante: z.string().optional().describe("Contratante Monnera."),
    responsavel: z.string().optional().describe("UUID do usuário responsável."),
    codigo_monnera: z.string().optional(),
    jira_issue_key: z.string().optional(),
    stage_id: z.string().optional().describe("Etapa inicial (stage_id ou rótulo). Padrão: primeira etapa do painel."),
    observacao: z.string().optional().describe("Anotações do card (até 500 caracteres)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) =>
    guard("create_card", async () => {
      const userId = authUser(ctx);
      if (!userId) return UNAUTH();
      const supabase = client(ctx);

      const nome = input.razao_social.trim();
      if (!nome) return failure("INVALID_INPUT", "razao_social é obrigatório.");
      const cnpj = digitsOnly(input.cnpj);
      if (cnpj.length !== 14) return failure("INVALID_CNPJ", "CNPJ inválido: são necessários 14 dígitos.", { cnpj });
      if ((input.observacao?.length ?? 0) > 500)
        return failure("INVALID_INPUT", "observacao deve ter no máximo 500 caracteres.");

      const stages = await stageLabels(supabase);
      let stageId = stages[0]?.value;
      if (input.stage_id) {
        const alvo = input.stage_id.trim().toLowerCase();
        const stage = stages.find(
          (s) => s.value.toLowerCase() === alvo || (s.label ?? "").toLowerCase() === alvo,
        );
        if (!stage)
          return failure("STAGE_NOT_FOUND", `Etapa "${input.stage_id}" não existe neste painel.`, {
            stages: stages.map((s) => ({ stage_id: s.value, label: s.label })),
          });
        stageId = stage.value;
      }
      if (!stageId) return failure("STAGE_NOT_FOUND", "O painel não possui etapas configuradas.");

      const email = input.email_parceiro?.trim().toLowerCase() || null;
      const phone = input.telefone_parceiro?.trim() || null;

      const { data, error } = await supabase
        .from("representative_cards")
        .insert({
          panel_id: PANEL_ID,
          stage_id: stageId,
          full_name: nome,
          cnpj,
          focal_name: input.nome_contato_parceiro?.trim() || null,
          focal_phone: phone,
          focal_email: email,
          phone: phone ?? "",
          email: email ?? "",
          contratante_monnera: input.contratante?.trim() || null,
          responsible_user_id: input.responsavel?.trim() || null,
          codigo_monnera: input.codigo_monnera?.trim() || null,
          jira_issue_key: input.jira_issue_key?.trim() || null,
          notes: input.observacao?.trim() || null,
          created_by_user_id: userId,
          source: "mcp",
        })
        .select(CARD_FIELDS)
        .single();

      if (error) return failure("CREATE_FAILED", error.message, { cnpj });

      await logHistory(supabase, {
        cardId: data.id,
        userId,
        action: "card_criado",
        destinationStageId: stageId,
        payload: { ferramenta: "create_card", cnpj },
      });

      return success("create_card", data, { card_id: data.id });
    }),
});
