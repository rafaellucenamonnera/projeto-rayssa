import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CROSS_PANEL_ID = "painel_msj9fyji";
const CRIACAO_PAINEL_LABEL = "criacao painel";

function normalizeLabel(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}

const JIRA_FLOW_LABEL = "monnera-onboarding";
// Cards protegidos: nunca recebem tarefa automática (reforço em código; a regra permanente é no banco).
const PROTECTED_CARD_NAMES = ["ORCA LOGÍSTICA", "ORCA LOGISTICA"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Erro estruturado: status HTTP próprio + categoria, sem expor credenciais. */
class ConfigError extends Error {
  constructor(public status: number, public kind: string, message: string, public extra: Record<string, unknown> = {}) {
    super(message);
  }
}

interface JiraConfig {
  site: string;
  auth: string;
  projectKey: string;
  issueTypeId: string;
  assigneeAccountId: string;
}

/** Lê os secrets — convenção única, sem fallback silencioso para outra conta. */
function loadConfig(): JiraConfig {
  const missing: string[] = [];
  const site = Deno.env.get("ATLASSIAN_SITE_URL")?.trim().replace(/\/+$/, "");
  const email = Deno.env.get("ATLASSIAN_EMAIL")?.trim();
  const token = Deno.env.get("ATLASSIAN_API_TOKEN")?.trim();
  const assigneeAccountId = Deno.env.get("JIRA_ASSIGNEE_ACCOUNT_ID")?.trim();
  if (!site) missing.push("ATLASSIAN_SITE_URL");
  if (!email) missing.push("ATLASSIAN_EMAIL");
  if (!token) missing.push("ATLASSIAN_API_TOKEN");
  if (!assigneeAccountId) missing.push("JIRA_ASSIGNEE_ACCOUNT_ID");
  if (missing.length) {
    throw new ConfigError(422, "configuracao", `Configuração Jira incompleta: ${missing.join(", ")}`, { missing_secrets: missing });
  }
  // Defaults aplicados apenas quando o secret está ausente.
  const projectKey = Deno.env.get("JIRA_PROJECT_KEY")?.trim() || "MB";
  const issueTypeId = Deno.env.get("JIRA_IMPLEMENTATION_ISSUE_TYPE_ID")?.trim() || "10042";
  return { site: site!, auth: btoa(`${email}:${token}`), projectKey, issueTypeId, assigneeAccountId: assigneeAccountId! };
}

interface JiraResponse { status: number; body: any; text: string }

async function jiraGet(cfg: JiraConfig, path: string): Promise<JiraResponse> {
  let res: Response;
  try {
    res = await fetch(`${cfg.site}${path}`, {
      headers: { Authorization: `Basic ${cfg.auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    });
  } catch (_e) {
    throw new ConfigError(502, "servidor_jira", "Jira indisponível (timeout ou falha de rede).");
  }
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (res.status >= 500) {
    throw new ConfigError(502, "servidor_jira", `Jira indisponível (HTTP ${res.status}).`, { jira_status: res.status });
  }
  if (res.status === 401) {
    throw new ConfigError(401, "autenticacao", "Credenciais Atlassian inválidas ou expiradas.", { jira_status: 401 });
  }
  return { status: res.status, body, text };
}

export interface Diagnostic {
  ok: boolean;
  jira_user: { display_name: string | null; active: boolean | null } | null;
  project: { key: string; name: string | null; id: string | null } | null;
  permission: { create_issues: boolean } | null;
  issue_type: { id: string; name: string | null } | null;
  allowed_issue_types?: { id: string; name: string }[];
}

/**
 * Pré-validação somente leitura, na ordem definida:
 * secrets → /myself → /project/{projectKey} → /mypermissions → /createmeta.
 * Lança ConfigError com status e categoria adequados. Nunca executa POST.
 */
async function runDiagnostic(cfg: JiraConfig): Promise<Diagnostic> {
  // 2. Conta de serviço.
  const me = await jiraGet(cfg, "/rest/api/3/myself");
  if (me.status !== 200) {
    throw new ConfigError(401, "autenticacao", "Credenciais Atlassian inválidas ou expiradas.", { jira_status: me.status });
  }
  const jiraUser = { display_name: me.body?.displayName ?? null, active: me.body?.active ?? null };

  // 3. Projeto visível.
  const proj = await jiraGet(cfg, `/rest/api/3/project/${encodeURIComponent(cfg.projectKey)}`);
  if (proj.status === 404) {
    throw new ConfigError(422, "projeto_inexistente", `Projeto Jira ${cfg.projectKey} não existe ou não é visível para a conta de serviço.`, { jira_status: 404 });
  }
  if (proj.status === 403) {
    throw new ConfigError(403, "sem_acesso_projeto", `Conta de serviço sem acesso ao projeto ${cfg.projectKey}.`, { jira_status: 403 });
  }
  if (proj.status !== 200) {
    throw new ConfigError(422, "projeto_inexistente", `Não foi possível confirmar o projeto ${cfg.projectKey} (HTTP ${proj.status}).`, { jira_status: proj.status });
  }
  const project = { key: proj.body?.key ?? cfg.projectKey, name: proj.body?.name ?? null, id: proj.body?.id ? String(proj.body.id) : null };

  // 4. Permissão de criação.
  const perm = await jiraGet(
    cfg,
    `/rest/api/3/mypermissions?projectKey=${encodeURIComponent(cfg.projectKey)}&permissions=CREATE_ISSUES`,
  );
  if (perm.status === 403) {
    throw new ConfigError(403, "sem_permissao_criar", `Conta de serviço sem permissão para criar itens em ${cfg.projectKey}.`, { jira_status: 403 });
  }
  const havePermission = perm.body?.permissions?.CREATE_ISSUES?.havePermission === true;
  if (!havePermission) {
    throw new ConfigError(403, "sem_permissao_criar", `Conta de serviço sem permissão para criar itens em ${cfg.projectKey}.`, {
      jira_user: jiraUser,
      project,
      permission: { create_issues: false },
    });
  }

  // 5. Tipo permitido dentro do projeto (createmeta explícito, sem resposta genérica/paginada).
  const meta = await jiraGet(
    cfg,
    `/rest/api/3/issue/createmeta?projectKeys=${encodeURIComponent(cfg.projectKey)}&issuetypeIds=${encodeURIComponent(cfg.issueTypeId)}&expand=projects.issuetypes.fields`,
  );
  const metaProject = Array.isArray(meta.body?.projects)
    ? meta.body.projects.find((p: any) => String(p?.key) === cfg.projectKey) ?? meta.body.projects[0]
    : null;
  const allowed: { id: string; name: string }[] = Array.isArray(metaProject?.issuetypes)
    ? metaProject.issuetypes.map((t: any) => ({ id: String(t.id), name: String(t.name ?? "") }))
    : [];
  const match = allowed.find((t) => t.id === cfg.issueTypeId);
  if (!match) {
    throw new ConfigError(422, "tipo_invalido", `Tipo ${cfg.issueTypeId} não permitido em ${cfg.projectKey}.`, {
      jira_user: jiraUser,
      project,
      permission: { create_issues: true },
      allowed_issue_types: allowed,
    });
  }

  return {
    ok: true,
    jira_user: jiraUser,
    project,
    permission: { create_issues: true },
    issue_type: { id: match.id, name: match.name || null },
    allowed_issue_types: allowed,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let cardId: string | null = null;
  try {
    // 1. Autenticação e autorização (admin ou gestor de conta).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Não autenticado." }, 401);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "Sessão inválida." }, 401);
    const userId = userData.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });

    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const isCheck = url.searchParams.get("check") === "1" || body?.check === true;

    // Endpoint de diagnóstico: somente GETs ao Jira, nenhum efeito colateral.
    if (isCheck) {
      const { data: isGestor } = await admin.rpc("has_role", { _user_id: userId, _role: "gestor_conta" });
      if (!isAdmin && !isGestor) return json({ error: "Ação restrita a administradores." }, 403);
      const cfg = loadConfig();
      const diagnostic = await runDiagnostic(cfg);
      return json({ ok: true, diagnostic });
    }

    if (!isAdmin) return json({ error: "Ação restrita a administradores." }, 403);

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
      return json({ error: "Card protegido: não recebe tarefa Jira.", error_kind: "pre_requisito" }, 400);
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

    // Configuração: ausência de secret é erro de configuração (422), não bloqueio de card.
    const cfg = loadConfig();

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
      jira: {
        project_key: cfg.projectKey,
        issue_type_id: cfg.issueTypeId,
        assignee: "configurado",
        summary,
        description,
      },
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

    // 4. Pré-validação (somente GET) antes de qualquer criação.
    const diagnostic = await runDiagnostic(cfg);

    // 5. Criação real no Jira, com os valores validados.
    let res: Response;
    try {
      res = await fetch(`${cfg.site}/rest/api/3/issue`, {
        method: "POST",
        headers: { Authorization: `Basic ${cfg.auth}`, "Content-Type": "application/json", Accept: "application/json" },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          fields: {
            project: { key: cfg.projectKey },
            issuetype: { id: cfg.issueTypeId },
            assignee: { id: cfg.assigneeAccountId },
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
    } catch (_e) {
      throw new ConfigError(502, "servidor_jira", "Jira indisponível (timeout ou falha de rede).");
    }
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Mensagens da API do Jira apenas; nenhuma credencial é registrada ou devolvida.
      const jiraMessages: string[] = Array.isArray((payload as any)?.errorMessages) ? (payload as any).errorMessages : [];
      const fieldErrors = (payload as any)?.errors && typeof (payload as any).errors === "object"
        ? Object.entries((payload as any).errors).map(([k, v]) => `${k}: ${v}`)
        : [];
      const message = [...jiraMessages, ...fieldErrors].join(" | ").slice(0, 500) || JSON.stringify(payload).slice(0, 500);
      const assigneeIssue = fieldErrors.some((e) => e.toLowerCase().startsWith("assignee"));
      let status = 400;
      let errorKind = "campos_invalidos";
      let friendly = `Campos rejeitados pelo Jira: ${message}`;
      if (res.status === 401) {
        status = 401; errorKind = "autenticacao"; friendly = "Credenciais Atlassian inválidas ou expiradas.";
      } else if (res.status === 403) {
        status = 403; errorKind = "sem_permissao_criar";
        friendly = `Conta de serviço sem permissão para criar itens em ${cfg.projectKey}.`;
      } else if (res.status === 404) {
        status = 422; errorKind = "projeto_inexistente";
        friendly = `Projeto Jira ${cfg.projectKey} não existe ou não é visível para a conta de serviço.`;
      } else if (res.status >= 500) {
        status = 502; errorKind = "servidor_jira"; friendly = "Jira indisponível.";
      } else if (assigneeIssue) {
        status = 422; errorKind = "configuracao";
        friendly = "Responsável Jira (JIRA_ASSIGNEE_ACCOUNT_ID) não autorizado neste projeto.";
      }
      await admin.from("representative_cards").update({ jira_last_error: message, jira_synced_at: new Date().toISOString() }).eq("id", card.id);
      await admin.rpc("record_automation_run", {
        p_stage: "jira_create_task", p_status: "erro", p_card_id: card.id, p_error: `${errorKind}: ${message}`, p_origin: "manual", p_payload: payload,
      });
      return json({ ok: false, error: friendly, error_kind: errorKind, jira_status: res.status, jira_message: message }, status);
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

    return json({ ok: true, issue_key: issueKey, url: `${cfg.site}/browse/${issueKey}`, diagnostic });
  } catch (error) {
    if (error instanceof ConfigError) {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_create_task", p_status: "erro", p_card_id: cardId, p_error: `${error.kind}: ${error.message}`, p_origin: "manual", p_payload: {},
      }).catch(() => null);
      return json({ ok: false, error: error.message, error_kind: error.kind, ...error.extra }, error.status);
    }
    const message = error instanceof Error ? error.message : String(error);
    await admin.rpc("record_automation_run", {
      p_stage: "jira_create_task", p_status: "erro", p_card_id: cardId, p_error: message, p_origin: "manual", p_payload: {},
    }).catch(() => null);
    return json({ ok: false, error: message }, 500);
  }
});
