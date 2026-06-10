import { useState, useEffect } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  HEALTH_STATUS_ORDER, IMPACT_ORDER,
  healthStatusColor, impactColor,
  normalizeHealthStatus, normalizeImpact,
} from "@/lib/healthStatusColors";
import { LeadContatos } from "@/components/admin/LeadContatos";
import { LeadTasks } from "@/components/admin/LeadTasks";
import { DaysInStage } from "@/components/admin/DaysInStage";
import { PipelineKanban } from "@/components/admin/PipelineKanban";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/pipelineConstants";
import { cardActionUrl, createNotification } from "@/lib/notifications";
import { addBusinessHoursBR } from "@/lib/businessHours";
import {
  SUCESSO_STAGE_CRIACAO_CAMPANHA,
  CAMPANHAS_STAGE_CONSTRUCAO,
  CAMPANHAS_STAGE_AGUARDANDO_CLIENTE,
  CAMPANHAS_STAGE_CONCLUIDA,
  SLA_SUCESSO_TO_CAMPANHA_HOURS,
  SLA_CAMPANHAS_AGUARDANDO_CLIENTE_HOURS,
} from "@/lib/campaignFlow";
import { CampaignMoveDialog, CampanhaConcluidaDialog } from "@/components/admin/CampaignFlowDialogs";

type PipelineStage = { value: string; label: string; sort_order: number };

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
  Number(lead?.valor_mensalidade ?? 0) >= 0 &&
  (lead?.comissao_vitalicia || Number(lead?.qtd_parcelas ?? 0) > 0) &&
  Number(lead?.quantidade_lojas ?? 0) > 0 &&
  Number(lead?.valor_campanhas ?? 0) >= 0 &&
  lead?.valor_campanhas !== null && lead?.valor_campanhas !== undefined;

