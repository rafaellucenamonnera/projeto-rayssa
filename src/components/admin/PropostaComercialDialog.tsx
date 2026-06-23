import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Copy, FileText } from "lucide-react";

interface PropostaComercialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
  onSuccess: (publicUrl: string, proposalName: string) => void;
  onCancel: () => void;
}

interface EscopoItem {
  titulo: string;
  descricao: string;
}

function defaultProposalName(lead: any): string {
  const nome = lead?.nome_fantasia || lead?.razao_social || "Cliente";
  const data = new Date().toLocaleDateString("pt-BR");
  return `Proposta Monnera - ${nome} - ${data}`;
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function PropostaComercialDialog({
  open,
  onOpenChange,
  lead,
  onSuccess,
  onCancel,
}: PropostaComercialDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  // Identificação
  const [proposalName, setProposalName] = useState("");
  const [cliente, setCliente] = useState("");
  const [contatoNome, setContatoNome] = useState("");
  const [contatoEmail, setContatoEmail] = useState("");
  const [contatoTelefone, setContatoTelefone] = useState("");

  // Escopo
  const [objetivo, setObjetivo] = useState("");
  const [escopoItens, setEscopoItens] = useState<EscopoItem[]>([
    { titulo: "", descricao: "" },
  ]);

  // Comercial
  const [omitFinancials, setOmitFinancials] = useState(false);
  const [omitReason, setOmitReason] = useState("");
  const [valorSetup, setValorSetup] = useState<string>("");
  const [valorMensalidade, setValorMensalidade] = useState<string>("");
  const [valorCampanhas, setValorCampanhas] = useState<string>("");
  const [qtdParcelas, setQtdParcelas] = useState<string>("");

  // Prazos
  const [prazoImplantacao, setPrazoImplantacao] = useState("");
  const [validadeProposta, setValidadeProposta] = useState("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!open || !lead) return;
    setProposalName(defaultProposalName(lead));
    setCliente(lead.nome_fantasia || lead.razao_social || "");
    setContatoNome(lead.nome_responsavel || "");
    setContatoEmail(lead.email_responsavel || "");
    setContatoTelefone(lead.telefone_responsavel || "");
    setObjetivo("");
    setEscopoItens([{ titulo: "", descricao: "" }]);
    setOmitFinancials(false);
    setOmitReason("");
    setValorSetup(lead.valor_setup != null ? String(lead.valor_setup) : "");
    setValorMensalidade(
      lead.valor_mensalidade != null ? String(lead.valor_mensalidade) : "",
    );
    setValorCampanhas(
      lead.valor_campanhas != null ? String(lead.valor_campanhas) : "",
    );
    setQtdParcelas(lead.qtd_parcelas != null ? String(lead.qtd_parcelas) : "");
    setPrazoImplantacao("");
    setValidadeProposta("");
    setCondicoesPagamento("");
    setObservacoes("");
  }, [open, lead]);

  function updateEscopoItem(idx: number, patch: Partial<EscopoItem>) {
    setEscopoItens((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  }

  function addEscopoItem() {
    setEscopoItens((prev) => [...prev, { titulo: "", descricao: "" }]);
  }

  function removeEscopoItem(idx: number) {
    setEscopoItens((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
    );
  }

  async function handleSubmit() {
    if (!lead?.id) {
      toast.error("Lead inválido.");
      return;
    }
    if (!proposalName.trim()) {
      toast.error("Informe o nome da proposta.");
      return;
    }
    if (omitFinancials && !omitReason.trim()) {
      toast.error("Informe o motivo para omitir valores comerciais.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      const token = generateToken();
      const publicUrl = `${window.location.origin}/proposta/${token}`;

      const itensFiltrados = escopoItens.filter(
        (i) => i.titulo.trim() || i.descricao.trim(),
      );

      const payload = {
        company: cliente.trim(),
        leadName: contatoNome.trim(),
        contato: {
          nome: contatoNome.trim(),
          email: contatoEmail.trim(),
          telefone: contatoTelefone.trim(),
        },
        objetivo: objetivo.trim(),
        escopo_itens: itensFiltrados,
        financeiro: omitFinancials
          ? null
          : {
              valor_setup: valorSetup ? Number(valorSetup) : null,
              valor_mensalidade: valorMensalidade
                ? Number(valorMensalidade)
                : null,
              valor_campanhas: valorCampanhas ? Number(valorCampanhas) : null,
              qtd_parcelas: qtdParcelas ? Number(qtdParcelas) : null,
            },
        prazos: {
          prazo_implantacao: prazoImplantacao.trim(),
          validade_proposta: validadeProposta.trim(),
          condicoes_pagamento: condicoesPagamento.trim(),
        },
        observacoes: observacoes.trim(),
      };

      const { error } = await supabase.from("commercial_proposals").insert({
        lead_id: lead.id,
        token,
        proposal_name: proposalName.trim(),
        payload,
        omit_financials: omitFinancials,
        omit_financials_reason: omitFinancials ? omitReason.trim() : null,
        public_url: publicUrl,
        created_by_user_id: userId,
      } as any);

      if (error) throw error;

      try {
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Proposta gerada! Link copiado para a área de transferência.");
      } catch {
        toast.success("Proposta gerada com sucesso.");
      }

      onSuccess(publicUrl, proposalName.trim());
      onOpenChange(false);
    } catch (err: any) {
      console.error("Erro ao gerar proposta:", err);
      toast.error("Erro ao gerar proposta: " + (err.message || "desconhecido"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelClick() {
    onCancel();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleCancelClick();
        else onOpenChange(isOpen);
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Proposta Comercial Monnera
          </DialogTitle>
          <DialogDescription>
            Edite as informações da proposta. Ao gerar, será criado um link público rastreável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Identificação */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Identificação</h3>
            <div className="space-y-2">
              <Label htmlFor="prop-name">Nome da proposta *</Label>
              <Input
                id="prop-name"
                value={proposalName}
                onChange={(e) => setProposalName(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-cliente">Cliente</Label>
              <Input
                id="prop-cliente"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prop-contato-nome">Contato</Label>
                <Input
                  id="prop-contato-nome"
                  value={contatoNome}
                  onChange={(e) => setContatoNome(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-contato-email">Email</Label>
                <Input
                  id="prop-contato-email"
                  type="email"
                  value={contatoEmail}
                  onChange={(e) => setContatoEmail(e.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-contato-tel">Telefone</Label>
                <Input
                  id="prop-contato-tel"
                  value={contatoTelefone}
                  onChange={(e) => setContatoTelefone(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* Escopo */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Escopo</h3>
            <div className="space-y-2">
              <Label htmlFor="prop-objetivo">Objetivo</Label>
              <Textarea
                id="prop-objetivo"
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="Descreva o objetivo da proposta"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Itens de escopo</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addEscopoItem}
                  disabled={submitting}
                >
                  <Plus className="h-4 w-4 mr-1" /> Adicionar item
                </Button>
              </div>
              {escopoItens.map((it, idx) => (
                <div
                  key={idx}
                  className="space-y-2 rounded-md border border-border p-3"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={it.titulo}
                      onChange={(e) =>
                        updateEscopoItem(idx, { titulo: e.target.value })
                      }
                      placeholder="Título do item"
                      disabled={submitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEscopoItem(idx)}
                      disabled={submitting || escopoItens.length <= 1}
                      aria-label="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={it.descricao}
                    onChange={(e) =>
                      updateEscopoItem(idx, { descricao: e.target.value })
                    }
                    placeholder="Descrição"
                    rows={2}
                    disabled={submitting}
                  />
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Comercial */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Comercial</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="prop-omit" className="text-xs text-muted-foreground">
                  Omitir valores
                </Label>
                <Switch
                  id="prop-omit"
                  checked={omitFinancials}
                  onCheckedChange={setOmitFinancials}
                  disabled={submitting}
                />
              </div>
            </div>

            {omitFinancials ? (
              <div className="space-y-2">
                <Label htmlFor="prop-omit-reason">Motivo da omissão *</Label>
                <Input
                  id="prop-omit-reason"
                  value={omitReason}
                  onChange={(e) => setOmitReason(e.target.value)}
                  disabled={submitting}
                  placeholder="Ex: valores em negociação"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="prop-setup">Valor setup (R$)</Label>
                  <Input
                    id="prop-setup"
                    type="number"
                    inputMode="decimal"
                    value={valorSetup}
                    onChange={(e) => setValorSetup(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-mens">Mensalidade (R$)</Label>
                  <Input
                    id="prop-mens"
                    type="number"
                    inputMode="decimal"
                    value={valorMensalidade}
                    onChange={(e) => setValorMensalidade(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-camp">Campanhas (R$)</Label>
                  <Input
                    id="prop-camp"
                    type="number"
                    inputMode="decimal"
                    value={valorCampanhas}
                    onChange={(e) => setValorCampanhas(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prop-parc">Qtd. parcelas</Label>
                  <Input
                    id="prop-parc"
                    type="number"
                    inputMode="numeric"
                    value={qtdParcelas}
                    onChange={(e) => setQtdParcelas(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              </div>
            )}
          </section>

          <Separator />

          {/* Prazos */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Prazos e Condições</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prop-prazo">Prazo de implantação</Label>
                <Input
                  id="prop-prazo"
                  value={prazoImplantacao}
                  onChange={(e) => setPrazoImplantacao(e.target.value)}
                  placeholder="Ex: 45 dias"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prop-validade">Validade da proposta</Label>
                <Input
                  id="prop-validade"
                  value={validadeProposta}
                  onChange={(e) => setValidadeProposta(e.target.value)}
                  placeholder="Ex: 30 dias"
                  disabled={submitting}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-cond">Condições de pagamento</Label>
              <Input
                id="prop-cond"
                value={condicoesPagamento}
                onChange={(e) => setCondicoesPagamento(e.target.value)}
                placeholder="Ex: boleto mensal"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prop-obs">Observações</Label>
              <Textarea
                id="prop-obs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                disabled={submitting}
              />
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancelClick} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !proposalName.trim()}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" />
                Gerar proposta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
