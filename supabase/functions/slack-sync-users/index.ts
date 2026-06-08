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

const isSlackBotToken = (token?: string | null) => !!token?.startsWith("xoxb-");

const requireAdmin = async (supabase: any, req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Nao autorizado");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error("Nao autorizado");

  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  const roleNames = (roles || []).map((role: any) => role.role);
  if (!roleNames.includes("admin")) throw new Error("Acesso negado");
  return user;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const slackToken = Deno.env.get("SLACK_BOT_TOKEN");
  const workspaceId = Deno.env.get("SLACK_WORKSPACE_ID") || null;

  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase env ausente" }, 500);
  if (!slackToken) return json({ error: "SLACK_BOT_TOKEN ausente" }, 500);
  if (!isSlackBotToken(slackToken)) {
    return json({ error: "SLACK_BOT_TOKEN deve ser um Bot User OAuth Token iniciado por xoxb-. Tokens pessoais xoxp/xoxe nao sao aceitos." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await requireAdmin(supabase, req);

    let cursor = "";
    let total = 0;
    let active = 0;
    const syncedAt = new Date().toISOString();
    const authUsersByEmail = new Map<string, string>();
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const user of data.users || []) {
        if (user.email) authUsersByEmail.set(user.email.toLowerCase(), user.id);
      }
      if (!data.users || data.users.length < 1000) break;
      page += 1;
    }

    do {
      const url = new URL("https://slack.com/api/users.list");
      url.searchParams.set("limit", "200");
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${slackToken}` },
      });
      const payload = await response.json();
      if (!payload.ok) throw new Error(payload.error || "Erro ao consultar Slack");

      const members = (payload.members || []).filter((member: any) => !member.is_bot && member.id !== "USLACKBOT");
      total += members.length;

      for (const member of members) {
        const email = member.profile?.email ? String(member.profile.email).toLowerCase() : null;
        const authUserId = email ? authUsersByEmail.get(email) : null;
        const { data: profile } = authUserId
          ? await supabase.from("profiles").select("user_id").eq("user_id", authUserId).maybeSingle()
          : { data: null };
        const profileUserId = profile?.user_id || null;
        const registrationStatus = profileUserId ? "active" : "pending";
        if (!member.deleted) active += 1;

        await supabase.from("slack_users").upsert({
          slack_user_id: member.id,
          team_id: member.team_id || workspaceId,
          name: member.name || member.real_name || member.id,
          real_name: member.real_name || member.profile?.real_name || null,
          email,
          avatar_url: member.profile?.image_72 || member.profile?.image_48 || null,
          is_active: !member.deleted,
          profile_user_id: profileUserId,
          registration_status: registrationStatus,
          last_synced_at: syncedAt,
          updated_at: syncedAt,
        }, { onConflict: "slack_user_id" });

        if (profileUserId) {
          await supabase
            .from("profiles")
            .update({
              email,
              slack_user_id: member.id,
              slack_username: member.name || null,
              registration_status: "active",
            })
            .eq("user_id", profileUserId);
        }
      }

      cursor = payload.response_metadata?.next_cursor || "";
    } while (cursor);

    await supabase.from("integration_events").insert({
      provider: "slack",
      event_type: "sync_users",
      entity_type: "workspace",
      entity_id: workspaceId || "default",
      status: "sent",
      response: { total, active, synced_at: syncedAt },
    });

    return json({ total, active, synced_at: syncedAt });
  } catch (error: any) {
    await supabase.from("integration_events").insert({
      provider: "slack",
      event_type: "sync_users",
      entity_type: "workspace",
      entity_id: workspaceId || "default",
      status: "failed",
      error: error.message,
    });
    return json({ error: error.message }, error.message === "Acesso negado" ? 403 : 400);
  }
});
