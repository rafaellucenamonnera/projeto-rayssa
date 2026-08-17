import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

/**
 * Importação de conversas do WhatsApp em MODO TRIAGEM.
 *
 * Garantias desta versão:
 * - o arquivo original é preservado no storage privado junto com o hash SHA-256;
 * - nenhum card é criado, movido ou alterado automaticamente;
 * - nenhuma tarefa, comentário ou notificação automática é gerada;
 * - áudios, vídeos e imagens não são processados (apenas anotados como mídia ignorada);
 * - todo dado extraído guarda o trecho original que o fundamentou.
 */

export const WHATSAPP_BUCKET = "whatsapp-imports";
export const MAX_WHATSAPP_BYTES = 20 * 1024 * 1024;
export const ALLOWED_WHATSAPP_EXTENSIONS = ["txt", "zip"];

export type WhatsappMessage = {
  at: Date | null;
  raw_date: string;
  author: string;
  text: string;
  line: string;
};

export type Evidence = {
  field: string;
  value: string;
  snippet: string;
  author?: string;
  at?: string | null;
};

export type PendingReason = { code: string; label: string };

export type WhatsappExtraction = {
  cliente_nome: string | null;
  cnpj: string | null;
  cnpj_candidates: Array<{ cnpj: string; snippet: string }>;
  email: string | null;
  telefone: string | null;
  codigo_monnera: string | null;
  campanhas: string[];
  metas: string[];
  regras: string[];
  pendencias: string[];
  evidences: Evidence[];
  pending_reasons: PendingReason[];
  confidence: number;
  status: string;
  participants: string[];
  message_count: number;
  first_at: string | null;
  last_at: string | null;
};

export const STATUS_LABEL: Record<string, string> = {
  triage_ok: "Pronto para vínculo",
  triage_sem_cnpj: "Sem CNPJ",
  triage_sem_nome: "Sem nome",
  triage_ambiguo: "Ambíguo",
  triage_divergencia_cnpj: "CNPJ divergente do card",
  triage_duplicado: "CNPJ já tem card",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export const PENDING_LABEL: Record<string, string> = {
  sem_cnpj: "Sem CNPJ",
  sem_nome: "Sem nome do cliente",
  sem_codigo: "Sem código Monnera",
  codigo_exemplo_invalido: "Código demonstrativo inválido",
  codigo_formato_nao_confirmado: "Código em formato não confirmado",
  multiplos_cnpj: "Múltiplos CNPJs na conversa",
  divergencia_cnpj: "CNPJ divergente do card sugerido",
  duplicado: "CNPJ já possui card",
  info_ambigua: "Informação ambígua",
  midia_ignorada: "Mídia não processada nesta versão",
};

/**
 * Regra oficial do código Monnera: exatamente 8 caracteres, apenas letras
 * maiúsculas (A-Z) e números (0-9), sem hífen, espaço ou outros símbolos.
 * Exemplo válido: 8K2M9P4L.
 */
export const MONNERA_CODE_RE = /^[A-Z0-9]{8}$/;

/** Códigos demonstrativos: mesmo no formato válido, nunca são código real. */
export const DEMO_MONNERA_CODES = new Set(["3SAXJF92", "UB5PXGDB", "XXXXXXX", "XXXXXXXX"]);

export const isDemoMonneraCode = (value: string) =>
  DEMO_MONNERA_CODES.has(value.trim().toUpperCase());

export const isValidMonneraCode = (value: string) => {
  const v = value.trim().toUpperCase();
  return MONNERA_CODE_RE.test(v) && !isDemoMonneraCode(v);
};

/**
 * Formatos históricos com prefixo (ex.: MNR-A1B2C3) não são reprovados nem
 * normalizados: ficam marcados como "formato não confirmado" para revisão.
 */
export const UNCONFIRMED_CODE_RE = /\b(?:MNR|MON|CROSS)[-_ ]?[A-Z0-9]{3,12}\b/i;


const MEDIA_MARKERS = [
  "<mídia oculta>",
  "<midia oculta>",
  "<media omitted>",
  "arquivo de mídia oculto",
  "imagem ocultada",
  "áudio ocultado",
  "audio ocultado",
  "vídeo ocultado",
  "video ocultado",
  "figurinha omitida",
  "sticker omitted",
  "(arquivo anexado)",
  "(file attached)",
];

export const validateWhatsappFile = (file: File): string | null => {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_WHATSAPP_EXTENSIONS.includes(ext)) {
    return `Formato não permitido em "${file.name}". Envie o export do WhatsApp em .txt ou .zip.`;
  }
  if (file.size > MAX_WHATSAPP_BYTES) return `O arquivo "${file.name}" excede o limite de 20 MB.`;
  return null;
};

