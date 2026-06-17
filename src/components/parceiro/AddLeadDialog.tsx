import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail } from "@/lib/validators";
import { toast } from "sonner";
import { Loader2, CheckCircle, Shield } from "lucide-react";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parceiroId: string;
  parceiroNome: string;
  onSuccess: () => void;
}

export const AddLeadDialog = ({ open, onOpenChange, parceiroId, parceiroNome, onSuccess }: AddLeadDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    nome_responsavel: "",
    telefone_responsavel: "",
    email_responsavel: "",
    nome_fantasia: "",
    quantidade_lojas: "",
    erp_utilizado: "",
    valor_campanhas: "",
    canal_tracao: "",
  });

  const resetForm = () => {
    setForm({
      nome_responsavel: "", telefone_responsavel: "", email_responsavel: "",
      nome_fantasia: "", quantidade_lojas: "", erp_utilizado: "", valor_campanhas: "", canal_tracao: "",
    });
    setErrors({});
    setSubmitted(false);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome_responsavel.trim()) errs.nome_responsavel = "Obrigatório";
    if (!form.telefone_responsavel.trim()) errs.telefone_responsavel = "Obrigatório";
    if (form.email_responsavel.trim() && !validateEmail(form.email_responsavel)) errs.email_responsavel = "Email inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("leads").insert({
        parceiro_id: parceiroId,
        nome_responsavel: form.nome_responsavel.trim(),
        telefone_responsavel: form.telefone_responsavel.trim(),
        email_responsavel: form.email_responsavel.trim() ? form.email_responsavel.trim().toLowerCase() : null,
        nome_fantasia: form.nome_fantasia.trim() || null,
        quantidade_lojas: form.quantidade_lojas ? parseInt(form.quantidade_lojas) : null,
        erp_utilizado: form.erp_utilizado.trim() || null,
        valor_campanhas: form.valor_campanhas ? parseFloat(form.valor_campanhas) : null,
        canal_tracao: form.canal_tracao.trim() || null,
        origem: "consultor_manual",
      } as any);

      if (error) throw error;
      setSubmitted(true);
      onSuccess();
    } catch (error: any) {
      console.error("Erro ao cadastrar lead:", error);
      const msg = error?.message || error?.details || "Erro desconhecido";
      toast.error(`Erro ao cadastrar lead: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const fieldClass = "space-y-1.5";

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="py-8 space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold">Lead cadastrado com sucesso!</h2>
            <p className="text-muted-foreground">O lead foi adicionado ao seu pipeline.</p>
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Adicionar Lead</DialogTitle>
          <DialogDescription>
            Embaixador Monnera: {parceiroNome}. Preencha os dados para cadastrar o lead.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={fieldClass}>
            <Label>Nome *</Label>
            <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} placeholder="Nome do responsável" />
            {errors.nome_responsavel && <p className="text-destructive text-xs">{errors.nome_responsavel}</p>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={fieldClass}>
              <Label>Telefone *</Label>
              <Input value={form.telefone_responsavel} onChange={(e) => setForm({ ...form, telefone_responsavel: e.target.value })} placeholder="(11) 99999-9999" />
              {errors.telefone_responsavel && <p className="text-destructive text-xs">{errors.telefone_responsavel}</p>}
            </div>
            <div className={fieldClass}>
              <Label>E-mail</Label>
              <Input type="email" value={form.email_responsavel} onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })} placeholder="email@exemplo.com" />
              {errors.email_responsavel && <p className="text-destructive text-xs">{errors.email_responsavel}</p>}
            </div>
          </div>
          <div className={fieldClass}>
            <Label>Nome da Empresa</Label>
            <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Nome da Empresa" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={fieldClass}>
              <Label>Número de lojas</Label>
              <Input type="number" min="1" value={form.quantidade_lojas} onChange={(e) => setForm({ ...form, quantidade_lojas: e.target.value })} placeholder="1" />
            </div>
            <div className={fieldClass}>
              <Label>Sistema de loja</Label>
              <Input value={form.erp_utilizado} onChange={(e) => setForm({ ...form, erp_utilizado: e.target.value })} placeholder="Ex: Trier, Linx" />
            </div>
          </div>
          <div className={fieldClass}>
            <Label>Valor médio pago em campanhas (R$/mês)</Label>
            <Input type="number" min="0" step="0.01" value={form.valor_campanhas} onChange={(e) => setForm({ ...form, valor_campanhas: e.target.value })} placeholder="Opcional" />
          </div>
          <div className={fieldClass}>
            <Label>Canal de tração</Label>
            <Input value={form.canal_tracao} onChange={(e) => setForm({ ...form, canal_tracao: e.target.value })} placeholder="Ex: indicação, evento, outbound" />
          </div>

          <Button type="submit" className="w-full text-base py-6" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cadastrando...</> : "Cadastrar Lead"}
          </Button>

          <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <p>O lead será associado automaticamente ao seu perfil de embaixador Monnera.</p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
