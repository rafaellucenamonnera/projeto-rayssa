import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { validateLostReason } from "@/lib/commercialPanel";

interface LeadPerdidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  onConfirm: (motivo: string) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
}

export const LeadPerdidoDialog = ({ open, onOpenChange, leadName, onConfirm, onCancel }: LeadPerdidoDialogProps) => {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const motivosSugeridos = ["Número inválido", "Nunca respondeu", "Parou de responder", "Não é prioridade no momento"];

  const handleConfirm = async () => {
    const validationError = validateLostReason(motivo);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    try {
      const saved = await onConfirm(motivo.trim());
      if (saved === false) return;
      setMotivo("");
      setError("");
    } catch {
      setError("Não foi possível registrar a perda. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (saving) return;
    setMotivo("");
    setError("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (saving) return; if (!v) handleCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Informe o motivo da perda do card</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Card: <strong>{leadName}</strong></p>
        <div className="space-y-1.5">
          <Label htmlFor="motivo-perda">Motivo da perda *</Label>
          <Select disabled={saving} value={motivo} onValueChange={(value) => { setMotivo(value); setError(""); }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um motivo sugerido" />
            </SelectTrigger>
            <SelectContent>
              {motivosSugeridos.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            id="motivo-perda"
            disabled={saving}
            value={motivo}
            onChange={(e) => { setMotivo(e.target.value.slice(0, 200)); setError(""); }}
            maxLength={200}
            rows={3}
            placeholder="Descreva o motivo..."
          />
          <p className="text-xs text-muted-foreground text-right">{motivo.length}/200</p>
          {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
