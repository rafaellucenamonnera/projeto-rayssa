// Regras compartilhadas do fluxo "código Monnera vindo do Jira" (polling e botão manual).
import { extractMonneraCode, validateMonneraCode } from "./monneraCode.ts";
import { CROSS_PANEL_ID, getIssueComments, type JiraComment, type JiraIssue } from "./jira.ts";

export const NOTIFY_USERS = [
  "d8e99940-2d3a-45e6-8170-0bf2f5fc98a9", // rafael.lucena@monnera.com.br
  "87842ad6-9a02-4e66-82ac-65f2743a2596", // maycon.santos@monnera.com.br
];

export const CARD_FIELDS =
  "id, full_name, cnpj, stage_id, codigo_monnera, jira_issue_key, origin_thread_id, is_protected, test_mode, panel_id";

export interface CardRow {
  id: string;
  full_name: string | null;
  cnpj: string | null;
  stage_id: string | null;
  codigo_monnera: string | null;
  jira_issue_key: string | null;
  origin_thread_id: string | null;
  is_protected: boolean | null;
  test_mode: boolean | null;
  panel_id: string | null;
}

export interface CodeHit {
  code: string;
  origin: string;
  evidence: string;
}

const normalizeName = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ]/g, "").trim().toUpperCase();

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Procura o código no campo configurado, na descrição e nos comentários (mais recente primeiro). */
export function findCodeInIssue(issue: JiraIssue, comments: JiraComment[]): CodeHit | null {
  const sources: Array<{ origin: string; text: string }> = [];
  if (issue.customField) sources.push({ origin: "campo configurado", text: issue.customField });
  for (let i = comments.length - 1; i >= 0; i--) {
    sources.push({ origin: `comentário #${i + 1} (${comments[i].author})`, text: comments[i].body });
  }
  if (issue.description) sources.push({ origin: "descrição", text: issue.description });

  for (const src of sources) {
    const raw = extractMonneraCode(src.text);
    if (!raw) continue;
    const validation = validateMonneraCode(raw, { allowTest: true });
    if (!validation.ok) continue;
    const idx = src.text.toUpperCase().indexOf(validation.code);
    const evidence = src.text.slice(Math.max(0, idx - 90), idx + 110).trim();
    return { code: validation.code, origin: src.origin, evidence };
  }
  return null;
}

export interface Resolution {
  card: CardRow | null;
  reason: string | null;
  candidates: Array<{ id: string; full_name: string | null }>;
  matchedBy: string | null;
}

/** Associação inequívoca: jira_issue_key -> card_id no texto -> thread_id -> CNPJ -> nome exato. */
export async function resolveCard(admin: any, issue: JiraIssue): Promise<Resolution> {
  const text = [issue.summary, issue.description, issue.customField ?? ""].join("\n");
  const base = () => admin.from("representative_cards").select(CARD_FIELDS).eq("panel_id", CROSS_PANEL_ID);

  const attempts: Array<{ by: string; run: () => Promise<any> }> = [
    { by: "jira_issue_key", run: () => base().eq("jira_issue_key", issue.key) },
  ];

  const cardIdMatch = text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (cardIdMatch) attempts.push({ by: "card_id", run: () => base().eq("id", cardIdMatch[0]) });

  const threadMatch = text.match(/thread[:\s]+([A-Za-z0-9_-]{6,})/i);
  if (threadMatch) attempts.push({ by: "thread_id", run: () => base().eq("origin_thread_id", threadMatch[1]) });

  const cnpjMatch = text.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (cnpjMatch) attempts.push({ by: "cnpj", run: () => base().eq("cnpj", digits(cnpjMatch[0])) });

  for (const attempt of attempts) {
    const { data } = await attempt.run();
    const rows: CardRow[] = data ?? [];
    if (rows.length === 1) return { card: rows[0], reason: null, candidates: [], matchedBy: attempt.by };
    if (rows.length > 1) {
      return {
        card: null,
        reason: `Ambiguidade: ${rows.length} cards correspondem por ${attempt.by}.`,
        candidates: rows.map((r) => ({ id: r.id, full_name: r.full_name })),
        matchedBy: attempt.by,
      };
    }
  }

  // Nome exato (normalizado) como último recurso.
  const summaryName = normalizeName(issue.summary.replace(/^.*—\s*/, ""));
  if (summaryName.length >= 4) {
    const { data } = await base();
    const rows: CardRow[] = (data ?? []).filter((r: CardRow) => normalizeName(r.full_name) === summaryName);
    if (rows.length === 1) return { card: rows[0], reason: null, candidates: [], matchedBy: "nome exato" };
    if (rows.length > 1) {
      return {
        card: null,
        reason: `Ambiguidade: ${rows.length} cards com o mesmo nome.`,
        candidates: rows.map((r) => ({ id: r.id, full_name: r.full_name })),
        matchedBy: "nome exato",
      };
    }
  }

  return { card: null, reason: "Nenhum card associado de forma inequívoca.", candidates: [], matchedBy: null };
}

