import { supabase } from "@/integrations/supabase/client";
import { crossCardActionUrl, logCardEvent, notifyCrossCard } from "@/lib/crossCardEvents";
import { createNotifications } from "@/lib/notifications";

/**
 * Tratamento padrão para registros de triagem que NÃO podem ser liberados.
 * Mantém o registro bloqueado, preserva a evidência, cria tarefa de análise
 * no card candidato e notifica os responsáveis (Rafael e Maycon).
 * Nenhum card é criado ou movido por aqui.
 */

export const CROSS_PANEL_ID = "painel_msj9fyji";

/** Nomes dos responsáveis notificados em qualquer bloqueio de triagem. */
const BLOCK_REVIEWER_NAMES = ["rafael lucena", "maycon"];

export const BLOCK_EXAMPLES: string[] = [
  "CNPJ ausente",
  "CNPJ diferente do card",
  "Mais de um card possível",
  "Nome incompatível",
  "Código Monnera não confirmado",
  "Card já bloqueado",
  "Informações conflitantes",
  "Card inexistente",
];

export type CandidateCardSource = { id: string; full_name: string; cnpj: string | null };
export type CandidateCard = { card: CandidateCardSource; motivo: string };

const digits = (value?: string | null) => (value || "").replace(/\D/g, "");

/** Cards candidatos por CNPJ (principal ou alternativo) e por nome semelhante. */
export function findCandidateCards(
  cards: CandidateCardSource[],
  input: { cnpj?: string | null; nome?: string | null; extraCnpjs?: Array<string | null | undefined> },
): CandidateCard[] {
  const target = digits(input.cnpj);
  const alternatives = new Set(
    (input.extraCnpjs || []).map((c) => digits(c)).filter((c) => c.length === 14 && c !== target),
  );
  const nome = (input.nome || "").toLowerCase().trim();

  const out: CandidateCard[] = [];
  const seen = new Set<string>();

  const push = (card: CandidateCardSource, motivo: string) => {
    if (seen.has(card.id)) return;
    seen.add(card.id);
    out.push({ card, motivo });
  };

  cards.forEach((card) => {
    const cardCnpj = digits(card.cnpj);
    const cardNome = (card.full_name || "").toLowerCase().trim();

    if (target && cardCnpj && cardCnpj === target) push(card, "CNPJ igual ao extraído");
    else if (cardCnpj && alternatives.has(cardCnpj)) push(card, "CNPJ alternativo encontrado na mensagem");
    else if (nome.length > 3 && cardNome && (cardNome.includes(nome) || nome.includes(cardNome)))
      push(card, !target && cardCnpj ? "CNPJ herdado do card" : "Nome semelhante");
  });

  return out.slice(0, 10);
}

/** Responsáveis pela análise de bloqueios, resolvidos por perfil (sem IDs fixos no código). */
export async function resolveBlockReviewers(): Promise<Array<{ user_id: string; nome: string }>> {
  const { data } = await supabase.from("profiles").select("user_id,nome").eq("ativo", true);
  return ((data ?? []) as Array<{ user_id: string; nome: string }>).filter((p) =>
    BLOCK_REVIEWER_NAMES.some((name) => (p.nome || "").toLowerCase().includes(name)),
  );
}

export type BlockedTriageInput = {
  /** Origem do registro bloqueado. */
  source: "gmail" | "whatsapp";
  /** ID da linha em gmail_processed_messages ou whatsapp_extractions. */
  rowId: string;
  /** Card vinculado/candidato onde a tarefa de análise será criada (opcional). */
  cardId?: string | null;
  cliente?: string | null;
  cnpj?: string | null;
  codigo?: string | null;
  /** Motivos específicos do bloqueio. */
  motivos: string[];
  /** Trecho de origem preservado (mensagem, corpo ou conversa). */
  trecho?: string | null;
  /** Referência da mensagem original (message_id, thread_id, arquivo...). */
  referencia?: Record<string, unknown>;
  /** Cards candidatos exibidos na análise. */
  candidatos?: CandidateCard[];
  currentUserId?: string | null;
};

const SOURCE_LABEL: Record<BlockedTriageInput["source"], string> = {
  gmail: "Triagem Gmail",
  whatsapp: "Importação WhatsApp",
};

/**
 * Registra o bloqueio: cria a tarefa de análise no card (quando há card),
 * grava o histórico operacional e notifica os responsáveis.
 */
