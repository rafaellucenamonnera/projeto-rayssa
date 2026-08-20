// ============================================================================
// send-onboarding-email
// Envio CONTROLADO do e-mail de onboarding Baston via conta Gmail autorizada
// rafael.lucena@monnera.com.br.
//
// Escopo travado nesta etapa (QA):
//   - somente o card TESTE FASE A QA (allowlist por card_id);
//   - somente os destinatarios internos autorizados (@monnera.com.br);
//   - somente o codigo QATEST01 e o link Canva aprovado;
//   - um envio por confirmacao explicita do administrador.
// Nao existe caminho de envio em massa, cobranca ou regua neste arquivo.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const SENDER_ACCOUNT = "rafael.lucena@monnera.com.br";
const TEMPLATE_NAME = "onboarding-parceiro-baston";
const TEMPLATE_VERSION = "v2";

// Allowlist rigida de QA
const ALLOWED_CARD_IDS = new Set(["32d1e94e-ab53-42b3-9118-ab3ad2d07c77"]);
const ALLOWED_RECIPIENTS = new Set([
  "rafael.lucena@monnera.com.br",
  "alexandre.rodrigues@monnera.com.br",
  "maycon.santos@monnera.com.br",
  "rodrigo.cristo@monnera.com.br",
  "gilberto.freitas@monnera.com.br",
  "bruno.vivas@monnera.com.br",
]);
const ALLOWED_CODES = new Set(["QATEST01"]);

// Notificados quando o link publico do Canva estiver ausente/invalido.
const BLOCK_NOTIFY_USER_IDS = [
  "4ac5e678-b3a1-46d8-ab1a-a9f52c2f2479", // Rafael Lucena
  "a0d7b70d-aeda-490a-bcde-e5dc6d6c74fb", // Maycon Santos
];

// Link publico: canva.link/... ou canva.com/d/<token>, sem token de edicao.
function isCanvaPublicLink(value: string): boolean {
  return (
    /^https:\/\/(canva\.link\/[A-Za-z0-9]+|www\.canva\.com\/d\/[A-Za-z0-9_-]+)(\?[^\s]*)?$/.test(value) &&
    !value.includes("/edit") &&
    !value.includes("canva.com/d/s_")
  );
}

async function notifyCanvaBlock(cardId: string, motivo: string, link: string) {
  for (const userId of BLOCK_NOTIFY_USER_IDS) {
    await admin.rpc("create_notification", {
      p_recipient_user_id: userId,
      p_type: "cross_block_created",
      p_title: "Envio de onboarding bloqueado: link público Canva",
      p_message: `${motivo} (link recebido: ${link || "vazio"}).`,
      p_lead_id: null,
      p_task_id: null,
      p_comment_id: null,
      p_action_url: "/admin/email-onboarding",
      p_metadata: { card_id: cardId, motivo, link },
      p_actor_user_id: null,
      p_delivery_key: `canva_public_link_block:${cardId}:${new Date().toISOString().slice(0, 10)}`,
      p_representative_card_id: cardId,
    });
  }
}


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GMAIL_CONNECTION_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToB64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function encodeHeaderWord(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const bytes = new TextEncoder().encode(value);
  return `=?UTF-8?B?${btoa(String.fromCharCode(...bytes))}?=`;
}

