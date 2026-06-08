import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, TrendingUp, CalendarCheck, FileSpreadsheet, CheckCircle, Trophy, PhoneCall, FileSignature, Send, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { PIPELINE_LABELS } from "@/lib/pipelineConstants";

const STATUS_CONFIG = [
  { value: "novo_lead", label: "Lead", icon: FileText, colorClass: "bg-primary/10 text-primary" },
  { value: "contato_realizado", label: "Contato Realizado", icon: PhoneCall, colorClass: "bg-cyan-500/10 text-cyan-500" },
  { value: "reuniao_agendada", label: "Reunião Agendada", icon: CalendarCheck, colorClass: "bg-amber-500/10 text-amber-500" },
  { value: "reuniao_realizada", label: "Reunião Realizada", icon: CheckCircle, colorClass: "bg-orange-500/10 text-orange-500" },
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

interface StageMetric {
  etapa: string;
  tempo_medio: number;
  total_passagens: number;
}

interface StalledLead {
  id: string;
  nome_fantasia: string;
  etapa: string;
  dias: number;
  dias_totais: number;
  parceiro_nome: string;
}

interface Panel {
  id: string;
  name: string;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [totalParceiros, setTotalParceiros] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [stageMetrics, setStageMetrics] = useState<StageMetric[]>([]);
  const [stalledLeads, setStalledLeads] = useState<StalledLead[]>([]);
  const [bottleneck, setBottleneck] = useState<StageMetric | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<string>("comercial");
  const [selectedConsultor, setSelectedConsultor] = useState<string>("all");
  const [selectedResponsavel, setSelectedResponsavel] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [consultores, setConsultores] = useState<Array<{ id: string; nome: string }>>([]);
  const [responsaveis, setResponsaveis] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      const [parceirosData, panelsRes] = await Promise.all([
        supabase.from("parceiros_comerciais").select("id, nome"),
        (supabase as any).from("pipeline_panels").select("id, name").order("sort_order", { ascending: true }),
      ]);
      setConsultores((parceirosData.data || []) as any);
      setPanels((panelsRes.data || []) as Panel[]);
    };
    load();
  }, []);

  const dateFilter = useMemo(() => {
    if (!startDate && !endDate) return {} as { from?: string; to?: string };
    if (startDate && endDate) return { from: `${startDate}T00:00:00`, to: `${endDate}T23:59:59` };
    if (startDate) return { from: `${startDate}T00:00:00` };
    return { to: `${endDate}T23:59:59` };
  }, [startDate, endDate]);

  useEffect(() => {
    const load = async () => {
      const { data: panelStages } = await (supabase as any)
        .from("pipeline_stages_config")
        .select("value")
        .eq("panel_key", selectedPanel);
      const stageValues = (panelStages || []).map((s: any) => s.value);

      let leadsQuery: any = supabase.from("leads").select("id, status_lead, parceiro_id, nome_responsavel, data_cadastro");
      if (stageValues.length > 0) leadsQuery = leadsQuery.in("status_lead", stageValues);
      if (selectedConsultor !== "all") leadsQuery = leadsQuery.eq("parceiro_id", selectedConsultor);
      if (selectedResponsavel !== "all") leadsQuery = leadsQuery.eq("nome_responsavel", selectedResponsavel);
      if (dateFilter.from) leadsQuery = leadsQuery.gte("data_cadastro", dateFilter.from);
      if (dateFilter.to) leadsQuery = leadsQuery.lte("data_cadastro", dateFilter.to);

      let stalledQuery: any = supabase
        .from("lead_stage_history")
        .select("lead_id, etapa, data_entrada")
        .is("data_saida", null)
        .order("data_entrada", { ascending: true });
      if (stageValues.length > 0) stalledQuery = stalledQuery.in("etapa", stageValues);

      const [parceiros, leads, metricsRes, stalledRes] = await Promise.all([
        supabase.from("parceiros_comerciais").select("id", { count: "exact", head: true }),
        leadsQuery,
        supabase.rpc("get_pipeline_stage_metrics"),
        stalledQuery,
      ]);
      setTotalParceiros(parceiros.count || 0);

      const leadsData = leads.data || [];
      setTotalLeads(leadsData.length);

      const counts: Record<string, number> = {};
      STATUS_CONFIG.forEach((s) => { counts[s.value] = 0; });

      const parceiroMap = new Map<string, { total: number; convertidos: number; assinados: number }>();
      leadsData.forEach((l: any) => {
        const s = l.status_lead || "novo_lead";
        counts[s] = (counts[s] || 0) + 1;

        const entry = parceiroMap.get(l.parceiro_id) || { total: 0, convertidos: 0, assinados: 0 };
        entry.total += 1;
        if (["lead_convertido", "contrato_enviado", "contrato_assinado"].includes(s)) entry.convertidos += 1;
        if (s === "contrato_assinado") entry.assinados += 1;
        parceiroMap.set(l.parceiro_id, entry);
      });
      setStatusCounts(counts);

      const nomeMap = new Map(consultores.map((p) => [p.id, p.nome]));
      setResponsaveis(Array.from(new Set(leadsData.map((l: any) => l.nome_responsavel).filter(Boolean))).sort() as string[]);
      const rankingList: RankingItem[] = Array.from(parceiroMap.entries())
        .map(([id, data]) => ({ parceiro_id: id, nome: nomeMap.get(id) || "—", ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setRanking(rankingList);

      const metrics: StageMetric[] = (metricsRes.data as any) || [];
      setStageMetrics(metrics);
      if (metrics.length > 0) {
        const bn = metrics.reduce((max, m) => m.tempo_medio > max.tempo_medio ? m : max, metrics[0]);
        setBottleneck(bn);
      } else {
        setBottleneck(null);
      }

      const stalledData = (stalledRes.data || []) as any[];
      const leadIds = stalledData.map((s: any) => s.lead_id);
      if (leadIds.length > 0) {
        const { data: leadDetails } = await supabase
          .from("leads")
          .select("id, nome_fantasia, parceiro_id, data_cadastro")
          .in("id", leadIds);

        const stalled: StalledLead[] = stalledData.map((s: any) => {
          const lead = (leadDetails || []).find((l: any) => l.id === s.lead_id);
          const dias = Math.max(0, Math.floor((Date.now() - new Date(s.data_entrada).getTime()) / (1000 * 60 * 60 * 24)));
          const dias_totais = lead?.data_cadastro
            ? Math.max(0, Math.floor((Date.now() - new Date(lead.data_cadastro).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
          return {
            id: s.lead_id,
            nome_fantasia: lead?.nome_fantasia || "—",
            etapa: s.etapa,
            dias,
            dias_totais,
            parceiro_nome: nomeMap.get(lead?.parceiro_id || "") || "—",
          };
        })
          .sort((a: StalledLead, b: StalledLead) => b.dias - a.dias)
          .slice(0, 10);
        setStalledLeads(stalled);
      } else {
        setStalledLeads([]);
      }
    };
    load();
  }, [selectedPanel, selectedConsultor, selectedResponsavel, dateFilter, consultores]);

  const medals = ["🥇", "🥈", "🥉"];

  const conversionRate = totalLeads > 0
    ? Math.round(((statusCounts.contrato_assinado || 0) / totalLeads) * 100)
    : 0;

  const getDaysColor = (dias: number) =>
    dias <= 3 ? "text-emerald-600" : dias <= 7 ? "text-amber-500" : "text-destructive";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Dashboard Comercial</h1>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Painel</p>
            <Select value={selectedPanel} onValueChange={setSelectedPanel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {panels.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Embaixador Monnera</p>
            <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {consultores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Responsável</p>
            <Select value={selectedResponsavel} onValueChange={setSelectedResponsavel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {responsaveis.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Data início</p>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Data fim</p>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Totais gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => navigate("/admin/parceiros")}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Embaixadores Monnera</p>
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
              <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
              <p className="text-3xl font-display font-bold">{conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Lead → Contrato Assinado</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline por status */}
      <div>
        <h2 className="text-lg font-display font-semibold mb-3">Pipeline Comercial</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-8 sm:overflow-visible">
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

      {/* Inteligência Comercial */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tempo Médio por Etapa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Tempo Médio por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stageMetrics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem dados de histórico ainda.</p>
            ) : (
              <div className="space-y-3">
                {stageMetrics.filter(m => m.etapa !== "lead_perdido").map((m) => {
                  const maxTempo = Math.max(...stageMetrics.map(s => s.tempo_medio), 1);
                  const pct = Math.round((m.tempo_medio / maxTempo) * 100);
                  const isBottleneck = bottleneck?.etapa === m.etapa;
                  return (
                    <div key={m.etapa} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`${isBottleneck ? "font-semibold text-destructive" : ""}`}>
                          {PIPELINE_LABELS[m.etapa] || m.etapa}
                          {isBottleneck && " 🔴"}
                        </span>
                        <span className={`font-mono text-xs ${getDaysColor(m.tempo_medio)}`}>
                          {m.tempo_medio} {m.tempo_medio === 1 ? "dia" : "dias"}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isBottleneck ? "bg-destructive" : "bg-primary"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottleneck callout */}
            {bottleneck && bottleneck.etapa !== "lead_perdido" && (
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                  <div>
                    <p className="font-semibold text-destructive">Gargalo atual do funil</p>
                    <p className="text-xs text-muted-foreground">
                      {PIPELINE_LABELS[bottleneck.etapa] || bottleneck.etapa} — Tempo médio: {bottleneck.tempo_medio} dias
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads Mais Tempo na Mesma Etapa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              Leads Mais Tempo na Mesma Etapa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stalledLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem leads parados.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stalledLeads.map((l) => (
                    <TableRow key={l.id} className="cursor-pointer" onClick={() => navigate(`/admin/leads?status=${l.etapa}`)}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{l.nome_fantasia}</p>
                          <p className="text-[10px] text-muted-foreground">{l.parceiro_nome}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {PIPELINE_LABELS[l.etapa] || l.etapa}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-bold ${getDaysColor(l.dias)}`}>
                        {l.dias}d
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking de embaixadores Monnera */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Ranking de Embaixadores Monnera
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
                  <TableHead>Embaixador Monnera</TableHead>
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
