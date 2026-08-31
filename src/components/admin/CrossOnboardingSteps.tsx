import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, Clock, ExternalLink, FileCode2, Loader2, RefreshCw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { describeMonneraCode } from "@/lib/monneraCode";
import { validateCanvaPublicLink } from "@/lib/canvaLink";
import { CARD_ATTACHMENTS_BUCKET, formatBytes, getCardAttachmentUrl } from "@/lib/cardAttachments";

/**
 * Checklist MANUAL do onboarding Cross.
 * Nada aqui dispara automação: não cria tarefa, não gera Canva, não envia e-mail
 * e não chama cross-onboarding-advance. A movimentação do card é feita pelo
 * operador, com confirmação, e só fica liberada com as conferências concluídas.
 */

const STEP_DESTINATARIOS = "destinatarios_confirmados";
const STEP_EMAIL = "email_confirmado";

/** Destinatários internos Monnera: valem para qualquer contratante. */
export const DESTINATARIOS_MONNERA = [
  "rafael.lucena@monnera.com.br",
  "maycon.santos@monnera.com.br",
];

/** Destinatários por contratante: só entram nos cards do respectivo contratante. */
export const DESTINATARIOS_POR_CONTRATANTE: Array<{
  match: RegExp;
  dominio: RegExp;
  emails: string[];
}> = [
  {
    match: /baston/i,
    dominio: /@baston\.com\.br$/i,
    emails: ["denise@baston.com.br", "deise.stadler@baston.com.br", "marcos.miranda@baston.com.br"],
  },
  {
    match: /maxi\s*nutri/i,
    dominio: /@maxinutri\.com\.br$/i,
    emails: ["comercial@maxinutri.com.br"],
  },
];

/** Lista obrigatória do card, conforme o contratante Monnera. */
export const destinatariosObrigatorios = (contratante?: string | null) => {
  const grupo = DESTINATARIOS_POR_CONTRATANTE.find((g) => g.match.test(contratante ?? ""));
  return [...DESTINATARIOS_MONNERA, ...(grupo?.emails ?? [])];
};

/** Domínios de contratante que não podem aparecer em cards de outro contratante. */
const dominioBloqueado = (email: string, contratante?: string | null) =>
  DESTINATARIOS_POR_CONTRATANTE.some(
    (g) => g.dominio.test(email) && !g.match.test(contratante ?? ""),
  );

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TECNICOS = [/^no-?reply@/i, /^nao-?responda@/i, /^notifications?@/i, /^jira@/i, /@monnera\.atlassian\.net$/i, /^mailer-daemon@/i];


interface StepRow {
  step: string;
  status: string;
  payload: Record<string, any> | null;
  updated_at: string | null;
}

interface HtmlFile {
  id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
  created_by: string | null;
}

interface CardInfo {
  id: string;
  full_name?: string | null;
  email?: string | null;
  codigo_monnera?: string | null;
  contratante_monnera?: string | null;

  canva_public_url?: string | null;
  stage_id?: string | null;
}