const AdminLeads = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { panelId: dynamicPanelId } = useParams();
  const location = useLocation();
  const { isAdmin } = useAuth();
  const painelTitleMap: Record<string, string> = {
    "/admin/painel-comercial": "Painel Comercial",
    "/admin/painel-onboarding": "Painel Onboarding / Integração",
    "/admin/painel-sucesso": "Painel Sucesso",
    "/admin/painel-campanhas": "Painel Criação Campanhas",
    "/admin/leads": "Painel Comercial",
  };
  const [allPanels, setAllPanels] = useState<{ id: string; name: string }[]>([]);
  const dynamicPanelName = allPanels.find((p) => p.id === dynamicPanelId)?.name;
  const painelTitle = dynamicPanelName || painelTitleMap[location.pathname] || "Painel Comercial";
  const [leads, setLeads] = useState<any[]>([]);
  const [stageMap, setStageMap] = useState<Record<string, string>>({});
  const [parceiros, setParceiros] = useState<Record<string, string>>({});
  const [parceirosAll, setParceirosAll] = useState<{ id: string; nome: string }[]>([]);
  const [usersAll, setUsersAll] = useState<{ user_id: string; nome: string }[]>([]);
  const [allActiveUsers, setAllActiveUsers] = useState<{ user_id: string; nome: string }[]>([]);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [savingNewCard, setSavingNewCard] = useState(false);
  const [newCardData, setNewCardData] = useState({ full_name: "", phone: "", email: "", city: "", state: "", region: "", responsible_user_id: "", canal_tracao: "" });
  const [reunioesMap, setReunioesMap] = useState<Record<string, any>>({});

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>(searchParams.get("status") || "all");
  const [filterConsultor, setFilterConsultor] = useState<string>("all");
  const [filterCs, setFilterCs] = useState<string>("all");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterResponsibleUser, setFilterResponsibleUser] = useState<string>("all");
  const [filterCampaignStatus, setFilterCampaignStatus] = useState<string>("all");
  const [filterImpactLevel, setFilterImpactLevel] = useState<string>("all");
  const [filterHealthStatus, setFilterHealthStatus] = useState<string>("all");
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
  const [isEditingCard, setIsEditingCard] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    nome_fantasia: string;
    descricao_necessidade: string;
    status_lead: string;
    cidade: string;
    nome_responsavel: string;
    responsible_user_id: string;
  }>({ nome_fantasia: "", descricao_necessidade: "", status_lead: "novo_lead", cidade: "", nome_responsavel: "", responsible_user_id: "" });

  // Reunião dialog
  const [reuniaoDialogOpen, setReuniaoDialogOpen] = useState(false);
  const [pendingReuniao, setPendingReuniao] = useState<{ leadId: string; leadName: string } | null>(null);
  const [reuniaoRealizadaOpen, setReuniaoRealizadaOpen] = useState(false);
  const [pendingReuniaoRealizada, setPendingReuniaoRealizada] = useState<{ leadId: string; leadName: string; lead?: any } | null>(null);
  const [savingReuniaoRealizada, setSavingReuniaoRealizada] = useState(false);
  const [reuniaoRealizadaForm, setReuniaoRealizadaForm] = useState({
    quantidade_lojas: "",
    erp_utilizado: "",
    numero_funcionarios: "",
    volume_premiacao_comissao: "",
    modelo_campanha: "",
    participantes_reuniao: "",
    cargo_participante: "",
    tipo_empresa: "",
    canal_tracao: "",
  });

  // Financial dialog
  const [financeiroDialogOpen, setFinanceiroDialogOpen] = useState(false);
  const [pendingFinanceiro, setPendingFinanceiro] = useState<{ leadId: string; leadName: string; parceiroId: string; nextStatus?: string; lead?: any } | null>(null);

  // Campaign flow dialogs
  const [campaignMoveOpen, setCampaignMoveOpen] = useState(false);
  const [pendingCampaignMove, setPendingCampaignMove] = useState<{ leadId: string; leadName: string; lead: any } | null>(null);
  const [campanhaConcluidaOpen, setCampanhaConcluidaOpen] = useState(false);
  const [pendingCampanhaConcluida, setPendingCampanhaConcluida] = useState<{ leadId: string; leadName: string } | null>(null);

  // Kanban toggle
  const [view, setView] = useState<"kanban" | "lista">("kanban");

  // User name for comments
  const [currentUserName, setCurrentUserName] = useState("Usuário");
  const [canCloneCard, setCanCloneCard] = useState(false);
  const [canEditCard, setCanEditCard] = useState(false);
  const [canDeleteCard, setCanDeleteCard] = useState(false);
  const [cloneLead, setCloneLead] = useState<any>(null);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [availablePanels, setAvailablePanels] = useState<{ id: string; name: string }[]>([]);
  const [targetPanelId, setTargetPanelId] = useState("");
  const [availableTargetStages, setAvailableTargetStages] = useState<{ value: string; label: string }[]>([]);
  const [targetStageId, setTargetStageId] = useState("");
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(PIPELINE_STAGES.map((s, i) => ({ ...s, sort_order: i + 1 })));
  const [syncingDrive, setSyncingDrive] = useState(false);

  const panelIdByPath: Record<string, string> = {
    "/admin/painel-comercial": "comercial",
    "/admin/painel-onboarding": "onboarding",
    "/admin/painel-sucesso": "sucesso",
    "/admin/painel-campanhas": "campanhas",
    "/admin/leads": "comercial",
  };
  const currentPanelId = dynamicPanelId || panelIdByPath[location.pathname] || "comercial";
  const painelTitleNormalized = painelTitle.toLowerCase();
  const isRepresentantesOuEmbaixadoresPanel =
    painelTitleNormalized.includes("representante") || painelTitleNormalized.includes("embaixador");
  const isCustomCrmPanel =
    isRepresentantesOuEmbaixadoresPanel &&
    !["comercial", "sucesso", "onboarding", "campanhas"].includes(currentPanelId);

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

  useEffect(() => {
    const loadClonePermissionAndPanels = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      if (isAdmin) {
        setCanCloneCard(true);
        setCanEditCard(true);
        setCanDeleteCard(true);
      } else {
        const { data: clonePermission } = await (supabase as any)
          .from("module_permissions")
          .select("permitido")
          .eq("user_id", auth.user.id)
          .eq("modulo", "pipeline")
          .eq("acao", "clonar_card")
          .maybeSingle();
        const { data: leadPermissions } = await (supabase as any)
          .from("module_permissions")
          .select("acao,permitido")
          .eq("user_id", auth.user.id)
          .eq("modulo", "leads")
          .in("acao", ["editar", "excluir"]);
        setCanCloneCard(!!clonePermission?.permitido);
        setCanEditCard(!!(leadPermissions || []).find((p: any) => p.acao === "editar" && p.permitido));
        setCanDeleteCard(!!(leadPermissions || []).find((p: any) => p.acao === "excluir" && p.permitido));
      }
      const { data: panels } = await (supabase as any)
        .from("pipeline_panels")
        .select("id,name")
        .order("sort_order", { ascending: true });
      const loadedPanels = (panels as { id: string; name: string }[]) || [];
      setAvailablePanels(loadedPanels);
      setAllPanels(loadedPanels);
    };
    loadClonePermissionAndPanels();
  }, [isAdmin]);

  const openCloneDialog = (lead: any) => {
    setCloneLead(lead);
    setTargetPanelId("");
    setTargetStageId("");
    setAvailableTargetStages([]);
    setCloneDialogOpen(true);
  };

  const loadTargetStages = async (panelId: string) => {
    if (!panelId) {
      setAvailableTargetStages([]);
      setTargetStageId("");
      return;
    }
    const { data } = await (supabase as any)
      .from("pipeline_stages_config")
      .select("value,label,sort_order")
      .eq("panel_key", panelId)
      .order("sort_order", { ascending: true });
    const stages = (data as { value: string; label: string }[]) || [];
    setAvailableTargetStages(stages);
    setTargetStageId(stages[0]?.value || "");
  };

  const handleCloneCard = async () => {
    if (!cloneLead || !targetPanelId || !targetStageId) return;
    setCloning(true);
    const payload = {
      nome_fantasia: cloneLead.nome_fantasia,
      nome_responsavel: cloneLead.nome_responsavel,
      telefone_responsavel: cloneLead.telefone_responsavel,
      email_responsavel: cloneLead.email_responsavel,
      cidade: cloneLead.cidade,
      quantidade_lojas: cloneLead.quantidade_lojas,
      erp_utilizado: cloneLead.erp_utilizado,
      parceiro_id: cloneLead.parceiro_id,
      descricao_necessidade: cloneLead.descricao_necessidade,
      valor_setup: cloneLead.valor_setup,
      valor_mensalidade: cloneLead.valor_mensalidade,
      valor_campanhas: cloneLead.valor_campanhas,
      status_lead: targetStageId,
      origem: `Clonado de ${cloneLead.nome_fantasia}`,
    };
    const { error } = await supabase.from("leads").insert(payload as any);
    setCloning(false);
    if (error) {
      toast.error("Erro ao clonar card: " + error.message);
      return;
    }
    toast.success("Card clonado com sucesso");
    setCloneDialogOpen(false);
    setCloneLead(null);
    setCloneLead(null);
    loadData();
  };

  const handleSyncDriveClients = async () => {
    setSyncingDrive(true);
    toast.loading("Atualizando dados do Drive...", { id: "sync-drive-clients" });
    try {
      const { data, error } = await supabase.functions.invoke("sync-drive-clients", { method: "POST" });
      if (error) throw error;
      if (data?.success === false) {
        console.error("[sync-drive-clients] resposta:", data);
        toast.error(data?.error || "Falha ao sincronizar Drive", { id: "sync-drive-clients" });
        return;
      }
      const summary = [
        `Linhas lidas: ${data?.total_rows_read ?? 0}`,
        `Clientes válidos: ${data?.valid_clients ?? 0}`,
        `Criados: ${data?.created ?? 0}`,
        `Atualizados: ${data?.updated ?? 0}`,
        `Ignorados: ${data?.skipped ?? 0}`,
      ].join(" | ");
      if (Array.isArray(data?.errors) && data.errors.length > 0) {
        toast.warning(`${summary} | Erros: ${data.errors.length}`, { id: "sync-drive-clients" });
      } else {
        toast.success(summary, { id: "sync-drive-clients" });
      }
      await loadData();
    } catch (error) {
      console.error("Erro técnico ao sincronizar Drive:", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao sincronizar Drive: ${message}`, { id: "sync-drive-clients" });
    } finally {
      setSyncingDrive(false);
    }
  };

  const loadData = async () => {
    const [leadsRes, parceirosRes, stageRes, reunioesRes, usersRes] = await Promise.all([
      isCustomCrmPanel
        ? (supabase as any).from("representative_cards").select("*").eq("panel_id", currentPanelId).order("created_at", { ascending: false })
        : supabase.from("leads").select("*").order("data_cadastro", { ascending: false }),
      supabase.from("parceiros_comerciais").select("id, nome"),
      supabase.from("lead_stage_history").select("lead_id, data_entrada").is("data_saida", null),
      supabase.from("reunioes").select("*").eq("realizada", false).order("data_reuniao", { ascending: true }),
      supabase.from("profiles").select("user_id,nome,ativo,can_be_responsible").eq("ativo", true).order("nome", { ascending: true }),
    ]);
    setLeads(leadsRes.data || []);
    const map: Record<string, string> = {};
    const list = parceirosRes.data || [];
    list.forEach((p: any) => { map[p.id] = p.nome; });
    setParceiros(map);
    setParceirosAll(list);
    const allUsers = ((usersRes.data as any) || []).map((u: any) => ({ user_id: u.user_id, nome: u.nome, can_be_responsible: !!u.can_be_responsible }));
    setAllActiveUsers(allUsers.map((u: any) => ({ user_id: u.user_id, nome: u.nome })));
    setUsersAll(allUsers.filter((u: any) => u.can_be_responsible).map((u: any) => ({ user_id: u.user_id, nome: u.nome })));

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
    const loadPipelineStages = async () => {
      const { data, error } = await (supabase as any)
        .from("pipeline_stages_config")
        .select("value,label,sort_order")
        .eq("panel_key", currentPanelId)
        .order("sort_order", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar colunas do painel");
        return;
      }

      if (data && data.length > 0) {
        setPipelineStages(data as PipelineStage[]);
      } else {
        setPipelineStages(PIPELINE_STAGES.map((stage, index) => ({ ...stage, sort_order: index + 1 })));
      }
    };

    loadPipelineStages();

    const channel = supabase
      .channel(`pipeline-stages-${currentPanelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pipeline_stages_config", filter: `panel_key=eq.${currentPanelId}` },
        () => loadPipelineStages()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentPanelId]);

  useEffect(() => {
    loadData();
  }, [isCustomCrmPanel, currentPanelId]);

  const formatCurrencyBRL = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const parseCurrencyBRL = (value: string) => {
    const normalized = value.replace(/[^\d,]/g, "").replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatCurrencyBRLInput = (value: string) => {
    const parsed = parseCurrencyBRL(value);
    return parsed == null ? "" : formatCurrencyBRL(parsed);
  };

  const formatCurrencyBRLFromNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? formatCurrencyBRL(parsed) : "";
  };

  const getTipoEmpresaLabel = (tipoEmpresa?: string | null) => {
    if (tipoEmpresa === "varejo") return "Varejo";
    if (tipoEmpresa === "distribuidor") return "Distribuidor";
    if (tipoEmpresa === "industria") return "Indústria";
    return "—";
  };

  useEffect(() => {
    const cardId = searchParams.get("card");
    if (!cardId || leads.length === 0) return;
    const lead = leads.find((item) => item.id === cardId);
    if (!lead) {
      toast.error("Você não tem acesso a este card ou painel.");
      const next = new URLSearchParams(searchParams);
      next.delete("card");
      next.delete("notification");
      setSearchParams(next, { replace: true });
      return;
    }
    openLeadDetail(lead);
    const notificationId = searchParams.get("notification");
    if (notificationId) {
      void (supabase as any).rpc("mark_notification_read", { p_notification_id: notificationId });
    }
  }, [leads, searchParams, setSearchParams]);

  const openReuniaoRealizadaDialog = (leadId: string, leadName: string, lead?: any) => {
    setPendingReuniaoRealizada({ leadId, leadName, lead });
    setReuniaoRealizadaForm({
      quantidade_lojas: lead?.quantidade_lojas ? String(lead.quantidade_lojas) : "",
      erp_utilizado: lead?.erp_utilizado || "",
      numero_funcionarios: lead?.numero_funcionarios || lead?.quantidade_funcionarios ? String(lead.numero_funcionarios || lead.quantidade_funcionarios) : "",
      volume_premiacao_comissao: formatCurrencyBRLFromNumber(lead?.volume_premiacao_comissao),
      modelo_campanha: lead?.modelo_campanha || "",
      participantes_reuniao: lead?.participantes_reuniao || "",
      cargo_participante: lead?.cargo_participante || "",
      tipo_empresa: lead?.tipo_empresa || "",
      canal_tracao: lead?.canal_tracao || "",
    });
    setReuniaoRealizadaOpen(true);
  };

  const handleStatusChange = (leadId: string, leadName: string, newStatus: string) => {
    const lead = leads.find((l) => l.id === leadId);

    // Sucesso → Criação Campanha: abrir modal de briefing obrigatório
    if (currentPanelId === "sucesso" && newStatus === SUCESSO_STAGE_CRIACAO_CAMPANHA) {
      setPendingCampaignMove({ leadId, leadName, lead });
      setCampaignMoveOpen(true);
      return;
    }

    // Campanhas → Aguardando cliente: tarefa 24h úteis automática
    if (currentPanelId === "campanhas" && newStatus === CAMPANHAS_STAGE_AGUARDANDO_CLIENTE) {
      void moveCampanhaToAguardandoCliente(leadId, leadName, newStatus);
      return;
    }

    // Campanhas → Concluída: exigir URL + comentário
    if (currentPanelId === "campanhas" && newStatus === CAMPANHAS_STAGE_CONCLUIDA) {
      setPendingCampanhaConcluida({ leadId, leadName });
      setCampanhaConcluidaOpen(true);
      return;
    }


    // Bloqueio financeiro: a partir de "Proposta Enviada" exigir dados completos
    if (FINANCEIRO_REQUIRED_FROM.includes(newStatus) && lead && !hasValidFinanceiro(lead)) {
      toast.warning("Preencha o financeiro para avançar este lead.");
      setPendingFinanceiro({ leadId, leadName, parceiroId: lead.parceiro_id || "", nextStatus: newStatus, lead });
      setFinanceiroDialogOpen(true);
      return;
    }

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
    if (newStatus === "reuniao_realizada") {
      openReuniaoRealizadaDialog(leadId, leadName, lead);
      return;
    }
    if (newStatus === "contrato_assinado") {
      if (lead && !lead.dados_completos) {
        toast.error("O cliente precisa preencher o formulário de cadastro completo antes de avançar para Contrato Assinado.");
        return;
      }
      // Reabrir modal financeiro para revisão (já tem dados válidos aqui)
      setPendingFinanceiro({ leadId, leadName, parceiroId: lead?.parceiro_id || "", nextStatus: "contrato_assinado", lead });
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

  const handleReuniaoRealizadaConfirm = async () => {
    if (!pendingReuniaoRealizada) return;
    const quantidadeLojas = parseInt(reuniaoRealizadaForm.quantidade_lojas);
    const numeroFuncionarios = parseInt(reuniaoRealizadaForm.numero_funcionarios);
    if (!quantidadeLojas || quantidadeLojas < 1) {
      toast.error("Número de lojas é obrigatório");
      return;
    }
    if (!reuniaoRealizadaForm.erp_utilizado.trim()) {
      toast.error("ERP é obrigatório");
      return;
    }
    if (!numeroFuncionarios || numeroFuncionarios < 1) {
      toast.error("Número de funcionários é obrigatório");
      return;
    }

    setSavingReuniaoRealizada(true);
    const volumePremiacaoComissao = parseCurrencyBRL(reuniaoRealizadaForm.volume_premiacao_comissao);
    const payload: any = {
      status_lead: "reuniao_realizada",
      quantidade_lojas: quantidadeLojas,
      erp_utilizado: reuniaoRealizadaForm.erp_utilizado.trim(),
      numero_funcionarios: numeroFuncionarios,
      quantidade_funcionarios: numeroFuncionarios,
      volume_premiacao_comissao: volumePremiacaoComissao,
      modelo_campanha: reuniaoRealizadaForm.modelo_campanha.trim() || null,
      participantes_reuniao: reuniaoRealizadaForm.participantes_reuniao.trim() || null,
      cargo_participante: reuniaoRealizadaForm.cargo_participante.trim() || null,
      tipo_empresa: reuniaoRealizadaForm.tipo_empresa || null,
      canal_tracao: reuniaoRealizadaForm.canal_tracao.trim() || null,
    };
    const { error } = await supabase.from("leads").update(payload).eq("id", pendingReuniaoRealizada.leadId);
    setSavingReuniaoRealizada(false);
    if (error) {
      toast.error("Erro ao salvar dados da reunião");
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === pendingReuniaoRealizada.leadId ? { ...l, ...payload } : l)));
    if (detailLead?.id === pendingReuniaoRealizada.leadId) {
      setDetailLead({ ...detailLead, ...payload });
    }
    setReuniaoRealizadaOpen(false);
    setPendingReuniaoRealizada(null);
    toast.success("Reunião realizada registrada");
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

  const handleFinanceiroSaved = (data: {
    valor_setup: number;
    valor_mensalidade: number;
    valor_campanhas: number;
    percentual_consultor: number;
    qtd_parcelas: number;
    comissao_vitalicia: boolean;
  }) => {
    if (!pendingFinanceiro) return;
    const { leadId, leadName, nextStatus } = pendingFinanceiro;

    // Atualiza estado local imediatamente para liberar bloqueio
    setLeads((prev) =>
      prev.map((l) => l.id === leadId
        ? { ...l, ...data, parcelas_pagas: 0 }
        : l
      )
    );
    if (detailLead?.id === leadId) {
      setDetailLead({ ...detailLead, ...data, parcelas_pagas: 0 });
    }
    setFinanceiroDialogOpen(false);
    setPendingFinanceiro(null);

    if (nextStatus === "contrato_assinado") {
      setTimeout(() => updateStatus(leadId, "contrato_assinado"), 0);
    } else if (nextStatus === "proposta_enviada" || nextStatus === "proposta_comercial") {
      setPendingStatusChange({ leadId, leadName });
      setUploadDialogOpen(true);
    } else if (nextStatus) {
      setTimeout(() => updateStatus(leadId, nextStatus), 0);
    }
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
      setConversionLeadName(lead?.nome_responsavel || lead?.full_name || "");
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
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
    if (detailLead?.id === id) {
      setDetailOpen(false);
      setDetailLead(null);
    }
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
    setIsEditingCard(false);
    setEditFormData({
      nome_fantasia: lead.nome_fantasia || "",
      descricao_necessidade: lead.descricao_necessidade || "",
      status_lead: lead.status_lead || lead.status || "novo_lead",
      cidade: lead.cidade || "",
      nome_responsavel: lead.nome_responsavel || "",
      responsible_user_id: lead.responsible_user_id || "",
    });
    setDetailOpen(true);
  };

  const startEditCard = (lead: any) => {
    if (!canEditCard && !isAdmin) return;
    setDetailLead(lead);
    setEditFormData({
      nome_fantasia: lead.nome_fantasia || "",
      descricao_necessidade: lead.descricao_necessidade || "",
      status_lead: lead.status_lead || lead.status || "novo_lead",
      cidade: lead.cidade || "",
      nome_responsavel: lead.nome_responsavel || "",
      responsible_user_id: lead.responsible_user_id || "",
    });
    setIsEditingCard(true);
    setDetailOpen(true);
  };

  const cancelEditCard = () => {
    if (!detailLead) return;
    setEditFormData({
      nome_fantasia: detailLead.nome_fantasia || "",
      descricao_necessidade: detailLead.descricao_necessidade || "",
      status_lead: detailLead.status_lead || detailLead.status || "novo_lead",
      cidade: detailLead.cidade || "",
      nome_responsavel: detailLead.nome_responsavel || "",
      responsible_user_id: detailLead.responsible_user_id || "",
    });
    setIsEditingCard(false);
  };

  const saveEditedCard = async () => {
    if (!detailLead) return;
    if (!canEditCard && !isAdmin) {
      toast.error("Sem permissão para editar");
      return;
    }
    const nome = editFormData.nome_fantasia.trim();
    if (!nome) {
      toast.error("Título é obrigatório");
      return;
    }
    setSavingCard(true);
    const payload = {
      nome_fantasia: nome,
      descricao_necessidade: editFormData.descricao_necessidade.trim(),
      cidade: editFormData.cidade.trim(),
      nome_responsavel: editFormData.nome_responsavel?.trim() || null,
      responsible_user_id: editFormData.responsible_user_id || null,
    };
    const previousResponsibleUserId = detailLead.responsible_user_id || null;
    const { error } = await supabase.from("leads").update(payload).eq("id", detailLead.id);
    setSavingCard(false);
    if (error) {
      toast.error("Erro ao salvar card");
      return;
    }
    const merged = { ...detailLead, ...payload };
    setDetailLead(merged);
    setLeads((prev) => prev.map((l) => (l.id === detailLead.id ? { ...l, ...payload } : l)));
    setIsEditingCard(false);
    if (payload.responsible_user_id && payload.responsible_user_id !== previousResponsibleUserId) {
      await createNotification({
        recipientUserId: payload.responsible_user_id,
        type: "card_responsible_assigned",
        title: "Você foi definido como responsável",
        message: `Você agora é responsável pelo card ${payload.nome_fantasia}.`,
        leadId: detailLead.id,
        actionUrl: cardActionUrl(detailLead.id),
        metadata: { previous_responsible_user_id: previousResponsibleUserId },
        deliveryKey: `lead-${detailLead.id}-responsible-${payload.responsible_user_id}-${Date.now()}`,
      });
    }
    toast.success("Card atualizado");
  };

  const createRepresentativeCard = async () => {
    const fullName = newCardData.full_name.trim();
    const phone = newCardData.phone.trim();
    const email = newCardData.email.trim().toLowerCase();
    if (!fullName || !phone || !email || !newCardData.responsible_user_id) return toast.error("Nome completo, telefone, e-mail e responsável são obrigatórios.");
    if (!usersAll.some((u) => u.user_id === newCardData.responsible_user_id)) return toast.error("Usuário selecionado não possui permissão para ser responsável.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Formato de e-mail inválido.");

    const { data: duplicate } = await (supabase as any)
      .from("representative_cards")
      .select("id")
      .eq("panel_id", currentPanelId)
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1);
    if (duplicate && duplicate.length > 0) return toast.error("Já existe cadastro com este telefone ou e-mail.");

    const firstStage = pipelineStages[0]?.value;
    if (!firstStage) return toast.error("Não há colunas configuradas para este painel.");

    setSavingNewCard(true);
    const auth = await supabase.auth.getUser();
    const payload: any = {
      panel_id: currentPanelId,
      stage_id: firstStage,
      full_name: fullName,
      phone,
      email,
      city: newCardData.city.trim() || null,
      state: newCardData.state.trim() || null,
      region: newCardData.region.trim() || null,
      source: newCardData.canal_tracao.trim() || null,
      responsible_user_id: newCardData.responsible_user_id,
      created_by_user_id: auth.data.user?.id,
    };
    const { data, error } = await (supabase as any).from("representative_cards").insert(payload).select("*").single();
    setSavingNewCard(false);
    if (error) return toast.error("Erro ao salvar cadastro: " + error.message);
    toast.success("Cadastro salvo com sucesso.");
    setNewCardOpen(false);
    setNewCardData({ full_name: "", phone: "", email: "", city: "", state: "", region: "", responsible_user_id: "", canal_tracao: "" });
    if (data) {
      setLeads((prev) => [{ ...payload, id: data.id, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev]);
    } else {
      loadData();
    }
  };

  const updateRepresentativeCard = async (id: string, payload: Record<string, any>) =>
    (supabase as any).from("representative_cards").update(payload).eq("id", id);

  const moveRepresentativeCard = async (id: string, stageId: string) =>
    updateRepresentativeCard(id, { stage_id: stageId });

  // Apply filters
  const filtered = leads.filter((l) => {
    if (filterStatus !== "all" && (l.status_lead || l.status) !== filterStatus) return false;
    if (currentPanelId !== "sucesso" && filterConsultor !== "all" && l.parceiro_id !== filterConsultor) return false;
    if (currentPanelId === "sucesso" && filterCs !== "all" && (l.consultor || "") !== filterCs) return false;
    if (filterEmpresa && !((l.full_name || l.nome_fantasia) || "").toLowerCase().includes(filterEmpresa.toLowerCase())) return false;
    if (isCustomCrmPanel && filterResponsibleUser !== "all" && l.responsible_user_id !== filterResponsibleUser) return false;
    if (currentPanelId === "sucesso" && filterCampaignStatus !== "all" && (l.campaign_status_current || "SEM_STATUS") !== filterCampaignStatus) return false;
    if (currentPanelId === "sucesso" && filterImpactLevel !== "all" && normalizeImpact(l.impact_level) !== filterImpactLevel) return false;
    if (currentPanelId === "sucesso" && filterHealthStatus !== "all" && normalizeHealthStatus(l.health_status) !== filterHealthStatus) return false;
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

  // Status counts (refletem todos os filtros, exceto o próprio filterStatus)
  const filteredExceptStatus = leads.filter((l) => {
    if (currentPanelId !== "sucesso" && filterConsultor !== "all" && l.parceiro_id !== filterConsultor) return false;
    if (currentPanelId === "sucesso" && filterCs !== "all" && (l.consultor || "") !== filterCs) return false;
    if (filterEmpresa && !((l.full_name || l.nome_fantasia) || "").toLowerCase().includes(filterEmpresa.toLowerCase())) return false;
    if (isCustomCrmPanel && filterResponsibleUser !== "all" && l.responsible_user_id !== filterResponsibleUser) return false;
    if (currentPanelId === "sucesso" && filterCampaignStatus !== "all" && (l.campaign_status_current || "SEM_STATUS") !== filterCampaignStatus) return false;
    if (currentPanelId === "sucesso" && filterImpactLevel !== "all" && normalizeImpact(l.impact_level) !== filterImpactLevel) return false;
    if (currentPanelId === "sucesso" && filterHealthStatus !== "all" && normalizeHealthStatus(l.health_status) !== filterHealthStatus) return false;
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
  const statusCounts: Record<string, number> = {};
  pipelineStages.forEach((s) => { statusCounts[s.value] = 0; });
  filteredExceptStatus.forEach((l) => {
    const s = l.status_lead || l.status || "novo_lead";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });

  const isConvertedOrBeyond = (status: string) =>
    ["lead_convertido", "contrato_enviado", "contrato_assinado"].includes(status);

  const fmt = formatCurrencyBRL;

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
            {pipelineStages.map((s) => (
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-display font-bold">{painelTitle}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden lg:inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
            >Kanban</button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`px-3 py-1.5 transition-colors ${view === "lista" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
            >Lista</button>
          </div>
          {currentPanelId !== "sucesso" && (
            <>
              <LeadExportButton
                leads={filtered}
                parceiros={parceiros}
                customCrmMode={isCustomCrmPanel}
                users={Object.fromEntries(allActiveUsers.map((u) => [u.user_id, u.nome]))}
              />
              <LeadImportDialog
                parceiros={parceirosAll}
                onImported={loadData}
                customCrmMode={isCustomCrmPanel}
                users={usersAll}
                panelId={currentPanelId}
                firstStageId={pipelineStages[0]?.value}
              />
            </>
          )}
          {isCustomCrmPanel && (
            <Button onClick={() => setNewCardOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              + Card
            </Button>
          )}
          {currentPanelId === "sucesso" && (
            <Button
              onClick={handleSyncDriveClients}
              disabled={syncingDrive}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {syncingDrive ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Atualizar
            </Button>
          )}
        </div>
      </div>

      {/* Status cards */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:overflow-visible">
        {pipelineStages.map((s) => (
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2 sm:gap-3">
        <Input placeholder="Filtrar por empresa..." value={filterEmpresa} onChange={(e) => setFilterEmpresa(e.target.value)} />
        {currentPanelId === "sucesso" ? (
          <Select value={filterCs} onValueChange={setFilterCs}>
            <SelectTrigger><SelectValue placeholder="CS" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos CS</SelectItem>
              {Array.from(new Set(leads.map((l) => (l.consultor || "").trim()).filter(Boolean)))
                .sort((a, b) => a.localeCompare(b, "pt-BR"))
                .map((cs) => (
                  <SelectItem key={cs} value={cs}>{cs}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : isCustomCrmPanel ? (
          <Select value={filterResponsibleUser} onValueChange={setFilterResponsibleUser}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              {usersAll.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={filterConsultor} onValueChange={setFilterConsultor}>
            <SelectTrigger><SelectValue placeholder="Embaixador Monnera" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Embaixadores Monnera</SelectItem>
              {parceirosAll.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {currentPanelId === "sucesso" && (
          <Select value={filterCampaignStatus} onValueChange={setFilterCampaignStatus}>
            <SelectTrigger><SelectValue placeholder="Status Campanha" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status Campanha (Todos)</SelectItem>
              {Array.from(new Set(leads.map((l) => l.campaign_status_current || "SEM_STATUS"))).map((status) => (
                <SelectItem key={status} value={status}>{status === "SEM_STATUS" ? "Sem status" : status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {currentPanelId === "sucesso" && (
          <Select value={filterImpactLevel} onValueChange={setFilterImpactLevel}>
            <SelectTrigger><SelectValue placeholder="Impacto" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Impacto (Todos)</SelectItem>
              {IMPACT_ORDER.filter((k) => leads.some((l) => normalizeImpact(l.impact_level) === k)).map((k) => {
                const c = impactColor(k);
                return (
                  <SelectItem key={k} value={k}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        {currentPanelId === "sucesso" && (
          <Select value={filterHealthStatus} onValueChange={setFilterHealthStatus}>
            <SelectTrigger><SelectValue placeholder="Status Cliente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status Cliente (Todos)</SelectItem>
              {HEALTH_STATUS_ORDER.filter((k) => leads.some((l) => normalizeHealthStatus(l.health_status) === k)).map((k) => {
                const c = healthStatusColor(k);
                return (
                  <SelectItem key={k} value={k}>
                    <span className="inline-flex items-center gap-2">
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: c.hex }} />
                      {c.label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
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
                  {canCloneCard && (
                    <Button variant="ghost" size="icon" onClick={() => openCloneDialog(l)} title="Clonar card" className="h-8 w-8">
                      <Copy className="h-4 w-4" />
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
                    {pipelineStages.map((s) => (
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

      {/* Desktop Kanban */}
      {view === "kanban" && (
        <div className="hidden lg:block">
          <PipelineKanban
            leads={filtered}
            stages={pipelineStages}
            parceirosMap={parceiros}
            showCampaignStatus={currentPanelId === "sucesso"}
            showCsInsteadOfPartner={currentPanelId === "sucesso"}
            canCloneCard={canCloneCard}
            canEditCard={canEditCard}
            canDeleteCard={canDeleteCard}
            onCloneCard={(lead) => openCloneDialog(lead)}
            onEditCard={(lead) => startEditCard(lead)}
            onDeleteCard={(lead) => handleDelete(lead.id, lead.nome_fantasia)}
            onAssignResponsible={(lead) => startEditCard(lead)}
            onMoveLead={(id, newStage) => {
              const lead = leads.find((l) => l.id === id);
              if (!lead) return;
              if (isCustomCrmPanel) {
                moveRepresentativeCard(id, newStage).then(({ error }: any) => {
                  if (error) return toast.error("Erro ao mover card: " + error.message);
                  setLeads((prev) => prev.map((p) => (p.id === id ? { ...p, stage_id: newStage } : p)));
                  toast.success("Card movido com sucesso");
                });
                return;
              }
              handleStatusChange(id, lead.nome_fantasia, newStage);
            }}
            onOpenLead={(l) => openLeadDetail(l)}
          />
        </div>
      )}

      {/* Desktop table */}
      <Card className={`border-border hidden ${view === "lista" ? "lg:block" : ""}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Embaixador Monnera</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Empresa</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cidade</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Responsável</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Telefone</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Pipeline</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Docs</th>
                  {(isAdmin || canCloneCard) && <th className="text-left py-3 px-4 text-muted-foreground font-medium"></th>}
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
                    {(isAdmin || canCloneCard) && (
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {canCloneCard && (
                            <Button variant="ghost" size="icon" onClick={() => openCloneDialog(l)} title="Clonar card">
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(l.id, l.nome_fantasia)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

      <Dialog open={reuniaoRealizadaOpen} onOpenChange={setReuniaoRealizadaOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dados da reunião realizada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Lead: <strong>{pendingReuniaoRealizada?.leadName || "—"}</strong></p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Número de lojas *</Label>
              <Input type="number" min="1" value={reuniaoRealizadaForm.quantidade_lojas} onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, quantidade_lojas: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>ERP *</Label>
              <Input value={reuniaoRealizadaForm.erp_utilizado} onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, erp_utilizado: e.target.value }))} placeholder="Ex: Trier, Linx" />
            </div>
            <div className="space-y-1.5">
              <Label>Número de funcionários *</Label>
              <Input type="number" min="1" value={reuniaoRealizadaForm.numero_funcionarios} onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, numero_funcionarios: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Volume pago em premiação / comissão</Label>
              <Input
                inputMode="numeric"
                value={reuniaoRealizadaForm.volume_premiacao_comissao}
                onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, volume_premiacao_comissao: e.target.value.replace(/[^\d]/g, "") }))}
                onFocus={(e) => {
                  const parsed = parseCurrencyBRL(e.target.value);
                  setReuniaoRealizadaForm((p) => ({ ...p, volume_premiacao_comissao: parsed == null ? "" : String(Math.round(parsed)) }));
                }}
                onBlur={(e) => setReuniaoRealizadaForm((p) => ({ ...p, volume_premiacao_comissao: formatCurrencyBRLInput(e.target.value) }))}
                placeholder="R$ 250.000,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo de campanha</Label>
              <Input value={reuniaoRealizadaForm.modelo_campanha} onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, modelo_campanha: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Canal de tração</Label>
              <Input value={reuniaoRealizadaForm.canal_tracao} onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, canal_tracao: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de empresa</Label>
              <Select value={reuniaoRealizadaForm.tipo_empresa || "nao_informado"} onValueChange={(value) => setReuniaoRealizadaForm((p) => ({ ...p, tipo_empresa: value === "nao_informado" ? "" : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Não informado</SelectItem>
                  <SelectItem value="varejo">Varejo</SelectItem>
                  <SelectItem value="distribuidor">Distribuidor</SelectItem>
                  <SelectItem value="industria">Indústria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ramo de atuação</Label>
              <Input value={reuniaoRealizadaForm.cargo_participante} onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, cargo_participante: e.target.value }))} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Quem participou da reunião</Label>
              <textarea
                value={reuniaoRealizadaForm.participantes_reuniao}
                onChange={(e) => setReuniaoRealizadaForm((p) => ({ ...p, participantes_reuniao: e.target.value.slice(0, 500) }))}
                className="min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setReuniaoRealizadaOpen(false); setPendingReuniaoRealizada(null); }} disabled={savingReuniaoRealizada}>Cancelar</Button>
            <Button onClick={handleReuniaoRealizadaConfirm} disabled={savingReuniaoRealizada}>
              {savingReuniaoRealizada ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar e mover
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cadastro Financeiro Dialog */}
      <CadastroFinanceiroDialog
        open={financeiroDialogOpen}
        onOpenChange={setFinanceiroDialogOpen}
        leadId={pendingFinanceiro?.leadId || ""}
        leadName={pendingFinanceiro?.leadName || ""}
        parceiroId={pendingFinanceiro?.parceiroId || ""}
        parceiros={parceirosAll}
        initialData={pendingFinanceiro?.lead ? {
          valor_setup: pendingFinanceiro.lead.valor_setup,
          valor_mensalidade: pendingFinanceiro.lead.valor_mensalidade,
          valor_campanhas: pendingFinanceiro.lead.valor_campanhas,
          qtd_parcelas: pendingFinanceiro.lead.qtd_parcelas,
          quantidade_lojas: pendingFinanceiro.lead.quantidade_lojas,
          percentual_consultor: pendingFinanceiro.lead.percentual_consultor,
          comissao_vitalicia: pendingFinanceiro.lead.comissao_vitalicia,
        } : undefined}
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
              {isEditingCard && (
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={cancelEditCard} disabled={savingCard}>Cancelar</Button>
                  <Button size="sm" onClick={saveEditedCard} disabled={savingCard}>
                    {savingCard ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Salvar
                  </Button>
                </div>
              )}
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
                  {isEditingCard ? (
                    <Input value={editFormData.cidade} onChange={(e) => setEditFormData((prev) => ({ ...prev, cidade: e.target.value }))} />
                  ) : (
                    <p>{detailLead.cidade || "—"}</p>
                  )}
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
                  <p>{detailLead.numero_funcionarios || detailLead.quantidade_funcionarios || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Tipo de empresa</p>
                  <p>{getTipoEmpresaLabel(detailLead.tipo_empresa)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Canal de tração</p>
                  <p>{detailLead.canal_tracao || "—"}</p>
                </div>
              </div>

              {(detailLead.modelo_campanha || detailLead.volume_premiacao_comissao || detailLead.participantes_reuniao || detailLead.cargo_participante) && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-3">Dados da reunião comercial</h3>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Volume em premiação / comissão</p>
                      <p>{detailLead.volume_premiacao_comissao != null ? fmt(detailLead.volume_premiacao_comissao) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Modelo de campanha</p>
                      <p>{detailLead.modelo_campanha || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Participantes</p>
                      <p>{detailLead.participantes_reuniao || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Ramo de atuação</p>
                      <p>{detailLead.cargo_participante || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Responsável */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Responsável</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Nome</p>
                    {isEditingCard ? (
                      <Input
                        value={editFormData.nome_responsavel}
                        onChange={(e) => setEditFormData((prev) => ({ ...prev, nome_responsavel: e.target.value }))}
                        placeholder="Responsável pelo card"
                      />
                    ) : (
                      <p>{detailLead.nome_responsavel || "—"}</p>
                    )}
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

              {/* Embaixador Monnera */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Embaixador Monnera</h3>
                <p className="text-sm">{parceiros[detailLead.parceiro_id] || "—"}</p>
              </div>

              {/* Pipeline Status */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Pipeline</h3>
                <div className="flex flex-wrap gap-2">
                  {pipelineStages.map((s) => {
                    const currentStatus = detailLead.status_lead || "novo_lead";
                    const currentIdx = pipelineStages.findIndex((st) => st.value === currentStatus);
                    const thisIdx = pipelineStages.findIndex((st) => st.value === s.value);
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
                {isEditingCard && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Para mover o card de etapa, use o Kanban ou o seletor de status na lista — assim as regras (financeiro, reunião, proposta, perda) são aplicadas.
                  </p>
                )}
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-2">Título e descrição</h3>
                {isEditingCard ? (
                  <div className="space-y-2">
                    <Input value={editFormData.nome_fantasia} onChange={(e) => setEditFormData((prev) => ({ ...prev, nome_fantasia: e.target.value }))} />
                    <textarea
                      value={editFormData.descricao_necessidade}
                      onChange={(e) => setEditFormData((prev) => ({ ...prev, descricao_necessidade: e.target.value }))}
                      className="w-full min-h-[110px] rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                    <Select value={editFormData.responsible_user_id} onValueChange={(value) => setEditFormData((prev) => ({ ...prev, responsible_user_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Responsável pelo card" />
                      </SelectTrigger>
                      <SelectContent>
                        {usersAll.map((u) => (
                          <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{detailLead.descricao_necessidade || "—"}</p>
                )}
              </div>

              {/* Valor Campanhas */}
              {detailLead.valor_campanhas != null && (
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold mb-2">Valor Médio de Campanhas</h3>
                  <p className="text-lg font-bold font-display">{fmt(detailLead.valor_campanhas)}</p>
                </div>
              )}

              {/* Financial Info */}
              {detailLead.valor_mensalidade != null && (
                <div className="border-t border-border pt-4 space-y-3">
                  <h3 className="text-sm font-semibold">Informações Financeiras</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Comissão mensal</p>
                      <p className="font-medium">{fmt((detailLead.valor_mensalidade || 0) * (detailLead.percentual_consultor || 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Parcelas contratadas</p>
                      <p className="font-medium">{detailLead.comissao_vitalicia ? "Vitalício" : detailLead.qtd_parcelas || 0}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Valor total do contrato</p>
                      <p className="font-bold">{detailLead.comissao_vitalicia ? "Não aplicável" : fmt((detailLead.valor_mensalidade || 0) * (detailLead.percentual_consultor || 0) * (detailLead.qtd_parcelas || 0))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs mb-1">Embaixador Monnera responsável</p>
                      <p className="font-medium">{parceiros[detailLead.parceiro_id] || "—"}</p>
                    </div>
                  </div>
                  {!detailLead.comissao_vitalicia && (
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
                  )}
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
                    handleStatusChange(detailLead.id, detailLead.nome_fantasia, "reuniao_realizada");
                  }}
                />
              </div>

              {/* Contatos do Lead */}
              <div className="border-t border-border pt-4">
                <LeadContatos leadId={detailLead.id} />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold mb-3">Tarefas do card</h3>
                <LeadTasks leadId={detailLead.id} leadName={detailLead.nome_fantasia} />
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

      <Dialog open={newCardOpen} onOpenChange={setNewCardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo cadastro</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input className="sm:col-span-2" placeholder="Nome completo *" value={newCardData.full_name} onChange={(e) => setNewCardData((p) => ({ ...p, full_name: e.target.value }))} />
            <Input placeholder="Telefone *" value={newCardData.phone} onChange={(e) => setNewCardData((p) => ({ ...p, phone: e.target.value }))} />
            <Input placeholder="E-mail *" value={newCardData.email} onChange={(e) => setNewCardData((p) => ({ ...p, email: e.target.value }))} />
            <Input placeholder="Cidade" value={newCardData.city} onChange={(e) => setNewCardData((p) => ({ ...p, city: e.target.value }))} />
            <Input placeholder="Estado" value={newCardData.state} onChange={(e) => setNewCardData((p) => ({ ...p, state: e.target.value }))} />
            <Input placeholder="Região de atuação" value={newCardData.region} onChange={(e) => setNewCardData((p) => ({ ...p, region: e.target.value }))} />
            <Input className="sm:col-span-2" placeholder="Canal de tração" value={newCardData.canal_tracao} onChange={(e) => setNewCardData((p) => ({ ...p, canal_tracao: e.target.value }))} />
            
            <Select value={newCardData.responsible_user_id} onValueChange={(v) => setNewCardData((p) => ({ ...p, responsible_user_id: v }))}>
              <SelectTrigger className="sm:col-span-2"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {usersAll.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createRepresentativeCard} disabled={savingNewCard} className="w-full">
            {savingNewCard ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clonar card</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Uma cópia de <span className="font-medium text-foreground">{cloneLead?.nome_fantasia}</span> será criada no painel/etapa selecionados.
            </p>
            <Select value={targetPanelId} onValueChange={(value) => { setTargetPanelId(value); loadTargetStages(value); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o painel de destino" />
              </SelectTrigger>
              <SelectContent>
                {availablePanels.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={targetStageId} onValueChange={setTargetStageId} disabled={!targetPanelId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a etapa de destino" />
              </SelectTrigger>
              <SelectContent>
                {availableTargetStages.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCloneDialogOpen(false)} disabled={cloning}>Cancelar</Button>
              <Button onClick={handleCloneCard} disabled={cloning || !targetPanelId || !targetStageId}>
                {cloning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirmar
              </Button>
            </div>
          </div>
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
