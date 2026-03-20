import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CadastroFinanceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  parceiroId: string;
  parceiros: { id: string; nome: string }[];
  onSaved: (data: { valor_mensalidade: number; percentual_consultor: number; qtd_parcelas: number }) => void;
  onCancel: () => void;
}

export const CadastroFinanceiroDialog = ({
  open, onOpenChange, leadId, leadName, parceiroId, parceiros, onSaved, onCancel,
}: CadastroFinanceiroDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [tipoComissao, setTipoComissao] = useState<"percentual" | "fixo">("percentual");
  const [form, setForm] = useState({
    consultor_id: parceiroId,
    valor_mensalidade: "",
    percentual_comissao: "",
    valor_comissao_fixo: "",
    qtd_parcelas: "",
  });

  useEffect(() => {
    setForm((f) => ({ ...f, consultor_id: parceiroId }));
  }, [parceiroId]);

  const comissaoMensal = tipoComissao === "percentual"
    ? (parseFloat(form.valor_mensalidade) || 0) * (parseFloat(form.percentual_comissao) || 0) / 100
    : parseFloat(form.valor_comissao_fixo) || 0;

  const valorTotal = comissaoMensal * (parseInt(form.qtd_parcelas) || 0);

  const percentualEfetivo = tipoComissao === "percentual"
    ? (parseFloat(form.percentual_comissao) || 0) / 100
    : (parseFloat(form.valor_mensalidade) || 0) > 0
      ? (parseFloat(form.valor_comissao_fixo) || 0) / (parseFloat(form.valor_mensalidade) || 1)
      : 0;

  const handleSave = async () => {
    const mensalidade = parseFloat(form.valor_mensalidade);
    const parcelas = parseInt(form.qtd_parcelas);

    if (!mensalidade || mensalidade <= 0) {
      toast.error("Informe o valor da mensalidade");
      return;
    }
    if (!parcelas || parcelas <= 0) {
      toast.error("Informe a quantidade de parcelas");
      return;
    }
    if (tipoComissao === "percentual" && (!form.percentual_comissao || parseFloat(form.percentual_comissao) <= 0)) {
      toast.error("Informe o percentual de comissão");
      return;
    }
    if (tipoComissao === "fixo" && (!form.valor_comissao_fixo || parseFloat(form.valor_comissao_fixo) <= 0)) {
      toast.error("Informe o valor da comissão");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          valor_mensalidade: mensalidade,
          percentual_consultor: percentualEfetivo,
          qtd_parcelas: parcelas,
          parcelas_pagas: 0,
        } as any)
        .eq("id", leadId);

      if (error) throw error;

      onSaved({
        valor_mensalidade: mensalidade,
        percentual_consultor: percentualEfetivo,
        qtd_parcelas: parcelas,
      });
      onOpenChange(false);
      toast.success("Cadastro financeiro salvo!");
    } catch {
      toast.error("Erro ao salvar cadastro financeiro");
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Cadastro Financeiro do Contrato</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Lead: <strong>{leadName}</strong></p>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Consultor responsável</Label>
            <Select value={form.consultor_id} onValueChange={(v) => setForm({ ...form, consultor_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {parceiros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Valor da mensalidade do cliente (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.valor_mensalidade}
              onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value })}
              placeholder="1000.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de comissão</Label>
            <Select value={tipoComissao} onValueChange={(v) => setTipoComissao(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual</SelectItem>
                <SelectItem value="fixo">Valor fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoComissao === "percentual" ? (
            <div className="space-y-1.5">
              <Label>Percentual de comissão (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.percentual_comissao}
                onChange={(e) => setForm({ ...form, percentual_comissao: e.target.value })}
                placeholder="10"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Valor da comissão (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.valor_comissao_fixo}
                onChange={(e) => setForm({ ...form, valor_comissao_fixo: e.target.value })}
                placeholder="300.00"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Quantidade de parcelas</Label>
            <Input
              type="number"
              min="1"
              value={form.qtd_parcelas}
              onChange={(e) => setForm({ ...form, qtd_parcelas: e.target.value })}
              placeholder="12"
            />
          </div>

          {/* Preview */}
          {comissaoMensal > 0 && (
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Comissão mensal:</span>
                <span className="font-medium">{fmt(comissaoMensal)}</span>
              </div>
              {valorTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total do contrato:</span>
                  <span className="font-bold">{fmt(valorTotal)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
