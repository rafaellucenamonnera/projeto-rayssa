import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Link2, Users, LogOut } from "lucide-react";
import { toast } from "sonner";

const PainelParceiro = () => {
  const navigate = useNavigate();
  const [parceiro, setParceiro] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("monnera_parceiro");
    if (!stored) {
      navigate("/cadastro");
      return;
    }
    const p = JSON.parse(stored);
    setParceiro(p);
    loadLeads(p.id);
  }, [navigate]);

  const loadLeads = async (parceiroId: string) => {
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("parceiro_id", parceiroId)
      .order("data_cadastro", { ascending: false });
    setLeads(data || []);
    setLoading(false);
  };

  if (!parceiro) return null;

  const linkIndicacao = `${window.location.origin}/lead/${parceiro.codigo_parceiro}`;

  const copyLink = () => {
    navigator.clipboard.writeText(linkIndicacao);
    toast.success("Link copiado!");
  };

  const logout = () => {
    localStorage.removeItem("monnera_parceiro");
    navigate("/");
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Painel do Consultor</h1>
            <p className="text-muted-foreground">Olá, {parceiro.nome}!</p>
          </div>
          <Button variant="outline" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Link2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Código do Consultor</p>
                <p className="text-lg font-display font-semibold glow-text">{parceiro.codigo_parceiro}</p>
              </div>
            </div>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Leads Captados</p>
                <p className="text-2xl font-display font-bold">{leads.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Link section */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg font-display">Seu Link de Indicação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary rounded-lg p-4 flex items-center justify-between gap-3">
              <p className="text-sm font-mono text-primary break-all flex-1">{linkIndicacao}</p>
              <Button variant="outline" size="sm" onClick={copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Compartilhe este link com empresas interessadas no Monnera. Os leads cadastrados serão vinculados ao seu perfil de consultor.
            </p>
          </CardContent>
        </Card>

        {/* Leads table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg font-display">Seus Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground text-center py-8">Carregando...</p>
            ) : leads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum lead cadastrado ainda. Compartilhe seu link para começar!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Empresa</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Responsável</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Cidade</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-3 px-2 text-muted-foreground font-medium">Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-3 px-2">{lead.nome_fantasia}</td>
                        <td className="py-3 px-2">{lead.nome_responsavel}</td>
                        <td className="py-3 px-2">{lead.cidade}</td>
                        <td className="py-3 px-2">
                          <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                            {lead.status === "novo_lead" ? "Novo" : lead.status}
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
