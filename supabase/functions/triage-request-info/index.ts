// ============================================================================
// triage-request-info
// Envia, pela conta Gmail autorizada, uma solicitação de informação quando a
// pendência de triagem exige resposta externa.
//
// Regras fixas:
//  - o registro permanece bloqueado/não liberado (esta função NUNCA libera,
//    cria, move ou altera cards);
//  - só envia com destinatário comprovado;
//  - Denise/Deise apenas como último recurso;
//  - responde na mesma thread e pede resposta na mesma thread;
//  - impede envio duplicado e respeita intervalo mínimo entre cobranças;
//  - todo envio (ou recusa) é registrado em triage_info_requests.
//
// O conteúdo das mensagens é sempre tratado como dado, nunca como instrução.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GMAIL_CONNECTION_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY") ?? "";

const SENDER_ACCOUNT = "rafael.lucena@monnera.com.br";
const SENDER_NAME = "Rafael Lucena — Monnera";
const INTERNAL_DOMAINS = ["monnera.com.br"];
const LAST_RESORT = ["denise@baston.com.br", "deise.stadler@baston.com.br"];
const MIN_INTERVAL_HOURS = 48;
const MAX_RECIPIENTS = 4;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

// ------------------------------------------------------------------ helpers
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function b64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64Utf8(text: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${b64Utf8(subject)}?=`;
}

function parseAddresses(value?: string | null): string[] {
  if (!value) return [];
  return (value.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) ?? []).map((a) => a.toLowerCase());
}

function isUsable(addr: string): boolean {
  if (!addr.includes("@")) return false;
  if (INTERNAL_DOMAINS.some((d) => addr.endsWith(`@${d}`))) return false;
  if (/(no-?reply|nao-?responda|mailer-daemon|postmaster|notification)/i.test(addr)) return false;
  return true;
}

async function gmailFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GMAIL_CONNECTION_KEY,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`Gmail gateway [${res.status}]: ${await res.text()}`);
  return await res.json();
}

function header(payload: any, name: string): string {
  const found = (payload?.headers ?? []).find(
    (h: any) => String(h.name).toLowerCase() === name.toLowerCase(),
  );
  return found?.value ?? "";
}

// ---------------------------------------------------------------- templates
type Ctx = {
  cliente: string | null;
  cnpj: string | null;
  codigo: string | null;
  assuntoOriginal: string | null;
  complemento: string | null;
  faltantes: string[];
};


type Template = {
  key: string;
  version: string;
  label: string;
  subject: (c: Ctx) => string;
  body: (c: Ctx) => string;
};

const ASSINATURA = `\n\nQualquer dúvida, é só responder por aqui.\n\nObrigado,\nRafael Lucena\nMonnera`;
const PEDIDO_THREAD = `\n\nPara mantermos tudo organizado, pedimos a gentileza de responder nesta mesma conversa.`;

const abertura = (c: Ctx) =>
  `Olá, tudo bem?\n\nEstamos finalizando o cadastro${c.cliente ? ` de ${c.cliente}` : ""} e precisamos de uma confirmação rápida para seguir com a operação.`;

const TEMPLATES: Record<string, Template> = {
  cnpj_ausente: {
    key: "cnpj_ausente",
    version: "v1",
    label: "CNPJ não informado",
    subject: (c) => `Confirmação de CNPJ${c.cliente ? ` — ${c.cliente}` : ""}`,
    body: (c) =>
      `${abertura(c)}\n\nNão localizamos o CNPJ da empresa nas informações que recebemos.\n\nVocê poderia nos confirmar o CNPJ completo (14 dígitos) da empresa${c.cliente ? ` ${c.cliente}` : ""}?${
        c.complemento ? `\n\n${c.complemento}` : ""
      }${PEDIDO_THREAD}${ASSINATURA}`,
  },
  cnpj_divergente: {
    key: "cnpj_divergente",
    version: "v1",
    label: "CNPJ divergente",
    subject: (c) => `Confirmação de CNPJ${c.cliente ? ` — ${c.cliente}` : ""}`,
    body: (c) =>
      `${abertura(c)}\n\nIdentificamos mais de um CNPJ associado a esta empresa e queremos evitar qualquer erro no cadastro.\n\nVocê poderia confirmar qual é o CNPJ correto${
        c.cnpj ? ` (o que temos registrado é ${c.cnpj})` : ""
      }?${c.complemento ? `\n\n${c.complemento}` : ""}${PEDIDO_THREAD}${ASSINATURA}`,
  },
  nome_incompativel: {
    key: "nome_incompativel",
    version: "v1",
    label: "Nome/razão social incompatível",
    subject: (c) => `Confirmação de razão social${c.cliente ? ` — ${c.cliente}` : ""}`,
    body: (c) =>
      `${abertura(c)}\n\nO nome da empresa que recebemos não está batendo com o cadastro que temos aqui.\n\nVocê poderia confirmar a razão social completa e o nome fantasia utilizados${
        c.cnpj ? `, junto com o CNPJ ${c.cnpj}` : ""
      }?${c.complemento ? `\n\n${c.complemento}` : ""}${PEDIDO_THREAD}${ASSINATURA}`,
  },
  codigo_nao_confirmado: {
    key: "codigo_nao_confirmado",
    version: "v1",
    label: "Código Monnera não confirmado",
    subject: (c) => `Confirmação do código Monnera${c.cliente ? ` — ${c.cliente}` : ""}`,
    body: (c) =>
      `${abertura(c)}\n\nO código Monnera informado não pôde ser confirmado${
        c.codigo ? ` (recebemos "${c.codigo}")` : ""
      }.\n\nO código tem exatamente 8 caracteres, apenas letras maiúsculas e números, sem hífen ou espaços. Você poderia nos confirmar o código correto?${
        c.complemento ? `\n\n${c.complemento}` : ""
      }${PEDIDO_THREAD}${ASSINATURA}`,
  },
  dados_conflitantes: {
    key: "dados_conflitantes",
    version: "v1",
    label: "Informações conflitantes",
    subject: (c) => `Confirmação de dados cadastrais${c.cliente ? ` — ${c.cliente}` : ""}`,
    body: (c) =>
      `${abertura(c)}\n\nRecebemos informações diferentes sobre esta empresa em momentos distintos e preferimos confirmar com você antes de seguir.\n\nVocê poderia nos confirmar os dados atuais: razão social, CNPJ, responsável pela operação e e-mail de contato?${
        c.complemento ? `\n\n${c.complemento}` : ""
      }${PEDIDO_THREAD}${ASSINATURA}`,
  },
  dados_incompletos: {
    key: "dados_incompletos",
    version: "v1",
    label: "Complemento de informação",
    subject: (c) => `Complemento de informação${c.cliente ? ` — ${c.cliente}` : ""}`,
    body: (c) =>
      `${abertura(c)}\n\nAgradecemos o retorno anterior. Ainda falta apenas um complemento para concluirmos:\n\n${
        c.complemento || "confirmação dos dados cadastrais da empresa (razão social, CNPJ e responsável)."
      }${PEDIDO_THREAD}${ASSINATURA}`,
  },
};

// ------------------------------------------------------------------ handler
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado." }, 401);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Não autenticado." }, 401);

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso restrito a administradores." }, 403);

    const body = await req.json().catch(() => ({}));
    const source = body?.source === "whatsapp" ? "whatsapp" : body?.source === "gmail" ? "gmail" : null;
    const rowId = typeof body?.row_id === "string" ? body.row_id : null;
    const pendency = typeof body?.pendency_code === "string" ? body.pendency_code : null;
    const reason = (typeof body?.reason === "string" ? body.reason : "").slice(0, 500);
    const complemento = (typeof body?.complemento === "string" ? body.complemento : "").slice(0, 600) || null;
    const dryRun = body?.dry_run === true;

    if (!source || !rowId || !pendency) return json({ error: "Parâmetros inválidos." }, 400);
    const template = TEMPLATES[pendency];
    if (!template) return json({ error: "Template de pendência desconhecido." }, 400);

    // ------------------------------------------------ registro de origem
    let cliente: string | null = null;
    let cnpj: string | null = null;
    let codigo: string | null = null;
    let cardId: string | null = null;
    let threadId: string | null = null;
    let originMessageId: string | null = null;
    let assuntoOriginal: string | null = null;
    let operationalStatus = "";
    const knownEmails: string[] = [];

    if (source === "gmail") {
      const { data: row, error } = await admin
        .from("gmail_processed_messages")
        .select(
          "id,message_id,thread_id,from_address,to_address,subject,extracted,manual_overrides,codigo_encontrado,matched_card_id,representative_card_id,operational_status",
        )
        .eq("id", rowId)
        .maybeSingle();
      if (error || !row) return json({ error: "Registro de triagem não encontrado." }, 404);

      const ov = (row.manual_overrides ?? {}) as Record<string, string>;
      const ex = (row.extracted ?? {}) as Record<string, unknown>;
      cliente = ov.nome_parceiro || (ex.nome_parceiro as string) || (ex.cliente as string) || null;
      cnpj = ov.cnpj || (ex.cnpj as string) || null;
      codigo = ov.codigo_monnera || row.codigo_encontrado || null;
      cardId = row.matched_card_id || row.representative_card_id || null;
      threadId = row.thread_id;
      originMessageId = row.message_id;
      assuntoOriginal = row.subject;
      operationalStatus = row.operational_status ?? "";
      knownEmails.push(...parseAddresses(ov.email), ...parseAddresses(ex.email as string));
    } else {
      const { data: row, error } = await admin
        .from("whatsapp_extractions")
        .select("id,cliente_nome,cnpj,codigo_monnera,email,matched_card_id,linked_card_id,suggested_gmail_message_id")
        .eq("id", rowId)
        .maybeSingle();
      if (error || !row) return json({ error: "Registro de triagem não encontrado." }, 404);

      cliente = row.cliente_nome;
      cnpj = row.cnpj;
      codigo = row.codigo_monnera;
      cardId = row.linked_card_id || row.matched_card_id || null;
      knownEmails.push(...parseAddresses(row.email));

      if (row.suggested_gmail_message_id) {
        const { data: gmailRow } = await admin
          .from("gmail_processed_messages")
          .select("thread_id,message_id,subject,from_address")
          .eq("message_id", row.suggested_gmail_message_id)
          .maybeSingle();
        if (gmailRow) {
          threadId = gmailRow.thread_id;
          originMessageId = gmailRow.message_id;
          assuntoOriginal = gmailRow.subject;
          knownEmails.push(...parseAddresses(gmailRow.from_address));
        }
      }
    }

    if (operationalStatus === "liberado" || operationalStatus === "executado") {
      return json({ error: "Registro já liberado — solicitação de informação não se aplica." }, 400);
    }

    if (body?.card_id && typeof body.card_id === "string") cardId = body.card_id;

    // ------------------------------------------- duplicidade / intervalo
    const since = new Date(Date.now() - MIN_INTERVAL_HOURS * 3600 * 1000).toISOString();
    const { data: recent } = await admin
      .from("triage_info_requests")
      .select("id,created_at,attempt,status,pendency_code")
      .eq("row_id", rowId)
      .eq("pendency_code", pendency)
      .eq("status", "enviado")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recent && recent.length > 0) {
      return json(
        {
          error: "duplicado",
          message: `Já existe uma solicitação desta pendência enviada em ${new Date(recent[0].created_at).toLocaleString("pt-BR")}. Intervalo mínimo entre cobranças: ${MIN_INTERVAL_HOURS}h.`,
        },
        409,
      );
    }

    const { count: attemptCount } = await admin
      .from("triage_info_requests")
      .select("id", { count: "exact", head: true })
      .eq("row_id", rowId)
      .eq("pendency_code", pendency)
      .eq("status", "enviado");
    const attempt = (attemptCount ?? 0) + 1;

    // ------------------------------------------------------ destinatários
    const connectionReady = Boolean(LOVABLE_API_KEY && GMAIL_CONNECTION_KEY);
    if (!connectionReady) {
      return json(
        {
          error: "bloqueio_tecnico",
          message:
            "Conexão Gmail indisponível (credenciais do conector ausentes). Nenhum e-mail foi enviado e nenhum envio foi simulado.",
        },
        503,
      );
    }

    const threadAddresses: string[] = [];
    let inReplyTo = "";
    let references = "";

    if (threadId) {
      try {
        const thread = await gmailFetch(`/users/me/threads/${threadId}?format=metadata`);
        for (const msg of thread?.messages ?? []) {
          const p = msg.payload;
          threadAddresses.push(
            ...parseAddresses(header(p, "Reply-To")),
            ...parseAddresses(header(p, "From")),
            ...parseAddresses(header(p, "To")),
            ...parseAddresses(header(p, "Cc")),
          );
        }
        const last = (thread?.messages ?? []).at(-1);
        if (last) {
          inReplyTo = header(last.payload, "Message-ID");
          references = [header(last.payload, "References"), inReplyTo].filter(Boolean).join(" ");
          if (!assuntoOriginal) assuntoOriginal = header(last.payload, "Subject");
        }
      } catch (err) {
        console.error("Falha ao ler thread:", err);
      }
    } else if (originMessageId) {
      try {
        const msg = await gmailFetch(`/users/me/messages/${originMessageId}?format=metadata`);
        threadAddresses.push(
          ...parseAddresses(header(msg.payload, "Reply-To")),
          ...parseAddresses(header(msg.payload, "From")),
        );
        inReplyTo = header(msg.payload, "Message-ID");
        references = inReplyTo;
        threadId = msg.threadId ?? null;
      } catch (err) {
        console.error("Falha ao ler mensagem original:", err);
      }
    }

    const cardEmails: string[] = [];
    if (cardId) {
      const { data: card } = await admin
        .from("representative_cards")
        .select("email,full_name")
        .eq("id", cardId)
        .maybeSingle();
      if (card?.email) cardEmails.push(...parseAddresses(card.email));
      if (!cliente && card?.full_name) cliente = card.full_name;
    }

    const dedupe = (list: string[]) => Array.from(new Set(list.filter(isUsable)));

    let recipients = dedupe(threadAddresses);
    let recipientsSource = "thread_original";

    if (recipients.length === 0) {
      recipients = dedupe(cardEmails);
      recipientsSource = "email_do_card";
    }
    if (recipients.length === 0) {
      recipients = dedupe(knownEmails);
      recipientsSource = "participante_comprovado";
    }
    if (recipients.length === 0) {
      recipients = [...LAST_RESORT];
      recipientsSource = "ultimo_recurso";
    }

    recipients = recipients.slice(0, MAX_RECIPIENTS);

    if (recipients.length === 0) {
      await admin.from("triage_info_requests").insert({
        source,
        row_id: rowId,
        card_id: cardId,
        pendency_code: pendency,
        reason: reason || template.label,
        template_key: template.key,
        template_version: template.version,
        subject: "",
        recipients: [],
        recipients_source: "nenhum",
        thread_id: threadId,
        status: "bloqueado_sem_destinatario",
        attempt,
        error: "Nenhum destinatário comprovado.",
        created_by: user.id,
      });
      return json({ error: "sem_destinatario", message: "Nenhum destinatário comprovado — envio não realizado." }, 422);
    }

    // ---------------------------------------------------------- mensagem
    const ctx: Ctx = { cliente, cnpj, codigo, assuntoOriginal, complemento };
    const baseSubject = template.subject(ctx);
    const subject =
      assuntoOriginal && threadId
        ? assuntoOriginal.toLowerCase().startsWith("re:")
          ? assuntoOriginal
          : `Re: ${assuntoOriginal}`
        : baseSubject;
    const text = template.body(ctx);

    if (dryRun) {
      return json({ preview: true, recipients, recipients_source: recipientsSource, subject, text, attempt });
    }

    const mime = [
      `From: ${encodeSubject(SENDER_NAME)} <${SENDER_ACCOUNT}>`,
      `To: ${recipients.join(", ")}`,
      `Subject: ${encodeSubject(subject)}`,
      inReplyTo ? `In-Reply-To: ${inReplyTo}` : null,
      references ? `References: ${references}` : null,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      b64Utf8(text).replace(/(.{76})/g, "$1\r\n"),
    ]
      .filter((l) => l !== null)
      .join("\r\n");

    const raw = b64Url(new TextEncoder().encode(mime));

    let sentId: string | null = null;
    let sentThread: string | null = threadId;
    let sendError: string | null = null;

    try {
      const sent = await gmailFetch("/users/me/messages/send", {
        method: "POST",
        body: JSON.stringify(threadId ? { raw, threadId } : { raw }),
      });
      sentId = sent?.id ?? null;
      sentThread = sent?.threadId ?? threadId;
    } catch (err) {
      sendError = String((err as Error).message ?? err).slice(0, 500);
    }

    const { data: logRow } = await admin
      .from("triage_info_requests")
      .insert({
        source,
        row_id: rowId,
        card_id: cardId,
        pendency_code: pendency,
        reason: reason || template.label,
        template_key: template.key,
        template_version: template.version,
        subject,
        recipients,
        recipients_source: recipientsSource,
        thread_id: sentThread,
        gmail_message_id: sentId,
        status: sendError ? "falhou" : "enviado",
        attempt,
        error: sendError,
        sent_at: sendError ? null : new Date().toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();

    if (sendError) {
      return json({ error: "falha_envio", message: sendError, request_id: logRow?.id ?? null }, 502);
    }

    return json({
      enviado: true,
      request_id: logRow?.id ?? null,
      recipients,
      recipients_source: recipientsSource,
      subject,
      thread_id: sentThread,
      gmail_message_id: sentId,
      attempt,
      template: `${template.key}@${template.version}`,
    });
  } catch (err) {
    console.error(err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
