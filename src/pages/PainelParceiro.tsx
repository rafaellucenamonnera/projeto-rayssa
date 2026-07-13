import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  ChevronLeft,
  Copy,
  FileSignature,
  FileText,
  Link2,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PIPELINE_STAGES, PIPELINE_LABELS } from "@/lib/pipelineConstants";
import { AddLeadDialog } from "@/components/parceiro/AddLeadDialog";
import { DaysInStage } from "@/components/admin/DaysInStage";
import { KitVendasSection } from "@/components/parceiro/KitVendasSection";

const calendarUrl = "https://calendar.app.google/wzotf4LMLcW1vKwo6";

const buildTesteMonneraMessage = (linkTesteMonnera: string) => `Olá, tudo bem?

Quero te convidar a fazer o Teste Monnera, um diagnóstico educativo rápido para entender se a sua empresa está pagando premiações com clareza, segurança e controle.

Em poucos minutos, você consegue identificar pontos importantes sobre comissão, premiação, metas, cálculo, rastreabilidade e forma de pagamento.

Muitas empresas querem premiar melhor e vender mais, mas ficam na dúvida se estão fazendo do jeito certo. O teste ajuda a enxergar onde podem existir riscos, retrabalho ou oportunidades de melhorar a governança da operação.

Acesse aqui:
${linkTesteMonnera}

O resultado é educativo e não substitui validação jurídica ou contábil, mas pode ajudar sua empresa a dar o próximo passo com mais clareza.`;

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

      if (!p) {
        navigate("/login");
        return;
      }
      if (!p.aprovado) {
        toast.error("Seu cadastro está pendente de aprovação.");
        await supabase.auth.signOut();
        navigate("/login");
        return;
      }

      setParceiro(p);

      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .eq("parceiro_id", p.id)
        .order("data_cadastro", { ascending: false });
      const leadIds = (leadsData || []).map((lead) => lead.id);
      const { data: stageData } = leadIds.length
        ? await supabase
            .from("lead_stage_history")
            .select("lead_id, data_entrada")
            .in("lead_id", leadIds)
            .is("data_saida", null)
        : { data: [] as { lead_id: string; data_entrada: string }[] };
      setLeads(leadsData || []);
      const sm: Record<string, string> = {};
      (stageData || []).forEach((s: any) => {
        sm[s.lead_id] = s.data_entrada;
      });
      setStageMap(sm);
      setLoading(false);
    };
    loadData();
  }, [user, authLoading, navigate]);

  if (authLoading || loading || !parceiro) {
    return (
      <div className="monnera-page flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#6BB0A1]" />
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
    `Olá!\n\nQuero te apresentar a Monnera.\n\nA Monnera ajuda empresas do varejo a transformar dados de vendas em campanhas de incentivo mais claras, seguras e eficientes.\n\nSe fizer sentido para sua empresa, você pode preencher rapidamente este link:\n\n${linkIndicacao}`
  );

  const emailSubject = encodeURIComponent("Conheça a Monnera");
  const emailBody = encodeURIComponent(
    `Olá!\n\nQuero te apresentar a Monnera, uma solução que conecta estratégia, operação e pessoas para aprimorar campanhas de incentivo de vendas com mais clareza e segurança.\n\nCaso tenha interesse, preencha rapidamente este link:\n\n${linkIndicacao}`
  );

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const leadsThisMonth = leads.filter((l) => new Date(l.data_cadastro) >= startOfMonth).length;
  const statusCounts: Record<string, number> = {};
  PIPELINE_STAGES.forEach((s) => {
    statusCounts[s.value] = 0;
  });
  leads.forEach((l) => {
    const s = l.status_lead || l.status || "novo_lead";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });

  const filteredLeads = statusFilter
    ? leads.filter((l) => (l.status_lead || l.status) === statusFilter)
    : leads;

  const handleStatusClick = (status: string | null) => {
    if (!status) return;
    if (statusFilter === status) {
      setStatusFilter(null);
      setSearchParams({});
    } else {
      setStatusFilter(status);
      setSearchParams({ status });
    }
  };

  const reloadLeads = async () => {
    const { data: leadsData } = await supabase
      .from("leads")
      .select("*")
      .eq("parceiro_id", parceiro.id)
      .order("data_cadastro", { ascending: false });
    const leadIds = (leadsData || []).map((lead) => lead.id);
    const { data: stageData } = leadIds.length
      ? await supabase
          .from("lead_stage_history")
          .select("lead_id, data_entrada")
          .in("lead_id", leadIds)
          .is("data_saida", null)
      : { data: [] as { lead_id: string; data_entrada: string }[] };
    setLeads(leadsData || []);
    const sm: Record<string, string> = {};
    (stageData || []).forEach((s: any) => {
      sm[s.lead_id] = s.data_entrada;
    });
    setStageMap(sm);
  };

  const statCards = [
    { label: "Leads indicados", helper: "Total em acompanhamento", value: leads.length, icon: Users, status: null },
    { label: "Leads este mês", helper: "Novas portas abertas", value: leadsThisMonth, icon: CalendarCheck, status: null },
    { label: "Contato realizado", helper: "Conversas iniciadas", value: statusCounts.contato_realizado, icon: PhoneCall, status: "contato_realizado" },
    { label: "Reuniões agendadas", helper: "Próximos passos", value: statusCounts.reuniao_agendada, icon: CalendarCheck, status: "reuniao_agendada" },
    { label: "Propostas enviadas", helper: "Oportunidades em análise", value: statusCounts.proposta_enviada, icon: FileText, status: "proposta_enviada" },
    { label: "Convertidos", helper: "Leads avançados", value: statusCounts.lead_convertido, icon: UserCheck, status: "lead_convertido" },
    { label: "Contratos assinados", helper: "Resultado consolidado", value: statusCounts.contrato_assinado, icon: FileSignature, status: "contrato_assinado" },
    { label: "Perdidos", helper: "Aprendizados do funil", value: statusCounts.lead_perdido || 0, icon: XCircle, status: "lead_perdido" },
  ];

  const facilidades = [
    {
      icon: Target,
      title: "Aborde com contexto",
      text: "Use as dores de incentivo, operação e vendas para abrir conversas mais qualificadas.",
    },
    {
      icon: Sparkles,
      title: "Use materiais prontos",
      text: "Apoie a conversa com mensagens, vídeos, portfólio e posts alinhados à Monnera.",
    },
    {
      icon: Send,
      title: "Registre oportunidades",
      text: "Cadastre o lead e deixe o time Monnera entrar junto no melhor momento.",
    },
    {
      icon: ShieldCheck,
      title: "Acompanhe a evolução",
      text: "Veja cada etapa com clareza, do primeiro contato ao contrato assinado.",
    },
  ];

  return (
    <div className="monnera-page">
      <div className="relative overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8 sm:pt-8 sm:pb-10">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="monnera-eyebrow">
                <span className="h-1.5 w-1.5 rounded-full bg-[#6BB0A1]" />
                Painel do Embaixador
              </div>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-[#003729] sm:text-4xl">
                Olá, {parceiro.nome}. Vamos transformar boas conexões em oportunidades.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#33584f] sm:text-base">
                A Monnera segue junto com você: materiais prontos, orientação comercial e um funil claro para levar
                mais empresas ao desempenho extraordinário com segurança e inteligência.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                onClick={() => setAddLeadOpen(true)}
                className="bg-[#6BB0A1] text-[#003729] hover:bg-[#8ed0c2]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar lead
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="border-[#b9d8d0] bg-white text-[#003729] hover:bg-[#e7f4f0] hover:text-[#003729]"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </header>

          <section className="mt-7">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2b6d5e]">Métricas primeiro</p>
                <h2 className="mt-1 text-xl font-bold text-[#003729]">Sua operação em movimento</h2>
              </div>
              {statusFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStatusFilter(null);
                    setSearchParams({});
                  }}
                  className="hidden border-[#b9d8d0] bg-white text-[#003729] hover:bg-[#e7f4f0] hover:text-[#003729] sm:inline-flex"
                >
                  Limpar filtro
                </Button>
              )}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
              {statCards.map((card) => {
                const selected = statusFilter === card.status && card.status;
                return (
                  <button
                    key={card.label}
                    type="button"
                    onClick={() => handleStatusClick(card.status)}
                    className={`group min-w-[190px] rounded-lg border p-4 text-left transition-all lg:min-w-0 ${
                      selected
                        ? "border-[#6BB0A1] bg-[#e7f4f0] shadow-[0_0_0_1px_rgba(107,176,161,0.35)]"
                        : "border-[#d7e9e4] bg-white hover:border-[#6BB0A1]/70 hover:bg-[#fbfdfb]"
                    } ${card.status ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="rounded-md border border-[#d7e9e4] bg-[#6BB0A1]/15 p-2 text-[#003729]">
                        <card.icon className="h-5 w-5" />
                      </div>
                      {card.status && <ArrowRight className="h-4 w-4 text-[#6b8a82] transition group-hover:text-[#00624b]" />}
                    </div>
                    <p className="mt-5 text-3xl font-bold text-[#003729]">{card.value || 0}</p>
                    <p className="mt-1 text-sm font-semibold text-[#003729]">{card.label}</p>
                    <p className="mt-1 text-xs leading-snug text-[#4f6d65]">{card.helper}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <main className="max-w-6xl mx-auto space-y-5 px-4 pb-10 sm:px-6 lg:px-8">
        <Card className="monnera-card-elevated overflow-hidden">
          <CardContent className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#2b6d5e]">
                <Link2 className="h-4 w-4" />
                Compartilhe sua ponte com novos clientes
              </div>
              <h2 className="mt-2 text-2xl font-bold">Seu link de indicação Monnera</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#33584f]">
                Use este link sempre que abrir uma conversa. Ele conecta o lead ao seu perfil de embaixador e ajuda o
                time Monnera a acompanhar a oportunidade com contexto.
              </p>
              <div className="mt-4 rounded-md border border-[#6BB0A1]/35 bg-white px-3 py-3">
                <p className="break-all font-mono text-xs text-[#00624b] sm:text-sm">{linkIndicacao}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
              <Button onClick={copyLink} className="justify-start bg-[#003729] text-white shadow-sm hover:bg-[#064b3a]">
                <Copy className="mr-2 h-4 w-4" />
                Copiar link
              </Button>
              <Button variant="outline" asChild className="justify-start border-[#00624b] bg-white text-[#003729] hover:bg-[#e7f4f0] hover:text-[#003729]">
                <a href={`https://wa.me/?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </a>
              </Button>
              <Button variant="outline" asChild className="justify-start border-[#00624b] bg-white text-[#003729] hover:bg-[#e7f4f0] hover:text-[#003729]">
                <a href={`mailto:?subject=${emailSubject}&body=${emailBody}`}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </a>
              </Button>
              <Button variant="outline" asChild className="justify-start border-[#00624b] bg-white text-[#003729] hover:bg-[#e7f4f0] hover:text-[#003729]">
                <a href={calendarUrl} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Agendar apoio
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <KitVendasSection />

        <section className="grid gap-3 md:grid-cols-4">
          {facilidades.map((item) => (
            <div key={item.title} className="monnera-hero-panel">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-[#6BB0A1]/15 text-[#003729]">
                <item.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-[#003729]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#4f6d65]">{item.text}</p>
            </div>
          ))}
        </section>

        <Card className="monnera-card">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center justify-between gap-3 text-lg">
              {statusFilter ? (
                <span className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setStatusFilter(null);
                      setSearchParams({});
                    }}
                    className="rounded-md p-1 text-[#4f6d65] transition hover:bg-[#e7f4f0] hover:text-[#003729]"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  {PIPELINE_LABELS[statusFilter] || statusFilter}
                </span>
              ) : (
                "Meus leads"
              )}
              <Button
                size="sm"
                onClick={() => setAddLeadOpen(true)}
                className="bg-[#6BB0A1] text-[#003729] hover:bg-[#8ed0c2]"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo lead
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {filteredLeads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#b9d8d0] bg-[#f5faf8] px-4 py-8 text-center">
                <p className="text-sm text-[#4f6d65]">
                  {statusFilter
                    ? "Nenhum lead neste estágio."
                    : "Nenhum lead cadastrado ainda. Compartilhe seu link ou adicione uma oportunidade para começar."}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {filteredLeads.map((lead) => (
                    <div key={lead.id} className="rounded-lg border border-[#d7e9e4] bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{lead.nome_fantasia}</p>
                          <p className="text-xs text-[#6b8a82]">{lead.cidade}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#6BB0A1]/15 px-2 py-0.5 text-[10px] text-[#9fd4c8]">
                          {PIPELINE_LABELS[lead.status_lead || lead.status] || "Lead"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[#6b8a82]">Responsável: </span>
                          <span>{lead.nome_responsavel}</span>
                        </div>
                        <div>
                          <span className="text-[#6b8a82]">Telefone: </span>
                          <span>{lead.telefone_responsavel}</span>
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-2">
                          <span>
                            <span className="text-[#6b8a82]">Data: </span>
                            <span>{new Date(lead.data_cadastro).toLocaleDateString("pt-BR")}</span>
                          </span>
                          <DaysInStage dataEntrada={stageMap[lead.id]} compact />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#d7e9e4]">
                        <th className="px-2 py-3 text-left font-medium text-[#4f6d65]">Empresa</th>
                        <th className="px-2 py-3 text-left font-medium text-[#4f6d65]">Cidade</th>
                        <th className="px-2 py-3 text-left font-medium text-[#4f6d65]">Responsável</th>
                        <th className="px-2 py-3 text-left font-medium text-[#4f6d65]">Telefone</th>
                        <th className="px-2 py-3 text-left font-medium text-[#4f6d65]">Status</th>
                        <th className="px-2 py-3 text-left font-medium text-[#4f6d65]">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLeads.map((lead) => (
                        <tr key={lead.id} className="border-b border-[#edf5f2] transition hover:bg-[#f5faf8]">
                          <td className="px-2 py-3 font-medium">{lead.nome_fantasia}</td>
                          <td className="px-2 py-3 text-[#4f6d65]">{lead.cidade}</td>
                          <td className="px-2 py-3 text-[#4f6d65]">{lead.nome_responsavel}</td>
                          <td className="px-2 py-3 text-[#4f6d65]">{lead.telefone_responsavel}</td>
                          <td className="px-2 py-3">
                            <div className="space-y-1">
                              <span className="rounded-full bg-[#6BB0A1]/15 px-2 py-1 text-xs text-[#9fd4c8]">
                                {PIPELINE_LABELS[lead.status_lead || lead.status] || "Lead"}
                              </span>
                              <DaysInStage dataEntrada={stageMap[lead.id]} compact />
                            </div>
                          </td>
                          <td className="px-2 py-3 text-[#6b8a82]">
                            {new Date(lead.data_cadastro).toLocaleDateString("pt-BR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>

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