export async function loadIssueComments(issueKey: string): Promise<JiraComment[]> {
  try {
    return await getIssueComments(issueKey);
  } catch (_) {
    return [];
  }
}

export async function notifyAdmins(admin: any, title: string, message: string, cardId: string | null) {
  for (const userId of NOTIFY_USERS) {
    try {
      await admin.rpc("create_notification", {
        p_recipient_user_id: userId,
        p_type: "cross_block_created",
        p_title: title,
        p_message: message,
        p_representative_card_id: cardId,
        p_delivery_key: `jira_sync_${cardId ?? "sem_card"}_${title}_${Date.now()}`,
      });
    } catch (_) { /* notificação nunca derruba o fluxo */ }
  }
}

export type GateResult = { ok: true } | { ok: false; status: string; reason: string };

/** Regras que impedem gravação, antes de qualquer escrita. */
export async function gateApplication(admin: any, card: CardRow, code: string): Promise<GateResult> {
  if (card.is_protected) return { ok: false, status: "ignorado_protegido", reason: "Card protegido: nenhuma alteração permitida." };

  const { data: protectedRows } = await admin
    .from("protected_entities")
    .select("id")
    .or(`card_id.eq.${card.id},cnpj_normalizado.eq.${digits(card.cnpj)}`);
  if (protectedRows?.length) {
    return { ok: false, status: "ignorado_protegido", reason: "Card protegido: nenhuma alteração permitida." };
  }

  if (card.codigo_monnera && card.codigo_monnera.toUpperCase() === code) {
    return { ok: false, status: "ignorado", reason: "Código já aplicado (idempotente)." };
  }
  if (card.codigo_monnera && card.codigo_monnera.toUpperCase() !== code) {
    return { ok: false, status: "divergencia", reason: `Divergência: card já tem ${card.codigo_monnera} e o Jira informou ${code}.` };
  }

  const { data: reused } = await admin
    .from("representative_cards")
    .select("id, cnpj")
    .eq("panel_id", CROSS_PANEL_ID)
    .eq("codigo_monnera", code)
    .neq("id", card.id);
  if (reused?.length) return { ok: false, status: "duplicidade", reason: "Código já utilizado por outro CNPJ." };

  return { ok: true };
}

/** Aplica o código com rastro completo. Nunca move o card. */
export async function applyCode(
  admin: any,
  card: CardRow,
  hit: CodeHit,
  issueKey: string,
  source: string,
  userId: string | null,
) {
  const evidence = {
    issue_key: issueKey,
    origem: hit.origin,
    trecho: hit.evidence.slice(0, 500),
    applied_at: new Date().toISOString(),
    applied_by: userId,
  };
  const { error } = await admin.rpc("apply_monnera_code_to_card", {
    p_card_id: card.id,
    p_codigo: hit.code,
    p_source: source,
    p_evidence: evidence,
    p_jira_issue_key: issueKey,
  });
  if (error) throw error;

  await admin.from("card_field_provenance").insert({
    card_id: card.id,
    field_name: "codigo_monnera",
    field_value: hit.code,
    source,
    evidence: JSON.stringify(evidence),
    status: "consolidado",
    created_by: userId,
  });
  await admin
    .from("representative_cards")
    .update({ jira_issue_status: "codigo_recebido", jira_synced_at: new Date().toISOString(), jira_last_error: null })
    .eq("id", card.id);
  try {
    await admin.rpc("log_representative_card_event", {
      p_card_id: card.id,
      p_action: "monnera_code_applied",
      p_payload: { codigo: hit.code, issue_key: issueKey, source, origem: hit.origin },
      p_source_stage_id: card.stage_id,
      p_destination_stage_id: card.stage_id,
    });
  } catch (_) { /* histórico best-effort */ }
}
