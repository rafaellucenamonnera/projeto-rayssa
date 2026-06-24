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
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase env ausente" }, 500);

  // AuthZ: aceita service role (cron) OU admin/gestor autenticado.
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


  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const created: string[] = [];

  const { data: tasks, error } = await supabase
    .from("lead_tasks")
    .select("id,lead_id,titulo,due_at,assigned_to,reminder_48h_sent_at,reminder_24h_sent_at,leads(nome_fantasia)")
    .eq("status", "pendente")
    .not("due_at", "is", null)
    .not("assigned_to", "is", null)
    .lte("due_at", in48h.toISOString())
    .gte("due_at", now.toISOString())
    .limit(200);

  if (error) return json({ error: error.message }, 500);

  for (const task of tasks || []) {
    const dueAt = new Date((task as any).due_at);
    const hoursLeft = (dueAt.getTime() - now.getTime()) / (60 * 60 * 1000);
    const leadName = (task as any).leads?.nome_fantasia || "Card";
    const actionUrl = `/admin/painel-comercial?card=${(task as any).lead_id}`;

    if (hoursLeft <= 24 && !(task as any).reminder_24h_sent_at) {
      const { data: notificationId } = await supabase.rpc("create_notification", {
        p_recipient_user_id: (task as any).assigned_to,
        p_type: "task_deadline_24h",
        p_title: "Tarefa vence em ate 24h",
        p_message: `A tarefa "${(task as any).titulo}" do card ${leadName} vence em ${dueAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        p_lead_id: (task as any).lead_id,
        p_task_id: (task as any).id,
        p_action_url: actionUrl,
        p_metadata: { reminder: "24h" },
        p_delivery_key: `task-${(task as any).id}-24h`,
      });
      await supabase.from("lead_tasks").update({ reminder_24h_sent_at: now.toISOString() }).eq("id", (task as any).id);
      if (notificationId) created.push(notificationId);
      continue;
    }

    if (hoursLeft <= 48 && !(task as any).reminder_48h_sent_at) {
      const { data: notificationId } = await supabase.rpc("create_notification", {
        p_recipient_user_id: (task as any).assigned_to,
        p_type: "task_deadline_48h",
        p_title: "Tarefa vence em ate 48h",
        p_message: `A tarefa "${(task as any).titulo}" do card ${leadName} vence em ${dueAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`,
        p_lead_id: (task as any).lead_id,
        p_task_id: (task as any).id,
        p_action_url: actionUrl,
        p_metadata: { reminder: "48h" },
        p_delivery_key: `task-${(task as any).id}-48h`,
      });
      await supabase.from("lead_tasks").update({ reminder_48h_sent_at: now.toISOString() }).eq("id", (task as any).id);
      if (notificationId) created.push(notificationId);
    }
  }

  return json({ created: created.length, notification_ids: created });
});
