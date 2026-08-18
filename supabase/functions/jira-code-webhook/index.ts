import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { extractMonneraCode, validateMonneraCode } from "../_shared/monneraCode.ts";

const CROSS_PANEL_ID = "painel_msj9fyji";
const PROTECTED_CARD_NAMES = ["ORCA LOGÍSTICA", "ORCA LOGISTICA"];
const NOTIFY_USERS = [
  "d8e99940-2d3a-45e6-8170-0bf2f5fc98a9", // rafael.lucena@monnera.com.br
  "87842ad6-9a02-4e66-82ac-65f2743a2596", // maycon.santos@monnera.com.br
];
const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Autenticação do webhook. Nunca aceita segredo em URL/query string, nem
 * segredo ou assinatura vindos do corpo do payload.
 * 1) header secreto simples (comparação em tempo constante); ou
 * 2) assinatura HMAC-SHA256 em header, sobre o corpo bruto + timestamp.
 */
async function authenticate(req: Request, rawBody: string): Promise<{ ok: boolean; reason?: string }> {
  const secret = Deno.env.get("JIRA_WEBHOOK_SECRET")?.trim();
  if (!secret) return { ok: false, reason: "JIRA_WEBHOOK_SECRET não configurado." };

  const headerSecret = req.headers.get("x-jira-webhook-secret");
  if (headerSecret) {
    return timingSafeEqual(headerSecret, secret) ? { ok: true } : { ok: false, reason: "Segredo inválido." };
  }

  const signature = req.headers.get("x-jira-signature");
  const timestamp = req.headers.get("x-jira-timestamp");
  if (signature && timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) {
      return { ok: false, reason: "Timestamp fora da janela permitida." };
    }
    const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
    const provided = signature.replace(/^sha256=/i, "").toLowerCase();
    return timingSafeEqual(provided, expected) ? { ok: true } : { ok: false, reason: "Assinatura inválida." };
  }

  return { ok: false, reason: "Autenticação ausente (header secreto ou assinatura HMAC)." };
}

