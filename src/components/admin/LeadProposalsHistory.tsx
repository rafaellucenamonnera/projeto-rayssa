import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2,
  ExternalLink,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
  XCircle,
  Ban,
  Copy,
} from "lucide-react";

type Proposal = {
  id: string;
  lead_id: string;
  token: string;
  proposal_name: string | null;
  public_url: string | null;
  created_at: string;
  created_by_user_id: string | null;
  version: number;
  accepted_at: string | null;
  accepted_by_name: string | null;
  acceptance_canceled_at: string | null;
  acceptance_cancellation_reason: string | null;
  superseded_at: string | null;
  proposal_canceled_at: string | null;
  proposal_canceled_by: string | null;
  proposal_cancellation_reason: string | null;
  pdf_path: string | null;
  pdf_status: "pending" | "ready" | "failed" | null;
  pdf_error: string | null;
  pdf_generated_at: string | null;
  payload: any;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function openPublic(url?: string | null) {
  if (!url) return;
  const target = /^https?:\/\//i.test(url)
    ? url
    : `${window.location.origin}${url.startsWith("/") ? "" : "/"}${url}`;
  window.open(target, "_blank", "noopener");
}

const isActiveAccepted = (p: Proposal) =>
  !!p.accepted_at && !p.acceptance_canceled_at;

const isActiveProposal = (p: Proposal) =>
  !p.accepted_at &&
  !p.acceptance_canceled_at &&
  !p.superseded_at &&
  !p.proposal_canceled_at;

export default function LeadProposalsHistory({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const proposalsRef = useRef<Proposal[]>([]);

  const [cancelTarget, setCancelTarget] = useState<Proposal | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [cancelProposalTarget, setCancelProposalTarget] =
    useState<Proposal | null>(null);
  const [cancelProposalReason, setCancelProposalReason] = useState("");
  const [cancellingProposal, setCancellingProposal] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("commercial_proposals")
      .select(
        "id, lead_id, token, proposal_name, public_url, created_at, created_by_user_id, version, accepted_at, accepted_by_name, acceptance_canceled_at, acceptance_cancellation_reason, superseded_at, proposal_canceled_at, proposal_canceled_by, proposal_cancellation_reason, pdf_path, pdf_status, pdf_error, pdf_generated_at, payload",
      )
      .eq("lead_id", leadId)
      .order("version", { ascending: false });
    if (error) {
      console.error("load proposals:", error);
      setProposals([]);
      proposalsRef.current = [];
    } else {
      const list = (data as Proposal[]) || [];
      setProposals(list);
      proposalsRef.current = list;

      if (import.meta.env.DEV) {
        console.info(
          "[LeadProposalsHistory] proposals",
          list.map((p) => ({
            id: p.id,
            version: p.version,
            accepted_at: p.accepted_at,
            acceptance_canceled_at: p.acceptance_canceled_at,
            isActiveAccepted: isActiveAccepted(p),
          })),
        );
      }

      const ids = Array.from(
        new Set(list.map((p) => p.created_by_user_id).filter(Boolean)),
      ) as string[];
      if (ids.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("user_id, nome")
          .in("user_id", ids);
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => {
          map[p.user_id] = p.nome || "";
        });
        setAuthors(map);
      } else {
        setAuthors({});
      }
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    setLoading(true);
    load();
    // Polling consulta APENAS o banco. Nunca invoca a Edge Function.
    const interval = setInterval(() => {
      const hasPending = proposalsRef.current.some(
        (p) => p.pdf_status === "pending",
      );
      if (hasPending) load();
    }, 5000);
    return () => clearInterval(interval);
  }, [leadId, load]);

  const handleDownloadPdf = async (p: Proposal) => {
    if (!p.pdf_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("propostas")
        .createSignedUrl(p.pdf_path, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Erro ao gerar link do PDF");
        return;
      }
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const baseName = (p.proposal_name || "proposta").replace(/[^\w\-]+/g, "_");
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${baseName}-v${p.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      console.error("download pdf:", err);
      toast.error(
        "Não foi possível baixar o PDF. O navegador pode ter bloqueado o download automático.",
      );
    }
  };

  const humanizePdfError = (raw?: string | null): string => {
    if (!raw) return "Não foi possível gerar o PDF agora. Você pode tentar novamente.";
    const s = raw.toLowerCase();
    if (s.includes("401") || s.includes("unauthorized") || s.includes("invalid api key"))
      return "A chave do PDFShift está inválida ou foi revogada. Avise o time técnico.";
    if (s.includes("timeout") || s.includes("timed out"))
      return "O serviço de PDF demorou demais para responder. Tente novamente em alguns instantes.";
    if (s.includes("429") || s.includes("rate limit"))
      return "Limite de geração de PDF atingido. Aguarde alguns minutos e tente novamente.";
    if (s.includes("processamento anterior") || s.includes("processamento expirado"))
      return "Processamento anterior foi interrompido. Clique em tentar gerar novamente.";
    if (/\b5\d{2}\b/.test(s) || s.includes("network") || s.includes("fetch failed"))
      return "O serviço de PDF está temporariamente indisponível. Tente novamente em alguns instantes.";
    return "Não foi possível gerar o PDF agora. Você pode tentar novamente.";
  };

  const handleRetry = async (p: Proposal) => {
    setRetrying((r) => ({ ...r, [p.id]: true }));
    try {
      const { data, error } = await supabase.functions.invoke(
        "render-commercial-proposal-pdf",
        { body: { proposal_id: p.id, force: true } },
      );
      if (error) throw error;
      if (data && (data as any).ok === false) {
        toast.error(
          "Falha ao gerar PDF: " + ((data as any).error || "desconhecido"),
        );
      } else {
        toast.success("Geração de PDF reenfileirada.");
      }
      load();
    } catch (err: any) {
      toast.error("Falha ao reprocessar: " + (err?.message || ""));
    } finally {
      setRetrying((r) => ({ ...r, [p.id]: false }));
    }
  };

  const openCancelModal = (p: Proposal) => {
    setCancelTarget(p);
    setCancelReason("");
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      toast.error("Informe um motivo com no mínimo 5 caracteres.");
      return;
    }
    setCancelling(true);
    try {
      const { error } = await (supabase as any).rpc(
        "cancel_commercial_proposal_acceptance",
        { p_proposal_id: cancelTarget.id, p_reason: reason },
      );
      if (error) throw error;
      toast.success("Aceite cancelado e registrado no histórico.");
      setCancelTarget(null);
      setCancelReason("");
      load();
    } catch (err: any) {
      toast.error("Falha ao cancelar aceite: " + (err?.message || ""));
    } finally {
      setCancelling(false);
    }
  };

  const openCancelProposalModal = (p: Proposal) => {
    setCancelProposalTarget(p);
    setCancelProposalReason("");
  };

  const handleConfirmCancelProposal = async () => {
    if (!cancelProposalTarget) return;
    const reason = cancelProposalReason.trim();
    if (reason.length < 5) {
      toast.error("Informe um motivo com no mínimo 5 caracteres.");
      return;
    }
    setCancellingProposal(true);
    try {
      const { error } = await (supabase as any).rpc(
        "cancel_commercial_proposal",
        { p_proposal_id: cancelProposalTarget.id, p_reason: reason },
      );
      if (error) throw error;
      toast.success("Proposta cancelada e registrada no histórico.");
      setCancelProposalTarget(null);
      setCancelProposalReason("");
      load();
    } catch (err: any) {
      toast.error("Falha ao cancelar proposta: " + (err?.message || ""));
    } finally {
      setCancellingProposal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando propostas…
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nenhuma proposta gerada ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <FileText className="h-4 w-4" /> Propostas
      </h3>
      <ul className="space-y-2">
        {proposals.map((p) => {
          const author =
            (p.created_by_user_id && authors[p.created_by_user_id]) || "—";
          const activeAccepted = isActiveAccepted(p);
          const isCanceledAcceptance =
            !!p.accepted_at && !!p.acceptance_canceled_at;
          const proposalCanceled = !!p.proposal_canceled_at && !p.accepted_at;
          const isSuperseded =
            !!p.superseded_at && !activeAccepted && !proposalCanceled;
          const activeProposal = isActiveProposal(p);
          return (
            <li
              key={p.id}
              className={`rounded-md border p-3 text-sm space-y-2 ${
                activeAccepted
                  ? "border-green-500/60 bg-green-500/5"
                  : isCanceledAcceptance
                    ? "border-destructive/40 bg-destructive/5"
                    : proposalCanceled
                      ? "border-destructive/40 bg-destructive/5"
                      : isSuperseded
                        ? "border-border bg-muted/40 opacity-80"
                        : "border-primary/40 bg-primary/5"
              }`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">v{p.version}</span>
                <span className="text-muted-foreground">·</span>
                <span>{fmtDate(p.created_at)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">por {author}</span>
                {activeAccepted && (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Proposta aceita
                  </Badge>
                )}
                {isCanceledAcceptance && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" /> Aceite cancelado
                  </Badge>
                )}
                {proposalCanceled && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" /> Proposta cancelada
                  </Badge>
                )}
                {isSuperseded && !isCanceledAcceptance && !proposalCanceled && (
                  <Badge variant="secondary">Substituída</Badge>
                )}
                {activeProposal && (
                  <>
                    <Badge variant="outline">Ativa</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                      onClick={() => openCancelProposalModal(p)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar proposta
                    </Button>
                  </>
                )}
              </div>

              {activeAccepted && (
                <div className="text-xs text-muted-foreground">
                  Aceita em {fmtDate(p.accepted_at)}
                  {p.accepted_by_name ? ` por ${p.accepted_by_name}` : ""}
                </div>
              )}

              {isCanceledAcceptance && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>
                    Aceite original: {fmtDate(p.accepted_at)}
                    {p.accepted_by_name ? ` por ${p.accepted_by_name}` : ""}
                  </div>
                  <div>
                    Cancelado em: {fmtDate(p.acceptance_canceled_at)}
                  </div>
                  {p.acceptance_cancellation_reason && (
                    <div>Motivo: {p.acceptance_cancellation_reason}</div>
                  )}
                </div>
              )}

              {proposalCanceled && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>
                    Proposta cancelada em: {fmtDate(p.proposal_canceled_at)}
                  </div>
                  {p.proposal_cancellation_reason && (
                    <div>Motivo: {p.proposal_cancellation_reason}</div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap pt-1">
                {p.public_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openPublic(p.public_url)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver proposta
                  </Button>
                )}

                {p.pdf_status === "ready" && p.pdf_path && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPdf(p)}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Baixar PDF
                  </Button>
                )}

                {p.pdf_status === "pending" && (
                  <span className="inline-flex items-center text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    Gerando PDF…
                  </span>
                )}

                {p.pdf_status === "failed" && (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex items-start gap-2 flex-wrap">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="inline-flex items-center text-sm text-destructive font-medium">
                          <AlertCircle className="h-4 w-4 mr-1" />
                          PDF ainda não foi gerado
                        </div>
                        <div className="text-xs text-muted-foreground">
                          A proposta está salva e o link público continua
                          funcionando. Você pode tentar gerar o PDF novamente.
                        </div>
                        <div className="text-xs text-destructive/90">
                          {humanizePdfError(p.pdf_error)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retrying[p.id]}
                        onClick={() => handleRetry(p)}
                      >
                        {retrying[p.id] ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Tentar gerar novamente
                      </Button>
                    </div>
                    {p.pdf_error && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                          Ver detalhe técnico
                        </summary>
                        <pre className="mt-1 text-[11px] leading-snug text-destructive/90 bg-destructive/5 border border-destructive/20 rounded px-2 py-1.5 whitespace-pre-wrap break-words font-mono max-h-32 overflow-auto">
                          {p.pdf_error}
                        </pre>
                      </details>
                    )}
                  </div>
                )}

                {activeAccepted && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                    onClick={() => openCancelModal(p)}
                  >
                    <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar aceite da proposta
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open && !cancelling) {
            setCancelTarget(null);
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar aceite da proposta</DialogTitle>
            <DialogDescription>
              O aceite original será preservado no histórico, mas a proposta
              deixará de ser considerada ativa. Informe o motivo (mín. 5
              caracteres).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Motivo do cancelamento do aceite"
            rows={4}
            disabled={cancelling}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setCancelReason("");
              }}
              disabled={cancelling}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling || cancelReason.trim().length < 5}
            >
              {cancelling && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Confirmar cancelamento do aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cancelProposalTarget}
        onOpenChange={(open) => {
          if (!open && !cancellingProposal) {
            setCancelProposalTarget(null);
            setCancelProposalReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar proposta</DialogTitle>
            <DialogDescription>
              A proposta deixará de constar como ativa no histórico interno. O
              link público e os registros permanecem preservados para auditoria.
              Informe o motivo (mín. 5 caracteres).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelProposalReason}
            onChange={(e) => setCancelProposalReason(e.target.value)}
            placeholder="Motivo do cancelamento"
            rows={4}
            disabled={cancellingProposal}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelProposalTarget(null);
                setCancelProposalReason("");
              }}
              disabled={cancellingProposal}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancelProposal}
              disabled={
                cancellingProposal || cancelProposalReason.trim().length < 5
              }
            >
              {cancellingProposal && (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              )}
              Confirmar cancelamento da proposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
