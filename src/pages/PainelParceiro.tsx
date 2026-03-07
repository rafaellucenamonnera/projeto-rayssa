import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Copy, Link2, Users, LogOut, Loader2, MessageCircle, Mail, CalendarCheck, FileText, UserCheck, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  novo_lead: "Novo Lead",
  reuniao_agendada: "Reunião Agendada",
  proposta_comercial: "Proposta Comercial",
  lead_convertido: "Lead Convertido",
};

const PainelParceiro = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const [parceiro, setParceiro] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(searchParams.get("status"));

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const stored = localStorage.getItem("monnera_parceiro");
      if (!stored) { navigate("/login"); return; }
    }

    const loadData = async () => {
      let p: any = null;
      if (user) {
        const { data } = await supabase
          .from("parceiros_comerciais")
          .select("*")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();
        p = data;
      }
      if (!p) {
        const stored = localStorage.getItem("monnera_parceiro");
        if (stored) p = JSON.parse(stored);
      }
      if (!p) { navigate("/login"); return; }

      setParceiro(p);
      localStorage.setItem("monnera_parceiro", JSON.stringify(p));

      const { data: leadsData } = await supabase
        .from("leads")
        .select("*")
        .eq("parceiro_id", p.id)
        .order("data_cadastro", { ascending: false });
      setLeads(leadsData || []);
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

  const slug = (parceiro as any).slug_consultor;
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
  const statusCounts: Record<string, number> = { novo_lead: 0, reuniao_agendada: 0, proposta_comercial: 0, lead_convertido: 0 };
  leads.forEach((l) => {
    const s = (l as any).status_lead || l.status || "novo_lead";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });

  const filteredLeads = statusFilter
    ? leads.filter((l) => ((l as any).status_lead || l.status) === statusFilter)
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

  const statCards = [
    { label: "Leads Indicados", value: leads.length, icon: Users, status: null },
    { label: "Leads este mês", value: leadsThisMonth, icon: CalendarCheck, status: null },
    { label: "Reuniões Agendadas", value: statusCounts.reuniao_agendada, icon: CalendarCheck, status: "reuniao_agendada" },
    { label: "Propostas Enviadas", value: statusCounts.proposta_comercial, icon: FileText, status: "proposta_comercial" },
    { label: "Clientes Convertidos", value: statusCounts.lead_convertido, icon: UserCheck, status: "lead_convertido" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Painel do Consultor</h1>
            <p className="text-muted-foreground">Olá, {parceiro.nome}!</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`stat-card cursor-pointer transition-all ${statusFilter === card.status && card.status ? "ring-2 ring-primary" : ""}`}
              onClick={() => card.status && handleStatusClick(card.status)}
            >
              <div className="flex flex-col items-center text-center gap-1">
                <card.icon className="w-5 h-5 text-primary" />
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-display font-bold">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Share Link */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Meu Link de Indicação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary rounded-lg p-4 flex items-center justify-between gap-3">
              <p className="text-sm font-mono text-primary break-all flex-1">{linkIndicacao}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://wa.me/?text=${whatsappMsg}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" /> Enviar via WhatsApp
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:?subject=${emailSubject}&body=${emailBody}`}>
                  <Mail className="mr-2 h-4 w-4" /> Enviar por Email
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Leads */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-display">
              {statusFilter ? (
                <span className="flex items-center gap-2">
                  <button onClick={() => { setStatusFilter(null); setSearchParams({}); }} className="text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  {STATUS_LABELS[statusFilter] || statusFilter}
                </span>
              ) : "Meus Leads"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredLeads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {statusFilter ? "Nenhum lead neste estágio." : "Nenhum lead cadastrado ainda. Compartilhe seu link para começar!"}
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                          <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                            {STATUS_LABELS[(lead as any).status_lead || lead.status] || "Novo"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{new Date(lead.data_cadastro).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PainelParceiro;
