import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
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

const jiraAuthHeader = (email: string, token: string) =>
  `Basic ${btoa(`${email}:${token}`)}`;

const buildSummary = (lead: any) => `[Painel Comercial ${lead.id}] ${lead.nome_fantasia || "Card sem nome"}`;

const textDoc = (text: string) => ({
  type: "doc",
  version: 1,
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text }],
    },
  ],
});

const buildDescription = (lead: any, originReference: string) => textDoc([
  `Origem: ${originReference}`,
  `Cliente: ${lead.nome_fantasia || "-"}`,
  `Responsavel: ${lead.nome_responsavel || "-"}`,
  `Email: ${lead.email_responsavel || "-"}`,
  `Telefone: ${lead.telefone_responsavel || "-"}`,
  `Cidade: ${lead.cidade || "-"}`,
  `CNPJ: ${lead.cnpj || "-"}`,
  `ERP: ${lead.erp_utilizado || "-"}`,
  `Lojas: ${lead.quantidade_lojas || "-"}`,
  `Setup: ${lead.valor_setup ?? "-"}`,
  `Mensalidade: ${lead.valor_mensalidade ?? "-"}`,
  `Campanhas: ${lead.valor_campanhas ?? "-"}`,
  "",
  lead.descricao_necessidade || "Sem descricao.",
].join("\n"));

