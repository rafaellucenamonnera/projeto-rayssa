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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  // APP_URL must be configured server-side to prevent attacker-controlled origin
  // headers from poisoning notification email links.
  const appUrl = Deno.env.get("APP_URL") || "";
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL") || "Rayssa <notificacoes@monnera.com.br>";

  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase env ausente" }, 500);
  if (!resendApiKey) return json({ error: "RESEND_API_KEY ausente" }, 500);

  // AuthZ: aceita service role (cron/edge interno) OU admin/gestor autenticado.
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  let authorized = bearer && bearer === serviceRoleKey;
  if (!authorized && bearer) {
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: claims } = await userClient.auth.getClaims(bearer);
    const uid = claims?.claims?.sub;
    if (uid) {
      const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", uid);
      authorized = !!roles?.some((r: any) => r.role === "admin" || r.role === "gestor_conta");
    }
  }
  if (!authorized) return json({ error: "Unauthorized" }, 401);


  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const notificationId = body?.notification_id as string | undefined;

  let query = supabase
    .from("notification_deliveries")
    .select("id, notification_id, notifications(*)")
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(notificationId ? 1 : 20);

  if (notificationId) query = query.eq("notification_id", notificationId);

  const { data: deliveries, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const results = [];

  for (const delivery of deliveries || []) {
    const notification = (delivery as any).notifications;
    if (!notification?.recipient_user_id) continue;

    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(notification.recipient_user_id);
    const recipientEmail = authUser?.user?.email;

    if (userError || !recipientEmail) {
      await supabase
        .from("notification_deliveries")
        .update({ status: "failed", error: userError?.message || "E-mail do usuario nao encontrado" })
        .eq("id", delivery.id);
      results.push({ delivery_id: delivery.id, status: "failed" });
      continue;
    }

    const actionUrl = notification.action_url
      ? `${appUrl}${notification.action_url.startsWith("/") ? "" : "/"}${notification.action_url}`
      : appUrl;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#12352e">
        <h2 style="margin:0 0 12px">${notification.title}</h2>
        <p style="margin:0 0 16px">${notification.message}</p>
        <a href="${actionUrl}" style="display:inline-block;background:#0f6b57;color:#fff;text-decoration:none;padding:10px 14px;border-radius:6px">
          Abrir card
        </a>
        <p style="font-size:12px;color:#6b7280;margin-top:18px">Notificacao automatica do Rayssa/Monnera.</p>
      </div>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipientEmail,
        subject: notification.title,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const details = await emailResponse.text();
      await supabase
        .from("notification_deliveries")
        .update({ status: "failed", error: details.slice(0, 1000) })
        .eq("id", delivery.id);
      results.push({ delivery_id: delivery.id, status: "failed" });
      continue;
    }

    await supabase
      .from("notification_deliveries")
      .update({ status: "sent", sent_at: new Date().toISOString(), error: null })
      .eq("id", delivery.id);
    results.push({ delivery_id: delivery.id, status: "sent" });
  }

  return json({ processed: results.length, results });
});
