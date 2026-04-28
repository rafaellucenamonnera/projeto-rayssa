import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Trash2, FileText, RefreshCw, Download, Loader2, Eye, Copy,
  MessageCircle, CheckCircle, BookOpen, Calendar, Clock, Video,
  DollarSign, Package, BarChart3, User, AlertTriangle
} from "lucide-react";
import { LeadExportButton } from "@/components/admin/LeadExportButton";
import { LeadImportDialog } from "@/components/admin/LeadImportDialog";
import { PropostaUploadDialog } from "@/components/admin/PropostaUploadDialog";
import { LeadPerdidoDialog } from "@/components/admin/LeadPerdidoDialog";
import { AgendarReuniaoDialog } from "@/components/admin/AgendarReuniaoDialog";
import { CadastroFinanceiroDialog } from "@/components/admin/CadastroFinanceiroDialog";
import { LeadComments } from "@/components/admin/LeadComments";
import { LeadReuniao } from "@/components/admin/LeadReuniao";
import { DaysInStage } from "@/components/admin/DaysInStage";
import { PipelineKanban } from "@/components/admin/PipelineKanban";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/pipelineConstants";

// Etapas a partir das quais é obrigatório ter financeiro preenchido
const FINANCEIRO_REQUIRED_FROM = [
  "proposta_enviada",
  "proposta_comercial",
  "lead_convertido",
  "contrato_enviado",
  "contrato_assinado",
];

const hasValidFinanceiro = (lead: any) =>
  Number(lead?.valor_setup ?? 0) >= 0 &&
  Number(lead?.valor_mensalidade ?? 0) > 0 &&
  Number(lead?.qtd_parcelas ?? 0) > 0 &&
  Number(lead?.quantidade_lojas ?? 0) > 0 &&
  Number(lead?.valor_campanhas ?? 0) >= 0 &&
  lead?.valor_campanhas !== null && lead?.valor_campanhas !== undefined;