function buildMime(to: string, subject: string, html: string): string {
  return [
    `From: ${SENDER_ACCOUNT}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderWord(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    btoa(String.fromCharCode(...new TextEncoder().encode(html))).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ---------------------------------------------------- autenticacao/admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Nao autenticado." }, 401);

    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Nao autenticado." }, 401);
    const userId = userData.user.id;

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso restrito a administradores." }, 403);

    // ------------------------------------------------------------- validacao
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Payload invalido." }, 400);

    const cardId = String(body.card_id ?? "").trim();
    const nome = String(body.nome_parceiro ?? "").trim();
    const codigo = String(body.codigo_parceiro ?? "").trim().toUpperCase();
    const link = String(body.link_material ?? "").trim();
    const assunto = String(body.assunto ?? "").trim();
    const html = String(body.html ?? "");
    const recipients: string[] = Array.isArray(body.destinatarios)
      ? body.destinatarios.map((v: unknown) => String(v).trim().toLowerCase()).filter(Boolean)
      : [];

    if (!ALLOWED_CARD_IDS.has(cardId)) {
      return json({ error: "Envio liberado somente para o card de QA autorizado." }, 403);
    }
    if (recipients.length !== 1 || !ALLOWED_RECIPIENTS.has(recipients[0])) {
      return json({ error: `Destinatario unico permitido: ${SENDER_ACCOUNT}.` }, 403);
    }
    if (!ALLOWED_CODES.has(codigo)) {
      return json({ error: "Codigo nao autorizado para envio nesta etapa." }, 403);
    }
    if (!nome || !assunto || html.length < 500) {
      return json({ error: "Dados incompletos para envio." }, 400);
    }
    if (!html.includes(codigo) || !html.includes(link)) {
      return json({ error: "HTML nao corresponde ao codigo/link informados." }, 400);
    }
    if (/\{\{[A-Z_]+\}\}/.test(html)) {
      return json({ error: "HTML ainda contem placeholders nao substituidos." }, 400);
    }

    // ------------------------------------------------------- card autorizado
    const { data: card } = await admin
      .from("representative_cards")
      .select("id, full_name, test_mode, canva_public_url, codigo_monnera, stage_id")
      .eq("id", cardId)
      .maybeSingle();
    if (!card) return json({ error: "Card nao encontrado." }, 404);
    if (card.test_mode !== true) {
      return json({ error: "Card nao esta em modo de teste; envio bloqueado." }, 403);
    }

    // ------------------------------------- pre-condicoes de etapa/codigo/link
    const cardCode = String(card.codigo_monnera ?? "").trim().toUpperCase();
    if (!cardCode || cardCode !== codigo) {
      await admin.rpc("record_automation_run", {
        p_stage: "onboarding_email",
        p_status: "erro",
        p_card_id: cardId,
        p_error: "Código Monnera ausente no card ou diferente do informado",
        p_origin: "send-onboarding-email",
        p_payload: { codigo_informado: codigo, codigo_card: cardCode },
      });
      return json({ error: "Código Monnera ausente no card ou diferente do informado. Envio bloqueado." }, 422);
    }

    // Etapa do card é informativa: não bloqueia o envio quando os dados estão completos.
    const stageId = String(card.stage_id ?? "");
    const { data: stageRow } = await admin
      .from("pipeline_stages_config")
      .select("label")
      .eq("value", stageId)
      .maybeSingle();
    const stageLabel = String(stageRow?.label ?? "");
    const avisos: string[] = [];
    if (!/material\s+onboarding/i.test(stageLabel)) {
      avisos.push(
        `Card fora da etapa Material Onboarding Cliente (${stageLabel || stageId || "sem etapa"}). Envio autorizado mesmo assim.`,
      );
      await admin.rpc("record_automation_run", {
        p_stage: "onboarding_email",
        p_status: "aviso",
        p_card_id: cardId,
        p_error: `Envio fora da etapa Material Onboarding Cliente (${stageLabel || stageId || "sem etapa"})`,
        p_origin: "send-onboarding-email",
        p_payload: { stage_id: stageId, stage_label: stageLabel },
      });
    }



    // --------------------------------------------- link publico obrigatorio
    const cardPublicUrl = String(card.canva_public_url ?? "").trim();
    if (!cardPublicUrl || !isCanvaPublicLink(cardPublicUrl)) {
      await notifyCanvaBlock(cardId, "Link público do material Canva ausente ou inválido no card", cardPublicUrl);
      return json({ error: "Link público do Canva ausente ou inválido no card. Envio bloqueado." }, 422);
    }
    if (link !== cardPublicUrl) {
      await notifyCanvaBlock(cardId, "Link enviado diverge do link público registrado no card", link);
      return json({ error: "Link do material diverge do link público registrado no card." }, 422);
    }




    if (!LOVABLE_API_KEY || !GMAIL_CONNECTION_KEY) {
      return json({ error: "Conexao Gmail nao vinculada ao projeto." }, 500);
    }

    // ------------------------------------------- protecao contra duplicidade
    const { data: alreadySent } = await admin
      .from("onboarding_email_sends")
      .select("id, sent_at, message_id")
      .eq("card_id", cardId)
      .eq("codigo_parceiro", codigo)
      .eq("status", "enviado")
      .maybeSingle();
    if (alreadySent) {
      return json(
        {
          error: "E-mail de onboarding ja enviado para este card/codigo.",
          duplicate: true,
          log_id: alreadySent.id,
          message_id: alreadySent.message_id,
          sent_at: alreadySent.sent_at,
        },
        409,
      );
    }

    // -------------------------------------------------- registro (pendente)
    const { data: logRow, error: logError } = await admin
      .from("onboarding_email_sends")
      .insert({
        card_id: cardId,
        nome_parceiro: nome,
        codigo_parceiro: codigo,
        link_material: link,
        assunto,
        destinatarios: recipients,
        status: "enviando",
        html_snapshot: html,
        created_by: userId,
        template_name: TEMPLATE_NAME,
        template_version: TEMPLATE_VERSION,
        gmail_account: SENDER_ACCOUNT,
        test_mode: true,
      })
      .select("id")
      .single();
    if (logError) {
      console.error("insert onboarding_email_sends failed", logError.message);
      return json({ error: `Falha ao registrar envio: ${logError.message}` }, 500);
    }


    // ------------------------------------------------------------- envio
    const raw = bytesToB64Url(new TextEncoder().encode(buildMime(recipients[0], assunto, html)));
    const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GMAIL_CONNECTION_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    });
    const resText = await res.text();

    if (!res.ok) {
      await admin
        .from("onboarding_email_sends")
        .update({ status: "erro", erro_mensagem: `Gmail [${res.status}]: ${resText.slice(0, 800)}` })
        .eq("id", logRow.id);
      return json({ error: `Falha no envio Gmail (${res.status})`, detail: resText.slice(0, 800) }, 502);
    }

    let parsed: any = {};
    try {
      parsed = JSON.parse(resText);
    } catch {
      parsed = {};
    }

    await admin
      .from("onboarding_email_sends")
      .update({
        status: "enviado",
        sent_at: new Date().toISOString(),
        message_id: parsed.id ?? null,
        thread_id: parsed.threadId ?? null,
      })
      .eq("id", logRow.id);

    return json({
      success: true,
      log_id: logRow.id,
      gmail_status: res.status,
      message_id: parsed.id ?? null,
      thread_id: parsed.threadId ?? null,
      label_ids: parsed.labelIds ?? [],
      template: TEMPLATE_NAME,
      template_version: TEMPLATE_VERSION,
      account: SENDER_ACCOUNT,
      recipient: recipients[0],
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado" }, 500);
  }
});