export const sha256Hex = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/** Extrai o texto da conversa: .txt direto ou o maior .txt dentro do .zip. */
export const readConversationText = async (file: File): Promise<string> => {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "txt") return await file.text();

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const txtFiles = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.toLowerCase().endsWith(".txt"),
  );
  if (!txtFiles.length) throw new Error("Nenhum arquivo .txt de conversa encontrado no .zip.");
  const contents = await Promise.all(txtFiles.map((f) => f.async("string")));
  return contents.sort((a, b) => b.length - a.length)[0];
};

const LINE_RE =
  /^\u200e?\[?(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4})[,]?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s?([AaPp][Mm])?\]?\s*[-–]?\s*([^:]{1,80}?):\s?([\s\S]*)$/;

const parseDate = (d: string, t: string, ampm?: string): Date | null => {
  const [dd, mm, yyRaw] = d.split(/[\/.]/).map((x) => parseInt(x, 10));
  if (!dd || !mm) return null;
  const yyyy = yyRaw < 100 ? 2000 + yyRaw : yyRaw;
  const [hRaw, min, sec] = t.split(":").map((x) => parseInt(x, 10));
  let h = hRaw;
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === "PM" && h < 12) h += 12;
    if (upper === "AM" && h === 12) h = 0;
  }
  const date = new Date(yyyy, mm - 1, dd, h || 0, min || 0, sec || 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const parseConversation = (text: string): WhatsappMessage[] => {
  const messages: WhatsappMessage[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/\u200e|\u200f/g, "").trim();
    if (!line) continue;
    const m = line.match(LINE_RE);
    if (m) {
      const [, d, t, ampm, author, body] = m;
      messages.push({
        at: parseDate(d, t, ampm),
        raw_date: `${d} ${t}${ampm ? " " + ampm : ""}`,
        author: author.trim(),
        text: body.trim(),
        line,
      });
    } else if (messages.length) {
      const last = messages[messages.length - 1];
      last.text = `${last.text}\n${line}`.trim();
      last.line = `${last.line}\n${line}`;
    }
  }
  return messages;
};

const isMedia = (text: string) => {
  const lower = text.toLowerCase();
  return MEDIA_MARKERS.some((marker) => lower.includes(marker));
};

const snippetOf = (text: string, index: number, size = 160) => {
  const start = Math.max(0, index - size / 2);
  return text.slice(start, start + size).trim();
};

const normalizeDigits = (value: string) => value.replace(/\D/g, "");

export const findCnpjs = (messages: WhatsappMessage[]) => {
  const found = new Map<string, { cnpj: string; snippet: string }>();
  const re = /\b\d{2}[.\s]?\d{3}[.\s]?\d{3}[\/\s]?\d{4}[-\s]?\d{2}\b|\b\d{14}\b/g;
  for (const msg of messages) {
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(msg.text))) {
      const digits = normalizeDigits(match[0]);
      if (digits.length !== 14) continue;
      if (!found.has(digits)) found.set(digits, { cnpj: digits, snippet: snippetOf(msg.text, match.index) });
    }
  }
  return Array.from(found.values());
};

const firstMatch = (
  messages: WhatsappMessage[],
  re: RegExp,
  group = 0,
): { value: string; snippet: string; msg: WhatsappMessage } | null => {
  for (const msg of messages) {
    const local = new RegExp(re.source, re.flags.replace("g", ""));
    const m = msg.text.match(local);
    if (m) return { value: (m[group] ?? m[0]).trim(), snippet: snippetOf(msg.text, m.index ?? 0), msg };
  }
  return null;
};

