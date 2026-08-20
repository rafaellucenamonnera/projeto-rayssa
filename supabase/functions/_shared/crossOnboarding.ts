// ============================================================================
// Regras e gates do fluxo pós-código Monnera (painel Onb Clientes Cross).
// Máquina de estados: codigo_validado -> canva_pendente -> canva_pronto ->
// html_pronto -> email_pendente -> email_enviado -> card_movido.
//
// Este módulo NÃO executa efeitos: só avalia gates e descreve a etapa seguinte.
// Quem persiste é a RPC transacional public.cross_onboarding_record_step.
// ============================================================================
import { validateMonneraCode } from "./monneraCode.ts";
import { validateCanvaPublicLink } from "./canvaLink.ts";

export const CROSS_PANEL_ID = "painel_msj9fyji";

/**
 * Etapas oficiais validadas por stage_id (label serve apenas para exibição).
 * Valores confirmados em pipeline_stages_config (panel_key = painel_msj9fyji):
 *   Cadastro = _1 | Criação Painel = _2 | Material Onboarding Cliente = _3 | Recebimento Dados = _4
 * Ainda assim os ids são resolvidos por rótulo em runtime (resolveStages).
 */
export const STAGE_CADASTRO = "etapa_painel_msj9fyji_1";
export const STAGE_CRIACAO_PAINEL = "etapa_painel_msj9fyji_2";
export const STAGE_MATERIAL_ONBOARDING = "etapa_painel_msj9fyji_3";
export const STAGE_RECEBIMENTO_DADOS = "etapa_painel_msj9fyji_4";

export const STAGE_LABELS = {
  cadastro: "Cadastro",
  criacaoPainel: "Criação Painel",
  materialOnboarding: "Material Onboarding Cliente",
  recebimentoDados: "Recebimento Dados",
} as const;

export interface ResolvedStages {
  cadastro: string;
  criacaoPainel: string;
  materialOnboarding: string;
  recebimentoDados: string;
}

/** Lê os stage_id reais por rótulo; cai nos ids confirmados se a consulta falhar. */
export async function resolveStages(admin: any): Promise<ResolvedStages> {
  const fallback: ResolvedStages = {
    cadastro: STAGE_CADASTRO,
    criacaoPainel: STAGE_CRIACAO_PAINEL,
    materialOnboarding: STAGE_MATERIAL_ONBOARDING,
    recebimentoDados: STAGE_RECEBIMENTO_DADOS,
  };
  try {
    const { data } = await admin
      .from("pipeline_stages_config")
      .select("value, label")
      .eq("panel_key", CROSS_PANEL_ID);
    const byLabel = new Map<string, string>(
      (data ?? []).map((r: { value: string; label: string }) => [(r.label ?? "").trim().toLowerCase(), r.value]),
    );
    const pick = (label: string, fb: string) => byLabel.get(label.trim().toLowerCase()) ?? fb;
    return {
      cadastro: pick(STAGE_LABELS.cadastro, fallback.cadastro),
      criacaoPainel: pick(STAGE_LABELS.criacaoPainel, fallback.criacaoPainel),
      materialOnboarding: pick(STAGE_LABELS.materialOnboarding, fallback.materialOnboarding),
      recebimentoDados: pick(STAGE_LABELS.recebimentoDados, fallback.recebimentoDados),
    };
  } catch (_) {
    return fallback;
  }
}

/** Allowlist de ELEGIBILIDADE do modo controlado (QA + ORCA liberada). */
export const QA_CARD_ID = "32d1e94e-ab53-42b3-9118-ab3ad2d07c77";
export const ORCA_CARD_ID = "f76d5bfa-680b-47e2-9f11-ca443ee2c40b";
export const ALLOWLIST_CARD_IDS = new Set<string>([QA_CARD_ID, ORCA_CARD_ID]);

/**
 * Allowlist de EXECUÇÃO REAL: liberar a proteção da ORCA não autoriza execução real.
 * A ORCA só entra aqui mediante autorização explícita do operador.
 */
export const EXECUTION_ALLOWLIST_CARD_IDS = new Set<string>([QA_CARD_ID]);

/** Destinatários autorizados no modo QA (nenhum outro endereço recebe e-mail em QA). */
export const QA_ALLOWED_RECIPIENTS = [
  "rafael.lucena@monnera.com.br",
  "alexandre.rodrigues@monnera.com.br",
  "maycon.santos@monnera.com.br",
  "rodrigo.cristo@monnera.com.br",
  "gilberto.freitas@monnera.com.br",
  "bruno.vivas@monnera.com.br",
];
/** Compatibilidade com chamadas antigas. */
export const QA_ALLOWED_RECIPIENT = QA_ALLOWED_RECIPIENTS[0];

