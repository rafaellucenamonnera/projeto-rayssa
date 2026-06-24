import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const IFRAME_SRC = "/gerador-proposta/index.html";

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export default function AdminGeradorProposta() {
  const { leadId } = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const replaceMode = searchParams.get("mode") === "replace";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [profile, setProfile] = useState<{ nome?: string | null; telefone?: string | null } | null>(null);
  const [telefone, setTelefone] = useState("");

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const submittingRef = useRef(false);
  const telefoneRef = useRef("");
  const leadRef = useRef<any>(null);
  const profileRef = useRef<{ nome?: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!leadId) {
        setLoading(false);
        return;
      }
      const [{ data: leadData, error: leadErr }, profileRes] = await Promise.all([
        supabase.from("leads").select("*").eq("id", leadId).maybeSingle(),
        user?.id
          ? supabase
              .from("profiles")
              .select("nome, telefone")
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null } as any),
      ]);
      if (cancelled) return;
      if (leadErr || !leadData) {
        toast.error("Lead não encontrado.");
        navigate("/admin/painel-comercial");
        return;
      }
      setLead(leadData);
      leadRef.current = leadData;
      const prof = (profileRes as any)?.data || null;
      setProfile(prof);
      profileRef.current = prof;
      setTelefone(prof?.telefone || "");
      telefoneRef.current = prof?.telefone || "";
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [leadId, user?.id, navigate]);

  useEffect(() => {
    telefoneRef.current = telefone;
  }, [telefone]);

  useEffect(() => {
    function sendPrefill() {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      const leadData = leadRef.current;
      const prof = profileRef.current;
      const payload = {
        client: {
          company:
            leadData?.nome_fantasia ||
            leadData?.razao_social ||
            "",
          contact: leadData?.nome_responsavel || "",
          proposalName: leadData?.nome_fantasia
            ? `Proposta Monnera - ${leadData.nome_fantasia}`
            : undefined,
        },
        footer: {
          nome: prof?.nome || user?.email || "",
          email: user?.email || "",
          telefone: telefoneRef.current || "",
        },
      };
      try {
        iframe.contentWindow.postMessage(
          { type: "prefill", payload },
          window.location.origin,
        );
      } catch {
        /* noop */
      }
    }

    async function handleSave(payload: any) {
      if (submittingRef.current) return;
      const leadData = leadRef.current;
      if (!leadData?.id) {
        toast.error("Lead inválido.");
        return;
      }
      submittingRef.current = true;
      setSubmitting(true);
      try {
        // Próxima versão + ids das versões abertas (não aceitas) para marcar como substituídas
        const { data: existing, error: existErr } = await (supabase as any)
          .from("commercial_proposals")
          .select("id, version, accepted_at")
          .eq("lead_id", leadData.id);
        if (existErr) throw existErr;

        const maxVersion = (existing || []).reduce(
          (m: number, r: any) => Math.max(m, Number(r.version) || 1),
          0,
        );
        const nextVersion = maxVersion + 1;
        const priorOpenIds = (existing || [])
          .filter((r: any) => !r.accepted_at)
          .map((r: any) => r.id);

        const token = generateToken();
        const publicUrl = `${window.location.origin}/proposta/${token}`;
        const proposalName =
          (payload && payload.proposalName) ||
          `Proposta Monnera - ${leadData.nome_fantasia || leadData.razao_social || "Cliente"}`;

        const { data: inserted, error: insertError } = await (supabase as any)
          .from("commercial_proposals")
          .insert({
            lead_id: leadData.id,
            token,
            proposal_name: proposalName,
            payload,
            public_url: publicUrl,
            created_by_user_id: user?.id ?? null,
            omit_financials: false,
            omit_financials_reason: null,
            version: nextVersion,
            pdf_status: "pending",
          } as any)
          .select("id")
          .single();
        if (insertError) throw insertError;
        const newId = (inserted as any)?.id as string | undefined;

        // Marca versões anteriores NÃO aceitas como substituídas (a aceita permanece intacta)
        if (newId && priorOpenIds.length > 0) {
          await (supabase as any)
            .from("commercial_proposals")
            .update({
              superseded_at: new Date().toISOString(),
              superseded_by: newId,
            } as any)
            .in("id", priorOpenIds);
        }

        const updateData: any = {
          proposta_url: publicUrl,
          numero_proposta: proposalName,
        };
        if (!replaceMode) {
          updateData.status_lead = "proposta_enviada";
        }
        const { error: updErr } = await supabase
          .from("leads")
          .update(updateData)
          .eq("id", leadData.id);
        if (updErr) throw updErr;

        // PDF em segundo plano — falha NÃO bloqueia a proposta
        if (newId) {
          supabase.functions
            .invoke("render-commercial-proposal-pdf", {
              body: { proposal_id: newId },
            })
            .catch((e) => console.warn("PDF dispatch failed:", e));
        }

        try {
          await navigator.clipboard.writeText(publicUrl);
          toast.success(
            "Proposta gerada! Link copiado. PDF sendo processado em segundo plano.",
          );
        } catch {
          toast.success(
            "Proposta gerada. PDF sendo processado em segundo plano.",
          );
        }
        navigate("/admin/painel-comercial");
      } catch (err: any) {
        console.error("Erro ao gerar proposta:", err);
        toast.error("Erro ao gerar proposta: " + (err.message || "desconhecido"));
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "ready") sendPrefill();
      else if (data.type === "save") handleSave(data.payload);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [navigate, replaceMode, user?.email, user?.id]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || loading) return;
    try {
      iframe.contentWindow.postMessage(
        {
          type: "prefill",
          payload: {
            footer: {
              nome: profile?.nome || user?.email || "",
              email: user?.email || "",
              telefone,
            },
          },
        },
        window.location.origin,
      );
    } catch {
      /* noop */
    }
  }, [telefone, loading, profile?.nome, user?.email]);

  const headerInfo = useMemo(
    () => ({
      nome: profile?.nome || user?.email || "—",
      email: user?.email || "—",
    }),
    [profile?.nome, user?.email],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-background/95 flex items-center gap-4 flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/painel-comercial")}
          disabled={submitting}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold leading-tight truncate">
            Gerador de Proposta — {lead?.nome_fantasia || lead?.razao_social || "Lead"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {replaceMode
              ? "Nova versão da proposta"
              : "Gere a proposta e o link público de aceite"}
          </p>
        </div>
        <div className="ml-auto flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Responsável
            </Label>
            <div className="text-sm font-medium">{headerInfo.nome}</div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Email
            </Label>
            <div className="text-sm font-medium">{headerInfo.email}</div>
          </div>
          <div className="space-y-1">
            <Label
              htmlFor="gerador-telefone"
              className="text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Telefone (rodapé)
            </Label>
            <Input
              id="gerador-telefone"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(00) 00000-0000"
              className="h-8 w-44"
              disabled={submitting}
            />
          </div>
          {submitting && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...
            </div>
          )}
        </div>
      </div>
      <iframe
        ref={iframeRef}
        src={IFRAME_SRC}
        title="Gerador de Proposta Monnera"
        className="flex-1 w-full border-0 bg-white"
      />
    </div>
  );
}
