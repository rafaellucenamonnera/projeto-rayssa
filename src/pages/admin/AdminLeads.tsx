import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2, FileText, RefreshCw, Download, Loader2, Eye } from "lucide-react";
import { LeadExportButton } from "@/components/admin/LeadExportButton";
import { LeadImportDialog } from "@/components/admin/LeadImportDialog";
import { PropostaUploadDialog } from "@/components/admin/PropostaUploadDialog";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/pipelineConstants";

const AdminLeads = () => {
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<Record<string, string>>({});
  const [parceirosAll, setParceirosAll] = useState<{ id: string; nome: string }[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get("status") || "all");
  const [filterConsultor, setFilterConsultor] = useState<string>("all");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");

  // Proposta upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ leadId: string; leadName: string; replaceOnly?: boolean } | null>(null);

  // Lead detail dialog
  const [detailLead, setDetailLead] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Contract number edit
  const [editingNumProposta, setEditingNumProposta] = useState<string>("");

  // Contract generation
  const [generatingContract, setGeneratingContract] = useState(false);

  const loadData = async () => {
    const [leadsRes, parceirosRes] = await Promise.all([
      supabase.from("leads").select("*").order("data_cadastro", { ascending: false }),
      supabase.from("parceiros_comerciais").select("id, nome"),
    ]);
    setLeads(leadsRes.data || []);
    const map: Record<string, string> = {};
    const list = parceirosRes.data || [];
    list.forEach((p) => { map[p.id] = p.nome; });
    setParceiros(map);
    setParceirosAll(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = (leadId: string, leadName: string, newStatus: string) => {
    if (newStatus === "proposta_enviada" || newStatus === "proposta_comercial") {
      setPendingStatusChange({ leadId, leadName });
      setUploadDialogOpen(true);
      return;
    }
    updateStatus(leadId, newStatus);
  };

  const autoGenerateContract = async (leadId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.contrato_url) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, contrato_url: data.contrato_url } : l))
        );
        toast.success("Contrato gerado automaticamente!");
      }
    } catch (err: any) {
      console.error("Auto contract generation failed:", err);
      toast.error("Erro ao gerar contrato automático: " + (err.message || "Erro desconhecido"));
    }
  };

  const updateStatus = async (leadId: string, newStatus: string, propostaUrl?: string, numeroProposta?: string) => {
    const updateData: any = { status_lead: newStatus };
    if (propostaUrl) {
      updateData.proposta_url = propostaUrl;
    }
    if (numeroProposta) {
      updateData.numero_proposta = numeroProposta;
    }

    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId);

    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }

    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status_lead: newStatus, ...(propostaUrl && { proposta_url: propostaUrl }), ...(numeroProposta && { numero_proposta: numeroProposta }) } : l))
    );
    toast.success("Status atualizado");

    // Auto-generate contract when status changes to lead_convertido
    if (newStatus === "lead_convertido") {
      autoGenerateContract(leadId);
    }
  };

  const handlePropostaUploadSuccess = (propostaUrl: string, numeroProposta: string) => {
    if (pendingStatusChange) {
      if (pendingStatusChange.replaceOnly) {
        updatePropostaUrl(pendingStatusChange.leadId, propostaUrl, numeroProposta);
      } else {
        updateStatus(pendingStatusChange.leadId, "proposta_enviada", propostaUrl, numeroProposta);
      }
      setPendingStatusChange(null);
    }
  };

  const updatePropostaUrl = async (leadId: string, propostaUrl: string, numeroProposta?: string) => {
    const updateData: any = { proposta_url: propostaUrl };
    if (numeroProposta) updateData.numero_proposta = numeroProposta;

    const { error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId);
    if (error) {
      toast.error("Erro ao atualizar proposta");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, proposta_url: propostaUrl, ...(numeroProposta && { numero_proposta: numeroProposta }) } : l))
    );
    toast.success("Proposta substituída com sucesso");
  };

  const handleReplaceProposta = (leadId: string, leadName: string) => {
    setPendingStatusChange({ leadId, leadName, replaceOnly: true });
    setUploadDialogOpen(true);
  };

  const handlePropostaUploadCancel = () => {
    setPendingStatusChange(null);
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir o lead ${nome}?`)) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir lead: " + error.message);
      return;
    }
    toast.success("Lead excluído");
    loadData();
  };

  const handleSaveNumeroProposta = async (leadId: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ numero_proposta: editingNumProposta } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("Erro ao salvar número da proposta");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, numero_proposta: editingNumProposta } : l))
    );
    if (detailLead?.id === leadId) {
      setDetailLead({ ...detailLead, numero_proposta: editingNumProposta });
    }
    toast.success("Número da proposta salvo");
  };

  const handleGenerateContract = async (lead: any) => {
    setGeneratingContract(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract", {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      if (data?.contrato_url) {
        setLeads((prev) =>
          prev.map((l) => (l.id === lead.id ? { ...l, contrato_url: data.contrato_url } : l))
        );
        if (detailLead?.id === lead.id) {
          setDetailLead({ ...detailLead, contrato_url: data.contrato_url });
        }
        toast.success("Contrato gerado com sucesso!");
      }
    } catch (err: any) {
      toast.error("Erro ao gerar contrato: " + (err.message || "Erro desconhecido"));
    } finally {
      setGeneratingContract(false);
    }
  };

  const openSignedUrl = async (storagePath: string, fileName?: string) => {
    try {
      let url = storagePath;
      if (!storagePath.startsWith("http")) {
        const { data, error } = await supabase.storage
          .from("propostas")
          .createSignedUrl(storagePath, 3600);
        if (error || !data?.signedUrl) {
          toast.error("Erro ao gerar link do documento");
          return;
        }
        url = data.signedUrl;
      }
      // Fetch as blob to avoid ad-blocker/popup-blocker issues
      const response = await fetch(url);
      if (!response.ok) throw new Error("Erro ao baixar documento");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName || storagePath.split("/").pop() || "documento.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error("Download error:", err);
      toast.error("Erro ao baixar documento: " + err.message);
    }
  };

  const openLeadDetail = (lead: any) => {
    setDetailLead(lead);
    setEditingNumProposta(lead.numero_proposta || "");
    setDetailOpen(true);
  };

  // Apply filters
  const filtered = leads.filter((l) => {
    if (filterStatus !== "all" && (l.status_lead || l.status) !== filterStatus) return false;
    if (filterConsultor !== "all" && l.parceiro_id !== filterConsultor) return false;
    if (filterEmpresa && !l.nome_fantasia.toLowerCase().includes(filterEmpresa.toLowerCase())) return false;
    if (filterDataInicio) {
      const d = new Date(l.data_cadastro);
      if (d < new Date(filterDataInicio)) return false;
    }
    if (filterDataFim) {
      const d = new Date(l.data_cadastro);
      const fim = new Date(filterDataFim);
      fim.setHours(23, 59, 59);
      if (d > fim) return false;
    }
    return true;
  });

  // Status counts
  const statusCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => { statusCounts[s.value] = 0; });
  leads.forEach((l) => {
    const s = l.status_lead || l.status || "novo_lead";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });

  const isConvertedOrBeyond = (status: string) =>
    ["lead_convertido", "contrato_enviado", "contrato_assinado"].includes(status);

  const StatusSelect = ({ lead }: { lead: any }) => {
    const currentStatus = lead.status_lead || lead.status || "novo_lead";
    const hasProposta = !!lead.proposta_url;

    return (
      <div className="flex items-center gap-1">
        <Select
          value={currentStatus}
          onValueChange={(val) => handleStatusChange(lead.id, lead.nome_fantasia, val)}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasProposta && (
          <>
            <button
              onClick={() => openSignedUrl(lead.proposta_url)}
              className="p-1 hover:bg-primary/10 rounded"
              title="Ver proposta"
            >
              <FileText className="h-4 w-4 text-primary" />
            </button>
            <button
              onClick={() => handleReplaceProposta(lead.id, lead.nome_fantasia)}
              className="p-1 hover:bg-amber-500/10 rounded"
              title="Substituir proposta"
            >
              <RefreshCw className="h-4 w-4 text-amber-500" />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-display font-bold">Pipeline Comercial</h1>
        <div className="flex items-center gap-2">
          <LeadExportButton leads={filtered} parceiros={parceiros} />
          <LeadImportDialog parceiros={parceirosAll} onImported={loadData} />
        </div>
      </div>

      {/* Status cards - scrollable on mobile */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:overflow-visible">
        {PIPELINE_STAGES.map((s) => (
          <div
            key={s.value}
            className={`stat-card !p-3 sm:!p-4 cursor-pointer transition-all min-w-[120px] sm:min-w-0 shrink-0 sm:shrink ${filterStatus === s.value ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
          >
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{s.label}</p>
              <p className="text-xl sm:text-2xl font-display font-bold">{statusCounts[s.value] || 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        <Input
          placeholder="Filtrar por empresa..."
          value={filterEmpresa}
          onChange={(e) => setFilterEmpresa(e.target.value)}
        />
        <Select value={filterConsultor} onValueChange={setFilterConsultor}>
          <SelectTrigger>
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Consultores</SelectItem>
            {parceirosAll.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDataInicio}
          onChange={(e) => setFilterDataInicio(e.target.value)}
          placeholder="Data início"
        />
        <Input
          type="date"
          value={filterDataFim}
          onChange={(e) => setFilterDataFim(e.target.value)}
          placeholder="Data fim"
        />
      </div>

      {/* Mobile card view */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((l) => (
          <Card key={l.id} className="border-border">
            <CardContent className="p-3 sm:p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 cursor-pointer" onClick={() => openLeadDetail(l)}>
                  <p className="font-medium text-sm truncate">{l.nome_fantasia}</p>
                  <p className="text-xs text-muted-foreground">{l.cidade}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.data_cadastro).toLocaleDateString("pt-BR")}
                  </span>
                  <button onClick={() => openLeadDetail(l)} className="p-1 hover:bg-primary/10 rounded">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id, l.nome_fantasia)} className="text-destructive hover:text-destructive h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] shrink-0">
                  {parceiros[l.parceiro_id] || '-'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <span className="text-muted-foreground">Responsável: </span>
                  <span>{l.nome_responsavel}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tel: </span>
                  <span>{l.telefone_responsavel}</span>
                </div>
              </div>
              <div>
                <Select
                  value={l.status_lead || l.status || "novo_lead"}
                  onValueChange={(val) => handleStatusChange(l.id, l.nome_fantasia, val)}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Document buttons on card */}
              {(l.proposta_url || l.contrato_url) && (
                <div className="flex items-center gap-2 pt-1">
                  {l.proposta_url && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openSignedUrl(l.proposta_url, `proposta-${l.nome_fantasia}.pdf`)}>
                      <FileText className="mr-1 h-3 w-3" /> Proposta
                    </Button>
                  )}
                  {l.contrato_url && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openSignedUrl(l.contrato_url)}>
                      <Download className="mr-1 h-3 w-3" /> Contrato
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">Nenhum lead encontrado.</p>
        )}
      </div>

      {/* Desktop table */}
      <Card className="border-border hidden lg:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Consultor</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Empresa</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cidade</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Responsável</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Telefone</th>
                   <th className="text-left py-3 px-4 text-muted-foreground font-medium">Pipeline</th>
                   <th className="text-left py-3 px-4 text-muted-foreground font-medium">Docs</th>
                   {isAdmin && <th className="text-left py-3 px-4 text-muted-foreground font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(l.data_cadastro).toLocaleDateString("pt-BR")}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs">{parceiros[l.parceiro_id] || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <button onClick={() => openLeadDetail(l)} className="hover:text-primary transition-colors text-left">
                        {l.nome_fantasia}
                      </button>
                    </td>
                    <td className="py-3 px-4">{l.cidade}</td>
                    <td className="py-3 px-4">{l.nome_responsavel}</td>
                    <td className="py-3 px-4">{l.telefone_responsavel}</td>
                    <td className="py-3 px-4">
                      <StatusSelect lead={l} />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {l.proposta_url && (
                          <button
                            onClick={() => openSignedUrl(l.proposta_url)}
                            className="p-1 hover:bg-primary/10 rounded"
                            title="Download Proposta"
                          >
                            <FileText className="h-4 w-4 text-primary" />
                          </button>
                        )}
                        {l.contrato_url && (
                          <button
                            onClick={() => openSignedUrl(l.contrato_url)}
                            className="p-1 hover:bg-primary/10 rounded"
                            title="Download Contrato"
                          >
                            <Download className="h-4 w-4 text-emerald-500" />
                          </button>
                        )}
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id, l.nome_fantasia)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum lead encontrado.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Proposta Upload Dialog */}
      <PropostaUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        leadId={pendingStatusChange?.leadId || ""}
        leadName={pendingStatusChange?.leadName || ""}
        replaceMode={pendingStatusChange?.replaceOnly || false}
        onSuccess={handlePropostaUploadSuccess}
        onCancel={handlePropostaUploadCancel}
      />

      {/* Lead Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{detailLead?.nome_fantasia}</DialogTitle>
          </DialogHeader>
          {detailLead && (
            <div className="space-y-6">
              {/* Lead Data */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Razão Social</p>
                  <p className="font-medium">{detailLead.razao_social}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">CNPJ</p>
                  <p className="font-mono">{detailLead.cnpj}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Cidade</p>
                  <p>{detailLead.cidade}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Qtd Lojas</p>
                  <p>{detailLead.quantidade_lojas}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">ERP / Sistema</p>
                  <p>{detailLead.erp_utilizado}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Qtd Funcionários</p>
                  <p>{detailLead.quantidade_funcionarios || "—"}</p>
                </div>
              </div>

              {/* Responsável */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Responsável</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Nome</p>
                    <p>{detailLead.nome_responsavel}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Telefone</p>
                    <p>{detailLead.telefone_responsavel}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs mb-1">Email</p>
                    <p>{detailLead.email_responsavel}</p>
                  </div>
                </div>
              </div>

              {/* Consultor */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Consultor</h3>
                <p className="text-sm">{parceiros[detailLead.parceiro_id] || "—"}</p>
              </div>

              {/* Pipeline Status */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Pipeline</h3>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((s) => {
                    const currentStatus = detailLead.status_lead || "novo_lead";
                    const currentIdx = PIPELINE_STAGES.findIndex((st) => st.value === currentStatus);
                    const thisIdx = PIPELINE_STAGES.findIndex((st) => st.value === s.value);
                    const isActive = thisIdx <= currentIdx;
                    return (
                      <div
                        key={s.value}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        {s.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Valor Campanhas */}
              {detailLead.valor_campanhas != null && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-2">Valor Médio de Campanhas</h3>
                  <p className="text-lg font-bold font-display">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(detailLead.valor_campanhas)}
                  </p>
                </div>
              )}

              {/* Contract section - visible for converted leads */}
              {isConvertedOrBeyond(detailLead.status_lead) && (
                <div className="border-t border-border pt-4 space-y-4">
                  <h3 className="text-sm font-semibold">Contrato</h3>

                  {/* Número da proposta */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Número da Proposta</label>
                      <Input
                        value={editingNumProposta}
                        onChange={(e) => setEditingNumProposta(e.target.value)}
                        placeholder="Ex: PROP-2026-001"
                        className="h-9"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSaveNumeroProposta(detailLead.id)}
                    >
                      Salvar
                    </Button>
                  </div>

                  {/* Proposta PDF */}
                  {detailLead.proposta_url && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openSignedUrl(detailLead.proposta_url)}>
                        <FileText className="mr-2 h-4 w-4" /> Ver Proposta
                      </Button>
                    </div>
                  )}

                  {/* Generate / Download Contract */}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleGenerateContract(detailLead)}
                      disabled={generatingContract}
                    >
                      {generatingContract ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="mr-2 h-4 w-4" />
                      )}
                      {detailLead.contrato_url ? "Regerar Contrato" : "Gerar Contrato"}
                    </Button>
                    {detailLead.contrato_url && (
                      <Button size="sm" variant="outline" onClick={() => openSignedUrl(detailLead.contrato_url)}>
                        <Download className="mr-2 h-4 w-4" /> Download Contrato
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeads;
