import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, TrendingUp, CalendarCheck, FileSpreadsheet, CheckCircle, Trophy, PhoneCall, FileSignature, Send } from "lucide-react";
import { PIPELINE_STAGES } from "@/lib/pipelineConstants";

const STATUS_CONFIG = [
  { value: "novo_lead", label: "Lead", icon: FileText, colorClass: "bg-primary/10 text-primary" },
  { value: "contato_realizado", label: "Contato Realizado", icon: PhoneCall, colorClass: "bg-cyan-500/10 text-cyan-500" },
  { value: "reuniao_agendada", label: "Reunião Agendada", icon: CalendarCheck, colorClass: "bg-amber-500/10 text-amber-500" },
  { value: "proposta_enviada", label: "Proposta Enviada", icon: Send, colorClass: "bg-blue-500/10 text-blue-500" },
  { value: "lead_convertido", label: "Lead Convertido", icon: CheckCircle, colorClass: "bg-emerald-500/10 text-emerald-500" },
  { value: "contrato_enviado", label: "Contrato Enviado", icon: FileSpreadsheet, colorClass: "bg-violet-500/10 text-violet-500" },
  { value: "contrato_assinado", label: "Contrato Assinado", icon: FileSignature, colorClass: "bg-green-500/10 text-green-500" },
];

interface RankingItem {
  parceiro_id: string;
  nome: string;
  total: number;
  convertidos: number;
  assinados: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [totalParceiros, setTotalParceiros] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  useEffect(() => {
    const load = async () => {
      const [parceiros, leads, parceirosData] = await Promise.all([
        supabase.from("parceiros_comerciais").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("status_lead, parceiro_id"),
        supabase.from("parceiros_comerciais").select("id, nome"),
      ]);
      setTotalParceiros(parceiros.count || 0);

      const leadsData = leads.data || [];
      setTotalLeads(leadsData.length);

      const counts: Record<string, number> = {};
      STATUS_CONFIG.forEach((s) => { counts[s.value] = 0; });

      const parceiroMap = new Map<string, { total: number; convertidos: number; assinados: number }>();
      leadsData.forEach((l) => {
        const s = l.status_lead || "novo_lead";
        counts[s] = (counts[s] || 0) + 1;

        const entry = parceiroMap.get(l.parceiro_id) || { total: 0, convertidos: 0, assinados: 0 };
        entry.total += 1;
        if (["lead_convertido", "contrato_enviado", "contrato_assinado"].includes(s)) entry.convertidos += 1;
        if (s === "contrato_assinado") entry.assinados += 1;
        parceiroMap.set(l.parceiro_id, entry);
      });
      setStatusCounts(counts);

      const nomeMap = new Map((parceirosData.data || []).map((p) => [p.id, p.nome]));
      const rankingList: RankingItem[] = Array.from(parceiroMap.entries())
        .map(([id, data]) => ({ parceiro_id: id, nome: nomeMap.get(id) || "—", ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setRanking(rankingList);
    };
    load();
  }, []);

  const medals = ["🥇", "🥈", "🥉"];

  // Conversion rate: lead → contrato_assinado
  const conversionRate = totalLeads > 0
    ? Math.round(((statusCounts.contrato_assinado || 0) / totalLeads) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Dashboard Comercial</h1>

      {/* Totais gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => navigate("/admin/parceiros")}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Consultores</p>
              <p className="text-3xl font-display font-bold">{totalParceiros}</p>
            </div>
          </div>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => navigate("/admin/leads")}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Leads</p>
              <p className="text-3xl font-display font-bold">{totalLeads}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <FileSignature className="w-7 h-7 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Conversão Geral</p>
              <p className="text-3xl font-display font-bold">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Lead → Contrato Assinado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline por status */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-3">Pipeline Comercial</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-7 sm:overflow-visible">
          {STATUS_CONFIG.map((s) => {
            const Icon = s.icon;
            const count = statusCounts[s.value] || 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <Card key={s.value} className="border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all min-w-[130px] sm:min-w-0 shrink-0 sm:shrink" onClick={() => navigate(`/admin/leads?status=${s.value}`)}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 leading-tight">{s.label}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-display font-bold">{count}</p>
                    <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: "currentColor", opacity: 0.7 }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Ranking de consultores */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Ranking de Consultores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead cadastrado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Convertidos</TableHead>
                  <TableHead className="text-right">Assinados</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((r, i) => {
                  const convPct = r.total > 0 ? Math.round((r.assinados / r.total) * 100) : 0;
                  return (
                    <TableRow key={r.parceiro_id}>
                      <TableCell className="font-medium">{medals[i] || i + 1}</TableCell>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.convertidos}</TableCell>
                      <TableCell className="text-right">{r.assinados}</TableCell>
                      <TableCell className="text-right">{convPct}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
