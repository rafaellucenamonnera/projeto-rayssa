import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AgendarReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AgendarReuniaoDialog = ({ open, onOpenChange, leadId, leadName, onConfirm, onCancel }: AgendarReuniaoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    data_reuniao: "",
    horario_reuniao: "",
    tipo_reuniao: "online",
    link_reuniao: "",
    observacao: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleConfirm = async () => {
    setErrors({});
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("reunioes").insert({
        lead_id: leadId,
        data_reuniao: form.data_reuniao || null,
        horario_reuniao: form.horario_reuniao || null,
        tipo_reuniao: form.tipo_reuniao,
        link_reuniao: form.link_reuniao || null,
        observacao: form.observacao || null,
        created_by: user.id,
      } as any);

      if (error) throw error;
      toast.success("Reunião agendada com sucesso!");
      resetForm();
      onConfirm();
    } catch (err: any) {
      toast.error("Erro ao agendar reunião: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ data_reuniao: "", horario_reuniao: "", tipo_reuniao: "online", link_reuniao: "", observacao: "" });
    setErrors({});
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Agendar Reunião</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Lead: <strong>{leadName}</strong></p>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data da reunião *</Label>
              <Input type="date" value={form.data_reuniao} onChange={(e) => setForm({ ...form, data_reuniao: e.target.value })} />
              {errors.data_reuniao && <p className="text-destructive text-xs">{errors.data_reuniao}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Horário *</Label>
              <Input type="time" value={form.horario_reuniao} onChange={(e) => setForm({ ...form, horario_reuniao: e.target.value })} />
              {errors.horario_reuniao && <p className="text-destructive text-xs">{errors.horario_reuniao}</p>}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de reunião</Label>
            <Select value={form.tipo_reuniao} onValueChange={(v) => setForm({ ...form, tipo_reuniao: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Link da reunião</Label>
            <Input value={form.link_reuniao} onChange={(e) => setForm({ ...form, link_reuniao: e.target.value })} placeholder="https://meet.google.com/..." />
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value.slice(0, 500) })} rows={2} maxLength={500} placeholder="Observações sobre a reunião..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
