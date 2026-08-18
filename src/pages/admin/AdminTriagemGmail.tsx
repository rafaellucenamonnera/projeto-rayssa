import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logCardEvent, crossCardActionUrl } from "@/lib/crossCardEvents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  computeOperationalInfo,
  OPERATIONAL_FILTER_OPTIONS,
} from "@/lib/triageOperationalStatus";
import { findCandidateCards, handleBlockedTriage, BLOCK_EXAMPLES, suggestPendencyTemplate } from "@/lib/triageBlockHandling";
import { TriageInfoRequest } from "@/components/admin/TriageInfoRequest";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, CheckCircle2, Mail, ShieldCheck, AlertTriangle } from "lucide-react";


const CROSS_PANEL_ID = "painel_msj9fyji";

type TriageAttachment = {
  filename?: string;
  extension?: string;
  size_bytes?: number;
  aceito?: boolean;
};

type PendingReason = { code: string; label: string };

type TriageMessage = {
  id: string;
  message_id: string;
  thread_id: string | null;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  received_at: string | null;
  created_at: string;
  status: string;
  analysis_result: string | null;
  pending_reason: string | null;
  pending_reasons: PendingReason[] | null;
  body_snippet: string | null;
  cnpj_source: string | null;
  cnpj_snippet: string | null;
  cnpj_candidates: Array<{ cnpj: string; source: string; snippet?: string }> | null;

  codigo_encontrado: string | null;
  attachments: TriageAttachment[] | null;
  attachments_count: number;
  extracted: Record<string, unknown> | null;
  matched_card_id: string | null;
  representative_card_id: string | null;
  mode: string;
  reprocessed_at: string | null;

  reviewed: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_decision: string | null;
  review_notes: string | null;

  manual_overrides: Record<string, string> | null;
  observacoes: string | null;
  responsavel: string | null;
  pending_reason_manual: string | null;
  operational_status: string;
  released_at: string | null;
  released_by: string | null;
  conflict_notes: Array<Record<string, unknown>> | null;
  last_correction_at: string | null;

  linked_at: string | null;
  linked_by: string | null;
  linked_card_snapshot: Record<string, unknown> | null;
};

type Correction = {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  justification: string;
  origin: string;
  created_at: string;
  created_by: string | null;
};

const CORRECTION_FIELDS: Array<{ key: string; label: string }> = [
  { key: "nome_parceiro", label: "Nome" },
  { key: "cnpj", label: "CNPJ" },
  { key: "email", label: "E-mail" },
  { key: "telefone", label: "Telefone" },
  { key: "codigo_monnera", label: "Código Monnera" },
  { key: "responsavel", label: "Responsável" },
  { key: "observacoes", label: "Observações" },
  { key: "pending_reason_manual", label: "Motivo da pendência" },
];

const ORIGIN_LABEL: Record<string, string> = {
  manual: "Correção manual",
  novo_email: "Nova mensagem do Gmail",
  whatsapp: "Importação de WhatsApp",
  liberacao: "Liberação operacional",
};


type CrossCard = { id: string; full_name: string; cnpj: string | null };

type SyncRun = {
  id: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
  fetched_count: number;
  processed_count: number;
  skipped_count: number;
  error_count: number;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Em processamento",
  triage_ok: "Pronto para vínculo",
  triage_sem_cnpj: "Sem CNPJ",
  triage_sem_nome: "Sem nome",
  triage_sem_codigo: "Sem código Monnera",
  triage_duplicado: "CNPJ já tem card",
  triage_ambiguo: "Vínculo ambíguo",
  triage_fora_do_escopo: "Fora do escopo",
  triage_divergencia_cnpj: "CNPJ divergente do card",
  triage_codigo_formato_nao_confirmado: "Código em formato não confirmado",
  triage_codigo_exemplo_invalido: "Código demonstrativo inválido",

  created: "Card criado (modo ativo)",
  duplicate_cnpj: "CNPJ duplicado",
  skipped_no_name: "Ignorada",
  error: "Erro",
};

