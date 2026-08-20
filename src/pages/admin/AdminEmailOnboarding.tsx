import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Eye, Save, Send, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ONBOARDING_EMAIL_SUBJECT,
  isValidEmail,
  parseRecipients,
  renderOnboardingEmail,
} from "@/lib/onboardingEmailTemplate";

interface HistoryRow {
  id: string;
  nome_parceiro: string;
  codigo_parceiro: string;
  link_material: string;
  assunto: string;
  destinatarios: string[];
  status: string;
  created_at: string;
  message_id: string | null;
  thread_id: string | null;
  template_name: string | null;
  template_version: string | null;
}

const statusVariant = (status: string) =>
  status === "enviado" ? "default" : status === "erro" ? "destructive" : "secondary";

// Envio controlado: liberado exclusivamente para o card de QA abaixo.
const QA_SEND = {
  cardId: "32d1e94e-ab53-42b3-9118-ab3ad2d07c77",
  nome: "TESTE FASE A QA",
  codigo: "QATEST01",
  destinatario: "rafael.lucena@monnera.com.br",
  conta: "rafael.lucena@monnera.com.br",
  template: "onboarding-parceiro-baston",
  versao: "v2",
};

// Link publico do Canva: canva.link/... ou canva.com/d/<token> sem token de edicao.
export const isCanvaPublicLink = (value: string) =>
  /^https:\/\/(canva\.link\/[A-Za-z0-9]+|www\.canva\.com\/d\/[A-Za-z0-9_-]+)(\?[^\s]*)?$/.test(value) &&
  !value.includes("/edit") &&
  !value.includes("canva.com/d/s_");

export async function fetchCardPublicLink(cardId: string): Promise<string | null> {
  const { data } = await (supabase as any)
    .from("representative_cards")
    .select("canva_public_url")
    .eq("id", cardId)
    .maybeSingle();
  const url = (data?.canva_public_url ?? "").trim();
  return url && isCanvaPublicLink(url) ? url : null;
}