const createIssue = async (config: any, fields: Record<string, unknown>) => {
  const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: jiraAuthHeader(config.email, config.token),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Jira create issue failed: ${JSON.stringify(payload).slice(0, 700)}`);
  return payload;
};

const transitionIssue = async (config: any, issueKey: string, transitionId?: string | null) => {
  if (!transitionId) return;
  const response = await fetch(`${config.baseUrl}/rest/api/3/issue/${issueKey}/transitions`, {
    method: "POST",
    headers: {
      Authorization: jiraAuthHeader(config.email, config.token),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transition: { id: transitionId } }),
  });
  if (!response.ok && response.status !== 204) {
    const details = await response.text();
    throw new Error(`Jira transition failed: ${details.slice(0, 700)}`);
  }
};

const generateCommentsPdf = async (lead: any, comments: any[]) => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;

  const drawLine = (text: string, size = 10, isBold = false) => {
    if (y < 48) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(text.slice(0, 110), {
      x: 40,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.07, 0.18, 0.16),
    });
    y -= size + 8;
  };

  drawLine("Historico de comentarios - Painel Comercial", 14, true);
  drawLine(`Cliente: ${lead.nome_fantasia || "-"}`, 11, true);
  drawLine(`Lead ID: ${lead.id}`, 9);
  y -= 10;

  if (comments.length === 0) {
    drawLine("Nenhum comentario encontrado.", 10);
  }

  for (const comment of comments) {
    const date = comment.data_comentario ? new Date(comment.data_comentario).toLocaleString("pt-BR") : "-";
    drawLine(`${date} - ${comment.usuario || "Usuario"}`, 10, true);
    const words = String(comment.comentario || "").split(/\s+/);
    let line = "";
    for (const word of words) {
      if (`${line} ${word}`.trim().length > 95) {
        drawLine(line, 9);
        line = word;
      } else {
        line = `${line} ${word}`.trim();
      }
    }
    if (line) drawLine(line, 9);
    y -= 8;
  }

  return await pdf.save();
};

const attachPdf = async (config: any, issueKey: string, filename: string, pdfBytes: Uint8Array) => {
  const form = new FormData();
  form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), filename);

  const response = await fetch(`${config.baseUrl}/rest/api/3/issue/${issueKey}/attachments`, {
    method: "POST",
    headers: {
      Authorization: jiraAuthHeader(config.email, config.token),
      Accept: "application/json",
      "X-Atlassian-Token": "no-check",
    },
    body: form,
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Jira attachment failed: ${details.slice(0, 700)}`);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Supabase env ausente" }, 500);

  const config = {
    baseUrl: (Deno.env.get("JIRA_BASE_URL") || "").replace(/\/+$/, ""),
    email: Deno.env.get("JIRA_EMAIL") || "",
    token: Deno.env.get("JIRA_API_TOKEN") || "",
    projectKey: Deno.env.get("JIRA_PROJECT_KEY") || "MB",
    implementationIssueTypeId: Deno.env.get("JIRA_IMPLEMENTATION_ISSUE_TYPE_ID") || "",
    originFieldId: Deno.env.get("JIRA_ORIGIN_FIELD_ID") || "",
    implementationTransitionId: Deno.env.get("JIRA_IMPLEMENTATION_TRANSITION_ID") || "",
  };

  if (!config.baseUrl || !config.email || !config.token || !config.implementationIssueTypeId) {
    return json({ error: "Jira env ausente" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let requestedLeadId: string | null = null;

  try {
    const { lead_id } = await req.json();
    requestedLeadId = lead_id || null;
    if (!lead_id) throw new Error("lead_id e obrigatorio");

    const { data: existing } = await supabase
      .from("jira_card_links")
      .select("*")
      .eq("lead_id", lead_id)
      .maybeSingle();
    if (existing?.sync_status === "synced") return json({ skipped: true, link: existing });

    const { data: lead, error: leadError } = await supabase.from("leads").select("*").eq("id", lead_id).single();
    if (leadError || !lead) throw new Error("Lead nao encontrado");
    if (lead.status_lead !== "contrato_assinado") throw new Error("Lead ainda nao esta em contrato_assinado");

    const originReference = `painel-comercial:${lead.id}`;
    await supabase.from("jira_card_links").upsert({
      lead_id,
      origin_reference: originReference,
      sync_status: "pending",
      last_error: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "lead_id" });

    const { data: comments } = await supabase
      .from("lead_comments")
      .select("*")
      .eq("lead_id", lead_id)
      .order("data_comentario", { ascending: true });

    const fields: Record<string, unknown> = {
      project: { key: config.projectKey },
      summary: buildSummary(lead),
      description: buildDescription(lead, originReference),
      issuetype: { id: config.implementationIssueTypeId },
    };
    if (config.originFieldId) fields[config.originFieldId] = originReference;

    const jiraIssue = await createIssue(config, fields);
    await transitionIssue(config, jiraIssue.key, config.implementationTransitionId);

    const pdfBytes = await generateCommentsPdf(lead, comments || []);
    const filename = `comentarios-${lead.id}.pdf`;
    await attachPdf(config, jiraIssue.key, filename, pdfBytes);

    const syncedAt = new Date().toISOString();
    const updatePayload = {
      jira_issue_key: jiraIssue.key,
      jira_issue_id: jiraIssue.id,
      sync_status: "synced",
      last_error: null,
      synced_at: syncedAt,
      updated_at: syncedAt,
    };
    await supabase.from("jira_card_links").update(updatePayload).eq("lead_id", lead_id);
    await supabase.from("integration_events").insert({
      provider: "jira",
      event_type: "contract_signed_sync",
      entity_type: "lead",
      entity_id: lead_id,
      delivery_key: `jira-contract-signed-${lead_id}`,
      status: "sent",
      payload: { lead_id },
      response: updatePayload,
    });

    return json({ synced: true, ...updatePayload });
  } catch (error: any) {
    const leadId = requestedLeadId;
    if (leadId) {
      await supabase.from("jira_card_links").upsert({
        lead_id: leadId,
        origin_reference: `painel-comercial:${leadId}`,
        sync_status: "failed",
        last_error: error.message,
        updated_at: new Date().toISOString(),
      }, { onConflict: "lead_id" });
    }
    await supabase.from("integration_events").insert({
      provider: "jira",
      event_type: "contract_signed_sync",
      entity_type: "lead",
      entity_id: leadId || "unknown",
      delivery_key: leadId ? `jira-contract-signed-${leadId}` : null,
      status: "failed",
      error: error.message,
    });
    return json({ error: error.message }, 400);
  }
});
