import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock, Loader2, PlayCircle, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

/**
 * Acompanhamento do fluxo pós-código Monnera.
 * O botão executa SEMPRE em dry-run: nenhuma tarefa, card, Canva, e-mail ou
 * etapa é alterado — apenas registro de auditoria em automation_runs.
 */
const STEP_LABELS: Record<string, string> = {
  codigo_validado: "1. Código validado",
  codigo_aplicado: "2. Código aplicado ao card",
  card_movido_material: "3. Card em Material Onboarding Cliente",
  canva_pronto: "4. Material Canva (link público validado)",
  html_pronto: "5. HTML personalizado",
  email_pendente: "6. Destinatários definidos",
  email_enviado: "7. E-mail enviado (message_id)",
  card_movido: "8. Card movido para Recebimento Dados",
};

const STEP_ORDER = Object.keys(STEP_LABELS);

interface StepRow {
  step: string;
  status: string;
  attempt: number | null;
  error: string | null;
  message_id: string | null;
  updated_at: string | null;
}

interface Props {
  cardId: string;
  canRun: boolean;
}

export default function CrossOnboardingSteps({ cardId, canRun }: Props) {
  const [rows, setRows] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [resuming, setResuming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cross_onboarding_steps")
      .select("step, status, attempt, error, message_id, updated_at")
      .eq("card_id", cardId);
    setRows((data as StepRow[]) ?? []);
    setLoading(false);
  }, [cardId]);

  useEffect(() => { void load(); }, [load]);

  const runDryRun = async () => {
    setRunning(true);
    setPreview(null);
    const { data, error } = await supabase.functions.invoke("cross-onboarding-advance", {
      body: { card_id: cardId, dry_run: true },
    });
    setRunning(false);
    if (error) {
      toast.error("Não foi possível simular o fluxo. Verifique os gates e tente novamente.");
      return;
    }
    setPreview(data as Record<string, unknown>);
    toast.success("Simulação concluída — nada foi alterado.");
    void load();
  };

  const runReal = async () => {
    setExecuting(true);
    setPreview(null);
    const { data, error } = await supabase.functions.invoke("cross-onboarding-advance", {
      body: { card_id: cardId, dry_run: false, origin: "manual_move" },
    });
    setExecuting(false);
    setConfirmOpen(false);
    if (error) {
      toast.error("A execução não pôde ser concluída. Verifique a pendência registrada no card.");
      void load();
      return;
    }
    setPreview(data as Record<string, unknown>);
    const stopped = (data as { stopped_at?: { step?: string; reason?: string } | null })?.stopped_at;
    if (stopped?.step) toast.warning(`Fluxo parou em ${STEP_LABELS[stopped.step] ?? stopped.step}.`);
    else toast.success("Fluxo avançado até onde as regras permitem.");
    void load();
  };


  // Etapa em falha corrigível: base do botão "Retomar automação".
  const failedRow = rows.find((r) => ["erro", "bloqueado", "pendencia_manual"].includes(r.status));

  const resume = async () => {
    if (!justificativa.trim()) {
      toast.error("Informe a justificativa da retomada.");
      return;
    }
    setResuming(true);
    const { data: resumeData, error: resumeError } = await supabase.rpc(
      "cross_onboarding_resume" as never,
      { p_card_id: cardId, p_justificativa: justificativa.trim() } as never,
    );
    if (resumeError) {
      setResuming(false);
      toast.error(resumeError.message);
      return;
    }
    const resumeFrom = (resumeData as { resume_from?: string } | null)?.resume_from ?? failedRow?.step;
    const { data, error } = await supabase.functions.invoke("cross-onboarding-advance", {
      body: { card_id: cardId, dry_run: false, origin: "resume", resume_from: resumeFrom },
    });
    setResuming(false);
    if (error) {
      toast.error("A retomada não pôde ser concluída. Verifique a pendência registrada no card.");
      void load();
      return;
    }
    setPreview(data as Record<string, unknown>);
    setResumeOpen(false);
    setJustificativa("");
    toast.success(`Automação retomada na etapa ${STEP_LABELS[resumeFrom ?? ""] ?? resumeFrom}.`);
    void load();
  };

  const statusOf = (step: string) => rows.find((r) => r.step === step);

  const badgeFor = (status?: string) => {
    if (status === "sucesso") return <Badge className="bg-emerald-600/15 text-emerald-400"><CheckCircle2 className="mr-1 h-3 w-3" />Concluído</Badge>;
    if (status === "pendencia_manual") return <Badge className="bg-amber-500/15 text-amber-400"><AlertTriangle className="mr-1 h-3 w-3" />Pendência manual</Badge>;
    if (status === "bloqueado" || status === "erro") return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Bloqueado</Badge>;
    return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />Aguardando</Badge>;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Fluxo de onboarding Cross</CardTitle>
          <CardDescription>
            Simulação somente leitura: nenhuma tarefa, material, e-mail ou etapa é alterado.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className="mr-1 h-4 w-4" />Atualizar
          </Button>
          {canRun && failedRow && (
            <Button variant="destructive" size="sm" onClick={() => setResumeOpen(true)}>
              <RotateCcw className="mr-1 h-4 w-4" />Retomar automação
            </Button>
          )}
          {canRun && (
            <Button size="sm" onClick={() => void runDryRun()} disabled={running}>
              {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-1 h-4 w-4" />}
              Simular avanço
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {STEP_ORDER.map((step) => {
            const row = statusOf(step);
            return (
              <li key={step} className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{STEP_LABELS[step]}</p>
                  {row?.error && <p className="mt-0.5 text-xs text-muted-foreground break-words">{row.error}</p>}
                  {row?.message_id && <p className="mt-0.5 text-xs text-muted-foreground">message_id: {row.message_id}</p>}
                </div>
                {badgeFor(row?.status)}
              </li>
            );
          })}
        </ul>

        {preview && (
          <div className="rounded-md border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-medium">Resultado da simulação</p>
            <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap text-[11px] text-muted-foreground">
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>

      <Dialog open={resumeOpen} onOpenChange={setResumeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retomar automação</DialogTitle>
            <DialogDescription>
              A retomada reinicia somente a etapa que falhou
              {failedRow ? `: ${STEP_LABELS[failedRow.step] ?? failedRow.step}` : ""}. Nenhuma etapa já concluída é refeita.
            </DialogDescription>
          </DialogHeader>
          {failedRow?.error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {failedRow.error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="resume-justificativa">Justificativa (obrigatória)</Label>
            <Textarea
              id="resume-justificativa"
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="O que foi corrigido antes da retomada?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResumeOpen(false)} disabled={resuming}>Cancelar</Button>
            <Button onClick={() => void resume()} disabled={resuming}>
              {resuming && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Retomar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
