import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProposalData = {
  id?: string;
  lead_id?: string;
  proposal_name?: string | null;
  payload?: Record<string, any> | null;
  omit_financials?: boolean;
  omit_financials_reason?: string | null;
  accepted?: boolean;
  accepted_at?: string | null;
  opened_at?: string | null;
  created_at?: string | null;
  lead?: { nome_fantasia?: string | null } | null;
};

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const ACCEPT_TEXT =
  "Declaro que li e aceito a proposta comercial Monnera, incluindo escopo, condições comerciais, valores, prazos e demais termos apresentados. Ao confirmar, o aceite será registrado no painel Monnera para acompanhamento do time comercial.";
const IFRAME_SRC = "/gerador-proposta/index.html";

function formatDate(value?: string | null) {
  if (!value) return "";
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

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const printMode = searchParams.get("print") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<ProposalData | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accepting, setAccepting] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const proposalRef = useRef<ProposalData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setError("Link inválido");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc(
        "get_public_commercial_proposal" as any,
        { p_token: token } as any,
      );
      if (cancelled) return;
      if (rpcError || !data) {
        setError("Proposta não encontrada ou link inválido.");
        setProposal(null);
      } else {
        const p = data as ProposalData;
        setProposal(p);
        proposalRef.current = p;
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ready") {
        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) return;
        try {
          iframe.contentWindow.postMessage(
            { type: "setMode", mode: "view", readonly: true },
            window.location.origin,
          );
          if (proposalRef.current?.payload) {
            iframe.contentWindow.postMessage(
              { type: "prefill", payload: proposalRef.current.payload },
              window.location.origin,
            );
          }
          if (printMode) {
            setTimeout(() => {
              document.body.classList.add("proposal-ready");
              try {
                (window as any).isProposalReadyForPdf = () => true;
              } catch {
                /* noop */
              }
            }, 1500);
          }
        } catch {
          /* noop */
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [printMode]);

  const isAccepted = Boolean(proposal?.accepted || proposal?.accepted_at);

  async function handleAccept() {
    if (!token) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast.error("Informe um email válido.");
      return;
    }
    setAccepting(true);
    const { data, error: rpcError } = await supabase.rpc(
      "accept_commercial_proposal" as any,
      {
        p_token: token,
        p_accepted_by_name: trimmedName,
        p_accepted_by_email: trimmedEmail,
        p_accepted_ip: null,
        p_accepted_user_agent: navigator.userAgent,
      } as any,
    );
    setAccepting(false);
    if (rpcError) {
      toast.error("Não foi possível registrar o aceite. Tente novamente.");
      return;
    }
    const result = (data as any) || {};
    const acceptedAt = result.accepted_at || new Date().toISOString();
    setProposal((prev) =>
      prev ? { ...prev, accepted: true, accepted_at: acceptedAt } : prev,
    );
    setModalOpen(false);
    if (result.already_accepted) {
      toast.success("Esta proposta já estava aceita.");
    } else {
      toast.success("Proposta aceita com sucesso!");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Proposta indisponível</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            {error || "Proposta não encontrada ou link inválido."}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {printMode && (
        <style>{`
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
          .proposta-print-hide { display: none !important; }
        `}</style>
      )}

      {!printMode && isAccepted && (
        <div className="flex items-center gap-3 border-b border-primary/40 bg-primary/10 px-4 py-2 text-primary text-sm">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">
            Proposta aceita em {formatDate(proposal.accepted_at)}
          </span>
        </div>
      )}

      <iframe
        ref={iframeRef}
        src={IFRAME_SRC}
        title="Proposta Monnera"
        className="flex-1 w-full border-0 bg-white"
        style={{ minHeight: "calc(100vh - 0px)" }}
      />

      {!printMode && !isAccepted && (
        <div className="fixed bottom-6 right-6 z-50 proposta-print-hide">
          <Button size="lg" onClick={() => setModalOpen(true)}>
            Aceitar proposta comercial
          </Button>
        </div>
      )}

      {!printMode && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aceitar proposta comercial</DialogTitle>
              <DialogDescription>
                Confirme seus dados para registrar o aceite.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accept-name">Nome completo</Label>
                <Input
                  id="accept-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  disabled={accepting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accept-email">Email</Label>
                <Input
                  id="accept-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  disabled={accepting}
                />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {ACCEPT_TEXT}
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={accepting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleAccept}
                disabled={accepting || !name.trim() || !email.trim()}
              >
                {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
                Aceitar proposta comercial
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
