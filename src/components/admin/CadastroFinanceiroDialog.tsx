import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface CadastroFinanceiroDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  parceiroId: string;
  parceiros: { id: string; nome: string }[];
  /** Valores atuais do lead (para pré-preencher e exibir auditoria) */
  initialData?: {
    valor_setup?: number | null;
    valor_mensalidade?: number | null;
    valor_campanhas?: number | null;
    qtd_parcelas?: number | null;
    quantidade_lojas?: number | null;
    percentual_consultor?: number | null;
    comissao_vitalicia?: boolean | null;
  };
  audit?: {
    preenchido_por_nome?: string | null;
    preenchido_em?: string | null;
    editado_por_nome?: string | null;
    editado_em?: string | null;
  };
  /** Quando true, exibe checkbox para dispensar a obrigatoriedade dos campos financeiros (usado no fluxo de Proposta Comercial). */
  allowSkipValidation?: boolean;
  onSaved: (data: {
    valor_setup: number;
    valor_mensalidade: number;
    valor_campanhas: number;
    percentual_consultor: number;
    qtd_parcelas: number;
    comissao_vitalicia: boolean;
  }) => void;
  onCancel: () => void;
}

export const CadastroFinanceiroDialog = ({
  open, onOpenChange, leadId, leadName, parceiroId, parceiros, initialData, audit, allowSkipValidation, onSaved, onCancel,
}: CadastroFinanceiroDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [tipoComissao, setTipoComissao] = useState<"percentual" | "fixo">("percentual");
  const [skipValidation, setSkipValidation] = useState(false);
  const [form, setForm] = useState({
    consultor_id: parceiroId,
    valor_setup: "",
    valor_mensalidade: "",
    valor_campanhas: "",
    quantidade_lojas: "1",
    percentual_comissao: "",
    valor_comissao_fixo: "",
    qtd_parcelas: "",
    comissao_vitalicia: false,
  });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      consultor_id: parceiroId,
      valor_setup: initialData?.valor_setup ? String(initialData.valor_setup) : f.valor_setup,
      valor_mensalidade: initialData?.valor_mensalidade ? String(initialData.valor_mensalidade) : f.valor_mensalidade,
      valor_campanhas: initialData?.valor_campanhas != null ? String(initialData.valor_campanhas) : f.valor_campanhas,
      quantidade_lojas: initialData?.quantidade_lojas ? String(initialData.quantidade_lojas) : f.quantidade_lojas,
      qtd_parcelas: initialData?.qtd_parcelas ? String(initialData.qtd_parcelas) : f.qtd_parcelas,
      percentual_comissao: initialData?.percentual_consultor ? String((initialData.percentual_consultor || 0) * 100) : f.percentual_comissao,
      comissao_vitalicia: !!initialData?.comissao_vitalicia,
    }));
  }, [parceiroId, initialData, open]);

  const setup = parseFloat(form.valor_setup) || 0;
  const mensalidade = parseFloat(form.valor_mensalidade) || 0;
  const campanhas = parseFloat(form.valor_campanhas) || 0;
  const qtdLojas = parseInt(form.quantidade_lojas) || 0;
  const parcelas = parseInt(form.qtd_parcelas) || 0;

  const mensalidadeTotal = qtdLojas * mensalidade;
  const valorTotalContrato = setup + (mensalidadeTotal * (parcelas || 1)) + campanhas;

  const comissaoMensal = tipoComissao === "percentual"
    ? mensalidadeTotal * (parseFloat(form.percentual_comissao) || 0) / 100
    : parseFloat(form.valor_comissao_fixo) || 0;

  const valorComissaoTotal = form.comissao_vitalicia ? 0 : comissaoMensal * (parcelas || 0);

  const percentualEfetivo = tipoComissao === "percentual"
    ? (parseFloat(form.percentual_comissao) || 0) / 100
    : mensalidadeTotal > 0
      ? (parseFloat(form.valor_comissao_fixo) || 0) / mensalidadeTotal
      : 0;

  const handleSave = async () => {
    if (setup < 0) { toast.error("Valor de setup inválido"); return; }
    if (mensalidade < 0) { toast.error("Mensalidade inválida"); return; }
    if (qtdLojas <= 0) { toast.error("Quantidade de lojas deve ser ao menos 1"); return; }
    if (campanhas < 0) { toast.error("Receita de campanhas inválida"); return; }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("leads")
        .update({
          valor_setup: setup,
          valor_mensalidade: mensalidade,
          valor_campanhas: campanhas,
          quantidade_lojas: qtdLojas,
          percentual_consultor: percentualEfetivo,
          qtd_parcelas: form.comissao_vitalicia || parcelas <= 0 ? null : parcelas,
          parcelas_pagas: 0,
          comissao_vitalicia: form.comissao_vitalicia,
        } as any)
        .eq("id", leadId);

      if (error) throw error;

      onSaved({
        valor_setup: setup,
        valor_mensalidade: mensalidade,
        valor_campanhas: campanhas,
        percentual_consultor: percentualEfetivo,
        qtd_parcelas: form.comissao_vitalicia || parcelas <= 0 ? 0 : parcelas,
        comissao_vitalicia: form.comissao_vitalicia,
      });
      onOpenChange(false);
      toast.success("Dados financeiros salvos!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Dados financeiros do contrato</DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-amber-500/10 border border-amber-500/30 p-3 flex gap-2 text-xs">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p>Para avançar este lead você precisa preencher <strong>Setup, Mensalidade, Quantidade de lojas e Receita de campanhas</strong>. Mensalidade pode ser zero quando a negociação exigir.</p>
        </div>

        <p className="text-sm text-muted-foreground">Lead: <strong>{leadName}</strong></p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Embaixador Monnera responsável</Label>
            <Select value={form.consultor_id} onValueChange={(v) => setForm({ ...form, consultor_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {parceiros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor Setup (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.valor_setup}
                onChange={(e) => setForm({ ...form, valor_setup: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Receita de Campanhas (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.valor_campanhas}
                onChange={(e) => setForm({ ...form, valor_campanhas: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Mensalidade por loja (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.valor_mensalidade}
                onChange={(e) => setForm({ ...form, valor_mensalidade: e.target.value })} placeholder="1000.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade de lojas</Label>
              <Input type="number" min="1" value={form.quantidade_lojas}
                onChange={(e) => setForm({ ...form, quantidade_lojas: e.target.value })} placeholder="1" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo de comissão</Label>
            <Select value={tipoComissao} onValueChange={(v) => setTipoComissao(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">Percentual sobre mensalidade total</SelectItem>
                <SelectItem value="fixo">Valor fixo mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipoComissao === "percentual" ? (
            <div className="space-y-1.5">
              <Label>Percentual de comissão (%)</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.percentual_comissao}
                onChange={(e) => setForm({ ...form, percentual_comissao: e.target.value })} placeholder="10" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Valor da comissão (R$)</Label>
              <Input type="number" min="0" step="0.01" value={form.valor_comissao_fixo}
                onChange={(e) => setForm({ ...form, valor_comissao_fixo: e.target.value })} placeholder="300.00" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Quantidade de parcelas</Label>
            <Input type="number" min="1" value={form.qtd_parcelas}
              onChange={(e) => setForm({ ...form, qtd_parcelas: e.target.value })} placeholder="12" disabled={form.comissao_vitalicia} />
          </div>

          <label className="flex items-start gap-3 rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.comissao_vitalicia}
              onChange={(e) => setForm({ ...form, comissao_vitalicia: e.target.checked, qtd_parcelas: e.target.checked ? "" : form.qtd_parcelas })}
            />
            <span>
              <span className="font-medium">Comissão vitalícia</span>
              <span className="block text-xs text-muted-foreground">
                Use quando o parceiro participou da agenda ou fechou diretamente com o cliente. Quantidade de parcelas não se aplica.
              </span>
            </span>
          </label>

          {/* Preview cálculos automáticos */}
          {(mensalidade > 0 || setup > 0) && (
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Mensalidade total ({qtdLojas} loja{qtdLojas !== 1 ? "s" : ""}):</span><span className="font-medium">{fmt(mensalidadeTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Valor total do contrato:</span><span className="font-bold">{fmt(valorTotalContrato)}</span></div>
              {comissaoMensal > 0 && (
                <>
                  <div className="flex justify-between border-t border-border/50 pt-1 mt-1"><span className="text-muted-foreground">Comissão mensal:</span><span className="font-medium">{fmt(comissaoMensal)}</span></div>
                  {valorComissaoTotal > 0 && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Comissão total:</span><span className="font-bold">{fmt(valorComissaoTotal)}</span></div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Auditoria */}
          {(audit?.preenchido_em || audit?.editado_em) && (
            <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/50 pt-2">
              {audit?.preenchido_em && (
                <p>Preenchido por <strong>{audit.preenchido_por_nome || "—"}</strong> em {fmtDate(audit.preenchido_em)}</p>
              )}
              {audit?.editado_em && (
                <p>Última edição por <strong>{audit.editado_por_nome || "—"}</strong> em {fmtDate(audit.editado_em)}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar e continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
