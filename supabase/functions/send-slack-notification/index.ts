import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isSlackBotToken = (token?: string | null) => !!token?.startsWith("xoxb-");

const buildMessage = (input: {
  appUrl: string;
  title: string;
  message: string;
  actionUrl?: string | null;
  slackUserId?: string | null;
  registrationStatus?: string | null;
}) => {
  const appUrl = trimTrailingSlash(input.appUrl || "");
  const cardPath = input.actionUrl || "/admin/painel-comercial";
  const cardUrl = `${appUrl}${cardPath.startsWith("/") ? "" : "/"}${cardPath}`;
  const onboardingUrl =
    input.registrationStatus === "pending" && input.slackUserId
      ? `${appUrl}/primeiro-acesso?slack_id=${encodeURIComponent(input.slackUserId)}`
      : null;
  const url = onboardingUrl || cardUrl;

  return {
    text: `${input.title}: ${input.message}`,
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `*${input.title}*\n${input.message}` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: onboardingUrl ? "Fazer primeiro acesso" : "Abrir card" },
            url,
          },
        ],
      },
    ],
  };
};

const postSlackMessage = async (token: string, slackUserId: string, message: any) => {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: slackUserId, ...message }),
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error || "Erro ao enviar Slack");
  return payload;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
  const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "";

  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase env ausente" }, 500);
  if (!slackToken) return json({ error: "SLACK_BOT_TOKEN ausente" }, 500);
  if (!isSlackBotToken(slackToken)) {
    return json({ error: "SLACK_BOT_TOKEN deve ser um Bot User OAuth Token iniciado por xoxb-. Tokens pessoais xoxp/xoxe nao sao aceitos." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (body?.slack_user_id) {
    try {
      const message = buildMessage({
        appUrl,
        title: body.title || "Notificacao Rayssa",
        message: body.message || "Voce recebeu uma atualizacao.",
        actionUrl: body.action_url,
        slackUserId: body.slack_user_id,
        registrationStatus: body.registration_status,
      });
      const result = await postSlackMessage(slackToken, body.slack_user_id, message);
      await supabase.from("integration_events").insert({
        provider: "slack",
        event_type: body.event_type || "direct_notification",
        entity_type: body.entity_type || "slack_user",
        entity_id: body.entity_id || body.slack_user_id,
        delivery_key: body.delivery_key || null,
        status: "sent",
        payload: body,
        response: result,
      });
      return json({ sent: true });
    } catch (error: any) {
      await supabase.from("integration_events").insert({
        provider: "slack",
        event_type: body.event_type || "direct_notification",
        entity_type: body.entity_type || "slack_user",
        entity_id: body.entity_id || body.slack_user_id,
        delivery_key: body.delivery_key || null,
        status: "failed",
        payload: body,
        error: error.message,
      });
      return json({ error: error.message }, 400);
    }
  }

  const notificationId = body?.notification_id as string | undefined;
  let query = supabase
    .from("notification_deliveries")
    .select("id, notification_id, notifications(*)")
    .eq("channel", "slack")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(notificationId ? 1 : 20);

  if (notificationId) query = query.eq("notification_id", notificationId);

  const { data: deliveries, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const results = [];
  for (const delivery of deliveries || []) {
    const notification = (delivery as any).notifications;
    const { data: profile } = await supabase
      .from("profiles")
      .select("slack_user_id,registration_status")
      .eq("user_id", notification.recipient_user_id)
      .maybeSingle();

    if (!profile?.slack_user_id) {
      await supabase
        .from("notification_deliveries")
        .update({ status: "skipped", error: "Usuario sem slack_user_id" })
        .eq("id", delivery.id);
      results.push({ delivery_id: delivery.id, status: "skipped" });
      continue;
    }

    try {
      const message = buildMessage({
        appUrl,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.action_url,
        slackUserId: profile.slack_user_id,
        registrationStatus: profile.registration_status,
      });
      const result = await postSlackMessage(slackToken, profile.slack_user_id, message);
      await supabase
        .from("notification_deliveries")
        .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
        .eq("id", delivery.id);
      await supabase.from("integration_events").insert({
        provider: "slack",
        event_type: notification.type,
        entity_type: "notification",
        entity_id: notification.id,
        delivery_key: delivery.delivery_key,
        status: "sent",
        response: result,
      });
      results.push({ delivery_id: delivery.id, status: "sent" });
    } catch (error: any) {
      await supabase
        .from("notification_deliveries")
        .update({ status: "failed", error: error.message.slice(0, 1000) })
        .eq("id", delivery.id);
      results.push({ delivery_id: delivery.id, status: "failed" });
    }
  }

  return json({ processed: results.length, results });
});
