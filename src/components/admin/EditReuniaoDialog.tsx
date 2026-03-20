import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Reuniao {
  id: string;
  data_reuniao: string;
  horario_reuniao: string;
  tipo_reuniao: string;
  link_reuniao: string | null;
  observacao: string | null;
}

interface EditReuniaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reuniao: Reuniao | null;
  onSaved: () => void;
}

export const EditReuniaoDialog = ({ open, onOpenChange, reuniao, onSaved }: EditReuniaoDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    data_reuniao: "",
    horario_reuniao: "",
    tipo_reuniao: "online",
    link_reuniao: "",
    observacao: "",
  });

  useEffect(() => {
    if (reuniao) {
      setForm({
        data_reuniao: reuniao.data_reuniao,
        horario_reuniao: reuniao.horario_reuniao?.slice(0, 5) || "",
        tipo_reuniao: reuniao.tipo_reuniao,
        link_reuniao: reuniao.link_reuniao || "",
        observacao: reuniao.observacao || "",
      });
    }
  }, [reuniao]);

  const handleSave = async () => {
    if (!reuniao || !form.data_reuniao || !form.horario_reuniao) {
      toast.error("Data e horário são obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("reunioes")
        .update({
          data_reuniao: form.data_reuniao,
          horario_reuniao: form.horario_reuniao,
          tipo_reuniao: form.tipo_reuniao,
          link_reuniao: form.link_reuniao || null,
          observacao: form.observacao || null,
        } as any)
        .eq("id", reuniao.id);
      if (error) throw error;
      toast.success("Reunião atualizada!");
      onSaved();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao atualizar reunião");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Editar Reunião</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={form.data_reuniao} onChange={(e) => setForm({ ...form, data_reuniao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Horário *</Label>
              <Input type="time" value={form.horario_reuniao} onChange={(e) => setForm({ ...form, horario_reuniao: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo de reunião</Label>
            <Select value={form.tipo_reuniao} onValueChange={(v) => setForm({ ...form, tipo_reuniao: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Textarea value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value.slice(0, 500) })} rows={2} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
