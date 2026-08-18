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
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, CheckCircle2, Mail } from "lucide-react";

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
  conflict_notes: Array<Record<string, unknown>> | null;
  last_correction_at: string | null;
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
  const [filterCnpj, setFilterCnpj] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterCodigo, setFilterCodigo] = useState("");
  const [filterInicio, setFilterInicio] = useState("");
  const [filterFim, setFilterFim] = useState("");

  const [selected, setSelected] = useState<TriageMessage | null>(null);
  const [decision, setDecision] = useState("");
  const [linkCardId, setLinkCardId] = useState<string>("none");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({});
  const [justification, setJustification] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [confirmRelease, setConfirmRelease] = useState(false);

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
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
  }, [messages, filterResult, filterReviewed, filterCnpj, filterFrom, filterCodigo, filterInicio, filterFim]);

  const resultOptions = useMemo(
    () => Array.from(new Set(messages.map((m) => m.analysis_result ?? m.status))).sort(),
    [messages],
  );

  const openRecord = (m: TriageMessage) => {
    setSelected(m);
    setDecision(m.review_decision ?? "");
    setLinkCardId(m.matched_card_id ?? "none");
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
                    {m.pending_reason && (
                      <p className="mt-1 text-xs text-amber-400">{m.pending_reason}</p>
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
                <Select value={linkCardId} onValueChange={setLinkCardId}>
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
                {linkCardId !== "none" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(crossCardActionUrl(CROSS_PANEL_ID, linkCardId))}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir card
                  </Button>
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
