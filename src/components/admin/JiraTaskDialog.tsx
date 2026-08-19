import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

interface Preview {
  card: { id: string; nome: string | null; cnpj: string | null; etapa: string | null };
  jira: { project: string; issue_type: string; assignee: string | null; summary: string; description: string };
  blockers: string[];
  duplicate: { id: string; full_name: string | null; jira_issue_key: string | null } | null;
}

interface SyncPreview {
  issue_key: string;
  codigo: string | null;
  origem?: string;
  evidencia?: string;
  codigo_atual?: string | null;
  bloqueio?: string | null;
}

interface Props {
  cardId: string;
  jiraIssueKey?: string | null;
  jiraStatus?: string | null;
  canEdit: boolean;
  onCreated?: (issueKey: string) => void;
  onCodeApplied?: (codigo: string) => void;
}

type FnErrorInfo = { status: number | null; message: string; body: any };

async function readFunctionError(fnError: any): Promise<FnErrorInfo> {
  const response = (fnError as any)?.context;
  let body: any = null;
  let status: number | null = null;
  try {
    if (response && typeof response.json === "function") {
      status = typeof response.status === "number" ? response.status : null;
      body = await response.clone().json();
    }
  } catch {
    body = null;
  }
  const kindLabel: Record<string, string> = {
    autenticacao: "Erro de autenticação",
    permissao: "Erro de permissão",
    payload: "Erro de dados enviados",
    pre_requisito: "Pré-requisito não atendido",
    duplicidade: "Duplicidade",
    servidor_jira: "Erro no Jira",
  };
  const parts: string[] = [];
  if (status) parts.push(`HTTP ${status}`);
  if (body?.error_kind && kindLabel[body.error_kind]) parts.push(kindLabel[body.error_kind]);
  const detail = body?.error ?? fnError?.message ?? "Falha desconhecida.";
  const jiraPart = body?.jira_status ? ` (Jira ${body.jira_status}${body.jira_message ? `: ${body.jira_message}` : ""})` : "";
  const message = `${parts.length ? `${parts.join(" · ")} — ` : ""}${detail}${jiraPart}`;
  return { status, message, body };
}