interface Props {
  cardId: string;
  canRun: boolean;
  card?: CardInfo | null;
  onCardMoved?: (stageId: string) => void;
}

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export default function CrossOnboardingSteps({ cardId, canRun, card, onCardMoved }: Props) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<StepRow[]>([]);
  const [cardData, setCardData] = useState<CardInfo | null>(card ?? null);
  const [htmlFiles, setHtmlFiles] = useState<HtmlFile[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // destinatários
  const [extras, setExtras] = useState("");
  const [savingDest, setSavingDest] = useState(false);

  // evidência de envio
  const [dataEnvio, setDataEnvio] = useState("");
  const [remetente, setRemetente] = useState("rafael.lucena@monnera.com.br");
  const [threadId, setThreadId] = useState("");
  const [messageId, setMessageId] = useState("");
  const [observacao, setObservacao] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // movimentação
  const [moveOpen, setMoveOpen] = useState(false);
  const [moving, setMoving] = useState(false);
  const [stageDestino, setStageDestino] = useState<{ value: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [stepsRes, cardRes, filesRes, stageRes] = await Promise.all([
      supabase
        .from("cross_onboarding_steps")
        .select("step, status, payload, updated_at")
        .eq("card_id", cardId),
      supabase
        .from("representative_cards")
        .select("id, full_name, email, codigo_monnera, contratante_monnera, canva_public_url, stage_id")
        .eq("id", cardId)
        .maybeSingle(),
      (supabase as any)
        .from("representative_card_attachments")
        .select("id, file_name, storage_path, size_bytes, created_at, created_by")
        .eq("representative_card_id", cardId)
        .order("created_at", { ascending: false }),
      supabase
        .from("pipeline_stages_config")
        .select("value, label")
        .eq("panel_key", "painel_msj9fyji"),
    ]);

    setRows((stepsRes.data as StepRow[]) ?? []);
    if (cardRes.data) setCardData(cardRes.data as CardInfo);

    const files = ((filesRes.data as HtmlFile[]) ?? []).filter((f) => /\.html?$/i.test(f.file_name));
    setHtmlFiles(files);

    const ids = Array.from(new Set(files.map((f) => f.created_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (profs as any[]) ?? []) map[p.id] = p.full_name || p.email || p.id;
      setProfiles(map);
    }

    const destino = ((stageRes.data as { value: string; label: string }[]) ?? []).find((s) =>
      /recebimento\s+dados/i.test(s.label ?? ""),
    );
    setStageDestino(destino ?? null);
    setLoading(false);
  }, [cardId]);

  useEffect(() => { void load(); }, [load]);

  const stepRow = (step: string) => rows.find((r) => r.step === step && r.status === "sucesso");
  const destRow = stepRow(STEP_DESTINATARIOS);
  const emailRow = stepRow(STEP_EMAIL);

  // ---------------------------------------------------------------- conferências
  const codigo = describeMonneraCode(cardData?.codigo_monnera);
  const okCodigo = codigo.state === "valido";

  const canva = validateCanvaPublicLink(cardData?.canva_public_url);
  const okCanva = canva.ok;

  const okHtml = htmlFiles.length > 0;

  const destinatariosSalvos: string[] = destRow?.payload?.destinatarios ?? [];
  const okDestinatarios = destinatariosSalvos.length > 0;

  const okEmail = Boolean(emailRow);

  const okTudo = okCodigo && okCanva && okHtml && okDestinatarios && okEmail;

  const sugeridos = useMemo(() => {
    const base = [cardData?.email ?? "", ...DESTINATARIOS_OBRIGATORIOS]
      .map((e) => e.trim().toLowerCase())
      .filter((e) => EMAIL_RE.test(e) && !TECNICOS.some((re) => re.test(e)));
    return Array.from(new Set(base));
  }, [cardData?.email]);

  // ------------------------------------------------------------------- ações
  const uploadHtml = async (file: File) => {
    if (!/\.html?$/i.test(file.name)) {
      toast.error("Envie um arquivo .html com o material personalizado.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("O arquivo passa de 10 MB. Reduza o conteúdo e tente de novo.");
      return;
    }
    setUploading(true);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${cardId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(CARD_ATTACHMENTS_BUCKET)
      .upload(path, file, { contentType: file.type || "text/html", upsert: false });
    if (upErr) {
      setUploading(false);
      toast.error("Não foi possível guardar o arquivo. Tente novamente.");
      return;
    }
    const auth = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("representative_card_attachments").insert({
      representative_card_id: cardId,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type || "text/html",
      size_bytes: file.size,
      created_by: auth.data.user?.id ?? null,
    });
    setUploading(false);
    if (error) {
      await supabase.storage.from(CARD_ATTACHMENTS_BUCKET).remove([path]);
      toast.error("O arquivo não pôde ser vinculado ao card.");
      return;
    }
    toast.success("HTML anexado ao card.");
    void load();
  };

  const removeHtml = async (file: HtmlFile) => {
    const { error } = await (supabase as any).from("representative_card_attachments").delete().eq("id", file.id);
    if (error) {
      toast.error("Não foi possível remover o arquivo.");
      return;
    }
    await supabase.storage.from(CARD_ATTACHMENTS_BUCKET).remove([file.storage_path]);
    toast.success("Arquivo removido. O histórico anterior continua no card.");
    void load();
  };

  const abrirHtml = async (file: HtmlFile) => {
    try {
      const url = await getCardAttachmentUrl(file as any);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Não foi possível abrir o arquivo agora.");
    }
  };

  const registrarStep = async (step: string, payload: Record<string, unknown>) => {
    const auth = await supabase.auth.getUser();
    const body = {
      card_id: cardId,
      step,
      status: "sucesso",
      attempt: 1,
      payload: {
        ...payload,
        origem: "conferencia_manual",
        confirmado_por: auth.data.user?.id ?? null,
        confirmado_por_email: auth.data.user?.email ?? null,
        confirmado_em: new Date().toISOString(),
      },
      finished_at: new Date().toISOString(),
    };
    const existing = rows.find((r) => r.step === step);
    if (existing) {
      return await (supabase as any)
        .from("cross_onboarding_steps")
        .update(body)
        .eq("card_id", cardId)
        .eq("step", step);
    }
    return await (supabase as any).from("cross_onboarding_steps").insert(body);
  };

  const confirmarDestinatarios = async () => {
    const informados = extras
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const invalido = informados.find((e) => !EMAIL_RE.test(e));
    if (invalido) {
      toast.error(`O endereço "${invalido}" não parece válido. Confira antes de salvar.`);
      return;
    }
    const tecnico = [...sugeridos, ...informados].find((e) => TECNICOS.some((re) => re.test(e)));
    if (tecnico) {
      toast.error(`O endereço ${tecnico} é técnico e não pode entrar na lista.`);
      return;
    }
    const lista = Array.from(new Set([...sugeridos, ...informados]));
    if (!lista.length) {
      toast.error("Inclua ao menos um destinatário antes de confirmar.");
      return;
    }
    const faltando = DESTINATARIOS_OBRIGATORIOS.filter((e) => !lista.includes(e));
    if (faltando.length) {
      toast.error(`Ainda faltam os destinatários obrigatórios: ${faltando.join(", ")}.`);
      return;
    }
    setSavingDest(true);
    const { error } = await registrarStep(STEP_DESTINATARIOS, { destinatarios: lista, email_do_card: cardData?.email ?? null });
    setSavingDest(false);
    if (error) {
      toast.error("Não foi possível salvar a lista de destinatários.");
      return;
    }
    setExtras("");
    toast.success("Destinatários confirmados.");
    void load();
  };

  const confirmarEnvio = async () => {
    if (!okDestinatarios) {
      toast.error("Confirme antes a lista de destinatários deste onboarding.");
      return;
    }
    if (!dataEnvio) {
      toast.error("Informe a data em que o e-mail foi enviado.");
      return;
    }
    if (!remetente.trim() || !EMAIL_RE.test(remetente.trim())) {
      toast.error("Informe o e-mail de quem enviou a mensagem.");
      return;
    }
    setSavingEmail(true);
    const { error } = await registrarStep(STEP_EMAIL, {
      data_envio: dataEnvio,
      remetente: remetente.trim().toLowerCase(),
      destinatarios: destinatariosSalvos,
      thread_id: threadId.trim() || null,
      message_id: messageId.trim() || null,
      observacao: observacao.trim() || null,
    });
    setSavingEmail(false);
    if (error) {
      toast.error("Não foi possível registrar a evidência do envio.");
      return;
    }
    toast.success("Envio confirmado com a evidência registrada.");
    void load();
  };

  const moverCard = async () => {
    if (!stageDestino) {
      toast.error("A etapa Recebimento Dados não foi encontrada neste painel.");
      return;
    }
    setMoving(true);
    const { error } = await supabase
      .from("representative_cards")
      .update({ stage_id: stageDestino.value })
      .eq("id", cardId);
    setMoving(false);
    setMoveOpen(false);
    if (error) {
      toast.error("O card não pôde ser movido agora.");
      return;
    }
    toast.success("Card movido para Recebimento Dados.");
    onCardMoved?.(stageDestino.value);
    void load();
  };

  // ------------------------------------------------------------------ render
  const badge = (ok: boolean) =>
    ok ? (
      <Badge className="bg-emerald-600/15 text-emerald-500"><CheckCircle2 className="mr-1 h-3 w-3" />Realizado</Badge>
    ) : (
      <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Aguardando</Badge>
    );

  const item = (titulo: string, ok: boolean, detalhe?: string, extra?: React.ReactNode) => (
    <li className="rounded-md border border-border/60 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{titulo}</p>
          {detalhe && <p className="mt-0.5 text-xs text-muted-foreground break-words">{detalhe}</p>}
        </div>
        {badge(ok)}
      </div>
      {extra && <div className="mt-3">{extra}</div>}
    </li>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Conferência do onboarding</CardTitle>
          <CardDescription>
            Checklist manual do card. Nada é enviado, criado ou movido sozinho — cada item é conferido e confirmado
            por você.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
          Atualizar
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {item(
            "1. Código Monnera validado",
            okCodigo,
            okCodigo
              ? `Código ${codigo.code} confirmado no card.`
              : "Ainda falta o código Monnera para concluir esta conferência.",
          )}

          {item(
            "2. Material Canva validado",
            okCanva,
            okCanva
              ? cardData?.canva_public_url ?? undefined
              : `${canva.reason ?? "Link público pendente."} Use o campo “Material Canva — link público” acima.`,
          )}

          {item(
            "3. HTML personalizado anexado",
            okHtml,
            okHtml ? undefined : "Anexe o arquivo HTML personalizado deste cliente.",
            <div className="space-y-2">
              {htmlFiles.map((f) => (
                <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 px-2 py-1.5 text-xs">
                  <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium break-all">{f.file_name}</span>
                  <span className="text-muted-foreground">
                    {formatBytes(f.size_bytes)} • {fmtDate(f.created_at)}
                    {f.created_by ? ` • ${profiles[f.created_by] ?? "usuário interno"}` : ""}
                  </span>
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void abrirHtml(f)}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                  {canRun && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => void removeHtml(f)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              {canRun && (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".html,.htm,text/html"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadHtml(file);
                    }}
                  />
                  <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                    {htmlFiles.length ? "Substituir HTML" : "Anexar HTML"}
                  </Button>
                </>
              )}
            </div>,
          )}

          {item(
            "4. Destinatários definidos",
            okDestinatarios,
            okDestinatarios
              ? `${destinatariosSalvos.join(", ")} — confirmado em ${fmtDate(destRow?.payload?.confirmado_em)}.`
              : "Confira a lista e confirme quem deve receber o onboarding.",
            canRun && !okDestinatarios ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Serão incluídos: {sugeridos.join(", ") || "nenhum endereço identificado"}.
                </p>
                <div className="space-y-1">
                  <Label htmlFor={`dest-${cardId}`} className="text-xs">Outros e-mails comprovados (opcional)</Label>
                  <Input
                    id={`dest-${cardId}`}
                    placeholder="nome@empresa.com.br, outro@empresa.com.br"
                    value={extras}
                    onChange={(e) => setExtras(e.target.value)}
                  />
                </div>
                <Button size="sm" onClick={() => void confirmarDestinatarios()} disabled={savingDest}>
                  {savingDest && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar destinatários
                </Button>
              </div>
            ) : undefined,
          )}

          {item(
            "5. E-mail de onboarding enviado",
            okEmail,
            okEmail
              ? `Enviado em ${emailRow?.payload?.data_envio ?? "—"} por ${emailRow?.payload?.remetente ?? "—"}${
                  emailRow?.payload?.message_id ? ` • message_id: ${emailRow.payload.message_id}` : ""
                }`
              : "Registre a evidência do envio depois de mandar o e-mail pela sua conta.",
            canRun && !okEmail ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Data do envio</Label>
                  <Input type="date" value={dataEnvio} onChange={(e) => setDataEnvio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Remetente</Label>
                  <Input value={remetente} onChange={(e) => setRemetente(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">thread_id (opcional)</Label>
                  <Input value={threadId} onChange={(e) => setThreadId(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">message_id (opcional)</Label>
                  <Input value={messageId} onChange={(e) => setMessageId(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Observação (opcional)</Label>
                  <Textarea rows={2} maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Button size="sm" onClick={() => void confirmarEnvio()} disabled={savingEmail}>
                    {savingEmail && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar envio
                  </Button>
                </div>
              </div>
            ) : undefined,
          )}

          {item(
            "6. Liberado para mover para Recebimento Dados",
            okTudo,
            okTudo
              ? "Todas as conferências concluídas. A movimentação continua sendo feita por você."
              : "Este card ainda possui conferências pendentes. Conclua os itens indicados antes de movê-lo para Recebimento Dados.",
            canRun ? (
              <Button size="sm" disabled={!okTudo || !stageDestino} onClick={() => setMoveOpen(true)}>
                Mover para Recebimento Dados
              </Button>
            ) : undefined,
          )}
        </ul>

        {!okTudo && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Enquanto houver item aguardando, o card segue nesta etapa. Nada é enviado ou movido automaticamente.
          </p>
        )}
      </CardContent>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mover para Recebimento Dados</DialogTitle>
            <DialogDescription>
              O card sai de {cardData?.stage_id === stageDestino?.value ? "Recebimento Dados" : "Material Onboarding Cliente"} e
              vai para Recebimento Dados. A mudança fica registrada no histórico com seu usuário. Nenhum e-mail, tarefa
              ou material é criado nesta ação.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={moving}>Cancelar</Button>
            <Button onClick={() => void moverCard()} disabled={moving}>
              {moving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar movimentação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
