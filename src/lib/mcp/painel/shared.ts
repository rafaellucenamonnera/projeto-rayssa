import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

/** Painel Onb Clientes Cross — único painel acessível por estas ferramentas. */
export const PANEL_ID = "painel_msj9fyji";

export const ATTACHMENT_BUCKET = "representative-card-attachments";
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "html",
  "json",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
] as const;

export const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  html: "text/html",
  json: "application/json",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export const CARD_FIELDS =
  "id, panel_id, stage_id, full_name, cnpj, phone, email, notes, city, state, region, status, source, responsible_user_id, created_by_user_id, parceiro_id, partner_code, focal_name, focal_phone, focal_email, contratante_monnera, vendor_name, vendor_phone, vendor_email, codigo_monnera, codigo_source, jira_issue_key, jira_issue_status, canva_public_url, canva_internal_url, canva_material_url, is_blocked, blocked_reason, is_protected, pending_complement, pending_fields, test_mode, created_at, updated_at";

type Json = Record<string, unknown>;

/** Resposta de sucesso padronizada do MCP. */
export function success(operation: string, data: unknown, extra: Json = {}) {
  const payload = {
    success: true,
    operation,
    ...extra,
    data,
    evidence: { queried_at: new Date().toISOString(), panel_id: PANEL_ID },
  };
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

/** Resposta de erro padronizada do MCP. */
export function failure(error_code: string, message: string, details: Json = {}) {
  const payload = { success: false, error_code, message, details };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    isError: true,
  };
}

export function requireUser(ctx: ToolContext): string {
  if (!ctx.isAuthenticated()) throw new Error("UNAUTHENTICATED: sessão OAuth obrigatória.");
  const userId = ctx.getUserId();
  if (!userId) throw new Error("UNAUTHENTICATED: não foi possível identificar o usuário.");
  return userId;
}

export function client(ctx: ToolContext) {
  return supabaseForUser(ctx);
}

export function digitsOnly(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Nome de arquivo seguro: sem diretórios, sem path traversal. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/\.{2,}/g, ".").replace(/[^\w.\-]+/g, "_").replace(/^\.+/, "");
  return clean.slice(0, 180);
}

export function extensionOf(name: string): string {
  return safeFileName(name).split(".").pop()?.toLowerCase() ?? "";
}

export function decodeBase64(input: string): Uint8Array {
  const clean = input.startsWith("data:") && input.includes(",") ? input.slice(input.indexOf(",") + 1) : input;
  const binary = atob(clean.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Garante que o card pertence ao painel permitido. Retorna null quando não encontrado/sem acesso. */
export async function loadCard(
  supabase: ReturnType<typeof supabaseForUser>,
  cardId: string,
  fields = CARD_FIELDS,
) {
  const { data, error } = await supabase
    .from("representative_cards")
    .select(fields)
    .eq("id", cardId)
    .eq("panel_id", PANEL_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function stageLabels(supabase: ReturnType<typeof supabaseForUser>) {
  const { data } = await supabase
    .from("pipeline_stages_config")
    .select("value, label, sort_order")
    .eq("panel_key", PANEL_ID)
    .order("sort_order");
  return data ?? [];
}

/** Registra auditoria de escrita no histórico do card. */
export async function logHistory(
  supabase: ReturnType<typeof supabaseForUser>,
  params: {
    cardId: string;
    userId: string;
    action: string;
    payload?: Json;
    sourceStageId?: string | null;
    destinationStageId?: string | null;
    actorLabel?: string;
  },
) {
  const { error } = await supabase.from("representative_card_history").insert({
    representative_card_id: params.cardId,
    actor_user_id: params.userId,
    actor_label: params.actorLabel ?? "mcp",
    action: params.action,
    source_stage_id: params.sourceStageId ?? null,
    destination_stage_id: params.destinationStageId ?? null,
    payload: { origem: "mcp", ...(params.payload ?? {}) },
  });
  if (error) console.error("[mcp painel] falha ao registrar histórico:", error.message);
}