export default function JiraTaskDialog({ cardId, jiraIssueKey, jiraStatus, canEdit, onCreated, onCodeApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const openSync = async () => {
    setSyncOpen(true);
    setSyncPreview(null);
    setSyncError(null);
    setSyncLoading(true);
    const { data, error: fnError } = await supabase.functions.invoke("jira-sync-card-code", {
      body: { card_id: cardId, confirm: false },
    });
    setSyncLoading(false);
    if (fnError) {
      const info = await readFunctionError(fnError);
      setSyncPreview(info.body?.preview ?? null);
      setSyncError(info.message);
      return;
    }
    setSyncPreview((data as any)?.preview ?? null);
    if ((data as any)?.ok === false) setSyncError((data as any)?.error ?? "Não foi possível ler o código na tarefa Jira.");
  };

  const confirmSync = async () => {
    if (syncSaving) return;
    setSyncSaving(true);
    const { data, error: fnError } = await supabase.functions.invoke("jira-sync-card-code", {
      body: { card_id: cardId, confirm: true },
    });
    setSyncSaving(false);
    if (fnError) {
      const info = await readFunctionError(fnError);
      setSyncError(info.message);
      toast.error(info.message);
      return;
    }
    if ((data as any)?.ok === false) {
      toast.error((data as any)?.error ?? "Falha ao gravar o código Monnera.");
      return;
    }
    const codigo = (data as any)?.codigo as string;
    toast.success(`Código ${codigo} aplicado ao card. O card não foi movido.`);
    onCodeApplied?.(codigo);
    setSyncOpen(false);
  };


  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    const { data, error: fnError } = await supabase.functions.invoke("jira-create-panel-task", {
      body: { card_id: cardId, dry_run: true },
    });
    setLoading(false);
    if (fnError) {
      const info = await readFunctionError(fnError);
      setPreview(info.body?.preview ?? null);
      setError(info.message);
      return;
    }
    setPreview((data as any)?.preview ?? null);
    if ((data as any)?.ok === false) setError((data as any)?.error ?? "Card não liberado para criar tarefa.");
  };

  const handleOpen = async () => {
    setOpen(true);
    setJustification("");
    await loadPreview();
  };

  const handleConfirm = async () => {
    if (sending) return;
    if (!justification.trim()) {
      toast.error("Justificativa obrigatória.");
      return;
    }
    setSending(true);
    const { data, error: fnError } = await supabase.functions.invoke("jira-create-panel-task", {
      body: { card_id: cardId, confirm: true, dry_run: false, justification: justification.trim() },
    });
    setSending(false);
    if (fnError) {
      const info = await readFunctionError(fnError);
      setError(info.message);
      toast.error(info.message);
      return;
    }
    if ((data as any)?.ok === false) {
      const msg = (data as any)?.error ?? "Falha ao criar a tarefa no Jira.";
      setError(msg);
      toast.error(msg);
      return;
    }
    const issueKey = (data as any)?.issue_key as string;
    toast.success(`Tarefa ${issueKey} criada no Jira.`);
    onCreated?.(issueKey);
    setOpen(false);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tarefa Jira — Criação do painel</CardTitle>
        <CardDescription>
          Criada apenas na etapa Criação Painel, com nome e CNPJ confirmados e responsável configurado. Sem duplicidade.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {jiraIssueKey ? (
            <>
              <Badge variant="secondary">{jiraIssueKey}</Badge>
              <span className="text-muted-foreground">{jiraStatus ?? "—"}</span>
              <Button variant="ghost" size="sm" asChild>
                <a href={`https://monnera.atlassian.net/browse/${jiraIssueKey}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Jira
                </a>
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">Nenhuma tarefa vinculada a este card.</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpen} disabled={!canEdit || !!jiraIssueKey}>
            <Send className="mr-2 h-4 w-4" /> Criar tarefa Jira
          </Button>
          <Button variant="outline" onClick={openSync} disabled={!canEdit || !jiraIssueKey}>
            <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar código Jira
          </Button>
        </div>
      </CardContent>

      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Código Monnera na tarefa Jira</DialogTitle>
            <DialogDescription>
              Consulta somente a tarefa vinculada a este card. Nada é gravado até a confirmação.
            </DialogDescription>
          </DialogHeader>

          {syncLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando o Jira...
            </div>
          )}

          {syncPreview && (
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p><strong>Tarefa:</strong> {syncPreview.issue_key}</p>
              <p><strong>Código encontrado:</strong> {syncPreview.codigo ?? "—"}</p>
              <p><strong>Origem:</strong> {syncPreview.origem ?? "—"}</p>
              <p><strong>Código atual do card:</strong> {syncPreview.codigo_atual ?? "—"}</p>
              {syncPreview.evidencia && (
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{syncPreview.evidencia}</pre>
              )}
              {syncPreview.bloqueio && <p className="text-destructive">{syncPreview.bloqueio}</p>}
            </div>
          )}

          {syncError && <p className="text-sm text-destructive">{syncError}</p>}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSyncOpen(false)}>Cancelar</Button>
            <Button
              onClick={confirmSync}
              disabled={syncSaving || syncLoading || !syncPreview?.codigo || !!syncPreview?.bloqueio}
            >
              {syncSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar e gravar código
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia da tarefa Jira</DialogTitle>
            <DialogDescription>Revise os dados antes de criar. Nada é enviado ao Jira nesta prévia.</DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando prévia...
            </div>
          )}

          {preview && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-border p-3 space-y-1">
                <p><strong>Cliente:</strong> {preview.card.nome ?? "—"}</p>
                <p><strong>CNPJ:</strong> {preview.card.cnpj ?? "—"}</p>
                <p><strong>Etapa:</strong> {preview.card.etapa ?? "—"}</p>
                <p><strong>Projeto/Tipo:</strong> {preview.jira.project} / {preview.jira.issue_type}</p>
                <p><strong>Responsável:</strong> {preview.jira.assignee ? "Lívia Fernandes (configurado)" : "não configurado"}</p>
              </div>
              <div className="rounded-md border border-border p-3">
                <p className="font-medium mb-1">{preview.jira.summary}</p>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground">{preview.jira.description}</pre>
              </div>
              {preview.duplicate && (
                <p className="text-destructive">
                  Já existe tarefa {preview.duplicate.jira_issue_key} para este card/CNPJ/thread.
                </p>
              )}
              {preview.blockers.length > 0 && (
                <ul className="list-disc pl-5 text-destructive">
                  {preview.blockers.map((b) => <li key={b}>{b}</li>)}
                </ul>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}

          <Textarea
            placeholder="Justificativa (obrigatória)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            maxLength={500}
          />

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleConfirm}
              disabled={sending || !preview || preview.blockers.length > 0 || !!preview.duplicate}
            >
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirmar e criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