const collectLabeled = (messages: WhatsappMessage[], re: RegExp, limit = 8) => {
  const out: Array<{ value: string; snippet: string; msg: WhatsappMessage }> = [];
  for (const msg of messages) {
    const local = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = local.exec(msg.text)) && out.length < limit) {
      const value = (m[1] ?? m[0]).trim();
      if (value && !out.some((o) => o.value.toLowerCase() === value.toLowerCase())) {
        out.push({ value, snippet: snippetOf(msg.text, m.index), msg });
      }
    }
  }
  return out;
};

const AMBIGUOUS_MARKERS =
  /\b(acho que|talvez|n[ãa]o tenho certeza|verificar depois|a confirmar|precisa confirmar|ver com|em aberto|pode ser)\b/i;

export const extractFromConversation = (messages: WhatsappMessage[]): WhatsappExtraction => {
  const usable = messages.filter((m) => !isMedia(m.text));
  const hadMedia = usable.length !== messages.length;
  const evidences: Evidence[] = [];
  const pending: PendingReason[] = [];
  const addPending = (code: string) => {
    if (!pending.some((p) => p.code === code)) pending.push({ code, label: PENDING_LABEL[code] ?? code });
  };
  const addEvidence = (field: string, value: string, snippet: string, msg?: WhatsappMessage) =>
    evidences.push({ field, value, snippet, author: msg?.author, at: msg?.at?.toISOString() ?? null });

  // CNPJ
  const cnpjs = findCnpjs(usable);
  let cnpj: string | null = null;
  if (cnpjs.length === 1) {
    cnpj = cnpjs[0].cnpj;
    addEvidence("cnpj", cnpj, cnpjs[0].snippet);
  } else if (cnpjs.length > 1) {
    cnpj = cnpjs[0].cnpj;
    cnpjs.forEach((c) => addEvidence("cnpj_candidato", c.cnpj, c.snippet));
    addPending("multiplos_cnpj");
  } else {
    addPending("sem_cnpj");
  }

  // Nome do cliente
  const nome =
    firstMatch(usable, /(?:cliente|parceiro|empresa|raz[ãa]o social|nome fantasia)\s*[:\-]\s*(.{3,80})/i, 1) ??
    firstMatch(usable, /(?:conta|loja)\s*[:\-]\s*(.{3,80})/i, 1);
  if (nome) addEvidence("cliente_nome", nome.value, nome.snippet, nome.msg);
  else addPending("sem_nome");

  // Código Monnera — regra oficial: 8 caracteres [A-Z0-9], sem símbolos.
  const codigoOficial =
    firstMatch(usable, /(?:c[oó]digo(?:\s+monnera)?|protocolo)\s*[:\-]?\s*([A-Z0-9]{8})\b/i, 1) ??
    firstMatch(usable, /\b(?=[A-Z0-9]{8}\b)(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8}\b/, 0);
  const codigoNaoConfirmado = codigoOficial
    ? null
    : firstMatch(usable, UNCONFIRMED_CODE_RE, 0);

  const demoHit = firstMatch(usable, /\b(3SAXJF92|UB5PXGDB|X{7,8})\b/i, 0);

  let codigo: { value: string; snippet: string; msg: WhatsappMessage } | null = null;
  if (demoHit || (codigoOficial && isDemoMonneraCode(codigoOficial.value))) {
    const hit = demoHit ?? codigoOficial!;
    addPending("codigo_exemplo_invalido");
    addPending("sem_codigo");
    addEvidence("codigo_exemplo_invalido", hit.value.toUpperCase(), hit.snippet, hit.msg);
  } else if (codigoOficial && isValidMonneraCode(codigoOficial.value)) {
    codigo = { ...codigoOficial, value: codigoOficial.value.toUpperCase() };
    addEvidence("codigo_monnera", codigo.value, codigo.snippet, codigo.msg);
  } else if (codigoNaoConfirmado) {
    // não altera a regra: apenas sinaliza para revisão manual
    addPending("codigo_formato_nao_confirmado");
    addEvidence(
      "codigo_monnera_nao_confirmado",
      codigoNaoConfirmado.value.toUpperCase(),
      codigoNaoConfirmado.snippet,
      codigoNaoConfirmado.msg,
    );
    addPending("sem_codigo");
  } else {
    addPending("sem_codigo");
  }


  // Contatos
  const email = firstMatch(usable, /[\w.+-]+@[\w-]+\.[\w.]{2,}/i);
  if (email) addEvidence("email", email.value.toLowerCase(), email.snippet, email.msg);
  const telefone = firstMatch(usable, /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/);
  if (telefone) addEvidence("telefone", telefone.value, telefone.snippet, telefone.msg);

  // Campanhas / metas / regras / pendências
  const campanhas = collectLabeled(usable, /campanha[s]?\s*[:\-]?\s*([^\n.;]{3,90})/i);
  const metas = collectLabeled(usable, /(?:meta|objetivo|target)\s*[:\-]?\s*([^\n.;]{3,90})/i);
  const regras = collectLabeled(usable, /(?:regra|crit[ée]rio|elegibilidade|pol[íi]tica)\s*[:\-]?\s*([^\n.;]{3,120})/i);
  const pendencias = collectLabeled(usable, /(?:pend[êe]ncia|pendente|falta|aguardando)\s*[:\-]?\s*([^\n.;]{3,120})/i);
  campanhas.forEach((c) => addEvidence("campanha", c.value, c.snippet, c.msg));
  metas.forEach((c) => addEvidence("meta", c.value, c.snippet, c.msg));
  regras.forEach((c) => addEvidence("regra", c.value, c.snippet, c.msg));
  pendencias.forEach((c) => addEvidence("pendencia", c.value, c.snippet, c.msg));

  const ambiguous = firstMatch(usable, AMBIGUOUS_MARKERS);
  if (ambiguous) {
    addPending("info_ambigua");
    addEvidence("informacao_ambigua", ambiguous.value, ambiguous.snippet, ambiguous.msg);
  }
  if (hadMedia) addPending("midia_ignorada");

  // Confiança: sinais fortes somam, pendências descontam
  let confidence = 0;
  if (cnpj && cnpjs.length === 1) confidence += 40;
  else if (cnpj) confidence += 15;
  if (nome) confidence += 25;
  if (codigo) confidence += 20;
  if (email) confidence += 8;
  if (telefone) confidence += 7;
  if (ambiguous) confidence -= 10;
  confidence = Math.max(0, Math.min(100, confidence));

  let status = "triage_ok";
  if (cnpjs.length > 1 || ambiguous) status = "triage_ambiguo";
  else if (!cnpj) status = "triage_sem_cnpj";
  else if (!nome) status = "triage_sem_nome";

  const dated = usable.filter((m) => m.at).map((m) => m.at as Date);
  const participants = Array.from(new Set(messages.map((m) => m.author))).slice(0, 30);

  return {
    cliente_nome: nome?.value ?? null,
    cnpj,
    cnpj_candidates: cnpjs,
    email: email ? email.value.toLowerCase() : null,
    telefone: telefone?.value ?? null,
    codigo_monnera: codigo ? codigo.value : null,
    campanhas: campanhas.map((c) => c.value),
    metas: metas.map((c) => c.value),
    regras: regras.map((c) => c.value),
    pendencias: pendencias.map((c) => c.value),
    evidences,
    pending_reasons: pending,
    confidence,
    status,
    participants,
    message_count: messages.length,
    first_at: dated.length ? new Date(Math.min(...dated.map((d) => d.getTime()))).toISOString() : null,
    last_at: dated.length ? new Date(Math.max(...dated.map((d) => d.getTime()))).toISOString() : null,
  };
};

