import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeadPerdidoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  onConfirm: (motivo: string) => void;
  onCancel: () => void;
}

export const LeadPerdidoDialog = ({ open, onOpenChange, leadName, onConfirm, onCancel }: LeadPerdidoDialogProps) => {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const motivosSugeridos = ["Número inválido", "Nunca respondeu", "Parou de responder", "Não é prioridade no momento"];

  const handleConfirm = () => {
    if (!motivo.trim()) {
      setError("É obrigatório informar o motivo da perda do lead.");
      return;
    }
    onConfirm(motivo.trim());
    setMotivo("");
    setError("");
  };

  const handleCancel = () => {
    setMotivo("");
    setError("");
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Informe o motivo da perda do lead</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Lead: <strong>{leadName}</strong></p>
        <div className="space-y-1.5">
          <Label>Motivo da perda *</Label>
          <Select value={motivo} onValueChange={(value) => { setMotivo(value); setError(""); }}>
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
          <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