/** Um card por execução, em qualquer origem (cron, manual, retry, reprocessamento). */
export const MAX_CARDS_PER_RUN = 1;
export const MAX_ATTEMPTS = 3;

export const NOTIFY_USERS = [
  "d8e99940-2d3a-45e6-8170-0bf2f5fc98a9", // rafael.lucena@monnera.com.br
  "87842ad6-9a02-4e66-82ac-65f2743a2596", // maycon.santos@monnera.com.br
];

export const STEPS = [
  "codigo_validado",
  "codigo_aplicado",
  "card_movido_material",
  "canva_pendente",
  "canva_pronto",
  "html_pronto",
  "email_pendente",
  "email_enviado",
  "card_movido",
] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABELS: Record<Step, string> = {
  codigo_validado: "Código Monnera validado",
  codigo_aplicado: "Código aplicado ao card",
  card_movido_material: "Card movido para Material Onboarding Cliente",
  canva_pendente: "Material Canva pendente",
  canva_pronto: "Material Canva pronto",
  html_pronto: "HTML v2 personalizado",
  email_pendente: "E-mail preparado",
  email_enviado: "E-mail enviado na thread",
  card_movido: "Card movido para Recebimento Dados",
};


export const CARD_FIELDS =
  "id, full_name, cnpj, email, panel_id, stage_id, codigo_monnera, codigo_recebido_at, jira_issue_key, " +
  "origin_thread_id, canva_public_url, is_protected, is_blocked, test_mode";

export interface CrossCard {
  id: string;
  full_name: string | null;
  cnpj: string | null;
  email: string | null;
  panel_id: string | null;
  stage_id: string | null;
  codigo_monnera: string | null;
  codigo_recebido_at: string | null;
  jira_issue_key: string | null;
  origin_thread_id: string | null;
  canva_public_url: string | null;
  is_protected: boolean | null;
  is_blocked: boolean | null;
  test_mode: boolean | null;
}

export type Gate = { ok: true } | { ok: false; reason: string; status: "bloqueado" | "pendencia_manual" };

const block = (reason: string): Gate => ({ ok: false, reason, status: "bloqueado" });
const pending = (reason: string): Gate => ({ ok: false, reason, status: "pendencia_manual" });
const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

/** Gate de entrada: nada acontece sem passar por aqui. */
export async function entryGate(
  admin: any,
  card: CrossCard,
  opts: { controlledMode: boolean; dryRun?: boolean; stages?: ResolvedStages },
): Promise<Gate> {
  const stages = opts.stages ?? {
    cadastro: STAGE_CADASTRO,
    criacaoPainel: STAGE_CRIACAO_PAINEL,
    materialOnboarding: STAGE_MATERIAL_ONBOARDING,
    recebimentoDados: STAGE_RECEBIMENTO_DADOS,
  };

  if (card.panel_id !== CROSS_PANEL_ID) return block("Card fora do painel Onb Clientes Cross.");
  if (card.is_protected) return block("Card protegido: nenhuma alteração permitida.");

  const { data: protectedRows } = await admin
    .from("protected_entities")
    .select("id")
    .or(`card_id.eq.${card.id},cnpj_normalizado.eq.${digits(card.cnpj)}`);
  if (protectedRows?.length) return block("Card protegido: nenhuma alteração permitida.");

  if (card.is_blocked) return block("Card bloqueado operacionalmente.");

  if (opts.controlledMode && !ALLOWLIST_CARD_IDS.has(card.id)) {
    return block("Modo controlado: card não está na allowlist de elegibilidade.");
  }
  // Liberar a proteção da ORCA não autoriza execução real: isso exige allowlist própria.
  if (opts.controlledMode && opts.dryRun === false && !EXECUTION_ALLOWLIST_CARD_IDS.has(card.id)) {
    return block("Execução real não autorizada para este card (somente simulação).");
  }

  if (card.stage_id === stages.cadastro) {
    return block("Card na etapa Cadastro: o orquestrador nunca inicia automaticamente aqui.");
  }
  if (card.stage_id !== stages.criacaoPainel && card.stage_id !== stages.materialOnboarding) {
    return block(
      `Card fora das etapas Criação Painel / Material Onboarding Cliente (stage_id atual: ${card.stage_id ?? "sem etapa"}).`,
    );
  }

  const codeCheck = validateCodeForCard(card);
  if (!codeCheck.ok) return codeCheck;

  // Vínculo Jira só é exigido a partir de Material Onboarding Cliente.
  if (card.stage_id === stages.materialOnboarding && !card.jira_issue_key) {
    return block("Vínculo Jira ausente: crie a tarefa de Criação Painel antes de avançar.");
  }
  return { ok: true };
}


