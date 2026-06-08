import { supabase } from "@/integrations/supabase/client";

export type NotificationPayload = {
  recipientUserId: string;
  type: string;
  title: string;
  message: string;
  leadId?: string | null;
  taskId?: string | null;
  commentId?: string | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  deliveryKey?: string;
};

export const cardActionUrl = (leadId: string) => `/admin/painel-comercial?card=${leadId}`;

export const createNotification = async (payload: NotificationPayload) => {
  const { data, error } = await (supabase as any).rpc("create_notification", {
    p_recipient_user_id: payload.recipientUserId,
    p_type: payload.type,
    p_title: payload.title,
    p_message: payload.message,
    p_lead_id: payload.leadId || null,
    p_task_id: payload.taskId || null,
    p_comment_id: payload.commentId || null,
    p_action_url: payload.actionUrl || (payload.leadId ? cardActionUrl(payload.leadId) : null),
    p_metadata: payload.metadata || {},
    p_delivery_key: payload.deliveryKey || payload.type,
  });

  if (error) throw error;
  if (data) {
    void supabase.functions.invoke("send-notification-email", {
      body: { notification_id: data },
    });
    void supabase.functions.invoke("send-slack-notification", {
      body: { notification_id: data },
    });
  }
  return data as string | null;
};

export const createNotifications = async (payloads: NotificationPayload[]) => {
  const unique = new Map<string, NotificationPayload>();
  payloads.forEach((payload) => {
    if (!payload.recipientUserId) return;
    const key = `${payload.recipientUserId}:${payload.type}:${payload.leadId || ""}:${payload.taskId || ""}:${payload.commentId || ""}`;
    unique.set(key, payload);
  });

  const created: string[] = [];
  for (const payload of unique.values()) {
    try {
      const id = await createNotification(payload);
      if (id) created.push(id);
    } catch (error) {
      console.error("Erro ao criar notificacao:", error);
    }
  }
  return created;
};
