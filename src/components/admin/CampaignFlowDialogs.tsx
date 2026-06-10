import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface CampaignMoveDialogProps {
  open: boolean;
  leadName: string;
  onConfirm: (briefing: string) => Promise<void> | void;
  onCancel: () => void;
}

export const CampaignMoveDialog = ({ open, leadName, onConfirm, onCancel }: CampaignMoveDialogProps) => {
  const [briefing, setBriefing] = useState("");
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (briefing.trim().length < 10) return;
    setBusy(true);
    try {
      await onConfirm(briefing.trim());
      setBriefing("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { onCancel(); setBriefing(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar para Criação de Campanhas</DialogTitle>
          <DialogDescription>
            {leadName}: descreva o briefing da campanha. Esta ação cria um card vinculado no Painel Criação Campanhas
            e uma tarefa com prazo de 48 horas úteis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="briefing">Briefing (mínimo 10 caracteres)</Label>
          <Textarea
            id="briefing"
            value={briefing}
            onChange={(e) => setBriefing(e.target.value.slice(0, 1500))}
            rows={6}
            placeholder="Objetivo, público-alvo, peças, prazos, observações..."
          />
          <p className="text-xs text-muted-foreground">{briefing.length}/1500</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onCancel(); setBriefing(""); }} disabled={busy}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={busy || briefing.trim().length < 10}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface CampanhaConcluidaDialogProps {
  open: boolean;
  leadName: string;
  onConfirm: (url: string, comment: string) => Promise<void> | void;
  onCancel: () => void;
}

export const CampanhaConcluidaDialog = ({ open, leadName, onConfirm, onCancel }: CampanhaConcluidaDialogProps) => {
  const [url, setUrl] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const isValidUrl = (() => {
    try { new URL(url); return true; } catch { return false; }
  })();

  const canSubmit = isValidUrl && comment.trim().length >= 5;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onConfirm(url.trim(), comment.trim());
      setUrl("");
      setComment("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) { onCancel(); setUrl(""); setComment(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir campanha</DialogTitle>
          <DialogDescription>
            {leadName}: para mover para Concluída, informe a URL da campanha publicada e um comentário descrevendo
            o resultado.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="campaign-url">URL da campanha</Label>
            <input
              id="campaign-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            {url && !isValidUrl && (
              <p className="text-xs text-destructive">URL inválida</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="campaign-comment">Comentário de fechamento</Label>
            <Textarea
              id="campaign-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="Resultados, observações, próximos passos..."
            />
            <p className="text-xs text-muted-foreground">{comment.length}/500</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onCancel(); setUrl(""); setComment(""); }} disabled={busy}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={busy || !canSubmit}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirmar conclusão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