/** QATEST01 só existe no card de QA com test_mode = true. */
export function validateCodeForCard(card: CrossCard): Gate {
  const raw = (card.codigo_monnera ?? "").trim().toUpperCase();
  if (!raw) return block("Código Monnera ausente (obrigatório na etapa Criação Painel).");
  const isQa = card.id === QA_CARD_ID && card.test_mode === true;
  if (raw === "QATEST01" && !isQa) return block("Código de teste QATEST01 não é aceito em card real.");
  const validation = validateMonneraCode(raw, { allowTest: isQa });
  if (!validation.ok) return block(`Código Monnera inválido: ${validation.reason}`);
  return { ok: true };
}

/** Confirma que a chave Jira existe e é resolvível. 403 ou chave inválida interrompem o fluxo. */
export async function jiraLinkGate(card: CrossCard, getIssue: (key: string) => Promise<unknown>): Promise<Gate> {
  if (!card.jira_issue_key) return block("Vínculo Jira ausente.");
  try {
    await getIssue(card.jira_issue_key);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return block(`Jira não resolvível para ${card.jira_issue_key}: ${message.slice(0, 200)}`);
  }
}

export function canvaGate(card: CrossCard): Gate {
  const validation = validateCanvaPublicLink(card.canva_public_url);
  if (!validation.ok) {
    return pending(
      `Material Canva pendente: ${validation.reason} Insira manualmente o link público https://canva.link/... no card.`,
    );
  }
  return { ok: true };
}

export function threadGate(card: CrossCard): Gate {
  if (!card.origin_thread_id) {
    return pending("Thread de origem não vinculada: o envio só ocorre como resposta na thread comprovada.");
  }
  return { ok: true };
}

const TECHNICAL_PATTERNS = [
  /@monnera\.atlassian\.net$/i,
  /^jira@/i,
  /^no-?reply@/i,
  /^nao-?responda@/i,
  /^notifications?@/i,
  /^automation@/i,
  /^mailer-daemon@/i,
];

/** Destinatários comprovados, sem endereços técnicos; Denise/Deise só como último recurso. */
export function buildRecipients(params: {
  cardEmail: string | null;
  threadParticipants: string[];
  senderAccount: string;
  qaMode: boolean;
}): { to: string[]; excluded: string[]; lastResort: boolean } {
  if (params.qaMode) return { to: [QA_ALLOWED_RECIPIENT], excluded: [], lastResort: false };

  const excluded: string[] = [];
  const seen = new Set<string>();
  const primary: string[] = [];
  const lastResort: string[] = [];

  const candidates = [params.cardEmail ?? "", ...params.threadParticipants]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean);

  for (const email of candidates) {
    if (seen.has(email)) continue;
    seen.add(email);
    if (email === params.senderAccount.toLowerCase() || TECHNICAL_PATTERNS.some((re) => re.test(email))) {
      excluded.push(email);
      continue;
    }
    if (/^(denise|deise)/i.test(email)) lastResort.push(email);
    else primary.push(email);
  }

  if (primary.length) return { to: primary, excluded, lastResort: false };
  return { to: lastResort, excluded, lastResort: lastResort.length > 0 };
}

/** Checklist obrigatório do HTML antes de qualquer envio. */
export function htmlChecklist(html: string, expect: { nome: string; codigo: string; link: string; assunto: string }) {
  const problems: string[] = [];
  if (!/<img[^>]+src=/i.test(html)) problems.push("logo Monnera ausente no HTML.");
  if (/\{\{[A-Z_]+\}\}/.test(html)) problems.push("placeholders não substituídos.");
  if (!html.includes(expect.codigo)) problems.push("código Monnera ausente no HTML.");
  if (!html.includes(expect.link)) problems.push("link público do Canva ausente no HTML.");
  if (!expect.assunto.trim()) problems.push("assunto vazio.");
  if (/jira|lovable|supabase|automa(ç|c)(ã|a)o|card\b/i.test(stripUrls(html))) {
    problems.push("HTML contém referência a Jira, Lovable, cards ou automação.");
  }
  return { ok: problems.length === 0, problems };
}

const stripUrls = (html: string) => html.replace(/https?:\/\/[^\s"'<>]+/g, "");

/** Próxima etapa pendente, dado o mapa de etapas já concluídas. */
export function nextStep(done: Record<string, string>): Step | null {
  for (const step of STEPS) {
    if (done[step] !== "sucesso") return step;
  }
  return null;
}
