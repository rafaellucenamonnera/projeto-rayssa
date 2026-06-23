import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PropostaMonneraTemplate,
  type PropostaMonneraPayload,
} from "@/components/proposta/PropostaMonneraTemplate";

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

export default function AdminGeradorProposta() {
  const { leadId } = useParams<{ leadId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const replaceMode = searchParams.get("mode") === "replace";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lead, setLead] = useState<any>(null);

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
    let cancelled = false;
    async function load() {
      if (!leadId) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Lead não encontrado.");
        navigate("/admin/painel-comercial");
        return;
      }
      setLead(data);
      setProposalName(defaultProposalName(data));
      setCliente(data.nome_fantasia || data.razao_social || "");
      setContatoNome(data.nome_responsavel || "");
      setContatoEmail(data.email_responsavel || "");
      setContatoTelefone(data.telefone_responsavel || "");
      setValorSetup(data.valor_setup != null ? String(data.valor_setup) : "");
      setValorMensalidade(
        data.valor_mensalidade != null ? String(data.valor_mensalidade) : "",
      );
      setValorCampanhas(
        data.valor_campanhas != null ? String(data.valor_campanhas) : "",
      );
      setQtdParcelas(
        data.qtd_parcelas != null ? String(data.qtd_parcelas) : "",
      );
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [leadId, navigate]);

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

  const payload = useMemo<PropostaMonneraPayload>(
    () => ({
      company: cliente.trim(),
      leadName: contatoNome.trim(),
      contato: {
        nome: contatoNome.trim(),
        email: contatoEmail.trim(),
        telefone: contatoTelefone.trim(),
      },
      objetivo: objetivo.trim(),
      escopo_itens: escopoItens.filter(
        (i) => i.titulo.trim() || i.descricao.trim(),
      ),
      financeiro: omitFinancials
        ? null
        : {
            valor_setup: valorSetup ? Number(valorSetup) : null,
            valor_mensalidade: valorMensalidade ? Number(valorMensalidade) : null,
            valor_campanhas: valorCampanhas ? Number(valorCampanhas) : null,
            qtd_parcelas: qtdParcelas ? Number(qtdParcelas) : null,
          },
      prazos: {
        prazo_implantacao: prazoImplantacao.trim(),
        validade_proposta: validadeProposta.trim(),
        condicoes_pagamento: condicoesPagamento.trim(),
      },
      observacoes: observacoes.trim(),
    }),
    [
      cliente,
      contatoNome,
      contatoEmail,
      contatoTelefone,
      objetivo,
      escopoItens,
      omitFinancials,
      valorSetup,
      valorMensalidade,
      valorCampanhas,
      qtdParcelas,
      prazoImplantacao,
      validadeProposta,
      condicoesPagamento,
      observacoes,
    ],
  );

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
      const token = generateToken();
      const publicUrl = `${window.location.origin}/proposta/${token}`;

      const { error: insertError } = await supabase
        .from("commercial_proposals")
        .insert({
          lead_id: lead.id,
          token,
          proposal_name: proposalName.trim(),
          payload,
          omit_financials: omitFinancials,
          omit_financials_reason: omitFinancials ? omitReason.trim() : null,
          public_url: publicUrl,
          created_by_user_id: user?.id ?? null,
        } as any);

      if (insertError) throw insertError;

      // Atualiza lead (mesmo padrão de AdminLeads.updateStatus, mínimo).
      const updateData: any = {
        proposta_url: publicUrl,
        numero_proposta: proposalName.trim(),
      };
      if (!replaceMode) {
        updateData.status_lead = "proposta_enviada";
      }
      const { error: updError } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", lead.id);
      if (updError) throw updError;

      try {
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Proposta gerada! Link copiado.");
      } catch {
        toast.success("Proposta gerada com sucesso.");
      }

      navigate("/admin/painel-comercial");
    } catch (err: any) {
      console.error("Erro ao gerar proposta:", err);
      toast.error("Erro ao gerar proposta: " + (err.message || "desconhecido"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientName =
    proposalName ||
    payload.company ||
    payload.leadName ||
    lead?.nome_fantasia ||
    "Cliente Monnera";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/painel-comercial")}
            disabled={submitting}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">
              Gerador de Proposta Monnera
            </h1>
            <p className="text-sm text-muted-foreground">
              {replaceMode
                ? "Substituindo proposta existente"
                : "Crie a proposta e gere o link público de aceite"}
            </p>
          </div>
        </div>
        <Button onClick={handleSubmit} disabled={submitting || !proposalName.trim()}>
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {replaceMode ? "Substituir proposta" : "Gerar proposta e enviar"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da proposta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Identificação */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Identificação</h3>
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
              <h3 className="text-sm font-semibold">Escopo</h3>
              <div className="space-y-2">
                <Label htmlFor="prop-objetivo">Objetivo</Label>
                <Textarea
                  id="prop-objetivo"
                  rows={3}
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
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
                <h3 className="text-sm font-semibold">Comercial</h3>
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
                    placeholder="Ex: valores em negociação"
                    disabled={submitting}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="prop-setup">Setup (R$)</Label>
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
              <h3 className="text-sm font-semibold">Prazos e Condições</h3>
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
                  <Label htmlFor="prop-validade">Validade</Label>
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
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Preview
          </h2>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-6 max-h-[calc(100vh-220px)] overflow-y-auto">
            <PropostaMonneraTemplate
              proposalName={proposalName}
              clientName={clientName}
              createdAt={new Date().toISOString()}
              payload={payload}
              omitFinancials={omitFinancials}
              omitFinancialsReason={omitReason}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