function collectText(payload: any): string {
  const parts: string[] = [];
  const push = (v: unknown) => { if (typeof v === "string") parts.push(v); };
  push(payload?.codigo_monnera);
  push(payload?.comment?.body);
  push(payload?.issue?.fields?.summary);
  push(payload?.issue?.fields?.description);
  const fields = payload?.issue?.fields ?? {};
  for (const [key, value] of Object.entries(fields)) {
    if (key.startsWith("customfield_") && typeof value === "string") push(value);
  }
  if (typeof payload?.issue?.fields?.description === "object") {
    push(JSON.stringify(payload.issue.fields.description));
  }
  return parts.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const rawBody = await req.text();
  const auth = await authenticate(req, rawBody);
  if (!auth.ok) {
    await admin.rpc("record_automation_run", {
      p_stage: "jira_code_webhook", p_status: "erro", p_card_id: null,
      p_error: auth.reason ?? "não autenticado", p_origin: "jira_webhook", p_payload: {},
    }).catch(() => null);
    return json({ error: "Não autorizado." }, 401);
  }

  // Modo de teste de entrega: autentica, registra e encerra sem tocar em card.
  try {
    const probe = JSON.parse(rawBody || "{}");
    if (probe?.ping === true || probe?.test_delivery === true) {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_code_webhook", p_status: "sucesso", p_card_id: null,
        p_error: null, p_origin: "jira_webhook", p_payload: { mode: "ping" },
      }).catch(() => null);
      return json({ ok: true, mode: "ping" }, 200);
    }
  } catch (_) { /* corpo não-JSON segue o fluxo normal */ }

  let cardId: string | null = null;

  try {
    const payload = JSON.parse(rawBody || "{}");
    const issueKey: string | null = payload?.issue?.key ?? payload?.issue_key ?? null;
    const explicitCardId: string | null = payload?.card_id ?? null;
    const cnpj = String(payload?.cnpj ?? "").replace(/\D/g, "");
    const threadId: string | null = payload?.thread_id ?? null;

    // Localiza o card: jira_issue_key -> card_id -> thread_id -> CNPJ.
    const base = () => admin.from("representative_cards")
      .select("id, full_name, cnpj, stage_id, codigo_monnera, jira_issue_key")
      .eq("panel_id", CROSS_PANEL_ID);

    let candidates: any[] = [];
    if (issueKey) candidates = (await base().eq("jira_issue_key", issueKey)).data ?? [];
    if (!candidates.length && explicitCardId) candidates = (await base().eq("id", explicitCardId)).data ?? [];
    if (!candidates.length && threadId) candidates = (await base().eq("origin_thread_id", threadId)).data ?? [];
    if (!candidates.length && cnpj.length === 14) candidates = (await base().eq("cnpj", cnpj)).data ?? [];

    const notify = async (title: string, message: string) => {
      for (const user of NOTIFY_USERS) {
        await admin.rpc("create_notification", {
          p_recipient_user_id: user,
          p_type: "cross_block_created",
          p_title: title,
          p_message: message,
          p_lead_id: null,
          p_task_id: null,
          p_comment_id: null,
          p_action_url: "/admin/leads",
          p_metadata: { issue_key: issueKey, card_id: cardId },
          p_actor_user_id: null,
          p_delivery_key: `jira_code_${issueKey ?? "sem_chave"}_${Date.now()}`,
        }).catch(() => null);
      }
    };

    if (candidates.length !== 1) {
      const reason = candidates.length === 0 ? "Nenhum card correspondente." : "Mais de um card candidato (ambiguidade).";
      await admin.rpc("record_automation_run", {
        p_stage: "jira_code_webhook", p_status: "ignorado", p_card_id: null,
        p_error: reason, p_origin: "jira_webhook", p_payload: { issue_key: issueKey, cnpj, thread_id: threadId },
      });
      await notify("Código Jira sem card inequívoco", `${reason} Tarefa: ${issueKey ?? "—"}.`);
      return json({ ok: false, error: reason }, 202);
    }

    const card = candidates[0];
    cardId = card.id;
    if (PROTECTED_CARD_NAMES.includes((card.full_name ?? "").toUpperCase())) {
      return json({ ok: false, error: "Card protegido: nenhuma alteração aplicada." }, 202);
    }

    const isQaCard = (card.full_name ?? "").toUpperCase() === "TESTE FASE A QA";
    const rawCode = typeof payload?.codigo_monnera === "string" ? payload.codigo_monnera : extractMonneraCode(collectText(payload));
    const validation = validateMonneraCode(rawCode, { allowTest: isQaCard });
    if (!validation.ok) {
      await admin.rpc("record_automation_run", {
        p_stage: "jira_code_webhook", p_status: "erro", p_card_id: card.id,
        p_error: validation.reason, p_origin: "jira_webhook", p_payload: { issue_key: issueKey, raw: rawCode ?? null },
      });
      await notify("Código Monnera recusado", `${validation.reason} Card: ${card.full_name}. Tarefa: ${issueKey ?? "—"}.`);
      return json({ ok: false, error: validation.reason }, 202);
    }
    const code = validation.code;

    // Idempotência: mesmo código já aplicado.
    if ((card.codigo_monnera ?? "").toUpperCase() === code) {
      return json({ ok: true, idempotent: true, card_id: card.id, codigo: code });
    }
    if (card.codigo_monnera) {
      const reason = "Card já possui código diferente: divergência exige decisão manual.";
      await admin.rpc("record_automation_run", {
        p_stage: "jira_code_webhook", p_status: "ignorado", p_card_id: card.id,
        p_error: reason, p_origin: "jira_webhook", p_payload: { atual: card.codigo_monnera, recebido: code },
      });
      await notify("Divergência de Código Monnera", `${reason} Card: ${card.full_name}.`);
      return json({ ok: false, error: reason }, 409);
    }

    // Código de outro CNPJ não pode ser reaproveitado.
    const { data: reused } = await admin.from("representative_cards")
      .select("id, cnpj").eq("panel_id", CROSS_PANEL_ID).eq("codigo_monnera", code).neq("id", card.id);
    if (reused?.length) {
      const reason = "Código já utilizado por outro CNPJ.";
      await notify("Código Monnera duplicado", `${reason} Card: ${card.full_name}.`);
      return json({ ok: false, error: reason }, 409);
    }

    // Aplica o código: grava, registra origem/evidência/histórico. NÃO move o card.
    const evidence = { issue_key: issueKey, received_at: new Date().toISOString(), webhook: true };
    const { error: applyErr } = await admin.rpc("apply_monnera_code_to_card", {
      p_card_id: card.id,
      p_codigo: code,
      p_source: "jira_webhook",
      p_evidence: evidence,
      p_jira_issue_key: issueKey,
    });
    if (applyErr) throw applyErr;

    await admin.from("card_field_provenance").insert({
      card_id: card.id,
      field_name: "codigo_monnera",
      field_value: code,
      source: "jira_webhook",
      evidence: JSON.stringify(evidence),
      status: "consolidado",
    });
    await admin.from("representative_cards")
      .update({ jira_issue_status: "codigo_recebido", jira_synced_at: new Date().toISOString(), jira_last_error: null })
      .eq("id", card.id);
    await admin.rpc("record_automation_run", {
      p_stage: "jira_code_webhook", p_status: "sucesso", p_card_id: card.id,
      p_error: null, p_origin: "jira_webhook", p_payload: { issue_key: issueKey, codigo: code },
    });
    await notify("Código Monnera recebido", `Card ${card.full_name} recebeu o código ${code}. Geração do material Canva liberada; o card não foi movido.`);

    // Apenas sinaliza que a geração do Canva pode iniciar. A movimentação de
    // etapa ocorre somente após o link público do Canva ser validado.
    await admin.rpc("record_automation_run", {
      p_stage: "canva_generation", p_status: "iniciado", p_card_id: card.id,
      p_error: null, p_origin: "jira_webhook", p_payload: { codigo: code },
    });

    return json({ ok: true, card_id: card.id, codigo: code, card_moved: false, canva_generation: "pendente" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.rpc("record_automation_run", {
      p_stage: "jira_code_webhook", p_status: "erro", p_card_id: cardId, p_error: message, p_origin: "jira_webhook", p_payload: {},
    }).catch(() => null);
    return json({ ok: false, error: message }, 500);
  }
});