export async function handleBlockedTriage(input: BlockedTriageInput) {
  const reviewers = await resolveBlockReviewers();
  const motivos = input.motivos.filter(Boolean);
  const motivoTexto = motivos.length ? motivos.join(" · ") : "Pendência de triagem não resolvida";
  const trecho = (input.trecho || "").slice(0, 800);
  const candidatosTexto = (input.candidatos || [])
    .map((c) => `${c.card.full_name}${c.card.cnpj ? ` (${c.card.cnpj})` : ""} — ${c.motivo}`)
    .join("\n");

  const descricao = [
    `Origem: ${SOURCE_LABEL[input.source]}`,
    input.cliente ? `Cliente: ${input.cliente}` : null,
    input.cnpj ? `CNPJ: ${input.cnpj}` : null,
    input.codigo ? `Código Monnera: ${input.codigo}` : null,
    `Motivo do bloqueio: ${motivoTexto}`,
    candidatosTexto ? `Cards candidatos:\n${candidatosTexto}` : "Cards candidatos: nenhum",
    trecho ? `Trecho de origem: "${trecho}"` : null,
    "Correções possíveis: correção manual no painel, nova resposta por Gmail ou nova importação pelo WhatsApp.",
  ]
    .filter(Boolean)
    .join("\n");

  const dueAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const assignedTo = reviewers[0]?.user_id ?? input.currentUserId ?? null;

  let taskId: string | null = null;

  if (input.cardId && assignedTo) {
    const { data, error } = await (supabase as any)
      .from("representative_card_tasks")
      .insert({
        representative_card_id: input.cardId,
        titulo: `Analisar bloqueio de triagem (${SOURCE_LABEL[input.source]})`,
        descricao,
        due_at: dueAt,
        due_date: dueAt.slice(0, 10),
        assigned_to: assignedTo,
        status: "pendente",
        created_by: input.currentUserId ?? assignedTo,
      })
      .select("id")
      .single();

    if (error) throw error;
    taskId = (data as { id: string }).id;

    await logCardEvent(
      input.cardId,
      "block_created",
      {
        origem: input.source,
        row_id: input.rowId,
        motivos,
        trecho,
        referencia: input.referencia ?? null,
        candidatos: (input.candidatos || []).map((c) => c.card.id),
        task_id: taskId,
      },
    );
  }

  const payload = {
    cliente: input.cliente ?? null,
    cnpj: input.cnpj ?? null,
    motivo: motivoTexto,
    evidencia: trecho || null,
    acaoRealizada: taskId
      ? "Registro mantido bloqueado e tarefa de análise criada no card."
      : "Registro mantido bloqueado (sem card vinculado para abrir tarefa).",
    decisaoNecessaria: "Confirmar dados e liberar, ou manter bloqueado.",
    proximoPasso: "Correção manual no painel, nova resposta por Gmail ou nova importação pelo WhatsApp.",
  };

  let notified = 0;

  if (input.cardId) {
    const created = await notifyCrossCard({
      cardId: input.cardId,
      panelId: CROSS_PANEL_ID,
      type: "cross_block_created",
      title: `Bloqueio de triagem — ${SOURCE_LABEL[input.source]}`,
      ...payload,
      actionUrl: crossCardActionUrl(CROSS_PANEL_ID, input.cardId),
      deliveryKey: `triage-block-${input.source}-${input.rowId}`,
      extraRecipients: reviewers.map((r) => r.user_id),
    });
    notified = created.length;
  } else if (reviewers.length) {
    const message = [
      `Origem: ${SOURCE_LABEL[input.source]}`,
      input.cliente ? `Cliente: ${input.cliente}` : null,
      input.cnpj ? `CNPJ: ${input.cnpj}` : null,
      `Motivo: ${motivoTexto}`,
      trecho ? `Evidência: ${trecho}` : null,
      "Próximo passo: correção manual no painel, nova resposta por Gmail ou nova importação pelo WhatsApp.",
    ]
      .filter(Boolean)
      .join("\n");

    const created = await createNotifications(
      reviewers.map((r) => ({
        recipientUserId: r.user_id,
        type: "cross_triagem_divergencia",
        title: `Bloqueio de triagem — ${SOURCE_LABEL[input.source]}`,
        message,
        actionUrl: input.source === "gmail" ? "/admin/triagem-gmail" : "/admin/importar-whatsapp",
        metadata: { origem: input.source, row_id: input.rowId, motivos },
        deliveryKey: `triage-block-${input.source}-${input.rowId}-${r.user_id}`,
      })),
    );
    notified = created.length;
  }

  return { taskId, notified, reviewers, motivoTexto };
}

/**
 * Sugere o template de solicitação de informação a partir do motivo do
 * bloqueio / pendências detectadas na triagem.
 */
export function suggestPendencyTemplate(
  blockReason?: string | null,
  pendingReasons?: Array<{ code?: string; label?: string }> | null,
): string {
  const text = [blockReason ?? "", ...(pendingReasons ?? []).map((p) => `${p.code ?? ""} ${p.label ?? ""}`)]
    .join(" ")
    .toLowerCase();

  if (text.includes("ambig") || text.includes("divergen") || text.includes("mais de um")) return "cnpj_divergente";
  if (text.includes("cnpj")) return "cnpj_ausente";
  if (text.includes("nome")) return "nome_incompativel";
  if (text.includes("codigo") || text.includes("código")) return "codigo_nao_confirmado";
  if (text.includes("conflit")) return "dados_conflitantes";
  return "cnpj_ausente";
}