const STATUS_TONE: Record<string, string> = {
  triage_ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  triage_duplicado: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  triage_ambiguo: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  triage_divergencia_cnpj: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  triage_sem_cnpj: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  triage_sem_nome: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  triage_sem_codigo: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  triage_fora_do_escopo: "bg-muted text-muted-foreground border-border",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

const PENDING_LABEL: Record<string, string> = {
  sem_cnpj: "Sem CNPJ",
  sem_nome: "Sem nome",
  sem_codigo: "Sem código Monnera",
  codigo_formato_nao_confirmado: "Código em formato não confirmado",
  codigo_exemplo_invalido: "Código demonstrativo inválido",
  duplicado: "CNPJ já tem card",
  ambiguo: "Vínculo ambíguo",
  divergencia_cnpj: "CNPJ divergente do card",
  fora_do_escopo: "Fora do escopo",
};


const CNPJ_SOURCE_LABEL: Record<string, string> = {
  assunto: "Assunto da mensagem",
  corpo: "Corpo da mensagem",
  metadados: "Metadados extraídos",
  thread: "Histórico da thread",
  anexo: "Nome de anexo",
};


const PENDING_CODES = Object.keys(PENDING_LABEL);

const onlyDigits = (v: string) => v.replace(/\D/g, "");

const fmtDate = (v: string | null) =>
  v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const extractedField = (extracted: Record<string, unknown> | null, key: string) => {
  const value = extracted?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const pendingList = (m: TriageMessage): PendingReason[] =>
  Array.isArray(m.pending_reasons) ? m.pending_reasons : [];


export default function AdminTriagemGmail() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<TriageMessage[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [cards, setCards] = useState<CrossCard[]>([]);

  const [filterResult, setFilterResult] = useState("all");
  const [filterReviewed, setFilterReviewed] = useState("all");
  const [filterOperational, setFilterOperational] = useState("all");
  const [filterCnpj, setFilterCnpj] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [filterInicio, setFilterInicio] = useState("");
  const [filterFim, setFilterFim] = useState("");

  const [selected, setSelected] = useState<TriageMessage | null>(null);
  const [decision, setDecision] = useState("");
  const [linkCardId, setLinkCardId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  /** Card cujo vínculo está sendo gravado (estado "Vinculando..." e proteção contra clique duplo). */
  const [linkingCardId, setLinkingCardId] = useState<string | null>(null);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinkJustification, setUnlinkJustification] = useState("");
  const [unlinking, setUnlinking] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [confirmRelease, setConfirmRelease] = useState(false);

  const [control, setControl] = useState<{ enabled: boolean; max_per_execution: number; stop_reason: string | null } | null>(null);
  const [activation, setActivation] = useState<any | null>(null);
  const [activationJustification, setActivationJustification] = useState("");
  const [activationConfirm, setActivationConfirm] = useState(false);
  const [executions, setExecutions] = useState<Array<{ id: string; source: string; source_row_id: string | null; cliente_nome: string; cnpj: string; codigo_monnera: string; created_at: string; executed_by: string | null }>>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [msgRes, runRes, cardRes] = await Promise.all([
      (supabase as any)
        .from("gmail_processed_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      (supabase as any)
        .from("gmail_sync_runs")
        .select("id,mode,started_at,finished_at,fetched_count,processed_count,skipped_count,error_count")
        .order("started_at", { ascending: false })
        .limit(5),
      (supabase as any)
        .from("representative_cards")
        .select("id,full_name,cnpj")
        .eq("panel_id", CROSS_PANEL_ID)
        .order("full_name"),
    ]);
    setMessages((msgRes.data ?? []) as TriageMessage[]);
    setRuns((runRes.data ?? []) as SyncRun[]);
    setCards((cardRes.data ?? []) as CrossCard[]);

    const [ctrlRes, execRes] = await Promise.all([
      (supabase as any).from("gmail_activation_control").select("enabled,max_per_execution,stop_reason").maybeSingle(),
      (supabase as any)
        .from("triage_activation_executions")
        .select("id,source,source_row_id,cliente_nome,cnpj,codigo_monnera,created_at,executed_by")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    setControl((ctrlRes?.data as any) ?? null);
    setExecutions((execRes?.data ?? []) as any[]);

    const { data: profileRows } = await (supabase as any).from("profiles").select("user_id,nome");
    setUserNames(
      Object.fromEntries(((profileRows ?? []) as Array<{ user_id: string; nome: string }>).map((p) => [p.user_id, p.nome])),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const executionByRow = useMemo(() => {
    const map = new Map<string, { created_at: string; executed_by?: string | null }>();
    executions
      .filter((e) => e.source === "gmail" && e.source_row_id)
      .forEach((e) => map.set(e.source_row_id as string, { created_at: e.created_at, executed_by: e.executed_by }));
    return map;
  }, [executions]);

  const operationalInfo = useCallback(
    (m: TriageMessage) =>
      computeOperationalInfo(
        {
          analysisResult: m.analysis_result,
          status: m.status,
          reviewed: m.reviewed,
          reviewDecision: m.review_decision,
          reviewNotes: m.review_notes,
          operationalStatus: m.operational_status,
          pendingReasons: m.pending_reasons,
          pendingReasonManual: m.pending_reason_manual,
          pendingReasonText: m.pending_reason,
          execution: executionByRow.get(m.id) ?? null,
        },
        PENDING_LABEL,
      ),
    [executionByRow],
  );

  const filtered = useMemo(() => {
    const cnpjTerm = onlyDigits(filterCnpj);
    const fromTerm = filterFrom.trim().toLowerCase();
    const codigoTerm = filterCodigo.trim().toLowerCase();
    const inicio = filterInicio ? new Date(`${filterInicio}T00:00:00`) : null;
    const fim = filterFim ? new Date(`${filterFim}T23:59:59`) : null;

    return messages.filter((m) => {
      if (filterResult !== "all" && (m.analysis_result ?? m.status) !== filterResult) return false;
      if (filterReviewed === "reviewed" && !m.reviewed) return false;
      if (filterReviewed === "pending" && m.reviewed) return false;
      if (filterOperational !== "all" && operationalInfo(m).state !== filterOperational) return false;
      if (cnpjTerm) {
        const cnpj = onlyDigits(extractedField(m.extracted, "cnpj") ?? "");
        if (!cnpj.includes(cnpjTerm)) return false;
      }
      if (fromTerm && !(m.from_address ?? "").toLowerCase().includes(fromTerm)) return false;
      if (codigoTerm && !(m.codigo_encontrado ?? "").toLowerCase().includes(codigoTerm)) return false;
      const ref = new Date(m.received_at ?? m.created_at);
      if (inicio && ref < inicio) return false;
      if (fim && ref > fim) return false;
      return true;
    });
  }, [messages, filterResult, filterReviewed, filterOperational, operationalInfo, filterCnpj, filterFrom, filterCodigo, filterInicio, filterFim]);

  const resultOptions = useMemo(
    () => Array.from(new Set(messages.map((m) => m.analysis_result ?? m.status))).sort(),
    [messages],
  );

  const effectiveValue = (m: TriageMessage, key: string): string => {
    const ov = m.manual_overrides ?? {};
    if (key === "responsavel") return m.responsavel ?? "";
    if (key === "observacoes") return m.observacoes ?? "";
    if (key === "pending_reason_manual") return m.pending_reason_manual ?? "";
    if (key === "codigo_monnera") return ov.codigo_monnera ?? m.codigo_encontrado ?? "";
    return ov[key] ?? extractedField(m.extracted, key) ?? "";
  };

  const loadCorrections = async (rowId: string) => {
    const { data } = await (supabase as any)
      .from("gmail_triage_corrections")
      .select("*")
      .eq("gmail_message_row_id", rowId)
      .order("created_at", { ascending: false });
    setCorrections((data ?? []) as Correction[]);
  };

  const openRecord = (m: TriageMessage) => {
    setSelected(m);
    setDecision(m.review_decision ?? "");
    setLinkCardId(m.matched_card_id ?? "none");
    setJustification("");
    setConfirmRelease(false);
    setUnlinkOpen(false);
    setUnlinkJustification("");
    setForm(Object.fromEntries(CORRECTION_FIELDS.map((f) => [f.key, effectiveValue(m, f.key)])));
    loadCorrections(m.id);
  };

  /** Recarrega o registro aberto após uma ação, mantendo o detalhe na tela. */
  const refreshSelected = async (rowId: string) => {
    const { data } = await (supabase as any)
      .from("gmail_processed_messages")
      .select("*")
      .eq("id", rowId)
      .maybeSingle();
    if (data) {
      const fresh = data as TriageMessage;
      setSelected(fresh);
      setLinkCardId(fresh.matched_card_id ?? "none");
      setForm(Object.fromEntries(CORRECTION_FIELDS.map((f) => [f.key, effectiveValue(fresh, f.key)])));
    }
    await loadCorrections(rowId);
  };

  /**
   * Vincula o card confirmado pelo operador: preenche nome/CNPJ faltantes a partir do card,
   * registra a evidência no histórico imutável e reavalia a etapa. O card não é alterado.
   */
  const linkCard = async (cardId: string) => {
    if (!selected || linkingCardId) return;
    setLinkingCardId(cardId);
    try {
      const { data, error } = await (supabase as any).rpc("link_gmail_triage_card", {
        p_row_id: selected.id,
        p_card_id: cardId,
        p_justification: "Vínculo confirmado manualmente na triagem: mensagem e card correspondem ao mesmo cliente.",
      });
      if (error) throw error;

      await logCardEvent(cardId, "triage_linked", {
        origem: "triagem_gmail",
        message_id: selected.message_id,
        thread_id: selected.thread_id,
        remetente: selected.from_address,
        assunto: selected.subject,
        cnpj: (data as any)?.cnpj ?? null,
        fonte_cnpj: (data as any)?.cnpj_source ?? null,
        liberado: !!(data as any)?.released,
      });

      setLinkCardId(cardId);
      toast.success("Card vinculado com sucesso. Os dados confirmados foram preenchidos na triagem.");
      if ((data as any)?.released) {
        toast.success("Registro liberado para a etapa Criação Painel. O código Monnera segue pendente dessa etapa.");
      }
      await refreshSelected(selected.id);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível vincular o card. Tente novamente.");
    } finally {
      setLinkingCardId(null);
    }
  };

  /** Desfaz o vínculo apenas na triagem, sem apagar ou alterar o card. */
  const unlinkCard = async () => {
    if (!selected || unlinking) return;
    if (!unlinkJustification.trim()) {
      toast.error("Informe a justificativa para desfazer o vínculo.");
      return;
    }
    const previousCardId = selected.matched_card_id;
    setUnlinking(true);
    try {
      const { error } = await (supabase as any).rpc("unlink_gmail_triage_card", {
        p_row_id: selected.id,
        p_justification: unlinkJustification.trim(),
      });
      if (error) throw error;

      if (previousCardId) {
        await logCardEvent(previousCardId, "triage_unlinked", {
          origem: "triagem_gmail",
          message_id: selected.message_id,
          thread_id: selected.thread_id,
          justificativa: unlinkJustification.trim(),
        });
      }

      toast.success("Vínculo desfeito. O card não foi alterado.");
      setUnlinkOpen(false);
      setUnlinkJustification("");
      await refreshSelected(selected.id);
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível desfazer o vínculo. Tente novamente.");
    } finally {
      setUnlinking(false);
    }
  };

  /** Abre o card específico do painel em nova aba, preservando a triagem. */
  const openCard = (cardId: string) => {
    const exists = cards.some((c) => c.id === cardId);
    if (!exists) {
      toast.error("O card não foi encontrado. O vínculo permanece registrado para análise.");
      return;
    }
    window.open(crossCardActionUrl(CROSS_PANEL_ID, cardId), "_blank", "noopener");
  };

  /** Cards candidatos exibidos quando o registro não pode ser liberado. */
  const candidateCards = useMemo(() => {
    if (!selected) return [];
    return findCandidateCards(cards, {
      cnpj: effectiveValue(selected, "cnpj"),
      nome: effectiveValue(selected, "nome_parceiro"),
      extraCnpjs: (selected.cnpj_candidates ?? []).map((c) => c.cnpj),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, cards]);

  /**
   * Mantém o registro bloqueado, abre tarefa de análise no card candidato
   * e notifica os responsáveis. Nenhum card é criado ou movido.
   */
  const registerBlock = async () => {
    if (!selected) return;
    const info = operationalInfo(selected);
    const cardId = linkCardId !== "none" ? linkCardId : selected.matched_card_id;

    setSaving(true);
    try {
      const result = await handleBlockedTriage({
        source: "gmail",
        rowId: selected.id,
        cardId,
        cliente: effectiveValue(selected, "nome_parceiro") || null,
        cnpj: effectiveValue(selected, "cnpj") || null,
        codigo: effectiveValue(selected, "codigo_monnera") || null,
        motivos: [info.blockReason ?? "Pendência de triagem em aberto"],
        trecho: selected.cnpj_snippet || selected.body_snippet || selected.subject,
        referencia: {
          message_id: selected.message_id,
          thread_id: selected.thread_id,
          remetente: selected.from_address,
          assunto: selected.subject,
        },
        candidatos: candidateCards,
        currentUserId: user?.id ?? null,
      });

      toast.success(
        result.taskId
          ? `Bloqueio registrado: tarefa de análise criada e ${result.notified} responsável(is) notificado(s).`
          : `Bloqueio registrado e ${result.notified} responsável(is) notificado(s). Vincule um card para abrir a tarefa de análise.`,
      );
      await load();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível registrar o tratamento do bloqueio.");
    } finally {
      setSaving(false);
    }
  };



  const applyCorrection = async () => {
    if (!selected) return;
    if (!justification.trim()) {
      toast.error("Informe a justificativa da correção.");
      return;
    }
    const changed: Record<string, string> = {};
    CORRECTION_FIELDS.forEach((f) => {
      const next = (form[f.key] ?? "").trim();
      if (next !== effectiveValue(selected, f.key).trim()) changed[f.key] = next;
    });
    if (!Object.keys(changed).length) {
      toast.error("Nenhum campo foi alterado.");
      return;
    }

    setSaving(true);
    const { data, error } = await (supabase as any).rpc("apply_gmail_triage_correction", {
      p_row_id: selected.id,
      p_values: changed,
      p_justification: justification.trim(),
      p_origin: "manual",
      p_evidence: { message_id: selected.message_id, thread_id: selected.thread_id },
    });
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível corrigir: ${error.message}`);
      return;
    }

    if (selected.matched_card_id) {
      await logCardEvent(selected.matched_card_id, "card_updated", {
        origem: "triagem_gmail",
        acao: "correcao_manual",
        message_id: selected.message_id,
        campos: Object.keys(changed),
        justificativa: justification.trim(),
        resultado: (data as any)?.analysis_result ?? null,
      });
    }

    toast.success("Correção registrada com justificativa e histórico.");
    setJustification("");
    await loadCorrections(selected.id);
    await load();
    setSelected(null);
  };

  const releaseRecord = async () => {
    if (!selected) return;
    if (!confirmRelease) {
      toast.error("Confirme a liberação marcando a caixa de confirmação.");
      return;
    }
    if (!justification.trim()) {
      toast.error("Informe a justificativa da liberação.");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("release_gmail_triage_message", {
      p_row_id: selected.id,
      p_justification: justification.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(`Liberação bloqueada: ${error.message}`);
      return;
    }
    if (selected.matched_card_id) {
      await logCardEvent(selected.matched_card_id, "card_updated", {
        origem: "triagem_gmail",
        acao: "liberacao_operacional",
        message_id: selected.message_id,
        justificativa: justification.trim(),
      });
    }
    toast.success("Registro liberado para o fluxo operacional.");
    setSelected(null);
    load();
  };

  const saveReview = async (markReviewed: boolean) => {
    if (!selected) return;
    if (markReviewed && !decision.trim()) {
      toast.error("Registre uma decisão antes de marcar como revisado.");
      return;
    }
    setSaving(true);
    const cardId = linkCardId === "none" ? null : linkCardId;
    const previousCardId = selected.matched_card_id;
    const { error } = await (supabase as any)
      .from("gmail_processed_messages")
      .update({
        matched_card_id: cardId,
        review_decision: decision.trim() || null,
        reviewed: markReviewed ? true : selected.reviewed,
        reviewed_at: markReviewed ? new Date().toISOString() : selected.reviewed_at,
        reviewed_by: markReviewed ? user?.id ?? null : selected.reviewed_by ?? null,
      })
      .eq("id", selected.id);
    setSaving(false);

    if (error) {
      toast.error(`Não foi possível salvar: ${error.message}`);
      return;
    }

    // Trilha operacional no card vinculado (histórico imutável do painel Cross).
    if (cardId) {
      await logCardEvent(cardId, "card_updated", {
        origem: "triagem_gmail",
        acao: markReviewed ? "mensagem_revisada" : "decisao_registrada",
        message_id: selected.message_id,
        thread_id: selected.thread_id,
        assunto: selected.subject,
        remetente: selected.from_address,
        resultado_triagem: selected.analysis_result ?? selected.status,
        vinculo_anterior: previousCardId,
        decisao: decision.trim() || null,
      });
    }

    toast.success(markReviewed ? "Mensagem marcada como revisada." : "Decisão registrada.");
    setSelected(null);
    load();
  };

  const toggleActivation = async (enabled: boolean) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("gmail_activation_control")
      .update({
        enabled,
        stop_reason: enabled ? null : "Interrompido manualmente pelo administrador",
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível alterar o controle: ${error.message}`);
      return;
    }
    toast.success(enabled ? "Ativação controlada habilitada (1 registro por execução)." : "Ativação interrompida imediatamente.");
    load();
  };

  const openActivation = async (m: TriageMessage) => {
    const { data, error } = await (supabase as any).rpc("preview_triage_activation", {
      p_source: "gmail",
      p_row_id: m.id,
    });
    if (error) {
      toast.error(`Não foi possível montar a confirmação: ${error.message}`);
      return;
    }
    setActivationJustification("");
    setActivationConfirm(false);
    setActivation(data);
  };

  const runActivation = async () => {
    if (!activation) return;
    if (!activationConfirm) {
      toast.error("Confirme a criação do card antes de executar.");
      return;
    }
    if (!activationJustification.trim()) {
      toast.error("Informe a justificativa da execução.");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any).rpc("execute_triage_activation", {
      p_source: activation.source,
      p_row_id: activation.row_id,
      p_justification: activationJustification.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error(`Execução bloqueada: ${error.message}`);
      return;
    }
    toast.success(`Card criado na etapa Cadastro (1 registro processado, nenhum e-mail enviado).`);
    setActivation(null);
    setSelected(null);
    load();
    void data;
  };

  const lastRun = runs[0];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admin/painel/${CROSS_PANEL_ID}`}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Painel Onb Clientes Cross
            </Link>
          </Button>
          <h1 className="text-xl sm:text-2xl font-display font-bold">Triagem Gmail</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Atualizar
        </Button>
      </div>

      <Card className="border-border">
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p>
            Modo triagem: as mensagens são apenas analisadas e registradas. Nenhum card é criado ou
            movido, nenhuma tarefa é aberta, nenhum anexo é salvo e nenhum e-mail é enviado.
          </p>
          {lastRun && (
            <p>
              Última execução {fmtDate(lastRun.started_at)} · modo {lastRun.mode} · {lastRun.fetched_count} lidas ·{" "}
              {lastRun.processed_count} analisadas · {lastRun.skipped_count} pendentes · {lastRun.error_count} erros
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Ativação operacional controlada
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-2 text-xs text-muted-foreground">
          <p>
            Executa no máximo <strong>1 registro por execução</strong>, somente sobre registros revisados,
            liberados e sem pendências. Cria apenas o card na etapa <strong>Cadastro</strong>: não move etapas,
            não cria tarefas e não envia e-mails. O worker do Gmail permanece em modo triagem.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={control?.enabled ? "border-emerald-500/30 text-emerald-400" : "text-muted-foreground"}>
              {control?.enabled ? "Ativação habilitada" : "Ativação desligada"}
            </Badge>
            <Button size="sm" variant={control?.enabled ? "destructive" : "secondary"} disabled={saving} onClick={() => toggleActivation(!control?.enabled)}>
              {control?.enabled ? "Interromper imediatamente" : "Habilitar ativação controlada"}
            </Button>
            <span>{executions.length} execução(ões) autorizada(s) até agora</span>
          </div>
          {executions.length > 0 && (
            <ul className="space-y-1">
              {executions.slice(0, 5).map((e) => (
                <li key={e.id}>
                  {fmtDate(e.created_at)} · {e.cliente_nome} · CNPJ {e.cnpj} · código {e.codigo_monnera} · origem {e.source}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Select value={filterResult} onValueChange={setFilterResult}>
          <SelectTrigger><SelectValue placeholder="Resultado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os resultados</SelectItem>
            {resultOptions.map((r) => (
              <SelectItem key={r} value={r}>{STATUS_LABEL[r] ?? r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterReviewed} onValueChange={setFilterReviewed}>
          <SelectTrigger><SelectValue placeholder="Revisão" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Revisadas e não revisadas</SelectItem>
            <SelectItem value="pending">Não revisadas</SelectItem>
            <SelectItem value="reviewed">Revisadas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOperational} onValueChange={setFilterOperational}>
          <SelectTrigger><SelectValue placeholder="Status operacional" /></SelectTrigger>
          <SelectContent>
            {OPERATIONAL_FILTER_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="CNPJ" value={filterCnpj} onChange={(e) => setFilterCnpj(e.target.value)} />
        <Input placeholder="Remetente" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
        <Input placeholder="Código Monnera" value={filterCodigo} onChange={(e) => setFilterCodigo(e.target.value)} />
        <Input type="date" value={filterInicio} onChange={(e) => setFilterInicio(e.target.value)} />
        <Input type="date" value={filterFim} onChange={(e) => setFilterFim(e.target.value)} />
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            {filtered.length} mensagem(ns) de triagem
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center py-10 text-sm text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">
              Nenhuma mensagem de triagem registrada com os filtros atuais.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((m) => {
                const result = m.analysis_result ?? m.status;
                const cnpj = extractedField(m.extracted, "cnpj");
                const nome = extractedField(m.extracted, "nome_parceiro");
                const op = operationalInfo(m);
                const exec = executionByRow.get(m.id) ?? null;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => openRecord(m)}
                    className="w-full text-left p-3 sm:p-4 hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate max-w-[420px]">
                        {m.subject || "(sem assunto)"}
                      </span>
                      <Badge variant="outline" className={STATUS_TONE[result] ?? ""}>
                        {STATUS_LABEL[result] ?? result}
                      </Badge>
                      {m.reviewed ? (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                          Revisada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Não revisada</Badge>
                      )}
                      <Badge variant="outline" className={op.tone}>{op.label}</Badge>
                      {m.attachments_count > 0 && (
                        <Badge variant="outline">{m.attachments_count} anexo(s)</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                      <span>De: {m.from_address || "—"}</span>
                      <span>Para: {m.to_address || "—"}</span>
                      <span>{fmtDate(m.received_at ?? m.created_at)}</span>
                      {nome && <span>Nome: {nome}</span>}
                      {cnpj && <span>CNPJ: {cnpj}</span>}
                      {m.codigo_encontrado && <span>Código: {m.codigo_encontrado}</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-1">
                      <span>Triagem: {STATUS_LABEL[result] ?? result}</span>
                      <span>Revisão: {m.reviewed ? `Revisada${m.review_decision ? ` (${m.review_decision})` : ""}` : "Não revisada"}</span>
                      <span>Operacional: {op.label}</span>
                      <span>Liberação: {m.released_at ? fmtDate(m.released_at) : "—"}</span>
                      <span>Liberado por: {m.released_by ? (userNames[m.released_by] ?? m.released_by) : "—"}</span>
                      <span>Execução: {exec ? fmtDate(exec.created_at) : "—"}</span>
                      <span>Status da execução: {exec ? "Card criado" : "Sem execução"}</span>
                    </div>
                    {op.blockReason && op.state !== "liberado" && op.state !== "executado" && (
                      <p className="mt-1 text-xs text-amber-400">Motivo do bloqueio: {op.blockReason}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">{selected?.subject || "(sem assunto)"}</DialogTitle>
            <DialogDescription className="text-xs">
              Registro de triagem — somente leitura da caixa de e-mail. Nenhuma ação operacional é
              executada a partir desta tela.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Field label="Remetente" value={selected.from_address} />
                <Field label="Destinatário" value={selected.to_address} />
                <Field label="Data" value={fmtDate(selected.received_at ?? selected.created_at)} />
                <Field label="Thread ID" value={selected.thread_id} />
                <Field label="Message ID" value={selected.message_id} />
                <Field label="CNPJ normalizado" value={extractedField(selected.extracted, "cnpj")} />
                <Field
                  label="Fonte do CNPJ"
                  value={selected.cnpj_source ? (CNPJ_SOURCE_LABEL[selected.cnpj_source] ?? selected.cnpj_source) : null}
                />
                <Field label="Nome extraído" value={extractedField(selected.extracted, "nome_parceiro")} />
                <Field label="Código Monnera" value={selected.codigo_encontrado} />
                <Field
                  label="Resultado da triagem"
                  value={STATUS_LABEL[selected.analysis_result ?? selected.status] ?? selected.analysis_result ?? selected.status}
                />
                <Field label="Status de revisão" value={selected.reviewed ? `Revisada em ${fmtDate(selected.reviewed_at)}` : "Não revisada"} />
                <Field
                  label="Reanálise de CNPJ"
                  value={selected.reprocessed_at ? `Reprocessada em ${fmtDate(selected.reprocessed_at)}` : "Pendente de reprocessamento"}
                />
              </div>


              {selected.cnpj_snippet && (
                <div>
                  <p className="text-xs font-medium mb-1">Trecho que gerou a extração do CNPJ</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2">
                    {selected.cnpj_snippet}
                  </p>
                </div>
              )}

              {Array.isArray(selected.cnpj_candidates) && selected.cnpj_candidates.length > 1 && (
                <div>
                  <p className="text-xs font-medium mb-1">CNPJs alternativos encontrados</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {selected.cnpj_candidates.slice(1).map((c, i) => (
                      <li key={i}>
                        {c.cnpj} · {CNPJ_SOURCE_LABEL[c.source] ?? c.source}
                        {c.snippet ? ` — ${c.snippet}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.pending_reason && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
                  {selected.pending_reason}
                </div>
              )}


              <div>
                <p className="text-xs font-medium mb-1">Anexos identificados</p>
                {selected.attachments && selected.attachments.length > 0 ? (
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {selected.attachments.map((a, i) => (
                      <li key={i}>
                        {a.filename} · {a.extension || "?"} ·{" "}
                        {a.size_bytes ? `${Math.round(a.size_bytes / 1024)} KB` : "tamanho desconhecido"} ·{" "}
                        {a.aceito ? "formato aceito" : "formato não aceito"} (não armazenado)
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhum anexo identificado.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Card correspondente</Label>
                <Select value={linkCardId} onValueChange={setLinkCardId} disabled={!!linkingCardId || !!selected.matched_card_id}>
                  <SelectTrigger><SelectValue placeholder="Selecionar card" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}{c.cnpj ? ` — ${c.cnpj}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex flex-wrap items-center gap-2">
                  {linkCardId !== "none" && selected.matched_card_id !== linkCardId && (
                    <Button size="sm" onClick={() => linkCard(linkCardId)} disabled={!!linkingCardId}>
                      {linkingCardId === linkCardId ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Vinculando...</>
                      ) : (
                        "Vincular card"
                      )}
                    </Button>
                  )}
                  {selected.matched_card_id && (
                    <>
                      <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                        Vinculado{selected.linked_at ? ` em ${fmtDate(selected.linked_at)}` : ""}
                        {selected.linked_by && userNames[selected.linked_by] ? ` por ${userNames[selected.linked_by]}` : ""}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => openCard(selected.matched_card_id as string)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir card
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setUnlinkOpen((v) => !v)} disabled={unlinking}>
                        Desfazer vínculo
                      </Button>
                    </>
                  )}
                  {!selected.matched_card_id && linkCardId !== "none" && (
                    <Button variant="outline" size="sm" onClick={() => openCard(linkCardId)}>
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir card
                    </Button>
                  )}
                </div>

                {selected.linked_card_snapshot && (
                  <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground space-y-0.5">
                    <p className="text-foreground font-medium">Dados herdados do card vinculado</p>
                    <p>Nome: {String((selected.linked_card_snapshot as any).card_nome ?? "—")}</p>
                    <p>CNPJ: {String((selected.linked_card_snapshot as any).card_cnpj ?? "—")} · fonte: card vinculado</p>
                    <p>Etapa atual do card: {String((selected.linked_card_snapshot as any).card_etapa ?? "—")}</p>
                    <p>Card ID: {String((selected.linked_card_snapshot as any).card_id ?? "—")}</p>
                  </div>
                )}

                {unlinkOpen && selected.matched_card_id && (
                  <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                    <p className="text-xs text-muted-foreground">
                      Confirme o desfazimento. O card não será apagado nem alterado — apenas o vínculo da triagem é removido.
                    </p>
                    <Textarea
                      rows={2}
                      value={unlinkJustification}
                      onChange={(e) => setUnlinkJustification(e.target.value.slice(0, 500))}
                      placeholder="Justificativa obrigatória (ex.: cliente confirmado como outro CNPJ)."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={unlinkCard} disabled={unlinking}>
                        {unlinking ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                        Confirmar desfazimento
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setUnlinkOpen(false)} disabled={unlinking}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {(() => {
                const info = operationalInfo(selected);
                if (info.state === "liberado" || info.state === "executado") return null;
                return (
                  <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                    <div className="flex items-center gap-2 text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="font-medium">
                        Não é possível liberar — registro mantido como {info.label}
                      </p>
                    </div>

                    <p className="text-amber-200">
                      Motivo específico: {info.blockReason ?? "Pendência de triagem em aberto"}
                    </p>

                    <div>
                      <p className="font-medium text-foreground">Cards candidatos</p>
                      {candidateCards.length === 0 ? (
                        <p className="text-muted-foreground">
                          Nenhum card candidato encontrado (possível card inexistente).
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {candidateCards.map((c) => (
                            <li key={c.card.id} className="flex flex-wrap items-center gap-2">
                              <span className="text-foreground">{c.card.full_name}</span>
                              <span className="text-muted-foreground">
                                {c.card.cnpj ? `· ${c.card.cnpj} ` : ""}· {c.motivo}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => linkCard(c.card.id)}
                                disabled={!!linkingCardId}
                              >
                                {linkingCardId === c.card.id ? (
                                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Vinculando...</>
                                ) : selected.matched_card_id === c.card.id ? (
                                  "Vinculado"
                                ) : (
                                  "Selecionar"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2"
                                onClick={() => openCard(c.card.id)}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" /> Abrir
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {(selected.body_snippet || selected.cnpj_snippet) && (
                      <div>
                        <p className="font-medium text-foreground">Mensagem e trecho de origem preservados</p>
                        <p className="whitespace-pre-wrap text-muted-foreground">
                          {(selected.cnpj_snippet || selected.body_snippet || "").slice(0, 600)}
                        </p>
                      </div>
                    )}

                    <p className="text-muted-foreground">
                      Exemplos de bloqueio: {BLOCK_EXAMPLES.join(" · ")}.
                    </p>
                    <p className="text-muted-foreground">
                      Correção possível: correção manual abaixo, nova resposta por Gmail ou nova importação pelo WhatsApp.
                    </p>

                    <Button size="sm" variant="outline" onClick={registerBlock} disabled={saving}>
                      {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5 mr-1" />}
                      Abrir tarefa de análise e notificar responsáveis
                    </Button>

                    <TriageInfoRequest
                      source="gmail"
                      rowId={selected.id}
                      cardId={linkCardId !== "none" ? linkCardId : selected.matched_card_id}
                      reason={info.blockReason ?? "Pendência de triagem em aberto"}
                      suggested={suggestPendencyTemplate(info.blockReason, selected.pending_reasons)}
                    />
                  </div>

                );
              })()}


              {Array.isArray(selected.conflict_notes) && selected.conflict_notes.length > 0 && (
                <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-300 space-y-1">
                  <p className="font-medium">Conflitos com novas mensagens (registro mantido bloqueado)</p>
                  {selected.conflict_notes.map((c, i) => (
                    <p key={i} className="whitespace-pre-wrap">
                      {fmtDate(String((c as any).at ?? ""))} · {((c as any).conflitos ?? []).join(" / ")}
                      {(c as any).trecho ? ` — "${String((c as any).trecho).slice(0, 200)}"` : ""}
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">Correção manual</p>
                  <Badge
                    variant="outline"
                    className={
                      selected.operational_status === "liberado"
                        ? "border-emerald-500/30 text-emerald-400"
                        : "text-muted-foreground"
                    }
                  >
                    {selected.operational_status === "liberado"
                      ? `Liberado em ${fmtDate(selected.released_at)}`
                      : "Bloqueado para operação"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CORRECTION_FIELDS.filter((f) => f.key !== "observacoes" && f.key !== "pending_reason_manual").map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        value={form[f.key] ?? ""}
                        disabled={selected.operational_status === "liberado"}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    rows={2}
                    value={form.observacoes ?? ""}
                    disabled={selected.operational_status === "liberado"}
                    onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value.slice(0, 1000) }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Motivo da pendência</Label>
                  <Input
                    value={form.pending_reason_manual ?? ""}
                    disabled={selected.operational_status === "liberado"}
                    onChange={(e) => setForm((p) => ({ ...p, pending_reason_manual: e.target.value.slice(0, 300) }))}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Justificativa (obrigatória)</Label>
                  <Textarea
                    rows={2}
                    value={justification}
                    disabled={selected.operational_status === "liberado"}
                    onChange={(e) => setJustification(e.target.value.slice(0, 500))}
                    placeholder="Ex.: CNPJ confirmado por telefone com o focal do cliente em 18/08."
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={confirmRelease}
                      disabled={selected.operational_status === "liberado"}
                      onChange={(e) => setConfirmRelease(e.target.checked)}
                    />
                    Confirmo a liberação deste registro para o fluxo operacional
                  </label>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={applyCorrection}
                      disabled={saving || selected.operational_status === "liberado"}
                    >
                      Salvar correção
                    </Button>
                    {operationalInfo(selected).state === "liberado" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openActivation(selected)}
                      disabled={saving || operationalInfo(selected).state !== "liberado"}
                    >
                      Ativação controlada
                    </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={releaseRecord}
                      disabled={saving || selected.operational_status === "liberado"}
                    >
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Liberar para operação
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium">Histórico de correções</p>
                {corrections.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma correção registrada.</p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {corrections.map((c) => (
                      <li key={c.id} className="rounded-md border border-border p-2">
                        <span className="text-foreground">
                          {CORRECTION_FIELDS.find((f) => f.key === c.field)?.label ?? c.field}
                        </span>{" "}
                        · {ORIGIN_LABEL[c.origin] ?? c.origin} · {fmtDate(c.created_at)}
                        <br />
                        de "{c.old_value || "—"}" para "{c.new_value || "—"}"
                        <br />
                        Justificativa: {c.justification}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Decisão registrada</Label>
                <Textarea
                  value={decision}
                  onChange={(e) => setDecision(e.target.value.slice(0, 1000))}
                  placeholder="Ex.: e-mail pertence ao card X; aguardando código do cliente; fora do escopo."
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setSelected(null)} disabled={saving}>
                  Fechar
                </Button>
                <Button variant="secondary" onClick={() => saveReview(false)} disabled={saving}>
                  Salvar decisão
                </Button>
                <Button onClick={() => saveReview(true)} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Marcar como revisado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!activation} onOpenChange={(open) => !open && setActivation(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmação administrativa da ativação</DialogTitle>
            <DialogDescription>
              Revise os dados antes de autorizar a criação do card. Apenas 1 registro é processado por execução.
            </DialogDescription>
          </DialogHeader>

          {activation && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Cliente:</span> {activation.cliente || "—"}</div>
                <div><span className="text-muted-foreground">CNPJ:</span> {activation.cnpj || "—"}</div>
                <div><span className="text-muted-foreground">Código Monnera:</span> {activation.codigo_monnera || "—"}</div>
                <div><span className="text-muted-foreground">Origem:</span> {activation.origem}</div>
                <div className="sm:col-span-2">
                  <span className="text-muted-foreground">Card sugerido:</span>{" "}
                  {activation.card_sugerido
                    ? cards.find((c) => c.id === activation.card_sugerido)?.full_name ?? activation.card_sugerido
                    : "Nenhum"}
                </div>
              </div>

              <div className="rounded-md bg-muted/40 p-2">
                <p className="font-medium mb-1">Evidência</p>
                <pre className="whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
                  {JSON.stringify(activation.evidencia, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded-md border border-border p-2">
                  <p className="font-medium mb-1">Ações que serão executadas</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {(activation.acoes ?? []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
                <div className="rounded-md border border-border p-2">
                  <p className="font-medium mb-1">Não será executado</p>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {(activation.nao_executa ?? []).map((a: string, i: number) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              </div>

              {(activation.bloqueios ?? []).length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                  <p className="font-medium">Bloqueios impedem a execução</p>
                  <ul className="list-disc pl-4">
                    {(activation.bloqueios ?? []).map((b: string, i: number) => <li key={i}>{b}</li>)}
                  </ul>
                </div>
              )}

              <Textarea
                rows={2}
                value={activationJustification}
                onChange={(e) => setActivationJustification(e.target.value.slice(0, 500))}
                placeholder="Justificativa da execução (obrigatória)."
              />

              <label className="flex items-center gap-2 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={activationConfirm}
                  onChange={(e) => setActivationConfirm(e.target.checked)}
                />
                Confirmo a criação do card na etapa Cadastro com os dados acima
              </label>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setActivation(null)} disabled={saving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={runActivation} disabled={saving || !activation.pode_executar}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Executar 1 registro
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="break-all">{value || "—"}</p>
    </div>
  );
}
