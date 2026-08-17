import { supabase } from "@/integrations/supabase/client";
import { createNotifications } from "@/lib/notifications";

/**
 * Trilha operacional e notificações do painel Onb Clientes Cross.
 * Toda ação relevante do card é registrada em representative_card_history
 * (imutável) e pode gerar notificação estruturada para o time interno.
 */

export type CrossCardAction =
  | "card_created"
  | "card_updated"
  | "stage_changed"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_deleted"
  | "attachment_added"
  | "attachment_removed"
  | "block_created"
  | "block_resolved"
  | "note_updated"
  | "notification_created"
  | "notification_read"
  | "whatsapp_triage_reviewed";


export const crossCardActionUrl = (panelId: string, cardId: string) =>
  `/admin/painel-comercial?panel=${panelId}&card=${cardId}`;

export const logCardEvent = async (
  cardId: string,
  action: CrossCardAction,
  payload: Record<string, unknown> = {},
  sourceStageId?: string | null,
  destinationStageId?: string | null,
) => {
  try {
    const { error } = await (supabase as any).rpc("log_representative_card_event", {
      p_card_id: cardId,
      p_action: action,
      p_payload: payload,
      p_source_stage_id: sourceStageId ?? null,
      p_destination_stage_id: destinationStageId ?? null,
    });
    if (error) throw error;
  } catch (error) {
    // O histórico nunca deve bloquear a operação principal do usuário.
    console.error("Erro ao registrar histórico do card:", error);
  }
};

/**
 * Destinatários internos resolvidos por perfil/permissão (sem IDs fixos):
 * administradores + usuários com acesso liberado ao painel.
 */
export const resolveCrossRecipients = async (panelId: string): Promise<string[]> => {
  const [{ data: profiles }, { data: panelUsers }, { data: roles }] = await Promise.all([
    supabase.from("profiles").select("user_id,ativo").eq("ativo", true),
    (supabase as any)
      .from("user_panel_permissions")
      .select("user_id,can_access")
      .eq("panel_id", panelId)
      .eq("can_access", true),
    (supabase as any).from("user_roles").select("user_id,role").eq("role", "admin"),
  ]);

  const allowed = new Set<string>(((panelUsers as any[]) || []).map((r) => r.user_id));
  ((roles as any[]) || []).forEach((r) => allowed.add(r.user_id));

  return ((profiles as any[]) || [])
    .map((p) => p.user_id as string)
    .filter((userId) => allowed.has(userId));
};

export type CrossNotificationInput = {
  cardId: string;
  panelId: string;
  type: string;
  title: string;
  cliente?: string | null;
  cnpj?: string | null;
  etapa?: string | null;
  motivo?: string | null;
  evidencia?: string | null;
  acaoRealizada?: string | null;
  decisaoNecessaria?: string | null;
  proximoPasso?: string | null;
  actionUrl?: string | null;
  deliveryKey?: string;
  extraRecipients?: string[];
};

const line = (label: string, value?: string | null) => (value ? `${label}: ${value}` : null);

export const buildCrossMessage = (input: CrossNotificationInput) =>
  [
    line("Cliente", input.cliente),
    line("CNPJ", input.cnpj),
    line("Etapa", input.etapa),
    line("Motivo", input.motivo),
    line("Evidência", input.evidencia),
    line("Ação realizada", input.acaoRealizada),
    line("Decisão necessária", input.decisaoNecessaria),
    line("Próximo passo", input.proximoPasso),
  ]
    .filter(Boolean)
    .join("\n");

export const notifyCrossCard = async (input: CrossNotificationInput) => {
  const recipients = new Set(await resolveCrossRecipients(input.panelId));
  (input.extraRecipients || []).forEach((id) => id && recipients.add(id));

  if (recipients.size === 0) return [];

  const message = buildCrossMessage(input);
  const actionUrl = input.actionUrl || crossCardActionUrl(input.panelId, input.cardId);

  const created = await createNotifications(
    Array.from(recipients).map((recipientUserId) => ({
      recipientUserId,
      type: input.type,
      title: input.title,
      message,
      actionUrl,
      representativeCardId: input.cardId,
      metadata: {
        representative_card_id: input.cardId,
        cliente: input.cliente ?? null,
        cnpj: input.cnpj ?? null,
        etapa: input.etapa ?? null,
        motivo: input.motivo ?? null,
        evidencia: input.evidencia ?? null,
        acao_realizada: input.acaoRealizada ?? null,
        decisao_necessaria: input.decisaoNecessaria ?? null,
        proximo_passo: input.proximoPasso ?? null,
      },
      deliveryKey: input.deliveryKey
        ? `${input.deliveryKey}-${recipientUserId}`
        : `${input.type}-${input.cardId}-${recipientUserId}`,
    })),
  );

  await logCardEvent(input.cardId, "notification_created", {
    tipo: input.type,
    titulo: input.title,
    destinatarios: recipients.size,
  });

  return created;
};
