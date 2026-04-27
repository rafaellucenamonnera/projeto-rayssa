import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Link2, Users, LogOut, Loader2, MessageCircle, Mail, CalendarCheck, FileText, UserCheck, ChevronLeft, PhoneCall, FileSignature, Plus, XCircle, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/pipelineConstants";
import { AddLeadDialog } from "@/components/parceiro/AddLeadDialog";
import { DaysInStage } from "@/components/admin/DaysInStage";
import { KitVendasSection } from "@/components/parceiro/KitVendasSection";

const PainelParceiro = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const [parceiro, setParceiro] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [stageMap, setStageMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get("status"));
  const [addLeadOpen, setAddLeadOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      localStorage.removeItem("monnera_parceiro");
      navigate("/login");
      return;
    }

    const loadData = async () => {
      const { data: p } = await supabase
        .from("parceiros_comerciais")
        .select("*")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (!p) { navigate("/login"); return; }
      if (!p.aprovado) {
        toast.error("Seu cadastro está pendente de aprovação.");
        await supabase.auth.signOut();
        navigate("/login");
        return;
      }

      setParceiro(p);
      localStorage.setItem("monnera_parceiro", JSON.stringify({
        id: p.id,
        nome: p.nome,
        codigo_parceiro: p.codigo_parceiro,
        slug_consultor: p.slug_consultor,
      }));

      const [leadsRes, stageRes] = await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .eq("parceiro_id", p.id)
          .order("data_cadastro", { ascending: false }),
        supabase
          .from("lead_stage_history")
          .select("lead_id, data_entrada")
          .is("data_saida", null),
      ]);
      setLeads(leadsRes.data || []);
      const sm: Record<string, string> = {};
      (stageRes.data || []).forEach((s: any) => { sm[s.lead_id] = s.data_entrada; });
      setStageMap(sm);
      setLoading(false);
    };
    loadData();
  }, [user, authLoading, navigate]);

  if (authLoading || loading || !parceiro) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const slug = parceiro.slug_consultor;
  const linkIndicacao = slug
    ? `${window.location.origin}/indicacao/${slug}`
    : `${window.location.origin}/lead/${parceiro.codigo_parceiro}`;

  const copyLink = () => {
    navigator.clipboard.writeText(linkIndicacao);
    toast.success("Link copiado!");
  };

  const whatsappMsg = encodeURIComponent(
    `Olá!\n\nGostaria de apresentar o Monnera.\n\nUma plataforma que ajuda empresas a aumentar vendas através de campanhas de incentivo com segurança trabalhista e tributária.\n\nSe fizer sentido para sua empresa, você pode preencher rapidamente neste link:\n\n${linkIndicacao}`
  );

  const emailSubject = encodeURIComponent("Conheça o Monnera");
  const emailBody = encodeURIComponent(
    `Gostaria de apresentar o Monnera.\n\nUma plataforma que ajuda empresas a aumentar vendas através de campanhas de incentivo com segurança trabalhista e tributária.\n\nCaso tenha interesse, preencha rapidamente neste link:\n\n${linkIndicacao}`
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  // Status counts
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const leadsThisMonth = leads.filter((l) => new Date(l.data_cadastro) >= startOfMonth).length;
  const statusCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => { statusCounts[s.value] = 0; });
  leads.forEach((l) => {
    const s = l.status_lead || l.status || "novo_lead";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });

  const filteredLeads = statusFilter
    ? leads.filter((l) => (l.status_lead || l.status) === statusFilter)
    : leads;

  const handleStatusClick = (status: string) => {
    if (statusFilter === status) {
      setStatusFilter(null);
      setSearchParams({});
    } else {
      setStatusFilter(status);
      setSearchParams({ status });
    }
  };

  const reloadLeads = async () => {
    const [leadsRes, stageRes] = await Promise.all([
      supabase.from("leads").select("*").eq("parceiro_id", parceiro.id).order("data_cadastro", { ascending: false }),
      supabase.from("lead_stage_history").select("lead_id, data_entrada").is("data_saida", null),
    ]);
    setLeads(leadsRes.data || []);
    const sm: Record<string, string> = {};
    (stageRes.data || []).forEach((s: any) => { sm[s.lead_id] = s.data_entrada; });
    setStageMap(sm);
  };

  const statCards = [
    { label: "Leads Indicados", value: leads.length, icon: Users, status: null },
    { label: "Leads este mês", value: leadsThisMonth, icon: CalendarCheck, status: null },
    { label: "Contato Realizado", value: statusCounts.contato_realizado, icon: PhoneCall, status: "contato_realizado" },
    { label: "Reuniões Agendadas", value: statusCounts.reuniao_agendada, icon: CalendarCheck, status: "reuniao_agendada" },
    { label: "Propostas Enviadas", value: statusCounts.proposta_enviada, icon: FileText, status: "proposta_enviada" },
    { label: "Convertidos", value: statusCounts.lead_convertido, icon: UserCheck, status: "lead_convertido" },
    { label: "Contratos Assinados", value: statusCounts.contrato_assinado, icon: FileSignature, status: "contrato_assinado" },
    { label: "Perdidos", value: statusCounts.lead_perdido || 0, icon: XCircle, status: "lead_perdido" },
  ];

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold truncate">Painel do Consultor</h1>
            <p className="text-sm text-muted-foreground truncate">Olá, {parceiro.nome}!</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" onClick={() => setAddLeadOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Adicionar Lead</span><span className="sm:hidden">Lead</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>

        {/* Stat Cards - scrollable on mobile */}
        <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:overflow-visible">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`stat-card !p-3 sm:!p-4 cursor-pointer transition-all min-w-[100px] sm:min-w-0 shrink-0 sm:shrink ${statusFilter === card.status && card.status ? "ring-2 ring-primary" : ""}`}
              onClick={() => card.status && handleStatusClick(card.status)}
            >
              <div className="flex flex-col items-center text-center gap-1">
                <card.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{card.label}</p>
                <p className="text-xl sm:text-2xl font-display font-bold">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Share Link */}
        <Card className="border-border">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-display flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary shrink-0" />
              Meu Link de Indicação
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-3 sm:space-y-4">
            <div className="bg-secondary rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm font-mono text-primary break-all">{linkIndicacao}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" size="sm" onClick={copyLink} className="w-full sm:w-auto">
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <a href={`https://wa.me/?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                <a href={`mailto:?subject=${emailSubject}&body=${emailBody}`}>
                  <Mail className="mr-2 h-4 w-4" /> Email
                </a>
              </Button>
              <Button size="sm" asChild className="w-full sm:w-auto sm:ml-auto">
                <a href="https://calendar.app.google/wzotf4LMLcW1vKwo6" target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="mr-2 h-4 w-4" /> Agende para o time Monnera
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Kit de Vendas */}
        <KitVendasSection />

        {/* Leads */}
        <Card className="border-border">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg font-display">
              {statusFilter ? (
                <span className="flex items-center gap-2">
                  <button onClick={() => { setStatusFilter(null); setSearchParams({}); }} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {PIPELINE_LABELS[statusFilter] || statusFilter}
                </span>
              ) : "Meus Leads"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {filteredLeads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">
                {statusFilter ? "Nenhum lead neste estágio." : "Nenhum lead cadastrado ainda. Compartilhe seu link para começar!"}
              </p>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="space-y-3 md:hidden">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="bg-secondary/50 rounded-lg p-3 space-y-2 border border-border/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{lead.nome_fantasia}</p>
                          <p className="text-xs text-muted-foreground">{lead.cidade}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary whitespace-nowrap shrink-0">
                          {PIPELINE_LABELS[lead.status_lead || lead.status] || "Lead"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        <div>
                          <span className="text-muted-foreground">Responsável: </span>
                          <span>{lead.nome_responsavel}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tel: </span>
                          <span>{lead.telefone_responsavel}</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-between">
                          <span>
                            <span className="text-muted-foreground">Data: </span>
                            <span>{new Date(lead.data_cadastro).toLocaleDateString("pt-BR")}</span>
                          </span>
                          <DaysInStage dataEntrada={stageMap[lead.id]} compact />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Empresa</th>
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Cidade</th>
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Responsável</th>
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Telefone</th>
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                        <th className="text-left py-3 px-2 text-muted-foreground font-medium">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-border/50 hover:bg-secondary/50">
                          <td className="py-3 px-2">{lead.nome_fantasia}</td>
                          <td className="py-3 px-2">{lead.cidade}</td>
                          <td className="py-3 px-2">{lead.nome_responsavel}</td>
                          <td className="py-3 px-2">{lead.telefone_responsavel}</td>
                          <td className="py-3 px-2">
                            <div className="space-y-1">
                              <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                                {PIPELINE_LABELS[lead.status_lead || lead.status] || "Lead"}
                              </span>
                              <DaysInStage dataEntrada={stageMap[lead.id]} compact />
                            </div>
                          </td>
                          <td className="py-3 px-2 text-muted-foreground">{new Date(lead.data_cadastro).toLocaleDateString("pt-BR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add Lead Dialog */}
      <AddLeadDialog
        open={addLeadOpen}
        onOpenChange={setAddLeadOpen}
        parceiroId={parceiro.id}
        parceiroNome={parceiro.nome}
        onSuccess={reloadLeads}
      />
    </div>
  );
};

export default PainelParceiro;