export type CrossCardRef = { id: string; full_name: string; cnpj: string | null; codigo?: string | null };

/** Cruza a extração com cards existentes — apenas sugere, nunca altera. */
export const matchCard = (extraction: WhatsappExtraction, cards: CrossCardRef[]) => {
  const digits = (v?: string | null) => (v ? v.replace(/\D/g, "") : "");
  const byCnpj = extraction.cnpj ? cards.filter((c) => digits(c.cnpj) === extraction.cnpj) : [];
  if (byCnpj.length === 1) return { card: byCnpj[0], reason: "cnpj" as const };
  if (byCnpj.length > 1) return { card: byCnpj[0], reason: "ambiguo" as const };

  if (extraction.cliente_nome) {
    const needle = extraction.cliente_nome.toLowerCase().trim();
    const byName = cards.filter(
      (c) => c.full_name.toLowerCase().includes(needle) || needle.includes(c.full_name.toLowerCase()),
    );
    if (byName.length === 1) return { card: byName[0], reason: "nome" as const };
    if (byName.length > 1) return { card: byName[0], reason: "ambiguo" as const };
  }
  return { card: null, reason: "sem_match" as const };
};

export type ImportResult = {
  duplicate: boolean;
  importId: string | null;
  extraction?: WhatsappExtraction;
};