const AdminLeads = () => {
  const [searchParams] = useSearchParams();
  const { isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [stageMap, setStageMap] = useState<Record<string, string>>({});
  const [parceiros, setParceiros] = useState<Record<string, string>>({});
  const [parceirosAll, setParceirosAll] = useState<{ id: string; nome: string }[]>([]);
  const [reunioesMap, setReunioesMap] = useState<Record<string, any>>({});

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

  // Lead perdido dialog
  const [perdidoDialogOpen, setPerdidoDialogOpen] = useState(false);
  const [pendingPerdido, setPendingPerdido] = useState<{ leadId: string; leadName: string } | null>(null);

  // Contract number edit
  const [editingNumProposta, setEditingNumProposta] = useState<string>("");

  // Contract generation
  const [generatingContract, setGeneratingContract] = useState(false);

  // Conversion link dialog
  const [conversionLinkOpen, setConversionLinkOpen] = useState(false);
  const [conversionLink, setConversionLink] = useState("");
  const [conversionLeadName, setConversionLeadName] = useState("");

  // Reunião dialog
  const [reuniaoDialogOpen, setReuniaoDialogOpen] = useState(false);
  const [pendingReuniao, setPendingReuniao] = useState<{ leadId: string; leadName: string } | null>(null);

  // Financial dialog
  const [financeiroDialogOpen, setFinanceiroDialogOpen] = useState(false);
  const [pendingFinanceiro, setPendingFinanceiro] = useState<{ leadId: string; leadName: string; parceiroId: string } | null>(null);

  // User name for comments
  const [currentUserName, setCurrentUserName] = useState("Usuário");

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle();
        if (data) setCurrentUserName(data.nome);
      }
    };
    fetchUserName();
  }, []);

  const loadData = async () => {
    const [leadsRes, parceirosRes, stageRes, reunioesRes] = await Promise.all([
      supabase.from("leads").select("*").order("data_cadastro", { ascending: false }),
      supabase.from("parceiros_comerciais").select("id, nome"),
      supabase.from("lead_stage_history").select("lead_id, data_entrada").is("data_saida", null),
      supabase.from("reunioes").select("*").eq("realizada", false).order("data_reuniao", { ascending: true }),
    ]);
    setLeads(leadsRes.data || []);
    const map: Record<string, string> = {};
    const list = parceirosRes.data || [];
    list.forEach((p: any) => { map[p.id] = p.nome; });
    setParceiros(map);
    setParceirosAll(list);

    const sm: Record<string, string> = {};
    (stageRes.data || []).forEach((s: any) => { sm[s.lead_id] = s.data_entrada; });
    setStageMap(sm);

    // Build reunioes map: lead_id -> latest upcoming reuniao
    const rm: Record<string, any> = {};
    (reunioesRes.data || []).forEach((r: any) => {
      if (!rm[r.lead_id]) rm[r.lead_id] = r;
    });
    setReunioesMap(rm);
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
    if (newStatus === "lead_perdido") {
      setPendingPerdido({ leadId, leadName });
      setPerdidoDialogOpen(true);
      return;
    }
    if (newStatus === "reuniao_agendada") {
      setPendingReuniao({ leadId, leadName });
      setReuniaoDialogOpen(true);
      return;
    }
    if (newStatus === "contrato_assinado") {
      const lead = leads.find((l) => l.id === leadId);
      if (lead && !lead.dados_completos) {
        toast.error("O cliente precisa preencher o formulário de cadastro completo antes de avançar para Contrato Assinado.");
        return;
      }
      // Open financial modal
      setPendingFinanceiro({ leadId, leadName, parceiroId: lead?.parceiro_id || "" });
      setFinanceiroDialogOpen(true);
      return;
    }
    updateStatus(leadId, newStatus);
  };

  const handleReuniaoConfirm = () => {
    if (pendingReuniao) {
      updateStatus(pendingReuniao.leadId, "reuniao_agendada");
    }
    setReuniaoDialogOpen(false);
    setPendingReuniao(null);
  };

  const handleReuniaoCancel = () => {
    setReuniaoDialogOpen(false);
    setPendingReuniao(null);
  };

  const handlePerdidoConfirm = async (motivo: string) => {
    if (!pendingPerdido) return;
    const { error } = await supabase
      .from("leads")
      .update({ status_lead: "lead_perdido", motivo_perda: motivo } as any)
      .eq("id", pendingPerdido.leadId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === pendingPerdido.leadId ? { ...l, status_lead: "lead_perdido", motivo_perda: motivo } : l))
    );
    toast.success("Lead marcado como perdido");
    setPerdidoDialogOpen(false);
    setPendingPerdido(null);
  };

  const handleFinanceiroSaved = (data: { valor_mensalidade: number; percentual_consultor: number; qtd_parcelas: number }) => {
    if (!pendingFinanceiro) return;
    // Now update status to contrato_assinado
    updateStatus(pendingFinanceiro.leadId, "contrato_assinado");
    setLeads((prev) =>
      prev.map((l) => l.id === pendingFinanceiro.leadId
        ? { ...l, ...data, parcelas_pagas: 0 }
        : l
      )
    );
    setFinanceiroDialogOpen(false);
    setPendingFinanceiro(null);
  };

  const handleFinanceiroCancel = () => {
    setFinanceiroDialogOpen(false);
    setPendingFinanceiro(null);
  };

  const autoGenerateContract = async (leadId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-contract", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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

  const autoGenerateDossie = async (leadId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("generate-dossie", {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      if (data?.dossie_url) {
        toast.success("Dossiê Comercial gerado automaticamente!");
      }
    } catch (err: any) {
      console.error("Auto dossie generation failed:", err);
      toast.error("Erro ao gerar dossiê: " + (err.message || "Erro desconhecido"));
    }
  };

  const updateStatus = async (leadId: string, newStatus: string, propostaUrl?: string, numeroProposta?: string) => {
    const updateData: any = { status_lead: newStatus };
    if (propostaUrl) updateData.proposta_url = propostaUrl;
    if (numeroProposta) updateData.numero_proposta = numeroProposta;

    if (newStatus === "lead_convertido") {
      updateData.completion_token = crypto.randomUUID();
    }
    if (newStatus === "contrato_assinado") {
      updateData.data_contrato_assinado = new Date().toISOString();
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
      prev.map((l) => (l.id === leadId ? { ...l, ...updateData } : l))
    );
    toast.success("Status atualizado");

    if (newStatus === "lead_convertido") {
      const lead = leads.find((l) => l.id === leadId);
      const link = `${window.location.origin}/completar-cadastro/${updateData.completion_token}`;
      setConversionLink(link);
      setConversionLeadName(lead?.nome_responsavel || "");
      setConversionLinkOpen(true);
      autoGenerateContract(leadId);
    }

    if (newStatus === "contrato_assinado") {
      autoGenerateDossie(leadId);
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

  const handleRegistrarParcela = async (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const newPagas = (lead.parcelas_pagas || 0) + 1;
    if (newPagas > (lead.qtd_parcelas || 0)) {
      toast.error("Todas as parcelas já foram pagas");
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({ parcelas_pagas: newPagas } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("Erro ao registrar parcela");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, parcelas_pagas: newPagas } : l))
    );
    if (detailLead?.id === leadId) {
      setDetailLead({ ...detailLead, parcelas_pagas: newPagas });
    }
    toast.success(`Parcela ${newPagas} de ${lead.qtd_parcelas} registrada`);
  };

  const handleDownloadDossie = async (leadId: string, leadName: string) => {
    try {
      // List files in dossies folder for this lead
      const { data: files } = await supabase.storage
        .from("propostas")
        .list(`dossies`, { search: leadId });

      const dossieFile = files?.find((f) => f.name.includes(leadId));
      if (!dossieFile) {
        toast.error("Dossiê não encontrado. Tente gerar novamente.");
        return;
      }

      const { data, error } = await supabase.storage
        .from("propostas")
        .createSignedUrl(`dossies/${dossieFile.name}`, 3600);
      if (error || !data?.signedUrl) {
        toast.error("Erro ao gerar link do dossiê");
        return;
      }

      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Erro ao baixar");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `dossie-${leadName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      toast.error("Erro ao baixar dossiê: " + (err.message || ""));
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

  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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

  // Meeting info component for cards
  const MeetingInfo = ({ lead }: { lead: any }) => {
    const reuniao = reunioesMap[lead.id];
    if (!reuniao) return null;
    const meetLink = reuniao.google_meet_link || reuniao.link_reuniao;

    return (
      <div className="text-xs space-y-0.5 pt-1 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {new Date(reuniao.data_reuniao + "T00:00:00").toLocaleDateString("pt-BR")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {reuniao.horario_reuniao?.slice(0, 5)}
          </span>
        </div>
        {meetLink && (
          <a href={meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
            <Video className="h-3 w-3" /> Abrir reunião
          </a>
        )}
      </div>
    );
  };

  // Financial info component for cards
  const FinancialInfo = ({ lead }: { lead: any }) => {
    if (!lead.valor_mensalidade || lead.valor_mensalidade <= 0) return null;
    const comissaoMensal = (lead.valor_mensalidade || 0) * (lead.percentual_consultor || 0);
    const parcelas = lead.qtd_parcelas || 0;
    const pagas = lead.parcelas_pagas || 0;
    const valorTotal = comissaoMensal * parcelas;
    const progressPercent = parcelas > 0 ? (pagas / parcelas) * 100 : 0;
    const statusFinanceiro = pagas >= parcelas && parcelas > 0 ? "Quitado" : "Em andamento";

    return (
      <div className="text-xs space-y-1.5 pt-1 border-t border-border/50">
        <div className="grid grid-cols-2 gap-1">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            {fmt(comissaoMensal)}/mês
          </span>
          <span className="flex items-center gap-1">
            <Package className="h-3 w-3 text-muted-foreground" />
            {parcelas} parcelas
          </span>
          <span className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3 text-muted-foreground" />
            {fmt(valorTotal)}
          </span>
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            {parceiros[lead.parceiro_id] || '-'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Progress value={progressPercent} className="h-2 flex-1" />
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{pagas} de {parcelas}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-medium ${statusFinanceiro === "Quitado" ? "text-emerald-600" : "text-amber-600"}`}>
            {statusFinanceiro}
          </span>
          {pagas < parcelas && parcelas > 0 && (
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleRegistrarParcela(lead.id)}>
              + Parcela
            </Button>
          )}
        </div>
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

      {/* Status cards */}
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
        <Input placeholder="Filtrar por empresa..." value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} />
        <Select value={filterConsultor} onValueChange={setFilterConsultor}>
          <SelectTrigger><SelectValue placeholder="Consultor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Consultores</SelectItem>
            {parceirosAll.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={filterDataInicio} onChange={(e) => setFilterDataInicio(e.target.value)} placeholder="Data início" />
        <Input type="date" value={filterDataFim} onChange={(e) => setFilterDataFim(e.target.value)} placeholder="Data fim" />
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
              <DaysInStage dataEntrada={stageMap[l.id]} />
              <MeetingInfo lead={l} />
              <div>
                <Select
                  value={l.status_lead || l.status || "novo_lead"}
                  onValueChange={(val) => handleStatusChange(l.id, l.nome_fantasia, val)}
                >
                  <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {/* Conversion link button */}
              {isConvertedOrBeyond(l.status_lead) && l.completion_token && !l.dados_completos && (
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => {
                  const link = `${window.location.origin}/completar-cadastro/${l.completion_token}`;
                  navigator.clipboard.writeText(link);
                  toast.success("Link copiado!");
                }}>
                  <Copy className="mr-1 h-3 w-3" /> Copiar link de cadastro
                </Button>
              )}
              <FinancialInfo lead={l} />
              {/* Document buttons */}
              {(l.proposta_url || l.contrato_url) && (
                <div className="flex items-center gap-2 pt-1">
                  {l.proposta_url && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openSignedUrl(l.proposta_url, `proposta-${l.nome_fantasia}.pdf`)}>
                      <FileText className="mr-1 h-3 w-3" /> Proposta
                    </Button>
                  )}
                  {l.contrato_url && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openSignedUrl(l.contrato_url, `contrato-${l.nome_fantasia}.docx`)}>
                      <Download className="mr-1 h-3 w-3" /> Contrato
                    </Button>
                  )}
                </div>
              )}
              {/* Dossie button */}
              {l.status_lead === "contrato_assinado" && (
                <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => handleDownloadDossie(l.id, l.nome_fantasia)}>
                  <BookOpen className="mr-1 h-3 w-3" /> Baixar dossiê completo
                </Button>
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
                      <div className="space-y-1">
                        <StatusSelect lead={l} />
                        <DaysInStage dataEntrada={stageMap[l.id]} compact />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        {l.proposta_url && (
                          <button onClick={() => openSignedUrl(l.proposta_url, `proposta-${l.nome_fantasia}.pdf`)} className="p-1 hover:bg-primary/10 rounded" title="Download Proposta">
                            <FileText className="h-4 w-4 text-primary" />
                          </button>
                        )}
                        {l.contrato_url && (
                          <button onClick={() => openSignedUrl(l.contrato_url, `contrato-${l.nome_fantasia}.docx`)} className="p-1 hover:bg-primary/10 rounded" title="Download Contrato">
                            <Download className="h-4 w-4 text-emerald-500" />
                          </button>
                        )}
                        {l.status_lead === "contrato_assinado" && (
                          <button onClick={() => handleDownloadDossie(l.id, l.nome_fantasia)} className="p-1 hover:bg-primary/10 rounded" title="Baixar dossiê">
                            <BookOpen className="h-4 w-4 text-blue-500" />
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

      {/* Lead Perdido Dialog */}
      <LeadPerdidoDialog
        open={perdidoDialogOpen}
        onOpenChange={setPerdidoDialogOpen}
        leadName={pendingPerdido?.leadName || ""}
        onConfirm={handlePerdidoConfirm}
        onCancel={() => { setPerdidoDialogOpen(false); setPendingPerdido(null); }}
      />

      {/* Agendar Reunião Dialog */}
      <AgendarReuniaoDialog
        open={reuniaoDialogOpen}
        onOpenChange={setReuniaoDialogOpen}
        leadId={pendingReuniao?.leadId || ""}
        leadName={pendingReuniao?.leadName || ""}
        onConfirm={handleReuniaoConfirm}
        onCancel={handleReuniaoCancel}
      />

      {/* Cadastro Financeiro Dialog */}
      <CadastroFinanceiroDialog
        open={financeiroDialogOpen}
        onOpenChange={setFinanceiroDialogOpen}
        leadId={pendingFinanceiro?.leadId || ""}
        leadName={pendingFinanceiro?.leadName || ""}
        parceiroId={pendingFinanceiro?.parceiroId || ""}
        parceiros={parceirosAll}
        onSaved={handleFinanceiroSaved}
        onCancel={handleFinanceiroCancel}
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
                  <p className="font-medium">{detailLead.razao_social || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">CNPJ</p>
                  <p className="font-mono">{detailLead.cnpj || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Cidade</p>
                  <p>{detailLead.cidade || "—"}</p>
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
                  <p className="text-lg font-bold font-display">{fmt(detailLead.valor_campanhas)}</p>
                </div>
              )}

              {/* Financial Info */}
              {detailLead.valor_mensalidade > 0 && (
                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Informações Financeiras</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">💰 Comissão mensal</p>
                      <p className="font-medium">{fmt((detailLead.valor_mensalidade || 0) * (detailLead.percentual_consultor || 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">📦 Parcelas contratadas</p>
                      <p className="font-medium">{detailLead.qtd_parcelas || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">📊 Valor total do contrato</p>
                      <p className="font-bold">{fmt((detailLead.valor_mensalidade || 0) * (detailLead.percentual_consultor || 0) * (detailLead.qtd_parcelas || 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">👤 Consultor responsável</p>
                      <p className="font-medium">{parceiros[detailLead.parceiro_id] || "—"}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Parcelas pagas: {detailLead.parcelas_pagas || 0} de {detailLead.qtd_parcelas || 0}</span>
                      <span className={`text-xs font-medium ${(detailLead.parcelas_pagas || 0) >= (detailLead.qtd_parcelas || 0) && (detailLead.qtd_parcelas || 0) > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {(detailLead.parcelas_pagas || 0) >= (detailLead.qtd_parcelas || 0) && (detailLead.qtd_parcelas || 0) > 0 ? "Quitado" : "Em andamento"}
                      </span>
                    </div>
                    <Progress value={(detailLead.qtd_parcelas || 0) > 0 ? ((detailLead.parcelas_pagas || 0) / (detailLead.qtd_parcelas || 0)) * 100 : 0} className="h-3" />
                    {(detailLead.parcelas_pagas || 0) < (detailLead.qtd_parcelas || 0) && (detailLead.qtd_parcelas || 0) > 0 && (
                      <Button size="sm" onClick={() => handleRegistrarParcela(detailLead.id)}>
                        Registrar parcela paga
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Motivo da Perda */}
              {detailLead.motivo_perda && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-2">Motivo da Perda</h3>
                  <p className="text-sm text-muted-foreground">{detailLead.motivo_perda}</p>
                </div>
              )}

              {/* Conversion Link */}
              {isConvertedOrBeyond(detailLead.status_lead) && detailLead.completion_token && !detailLead.dados_completos && (
                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Abrir cadastro do cliente</h3>
                  <div className="bg-secondary rounded-lg p-3 text-sm space-y-2">
                    <p>Para formalizarmos nossa parceria, por favor preencha as informações contidas neste link.</p>
                    <p>Desta forma seremos assertivos na condução de seu processo de onboarding no Monnera.</p>
                    <p className="font-medium">Seja bem-vindo!</p>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <p className="text-xs font-mono text-primary break-all">
                      {`${window.location.origin}/completar-cadastro/${detailLead.completion_token}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/completar-cadastro/${detailLead.completion_token}`);
                      toast.success("Link copiado!");
                    }}>
                      <Copy className="mr-1 h-3 w-3" /> Copiar
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <a href={`https://wa.me/?text=${encodeURIComponent(
                        `Para formalizarmos nossa parceria, por favor preencha as informações contidas neste link.\n\nDesta forma seremos assertivos na condução de seu processo de onboarding no Monnera.\n\nSeja bem-vindo!\n\n${window.location.origin}/completar-cadastro/${detailLead.completion_token}`
                      )}`} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-1 h-3 w-3" /> WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {detailLead.dados_completos && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Dados completos recebidos</span>
                  </div>
                </div>
              )}

              {/* Informações de Implantação */}
              {detailLead.dados_completos && detailLead.responsavel_tecnico_nome && (
                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Informações de Implantação</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Resp. Técnico</p>
                      <p>{detailLead.responsavel_tecnico_nome}</p>
                      <p className="text-xs text-muted-foreground">{detailLead.responsavel_tecnico_telefone}</p>
                      <p className="text-xs text-muted-foreground">{detailLead.responsavel_tecnico_email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Resp. Comercial</p>
                      <p>{detailLead.responsavel_comercial_nome}</p>
                      <p className="text-xs text-muted-foreground">{detailLead.responsavel_comercial_telefone}</p>
                      <p className="text-xs text-muted-foreground">{detailLead.responsavel_comercial_email}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Resp. RH</p>
                      <p>{detailLead.responsavel_rh_nome}</p>
                      <p className="text-xs text-muted-foreground">{detailLead.responsavel_rh_telefone}</p>
                      <p className="text-xs text-muted-foreground">{detailLead.responsavel_rh_email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Contract section */}
              {isConvertedOrBeyond(detailLead.status_lead) && (
                <div className="border-t border-border pt-4 space-y-4">
                  <h3 className="text-sm font-semibold">Contrato</h3>
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
                    <Button size="sm" variant="outline" onClick={() => handleSaveNumeroProposta(detailLead.id)}>
                      Salvar
                    </Button>
                  </div>
                  {detailLead.proposta_url && (
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openSignedUrl(detailLead.proposta_url)}>
                        <FileText className="mr-2 h-4 w-4" /> Ver Proposta
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => handleGenerateContract(detailLead)} disabled={generatingContract}>
                      {generatingContract ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                      {detailLead.contrato_url ? "Regerar Contrato" : "Gerar Contrato"}
                    </Button>
                    {detailLead.contrato_url && (
                      <Button size="sm" variant="outline" onClick={() => openSignedUrl(detailLead.contrato_url, `contrato-${detailLead.nome_fantasia}.docx`)}>
                        <Download className="mr-2 h-4 w-4" /> Download Contrato
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Dossiê download */}
              {detailLead.status_lead === "contrato_assinado" && (
                <div className="border-t border-border pt-4">
                  <Button size="sm" onClick={() => handleDownloadDossie(detailLead.id, detailLead.nome_fantasia)}>
                    <BookOpen className="mr-2 h-4 w-4" /> Baixar dossiê completo
                  </Button>
                </div>
              )}

              {/* Reuniões */}
              <div className="border-t border-border pt-4">
                <LeadReuniao
                  leadId={detailLead.id}
                  currentStage={detailLead.status_lead || "novo_lead"}
                  onMoveToRealizada={() => {
                    updateStatus(detailLead.id, "reuniao_realizada");
                  }}
                />
              </div>

              {/* Histórico de Conversa */}
              <div className="border-t border-border pt-4">
                <LeadComments
                  leadId={detailLead.id}
                  currentStage={detailLead.status_lead || "novo_lead"}
                  userName={currentUserName}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversion Link Dialog */}
      <Dialog open={conversionLinkOpen} onOpenChange={setConversionLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Link de Conversão Gerado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary rounded-lg p-4 text-sm space-y-2">
              <p>Para formalizarmos nossa parceria, por favor preencha as informações contidas neste link.</p>
              <p>Desta forma seremos assertivos na condução de seu processo de onboarding no Monnera.</p>
              <p className="font-medium">Seja bem-vindo!</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs font-mono text-primary break-all">{conversionLink}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(conversionLink);
                toast.success("Link copiado!");
              }}>
                <Copy className="mr-1 h-3 w-3" /> Copiar Link
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConversionLinkOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLeads;
