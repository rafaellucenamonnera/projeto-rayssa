import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface Preview {
  card: { id: string; nome: string | null; cnpj: string | null; etapa: string | null };
  jira: { project: string; issue_type: string; assignee: string | null; summary: string; description: string };
  blockers: string[];
  duplicate: { id: string; full_name: string | null; jira_issue_key: string | null } | null;
}

interface Props {
  cardId: string;
  jiraIssueKey?: string | null;
  jiraStatus?: string | null;
  canEdit: boolean;
  onCreated?: (issueKey: string) => void;
}

export default function JiraTaskDialog({ cardId, jiraIssueKey, jiraStatus, canEdit, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justification, setJustification] = useState("");

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    const { data, error: fnError } = await supabase.functions.invoke("jira-create-panel-task", {
      body: { card_id: cardId, dry_run: true },
    });
    setLoading(false);
    if (fnError) {
      setError(fnError.message);
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
    if (fnError || (data as any)?.ok === false) {
      toast.error((data as any)?.error ?? fnError?.message ?? "Falha ao criar a tarefa no Jira.");
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
        <Button onClick={handleOpen} disabled={!canEdit || !!jiraIssueKey}>
          <Send className="mr-2 h-4 w-4" /> Criar tarefa Jira
        </Button>
      </CardContent>

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

          {error && !preview && <p className="text-sm text-destructive">{error}</p>}

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