/** Processa e grava um arquivo em modo triagem (idempotente pelo hash). */
export const importWhatsappFile = async (
  file: File,
  cards: CrossCardRef[],
  userId: string | null,
): Promise<ImportResult> => {
  const invalid = validateWhatsappFile(file);
  if (invalid) throw new Error(invalid);

  const hash = await sha256Hex(file);
  const { data: existing } = await (supabase as any)
    .from("whatsapp_imports")
    .select("id")
    .eq("content_sha256", hash)
    .maybeSingle();
  if (existing) return { duplicate: true, importId: existing.id };

  const text = await readConversationText(file);
  const messages = parseConversation(text);
  if (!messages.length) throw new Error("Não foi possível ler mensagens neste arquivo de conversa.");
  const extraction = extractFromConversation(messages);

  // preserva o arquivo original
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${hash.slice(0, 12)}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from(WHATSAPP_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (uploadError) throw uploadError;

  const { data: imported, error: importError } = await (supabase as any)
    .from("whatsapp_imports")
    .insert({
      file_name: file.name,
      file_type: file.type || file.name.split(".").pop(),
      size_bytes: file.size,
      content_sha256: hash,
      storage_path: path,
      status: "processado",
      message_count: extraction.message_count,
      participants: extraction.participants,
      first_message_at: extraction.first_at,
      last_message_at: extraction.last_at,
      created_by: userId,
    })
    .select("id")
    .single();
  if (importError) {
    await supabase.storage.from(WHATSAPP_BUCKET).remove([path]);
    if ((importError as any).code === "23505") return { duplicate: true, importId: null };
    throw importError;
  }

  const match = matchCard(extraction, cards);
  const pendingReasons = [...extraction.pending_reasons];
  let status = extraction.status;

  if (match.reason === "ambiguo") {
    status = "triage_ambiguo";
    if (!pendingReasons.some((p) => p.code === "info_ambigua"))
      pendingReasons.push({ code: "info_ambigua", label: PENDING_LABEL.info_ambigua });
  } else if (match.card) {
    const cardCnpj = (match.card.cnpj || "").replace(/\D/g, "");
    if (extraction.cnpj && cardCnpj && cardCnpj !== extraction.cnpj) {
      status = "triage_divergencia_cnpj";
      pendingReasons.push({ code: "divergencia_cnpj", label: PENDING_LABEL.divergencia_cnpj });
    } else if (extraction.cnpj && cardCnpj === extraction.cnpj) {
      status = status === "triage_ok" ? "triage_duplicado" : status;
      pendingReasons.push({ code: "duplicado", label: PENDING_LABEL.duplicado });
    }
  }

  const { error: extractionError } = await (supabase as any).from("whatsapp_extractions").insert({
    import_id: imported.id,
    cliente_nome: extraction.cliente_nome,
    cnpj: extraction.cnpj,
    cnpj_candidates: extraction.cnpj_candidates,
    email: extraction.email,
    telefone: extraction.telefone,
    codigo_monnera: extraction.codigo_monnera,
    campanhas: extraction.campanhas,
    metas: extraction.metas,
    regras: extraction.regras,
    pendencias: extraction.pendencias,
    evidences: extraction.evidences,
    pending_reasons: pendingReasons,
    confidence: extraction.confidence,
    status,
    matched_card_id: match.card?.id ?? null,
    conversation_started_at: extraction.first_at,
    conversation_ended_at: extraction.last_at,
    message_count: extraction.message_count,
  });
  if (extractionError) throw extractionError;

  return { duplicate: false, importId: imported.id, extraction };
};
