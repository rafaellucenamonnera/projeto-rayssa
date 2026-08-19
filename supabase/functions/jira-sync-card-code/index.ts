// Sincronização manual do código Monnera de um único card (prévia + confirmação admin).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getIssue } from "../_shared/jira.ts";
import {
  applyCode,
  CARD_FIELDS,
  findCodeInIssue,
  gateApplication,
  loadIssueComments,
  type CardRow,
} from "../_shared/jiraCodeSync.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  let cardId: string | null = null;
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Não autenticado." }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ ok: false, error: "Sessão inválida." }, 401);
    const userId = userData.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ ok: false, error: "Ação restrita a administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    cardId = typeof body?.card_id === "string" ? body.card_id : null;
    const confirm = body?.confirm === true;
    if (!cardId) return json({ ok: false, error: "card_id é obrigatório." }, 400);

    const { data: card, error: cardErr } = await admin
      .from("representative_cards").select(CARD_FIELDS).eq("id", cardId).maybeSingle();
    if (cardErr) throw cardErr;
    if (!card) return json({ ok: false, error: "Card não encontrado." }, 404);
    const row = card as CardRow;
    if (!row.jira_issue_key) return json({ ok: false, error: "Card sem tarefa Jira vinculada." }, 400);

    const issue = await getIssue(row.jira_issue_key);
    const comments = await loadIssueComments(row.jira_issue_key);
    const hit = findCodeInIssue(issue, comments);

    if (!hit) {
      return json({
        ok: false,
        error: "Nenhum código Monnera válido encontrado na tarefa Jira.",
        preview: { issue_key: row.jira_issue_key, codigo: null },
      }, 404);
    }

    const gate = await gateApplication(admin, row, hit.code);
    const preview = {
      issue_key: row.jira_issue_key,
      codigo: hit.code,
      origem: hit.origin,
      evidencia: hit.evidence.slice(0, 500),
      codigo_atual: row.codigo_monnera,
      bloqueio: gate.ok ? null : gate.reason,
    };

    if (!confirm) return json({ ok: gate.ok, dry_run: true, preview });

    if (!gate.ok) {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_sync_card_code", p_status: gate.status, p_card_id: row.id,
        p_error: gate.reason, p_origin: "manual_jira_sync", p_payload: { issue_key: row.jira_issue_key, codigo: hit.code },
      });
      return json({ ok: false, preview, error: gate.reason }, 409);
    }

    await applyCode(admin, row, hit, row.jira_issue_key, "manual_jira_sync", userId);
    await admin.rpc("record_automation_run", {
      p_stage: "jira_sync_card_code", p_status: "sucesso", p_card_id: row.id, p_error: null,
      p_origin: "manual_jira_sync",
      p_payload: { issue_key: row.jira_issue_key, codigo: hit.code, origem: hit.origin, confirmado_por: userId },
    });

    return json({ ok: true, preview, codigo: hit.code });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_sync_card_code", p_status: "erro", p_card_id: cardId, p_error: message,
        p_origin: "manual_jira_sync", p_payload: {},
      });
    } catch (_) { /* auditoria best-effort */ }
    return json({ ok: false, error: message }, 500);
  }
});
