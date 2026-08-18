/**
 * Status operacional unificado para a triagem de Gmail e para as importações de WhatsApp.
 * Apenas leitura/derivação — não executa nenhuma ação operacional.
 */

export type OperationalState =
  | "nao_liberado"
  | "liberado"
  | "executado"
  | "bloqueado"
  | "rejeitado";

export const OPERATIONAL_LABEL: Record<OperationalState, string> = {
  nao_liberado: "Não liberado",
  liberado: "Liberado",
  executado: "Executado",
  bloqueado: "Bloqueado",
  rejeitado: "Rejeitado",
};

export const OPERATIONAL_TONE: Record<OperationalState, string> = {
  nao_liberado: "text-muted-foreground",
  liberado: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  executado: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  bloqueado: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  rejeitado: "bg-destructive/15 text-destructive border-destructive/30",
};

export const OPERATIONAL_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "all", label: "Todos os status operacionais" },
  { value: "nao_liberado", label: "Não liberado" },
  { value: "liberado", label: "Liberado" },
  { value: "executado", label: "Executado" },
  { value: "bloqueado", label: "Bloqueado" },
  { value: "rejeitado", label: "Rejeitado" },
];

export type PendingReasonLike = { code?: string; label?: string; stage?: string | null };

/**
 * Etapa em que a pendência é exigida.
 * O código Monnera NÃO é exigido na triagem/cadastro — só na etapa "Criação Painel".
 */
const CRIACAO_PAINEL_CODES = new Set([
  "sem_codigo",
  "codigo_exemplo_invalido",
  "codigo_formato_nao_confirmado",
]);

export const pendingStage = (p: PendingReasonLike): "triagem" | "criacao_painel" =>
  (p.stage as "triagem" | "criacao_painel") ??
  (p.code && CRIACAO_PAINEL_CODES.has(p.code) ? "criacao_painel" : "triagem");

export const STAGE_LABEL: Record<string, string> = {
  triagem: "Triagem/Cadastro",
  criacao_painel: "Criação Painel",
};

export type OperationalInput = {
  analysisResult?: string | null;
  status?: string | null;
  reviewed?: boolean | null;
  reviewDecision?: string | null;
  reviewNotes?: string | null;
  /** Coluna operational_status (existe apenas nas mensagens do Gmail). */
  operationalStatus?: string | null;
  pendingReasons?: PendingReasonLike[] | null;
  pendingReasonManual?: string | null;
  pendingReasonText?: string | null;
  /** Execução da ativação controlada já registrada para o registro. */
  execution?: { created_at: string; executed_by?: string | null } | null;
};

export type OperationalInfo = {
  state: OperationalState;
  label: string;
  tone: string;
  blockReason: string | null;
  canActivate: boolean;
};

const isRejected = (decision?: string | null) =>
  !!decision && /rejeit/i.test(decision);

const isApproved = (decision?: string | null) =>
  !!decision && /aprovad|liberad/i.test(decision);

export function computeOperationalInfo(input: OperationalInput, pendingLabel?: Record<string, string>): OperationalInfo {
  const triage = input.analysisResult ?? input.status ?? "";
  const allPending = input.pendingReasons ?? [];
  // Só as pendências da etapa Triagem/Cadastro bloqueiam a liberação.
  const pending = allPending.filter((p) => pendingStage(p) === "triagem");
  const pendingText = pending
    .map((p) => (p.code && pendingLabel?.[p.code]) || p.label || p.code || "")
    .filter(Boolean)
    .join(" · ");

  const reason =
    [pendingText, input.pendingReasonManual, input.pendingReasonText]
      .filter((v) => !!v && String(v).trim().length > 0)
      .join(" · ") || null;

  const build = (state: OperationalState, blockReason: string | null = null): OperationalInfo => ({
    state,
    label: OPERATIONAL_LABEL[state],
    tone: OPERATIONAL_TONE[state],
    blockReason,
    canActivate: state === "liberado",
  });

  if (input.execution || input.operationalStatus === "processado" || input.status === "processado") {
    return build("executado");
  }
  if (isRejected(input.reviewDecision) || input.operationalStatus === "rejeitado") {
    return build("rejeitado", input.reviewNotes ?? reason);
  }
  if (
    input.operationalStatus === "liberado" ||
    (triage === "triage_ok" && !!input.reviewed && isApproved(input.reviewDecision) && pending.length === 0)
  ) {
    return build("liberado");
  }
  if (input.operationalStatus === "bloqueado" || pending.length > 0 || (triage && triage !== "triage_ok")) {
    return build("bloqueado", reason ?? "Pendência de triagem em aberto");
  }
  return build("nao_liberado", reason);
}

export const executionStatusLabel = (execution?: { created_at: string } | null) =>
  execution ? "Card criado (execução concluída)" : "Sem execução";
