import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Mail, Eye } from "lucide-react";

/**
 * Solicitação de informação por e-mail para pendências que exigem resposta
 * externa. O registro permanece bloqueado; nenhum card é criado ou movido.
 * A resposta recebida volta pela mesma thread do Gmail (reprocessada pelo
 * worker de triagem) ou por nova importação do WhatsApp.
 */

export const PENDENCY_TEMPLATES: Array<{ value: string; label: string }> = [
  { value: "cnpj_ausente", label: "CNPJ ausente" },
  { value: "cnpj_divergente", label: "CNPJ divergente / mais de um CNPJ" },
  { value: "nome_incompativel", label: "Nome ou razão social incompatível" },
  { value: "codigo_nao_confirmado", label: "Código Monnera não confirmado" },
  { value: "dados_conflitantes", label: "Informações conflitantes" },
  { value: "dados_incompletos", label: "Complemento após resposta incompleta" },
];

const RECIPIENT_SOURCE_LABEL: Record<string, string> = {
  thread_original: "Thread original",
  email_do_card: "E-mail do cadastro",
  participante_comprovado: "Participante comprovado",
  ultimo_recurso: "Último recurso",
  nenhum: "Sem destinatário",
};

const STATUS_LABEL: Record<string, string> = {
  enviado: "Enviado",
  falhou: "Falhou",
  bloqueado_sem_destinatario: "Bloqueado (sem destinatário)",
};

type InfoRequest = {
  id: string;
  pendency_code: string;
  reason: string;
  template_key: string;
  template_version: string;
  subject: string;
  recipients: string[] | null;
  recipients_source: string;
  thread_id: string | null;
  gmail_message_id: string | null;
  status: string;
  attempt: number;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

type Props = {
  source: "gmail" | "whatsapp";
  rowId: string;
  cardId?: string | null;
  /** Motivo do bloqueio que originou a solicitação. */
  reason?: string | null;
  /** Sugestão inicial de template a partir da pendência detectada. */
  suggested?: string | null;
};

const fmt = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export const TriageInfoRequest = ({ source, rowId, cardId, reason, suggested }: Props) => {
  const [pendency, setPendency] = useState(suggested || "cnpj_ausente");
  const [complemento, setComplemento] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ recipients: string[]; recipients_source: string; subject: string; text: string } | null>(null);
  const [history, setHistory] = useState<InfoRequest[]>([]);

  const loadHistory = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("triage_info_requests")
      .select(
        "id,pendency_code,reason,template_key,template_version,subject,recipients,recipients_source,thread_id,gmail_message_id,status,attempt,error,sent_at,created_at",
      )
      .eq("row_id", rowId)
      .order("created_at", { ascending: false });
    setHistory((data as InfoRequest[]) ?? []);
  }, [rowId]);

  useEffect(() => {
    setPreview(null);
    setComplemento("");
    setPendency(suggested || "cnpj_ausente");
    loadHistory();
  }, [rowId, suggested, loadHistory]);

  const call = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("triage-request-info", {
        body: {
          source,
          row_id: rowId,
          card_id: cardId ?? null,
          pendency_code: pendency,
          reason: reason ?? null,
          complemento: complemento.trim() || null,
          dry_run: dryRun,
        },
      });

      const payload = (data ?? {}) as any;

      if (error || payload?.error) {
        const message =
          payload?.message ||
          (payload?.error === "sem_destinatario"
            ? "Nenhum destinatário comprovado — nenhum e-mail foi enviado."
            : payload?.error) ||
          error?.message ||
          "Não foi possível concluir a solicitação.";
        toast.error(message);
        await loadHistory();
        return;
      }

      if (dryRun) {
        setPreview(payload);
        return;
      }

      setPreview(null);
      setComplemento("");
      toast.success(
        `Solicitação enviada para ${(payload.recipients ?? []).join(", ")} (tentativa ${payload.attempt}). O registro segue bloqueado até a resposta.`,
      );
      await loadHistory();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao acionar o envio.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-background/40 p-3 text-xs">
      <p className="font-medium text-foreground">Solicitar informação por e-mail</p>
      <p className="text-muted-foreground">
        Envio pela conta Gmail autorizada, na mesma conversa quando ela existir. O registro permanece bloqueado até a
        resposta ser conferida. Destinatários seguem a ordem: thread original, e-mails do cadastro, participantes
        comprovados e, só em último caso, Denise/Deise.
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Pendência / template</Label>
          <Select value={pendency} onValueChange={setPendency}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PENDENCY_TEMPLATES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Complemento específico (opcional)</Label>
          <Textarea
            value={complemento}
            onChange={(e) => setComplemento(e.target.value)}
            rows={2}
            maxLength={600}
            placeholder="Ex.: precisamos apenas do CNPJ da filial de Curitiba."
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => call(true)}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Eye className="h-3.5 w-3.5 mr-1" />}
          Pré-visualizar
        </Button>
        <Button size="sm" disabled={busy} onClick={() => call(false)}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1" />}
          Enviar solicitação
        </Button>
      </div>

      {preview && (
        <div className="space-y-1 rounded-md border border-border bg-muted/30 p-2">
          <p className="text-foreground">
            Para: {preview.recipients.join(", ")}{" "}
            <Badge variant="outline" className="ml-1">
              {RECIPIENT_SOURCE_LABEL[preview.recipients_source] ?? preview.recipients_source}
            </Badge>
          </p>
          <p className="text-foreground">Assunto: {preview.subject}</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{preview.text}</p>
        </div>
      )}

      <div className="space-y-1">
        <p className="font-medium text-foreground">Histórico de solicitações</p>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma solicitação enviada para este registro.</p>
        ) : (
          <ul className="space-y-1">
            {history.map((h) => (
              <li key={h.id} className="rounded border border-border/60 p-2 text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      h.status === "enviado"
                        ? "border-emerald-500/30 text-emerald-400"
                        : "border-red-500/30 text-red-400"
                    }
                  >
                    {STATUS_LABEL[h.status] ?? h.status}
                  </Badge>
                  <span className="text-foreground">{h.subject || "(sem assunto)"}</span>
                  <span>tentativa {h.attempt}</span>
                  <span>· {fmt(h.sent_at || h.created_at)}</span>
                </div>
                <p>
                  Para: {(h.recipients ?? []).join(", ") || "—"} ·{" "}
                  {RECIPIENT_SOURCE_LABEL[h.recipients_source] ?? h.recipients_source}
                </p>
                <p>
                  Template: {h.template_key} {h.template_version} · Motivo: {h.reason}
                </p>
                <p>
                  Thread: {h.thread_id ?? "—"} · Mensagem: {h.gmail_message_id ?? "—"}
                </p>
                {h.error && <p className="text-red-400">Erro: {h.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
