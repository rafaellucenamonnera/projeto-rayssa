// Polling do Jira (sem webhook): lê issues do fluxo Monnera, associa ao card e,
// fora do modo somente leitura, aplica o código Monnera. Nunca move cards.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { searchFlowIssues } from "../_shared/jira.ts";
import {
  applyCode,
  findCodeInIssue,
  gateApplication,
  loadIssueComments,
  notifyAdmins,
  resolveCard,
} from "../_shared/jiraCodeSync.ts";

const STATE_ID = "jira_polling";
const BATCH_SIZE = 10;
const LEASE_MINUTES = 10;

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

  const record = async (status: string, cardId: string | null, error: string | null, payload: unknown) => {
    try {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_sync_panel_tasks",
        p_status: status,
        p_card_id: cardId,
        p_error: error,
        p_origin: "jira_polling",
        p_payload: payload ?? {},
      });
    } catch (_) { /* auditoria não pode derrubar a execução */ }
  };

  try {
    const { data: state, error: stateErr } = await admin
      .from("jira_sync_state").select("*").eq("id", STATE_ID).maybeSingle();
    if (stateErr) throw stateErr;
    if (!state) return json({ ok: false, error: "Estado do polling não inicializado." }, 500);

    // Guarda de pausa (circuit breaker).
    if (state.paused) {
      await record("ignorado", null, "Polling pausado.", {});
      return json({ ok: true, skipped: "paused" });
    }

    // Single-flight por lease com expiração.
    const now = new Date();
    if (state.locked_until && new Date(state.locked_until) > now) {
      return json({ ok: true, skipped: "locked" });
    }
    const lockUntil = new Date(now.getTime() + LEASE_MINUTES * 60_000).toISOString();
    const { data: locked } = await admin
      .from("jira_sync_state")
      .update({ locked_until: lockUntil, last_run_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("id", STATE_ID)
      .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
      .select("id");
    if (!locked?.length) return json({ ok: true, skipped: "locked" });

    const readOnly = state.read_only !== false;
    const summary = { lidas: 0, aplicadas: 0, simuladas: 0, ignoradas: 0, ambiguidades: 0, erros: 0 };
    let cursorUpdated: string | null = state.last_issue_updated_at;
    let cursorKey: string | null = state.last_issue_key;
    let lastError: string | null = null;

    try {
      const issues = await searchFlowIssues(state.last_issue_updated_at, BATCH_SIZE);
      for (const issue of issues) {
        summary.lidas++;
        // Cursor avança mesmo quando a issue não gera ação, para permitir retomada.
        cursorUpdated = issue.updated;
        cursorKey = issue.key;

        if (issue.key === state.last_issue_key && issue.updated === state.last_issue_updated_at) continue;

        const comments = await loadIssueComments(issue.key);
        const hit = findCodeInIssue(issue, comments);
        if (!hit) {
          summary.ignoradas++;
          continue;
        }

        const resolution = await resolveCard(admin, issue);
        if (!resolution.card) {
          summary.ambiguidades++;
          await record("ambiguidade", null, resolution.reason, {
            issue_key: issue.key,
            candidatos: resolution.candidates,
            codigo: hit.code,
          });
          continue;
        }
        const card = resolution.card;

        const gate = await gateApplication(admin, card, hit.code);
        if (!gate.ok) {
          summary.ignoradas++;
          await record(gate.status, card.id, gate.reason, { issue_key: issue.key, codigo: hit.code });
          if (!readOnly && (gate.status === "divergencia" || gate.status === "duplicidade")) {
            await notifyAdmins(admin, "Código Monnera com divergência", `${gate.reason} Card: ${card.full_name}.`, card.id);
          }
          continue;
        }

        // Modo somente leitura: associação e validação ficam apenas em memória.
        if (readOnly) {
          summary.simuladas++;
          await record("simulado", card.id, null, {
            issue_key: issue.key,
            codigo: hit.code,
            origem: hit.origin,
            associado_por: resolution.matchedBy,
            gravacao: false,
          });
          continue;
        }

        // Modo geral desligado: só cards de teste recebem escrita.
        if (!card.test_mode) {
          summary.ignoradas++;
          await record("ignorado", card.id, "Modo geral desligado: apenas cards em test_mode recebem escrita.", {
            issue_key: issue.key, codigo: hit.code,
          });
          continue;
        }

        await applyCode(admin, card, hit, issue.key, "jira_polling", null);
        summary.aplicadas++;
        await record("sucesso", card.id, null, { issue_key: issue.key, codigo: hit.code, origem: hit.origin });
        await notifyAdmins(
          admin,
          "Código Monnera recebido",
          `Card ${card.full_name} recebeu o código ${hit.code} via Jira. O card não foi movido.`,
          card.id,
        );
      }
    } catch (loopError) {
      summary.erros++;
      lastError = loopError instanceof Error ? loopError.message : String(loopError);
      await record("erro", null, lastError, {});
    }

    await admin.from("jira_sync_state").update({
      last_issue_updated_at: cursorUpdated,
      last_issue_key: cursorKey,
      locked_until: null,
      last_error: lastError,
      updated_at: new Date().toISOString(),
    }).eq("id", STATE_ID);

    await admin.from("sync_job_logs").insert({
      job_name: "jira_polling",
      processed_count: summary.lidas,
      created_count: summary.aplicadas,
      updated_count: summary.simuladas,
      error_count: summary.erros,
      error_details: lastError,
    });

    return json({ ok: true, read_only: readOnly, summary, cursor: { updated: cursorUpdated, key: cursorKey } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("jira_sync_state").update({ locked_until: null, last_error: message }).eq("id", STATE_ID);
    await record("erro", null, message, {});
    return json({ ok: false, error: message }, 500);
  }
});
