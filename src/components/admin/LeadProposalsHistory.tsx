import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  ExternalLink,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileText,
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
  superseded_at: string | null;
  pdf_path: string | null;
  pdf_status: "pending" | "ready" | "failed" | null;
  pdf_error: string | null;
  pdf_generated_at: string | null;
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

export default function LeadProposalsHistory({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [authors, setAuthors] = useState<Record<string, string>>({});
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const proposalsRef = useRef<Proposal[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("commercial_proposals")
      .select(
        "id, lead_id, token, proposal_name, public_url, created_at, created_by_user_id, version, accepted_at, accepted_by_name, superseded_at, pdf_path, pdf_status, pdf_error, pdf_generated_at",
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
    const { data, error } = await supabase.storage
      .from("propostas")
      .createSignedUrl(p.pdf_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link do PDF");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const handleRetry = async (p: Proposal) => {
    setRetrying((r) => ({ ...r, [p.id]: true }));
    try {
      await (supabase as any)
        .from("commercial_proposals")
        .update({ pdf_status: "pending", pdf_error: null })
        .eq("id", p.id);
      await supabase.functions.invoke("render-commercial-proposal-pdf", {
        body: { proposal_id: p.id },
      });
      toast.success("Geração de PDF reenfileirada.");
      load();
    } catch (err: any) {
      toast.error("Falha ao reprocessar: " + (err?.message || ""));
    } finally {
      setRetrying((r) => ({ ...r, [p.id]: false }));
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
          const isAccepted = !!p.accepted_at;
          const isSuperseded = !!p.superseded_at && !isAccepted;
          return (
            <li
              key={p.id}
              className={`rounded-md border p-3 text-sm space-y-2 ${
                isAccepted
                  ? "border-green-500/60 bg-green-500/5"
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
                {isAccepted && (
                  <Badge className="bg-green-600 hover:bg-green-600 text-white">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Aceita em{" "}
                    {fmtDate(p.accepted_at)}
                  </Badge>
                )}
                {isSuperseded && <Badge variant="secondary">Substituída</Badge>}
                {!isAccepted && !isSuperseded && (
                  <Badge variant="outline">Ativa</Badge>
                )}
              </div>

              {isAccepted && p.accepted_by_name && (
                <div className="text-xs text-muted-foreground">
                  Aceita por: {p.accepted_by_name}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap pt-1">
                {p.public_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      window.open(p.public_url!, "_blank", "noopener")
                    }
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir link
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
                  <>
                    <span
                      className="inline-flex items-center text-xs text-destructive"
                      title={p.pdf_error || ""}
                    >
                      <AlertCircle className="h-3.5 w-3.5 mr-1" />
                      Falha ao gerar PDF
                    </span>
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
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
