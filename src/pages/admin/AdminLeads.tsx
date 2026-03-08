import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { LeadExportButton } from "@/components/admin/LeadExportButton";
import { LeadImportDialog } from "@/components/admin/LeadImportDialog";

const STATUS_OPTIONS = [
  { value: "novo_lead", label: "Novo Lead" },
  { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "proposta_comercial", label: "Proposta Comercial" },
  { value: "lead_convertido", label: "Lead Convertido" },
];

const AdminLeads = () => {
  const { isAdmin } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<Record<string, string>>({});
  const [parceirosAll, setParceirosAll] = useState<{ id: string; nome: string }[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterConsultor, setFilterConsultor] = useState<string>("all");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");

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

  const updateStatus = async (leadId: string, newStatus: string) => {
    const { error } = await supabase
      .from("leads")
      .update({ status_lead: newStatus } as any)
      .eq("id", leadId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status_lead: newStatus } : l))
    );
    toast.success("Status atualizado");
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

  // Apply filters
  const filtered = leads.filter((l) => {
    if (filterStatus !== "all" && ((l as any).status_lead || l.status) !== filterStatus) return false;
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
  STATUS_OPTIONS.forEach((s) => { statusCounts[s.value] = 0; });
  leads.forEach((l) => {
    const s = (l as any).status_lead || l.status || "novo_lead";
    if (statusCounts[s] !== undefined) statusCounts[s]++;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-display font-bold">Leads Recebidos</h1>
        <div className="flex items-center gap-2">
          <LeadExportButton leads={filtered} parceiros={parceiros} />
          <LeadImportDialog parceiros={parceirosAll} onImported={loadData} />
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {STATUS_OPTIONS.map((s) => (
          <div
            key={s.value}
            className={`stat-card !p-3 sm:!p-6 cursor-pointer transition-all ${filterStatus === s.value ? "ring-2 ring-primary" : ""}`}
            onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
          >
            <div className="text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{s.label}</p>
              <p className="text-xl sm:text-2xl font-display font-bold">{statusCounts[s.value]}</p>
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
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{l.nome_fantasia}</p>
                  <p className="text-xs text-muted-foreground">{l.cidade}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(l.data_cadastro).toLocaleDateString("pt-BR")}
                  </span>
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
                  value={(l as any).status_lead || l.status || "novo_lead"}
                  onValueChange={(val) => updateStatus(l.id, val)}
                >
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
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
                    <td className="py-3 px-4">{l.nome_fantasia}</td>
                    <td className="py-3 px-4">{l.cidade}</td>
                    <td className="py-3 px-4">{l.nome_responsavel}</td>
                    <td className="py-3 px-4">{l.telefone_responsavel}</td>
                    <td className="py-3 px-4">
                      <Select
                        value={(l as any).status_lead || l.status || "novo_lead"}
                        onValueChange={(val) => updateStatus(l.id, val)}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
    </div>
  );
};

export default AdminLeads;