export default function AdminEmailOnboarding() {
  const { user, isAdmin } = useAuth();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [link, setLink] = useState("");
  const [destinatarios, setDestinatarios] = useState("");
  const [assunto, setAssunto] = useState(ONBOARDING_EMAIL_SUBJECT);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [resendInfo, setResendInfo] = useState<{
    sentAt: string | null;
    messageId: string | null;
    destinatarios: string[];
  } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);


  const recipients = useMemo(() => parseRecipients(destinatarios), [destinatarios]);
  const invalidRecipients = useMemo(
    () => recipients.filter((item) => !isValidEmail(item)),
    [recipients],
  );

  const isQaSend =
    nome.trim() === QA_SEND.nome &&
    codigo.trim().toUpperCase() === QA_SEND.codigo &&
    isCanvaPublicLink(link.trim()) &&
    recipients.length === 1 &&
    recipients[0].toLowerCase() === QA_SEND.destinatario;

  const loadQaCard = async () => {
    const publicLink = await fetchCardPublicLink(QA_SEND.cardId);
    if (!publicLink) {
      toast.error("Link público do Canva ausente ou inválido no card. Envio bloqueado.");
      return;
    }
    setNome(QA_SEND.nome);
    setCodigo(QA_SEND.codigo);
    setLink(publicLink);
    setDestinatarios(QA_SEND.destinatario);
    setAssunto(ONBOARDING_EMAIL_SUBJECT);
    setPreview(null);
    toast.success("Dados do card TESTE FASE A QA carregados.");
  };


  const handleSend = async (confirmarReenvio = false) => {
    const html = preview ?? build();
    if (!html || !isQaSend) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-onboarding-email", {
      body: {
        card_id: QA_SEND.cardId,
        nome_parceiro: nome.trim(),
        codigo_parceiro: codigo.trim().toUpperCase(),
        link_material: link.trim(),
        assunto: assunto.trim(),
        destinatarios: recipients,
        html,
        confirmar_reenvio: confirmarReenvio,
      },
    });
    setSending(false);
    setConfirmOpen(false);
    if (error || (data as any)?.error) {
      let payload: any = data ?? null;
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") {
        try {
          payload = await ctx.json();
        } catch {
          /* mantem mensagem generica */
        }
      }
      if (payload?.duplicate && !confirmarReenvio) {
        setResendInfo({
          sentAt: payload.sent_at ?? null,
          messageId: payload.message_id ?? null,
          destinatarios: payload.destinatarios_anteriores ?? [],
        });
        setResendOpen(true);
        loadHistory();
        return;
      }
      const detail = payload?.error
        ? `${payload.error}${payload.detail ? ` — ${payload.detail}` : ""}`
        : error?.message ?? "erro desconhecido";
      toast.error(`Falha no envio: ${detail}`);
      loadHistory();
      return;
    }

    const result = data as any;
    setResendOpen(false);
    setResendInfo(null);
    toast.success(
      `${result.is_resend ? "REENVIO realizado" : "E-mail enviado"}. message_id ${result.message_id ?? "-"}`,
    );
    (result.avisos ?? []).forEach((aviso: string) => toast.warning(aviso));
    loadHistory();
  };




  const loadHistory = async () => {
    const { data } = await (supabase as any)
      .from("onboarding_email_sends")
      .select("id,nome_parceiro,codigo_parceiro,link_material,assunto,destinatarios,status,created_at,message_id,thread_id,template_name,template_version")
      .order("created_at", { ascending: false })
      .limit(30);
    setHistory((data as HistoryRow[]) || []);
  };

  useEffect(() => {
    if (isAdmin) loadHistory();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    if (new URLSearchParams(window.location.search).get("qa") !== "1") return;
    void loadQaCard();
  }, [isAdmin]);



  const build = () => {
    const { html, errors } = renderOnboardingEmail({
      nomeParceiro: nome,
      codigoParceiro: codigo,
      linkMaterial: link,
    });
    if (errors.length) {
      errors.forEach((error) => toast.error(error));
      return null;
    }
    return html;
  };

  const handlePreview = () => {
    const html = build();
    if (!html) return;
    setPreview(html);
    toast.success("Preview gerado.");
  };

  const handleCopy = async () => {
    const html = preview ?? build();
    if (!html) return;
    await navigator.clipboard.writeText(html);
    toast.success("HTML final copiado.");
  };

  const handleSaveDraft = async () => {
    const html = build();
    if (!html) return;
    if (!assunto.trim()) {
      toast.error("Informe o assunto do e-mail.");
      return;
    }
    if (invalidRecipients.length) {
      toast.error(`Destinatário inválido: ${invalidRecipients.join(", ")}`);
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("onboarding_email_sends").insert({
      nome_parceiro: nome.trim(),
      codigo_parceiro: codigo.trim().toUpperCase(),
      link_material: link.trim(),
      assunto: assunto.trim(),
      destinatarios: recipients,
      status: "rascunho",
      html_snapshot: html,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(`Não foi possível salvar o rascunho: ${error.message}`);
      return;
    }
    toast.success("Rascunho salvo.");
    setPreview(html);
    loadHistory();
  };

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">E-mail de Onboarding Baston</h1>
        <p className="text-sm text-muted-foreground">
          Gera o e-mail oficial de boas-vindas a partir do template aprovado. O envio permanece desativado nesta etapa.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do parceiro</CardTitle>
            <CardDescription>Somente três campos são substituídos no template.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome do parceiro</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="codigo">Código de cadastro Parceiro Baston</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                placeholder="8 caracteres (A-Z, 0-9)"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link">Link do material customizado</Label>
              <Input
                id="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.canva.com/d/..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="destinatarios">E-mail(s) destinatário(s)</Label>
              <Textarea
                id="destinatarios"
                value={destinatarios}
                onChange={(e) => setDestinatarios(e.target.value)}
                rows={3}
                placeholder="separe por vírgula, ponto e vírgula ou quebra de linha"
              />
              {invalidRecipients.length > 0 && (
                <p className="text-xs text-destructive">Inválidos: {invalidRecipients.join(", ")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assunto">Assunto</Label>
              <Textarea id="assunto" value={assunto} onChange={(e) => setAssunto(e.target.value)} rows={2} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={handlePreview}>
                <Eye className="mr-2 h-4 w-4" /> Gerar preview
              </Button>
              <Button variant="outline" onClick={handleCopy}>
                <Copy className="mr-2 h-4 w-4" /> Copiar HTML
              </Button>
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar rascunho
              </Button>
              <Button variant="ghost" onClick={loadQaCard}>
                Carregar card de QA
              </Button>
              <Button
                variant="secondary"
                disabled={!isQaSend || !preview || sending}
                title={
                  isQaSend
                    ? preview
                      ? "Envio controlado do card TESTE FASE A QA"
                      : "Gere o preview antes de enviar"
                    : "Envio liberado apenas para o card TESTE FASE A QA"
                }
                onClick={() => setConfirmOpen(true)}
              >
                {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Enviar e-mail
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Envio habilitado exclusivamente para o card TESTE FASE A QA, pela conta {QA_SEND.conta}, com preview e
              confirmação explícita. Nenhum outro card, destinatário, cobrança ou régua é processado.
            </p>

          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview do e-mail</CardTitle>
            <CardDescription>Renderização fiel do HTML final que será enviado.</CardDescription>
          </CardHeader>
          <CardContent>
            {preview ? (
              <iframe
                title="Preview do e-mail de onboarding"
                srcDoc={preview}
                sandbox=""
                className="w-full h-[720px] rounded-md border border-border bg-white"
              />
            ) : (
              <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
                Preencha os campos e clique em "Gerar preview".
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
          <CardDescription>Rascunhos e tentativas de envio registrados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>}
          {history.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{row.nome_parceiro}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {row.codigo_parceiro} · {row.destinatarios?.join(", ") || "sem destinatários"}
                </p>
                {row.message_id && (
                  <p className="text-xs text-muted-foreground truncate">
                    msg {row.message_id} · thread {row.thread_id ?? "-"} · {row.template_name}/{row.template_version}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(row.created_at).toLocaleString("pt-BR")}
                </span>
                <Badge variant={statusVariant(row.status) as any}>{row.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmação final de envio</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 text-sm">
                <p><strong>Destinatário:</strong> {recipients.join(", ")}</p>
                <p><strong>Assunto:</strong> {assunto.trim()}</p>
                <p><strong>Nome:</strong> {nome.trim()}</p>
                <p><strong>Código:</strong> {codigo.trim().toUpperCase()}</p>
                <p className="break-all"><strong>Link Canva:</strong> {link.trim()}</p>
                <p><strong>Template:</strong> {QA_SEND.template}</p>
                <p><strong>Versão:</strong> {QA_SEND.versao}</p>
                <p><strong>Conta remetente:</strong> {QA_SEND.conta}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!isQaSend || sending}
              onClick={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              {sending ? "Enviando..." : "Confirmar e enviar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
