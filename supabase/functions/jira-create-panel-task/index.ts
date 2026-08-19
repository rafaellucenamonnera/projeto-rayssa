import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CROSS_PANEL_ID = "painel_msj9fyji";
const CRIACAO_PAINEL_LABEL = "criacao painel";

function normalizeLabel(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

const JIRA_PROJECT_ID = "10038";
const JIRA_ISSUE_TYPE_ID = "10042";
const JIRA_FLOW_LABEL = "monnera-onboarding";
// Cards protegidos: nunca recebem tarefa automática (reforço em código; a regra permanente é no banco).
const PROTECTED_CARD_NAMES = ["ORCA LOGÍSTICA", "ORCA LOGISTICA"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Configuração ausente: ${name}`);
  return value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let cardId: string | null = null;
  try {
    // 1. Autenticação e autorização (somente admin).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado." }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);
    const userId = userData.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Ação restrita a administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    cardId = typeof body?.card_id === "string" ? body.card_id : null;
    const dryRun = body?.dry_run !== false && body?.confirm !== true;
    const justification = typeof body?.justification === "string" ? body.justification.trim() : "";
    if (!cardId) return json({ error: "card_id é obrigatório." }, 400);

    // 2. Carrega o card e aplica as regras de liberação.
    const { data: card, error: cardErr } = await admin
      .from("representative_cards")
      .select("id, panel_id, stage_id, full_name, cnpj, jira_issue_key, origin_thread_id, is_protected")
      .eq("id", cardId)
      .maybeSingle();
    if (cardErr) throw cardErr;
    if (!card) return json({ error: "Card não encontrado." }, 404);
    if (card.panel_id !== CROSS_PANEL_ID) return json({ error: "Card fora do painel Onb Clientes Cross." }, 400);

    // Proteção permanente: flag no card, tabela protected_entities e reforço por nome.
    const { data: protectedRows } = await admin
      .from("protected_entities")
      .select("id")
      .or(`card_id.eq.${card.id},cnpj_normalizado.eq.${(card.cnpj ?? "").replace(/\D/g, "")}`);
    if (card.is_protected || protectedRows?.length || PROTECTED_CARD_NAMES.includes((card.full_name ?? "").toUpperCase())) {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_create_task", p_status: "ignorado_protegido", p_card_id: card.id,
        p_error: "Card protegido.", p_origin: "manual", p_payload: {},
      }).catch(() => null);
      return json({ error: "Card protegido: não recebe tarefa Jira." }, 400);
    }


    const blockers: string[] = [];
    if (!card.full_name?.trim()) blockers.push("Nome do parceiro não confirmado.");
    if (!card.cnpj || card.cnpj.replace(/\D/g, "").length !== 14) blockers.push("CNPJ não confirmado (14 dígitos).");

    // Etapa: comparar pelo rótulo configurado (o stage_id é técnico, ex.: etapa_painel_msj9fyji_2).
    const { data: stageRow } = await admin
      .from("pipeline_stages_config")
      .select("value, label")
      .eq("panel_key", CROSS_PANEL_ID)
      .eq("value", card.stage_id ?? "")
      .maybeSingle();
    const stageLabel = stageRow?.label ?? "";
    if (normalizeLabel(stageLabel) !== CRIACAO_PAINEL_LABEL) {
      blockers.push("Card não está na etapa Criação Painel.");
    }


    // 3. Deduplicação: por card, por CNPJ e por thread de origem.
    let duplicate: { id: string; full_name: string | null; jira_issue_key: string | null } | null = null;
    if (card.jira_issue_key) {
      duplicate = { id: card.id, full_name: card.full_name, jira_issue_key: card.jira_issue_key };
    } else {
      const orFilters = [`cnpj.eq.${card.cnpj ?? ""}`];
      if (card.origin_thread_id) orFilters.push(`origin_thread_id.eq.${card.origin_thread_id}`);
      const { data: siblings } = await admin
        .from("representative_cards")
        .select("id, full_name, jira_issue_key, cnpj, origin_thread_id")
        .eq("panel_id", CROSS_PANEL_ID)
        .not("jira_issue_key", "is", null)
        .or(orFilters.join(","));
      if (siblings?.length) duplicate = siblings[0];
    }

    const assigneeAccountId = Deno.env.get("JIRA_ASSIGNEE_ACCOUNT_ID")?.trim();
    if (!assigneeAccountId) blockers.push("Responsável Jira não configurado ou não autorizado.");


    const appUrl = Deno.env.get("PUBLIC_APP_URL")?.replace(/\/+$/, "") ?? "";
    const cardUrl = appUrl ? `${appUrl}/admin/leads?panel=${CROSS_PANEL_ID}&card=${card.id}` : card.id;
    const summary = `Criação de painel Monnera — ${card.full_name}`;
    const description = [
      `Cliente: ${card.full_name}`,
      `CNPJ: ${card.cnpj ?? "—"}`,
      `Card: ${card.id}`,
      `Link do card: ${cardUrl}`,
      `Origem da informação: ${card.origin_thread_id ? `thread ${card.origin_thread_id}` : "cadastro manual"}`,
      "",
      "Solicitação: criar o painel Monnera para este cliente.",
      "Ao concluir, responder nesta tarefa com o Código Monnera (8 caracteres, apenas letras maiúsculas e números).",
    ].join("\n");

    const preview = {
      card: { id: card.id, nome: card.full_name, cnpj: card.cnpj, etapa: stageLabel || card.stage_id },
      jira: { project: JIRA_PROJECT_ID, issue_type: JIRA_ISSUE_TYPE_ID, assignee: assigneeAccountId ? "configurado" : null, summary, description },
      blockers,
      duplicate,
    };

    if (blockers.length) {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_create_task",
        p_status: "ignorado",
        p_card_id: card.id,
        p_error: blockers.join(" "),
        p_origin: dryRun ? "manual_preview" : "manual",
        p_payload: { blockers },
      });
      return json({ ok: false, preview, error: blockers.join(" "), error_kind: "pre_requisito" }, 400);
    }

    if (duplicate) {
      return json({ ok: false, preview, error_kind: "duplicidade", error: `Já existe tarefa Jira (${duplicate.jira_issue_key}) para este card/CNPJ/thread.` }, 409);
    }
    if (dryRun) return json({ ok: true, dry_run: true, preview });
    if (!justification) return json({ ok: false, preview, error: "Justificativa obrigatória.", error_kind: "pre_requisito" }, 400);


    // 4. Criação real no Jira.
    const site = env("ATLASSIAN_SITE_URL").replace(/\/+$/, "");
    const auth = btoa(`${env("ATLASSIAN_EMAIL")}:${env("ATLASSIAN_API_TOKEN")}`);
    const res = await fetch(`${site}/rest/api/3/issue`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        fields: {
          project: { id: JIRA_PROJECT_ID },
          issuetype: { id: JIRA_ISSUE_TYPE_ID },
          assignee: { id: assigneeAccountId },
          labels: [JIRA_FLOW_LABEL],
          summary,
          description: {
            type: "doc",
            version: 1,
            content: description.split("\n").map((line) => ({
              type: "paragraph",
              content: line ? [{ type: "text", text: line }] : [],
            })),
          },
        },
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = JSON.stringify(payload).slice(0, 500);
      await admin.from("representative_cards").update({ jira_last_error: message, jira_synced_at: new Date().toISOString() }).eq("id", card.id);
      await admin.rpc("record_automation_run", {
        p_stage: "jira_create_task", p_status: "erro", p_card_id: card.id, p_error: message, p_origin: "manual", p_payload: payload,
      });
      return json({ ok: false, error: `Falha ao criar tarefa no Jira: ${message}` }, 502);
    }

    const issueKey = payload.key as string;
    await admin.rpc("register_jira_panel_task", { p_execution_id: null, p_issue_key: issueKey, p_payload: payload }).catch(() => null);
    await admin
      .from("representative_cards")
      .update({
        jira_issue_key: issueKey,
        jira_issue_status: "criada",
        jira_created_at: new Date().toISOString(),
        jira_synced_at: new Date().toISOString(),
        jira_last_error: null,
      })
      .eq("id", card.id);
    await admin.from("card_field_provenance").insert({
      card_id: card.id,
      field_name: "jira_issue_key",
      field_value: issueKey,
      source: "manual",
      evidence: justification,
      status: "consolidado",
      created_by: userId,
    });
    await admin.rpc("log_representative_card_event", {
      p_card_id: card.id,
      p_action: "jira_task_created",
      p_payload: { issue_key: issueKey, justification },
      p_source_stage_id: card.stage_id,
      p_destination_stage_id: card.stage_id,
    }).catch(() => null);
    await admin.rpc("record_automation_run", {
      p_stage: "jira_create_task", p_status: "sucesso", p_card_id: card.id, p_error: null, p_origin: "manual", p_payload: { issue_key: issueKey },
    });

    return json({ ok: true, issue_key: issueKey, url: `${site}/browse/${issueKey}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.rpc("record_automation_run", {
      p_stage: "jira_create_task", p_status: "erro", p_card_id: cardId, p_error: message, p_origin: "manual", p_payload: {},
    }).catch(() => null);
    return json({ ok: false, error: message }, 500);
  }
});
