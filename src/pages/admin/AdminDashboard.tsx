import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, TrendingUp, CalendarCheck, FileSpreadsheet, CheckCircle, Trophy, PhoneCall, FileSignature, Send, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { getPipelineStageLabel, getPipelineStageOrder, PIPELINE_STAGES } from "@/lib/pipelineConstants";

const STATUS_STYLE: Record<string, { icon: typeof FileText; colorClass: string }> = {
  novo_lead: { icon: FileText, colorClass: "bg-primary/10 text-primary" },
  contato_realizado: { icon: PhoneCall, colorClass: "bg-cyan-500/10 text-cyan-500" },
  reuniao_agendada: { icon: CalendarCheck, colorClass: "bg-amber-500/10 text-amber-500" },
  reuniao_realizada: { icon: CheckCircle, colorClass: "bg-orange-500/10 text-orange-500" },
  proposta_enviada: { icon: Send, colorClass: "bg-blue-500/10 text-blue-500" },
  lead_convertido: { icon: CheckCircle, colorClass: "bg-emerald-500/10 text-emerald-500" },
  contrato_enviado: { icon: FileSpreadsheet, colorClass: "bg-violet-500/10 text-violet-500" },
  contrato_assinado: { icon: FileSignature, colorClass: "bg-green-500/10 text-green-500" },
  lead_perdido: { icon: AlertTriangle, colorClass: "bg-destructive/10 text-destructive" },
};

const DEFAULT_STATUS_CONFIG = PIPELINE_STAGES
  .filter((stage) => stage.value !== "lead_perdido")
  .map((stage, index) => ({ ...stage, sort_order: index + 1 }));

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
  total_leads: number;
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

interface PipelineStageConfig {
  value: string;
  label: string;
  sort_order: number;
}

const formatCount = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

const fetchAllRows = async <T,>(buildQuery: () => any, pageSize = 1000): Promise<T[]> => {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data || []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [totalParceiros, setTotalParceiros] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [signedContractsCount, setSignedContractsCount] = useState(0);
  const [ranking, setRanking] = useState<RankingItem[]>([]);
  const [stageMetrics, setStageMetrics] = useState<StageMetric[]>([]);
  const [stalledLeads, setStalledLeads] = useState<StalledLead[]>([]);
  const [stalledLeadSearch, setStalledLeadSearch] = useState("");
  const [bottleneck, setBottleneck] = useState<StageMetric | null>(null);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageConfig[]>(DEFAULT_STATUS_CONFIG);
  const [stageLabels, setStageLabels] = useState<Record<string, string>>({});
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
        .select("value, label, sort_order")
        .eq("panel_key", selectedPanel);
      const panelStageList = ((panelStages || []) as PipelineStageConfig[])
        .sort((a, b) => a.sort_order - b.sort_order);
      const activeStages = panelStageList.length > 0 ? panelStageList : DEFAULT_STATUS_CONFIG;
      const stageValues = activeStages.map((s) => s.value);
      const labels = Object.fromEntries(activeStages.map((s) => [s.value, s.label]));
      const orders = Object.fromEntries(activeStages.map((s, index) => [s.value, index]));
      setPipelineStages(activeStages);
      setStageLabels(labels);

      const applyLeadFilters = (q: any) => {
        let query = q.eq("panel_id", selectedPanel);
        if (selectedConsultor !== "all") query = query.eq("parceiro_id", selectedConsultor);
        if (selectedResponsavel !== "all") query = query.eq("nome_responsavel", selectedResponsavel);
        if (dateFilter.from) query = query.gte("data_cadastro", dateFilter.from);
        if (dateFilter.to) query = query.lte("data_cadastro", dateFilter.to);
        return query;
      };

      // 1. Total de parceiros (não depende de filtros de leads)
      const parceirosCountP = supabase
        .from("parceiros_comerciais")
        .select("id", { count: "exact", head: true });

      // 2. Contagem por etapa via count/head:true (uma query paralela por etapa)
      const stageCountsP = Promise.all(
        activeStages.map(async (s) => {
          const { count } = await applyLeadFilters(
            supabase.from("leads").select("id", { count: "exact", head: true }),
          ).eq("status_lead", s.value);
          return [s.value, count || 0] as const;
        }),
      );

      // 3. Total de leads via count/head:true, sem filtro de status (inclui lead_perdido e etapas fora do painel corrente)
      const totalLeadsP = applyLeadFilters(
        supabase.from("leads").select("id", { count: "exact", head: true }),
      ).then(({ count }: any) => count || 0);

      // 4. Dataset leve só para ranking + filtro de responsáveis (Fase 1: RPC/agregação server-side fica para fase posterior)
      const rankingLeadsP = fetchAllRows<any>(() =>
        applyLeadFilters(
          supabase
            .from("leads")
            .select("id, parceiro_id, status_lead, nome_responsavel, data_cadastro")
            .order("data_cadastro", { ascending: false }),
        ),
      );

      // 5. Histórico de etapas em aberto (leve: 3 colunas) — usado por métricas e leads parados
      const buildStalledQuery = () => {
        let query: any = supabase
          .from("lead_stage_history")
          .select("lead_id, etapa, data_entrada")
          .is("data_saida", null)
          .order("data_entrada", { ascending: true });
        if (stageValues.length > 0) query = query.in("etapa", stageValues);
        return query;
      };
      const stageHistoryP = fetchAllRows<any>(buildStalledQuery);

      const [parceirosRes, stageCountsPairs, totalLeadsCount, rankingLeads, stageHistoryRows] = await Promise.all([
        parceirosCountP,
        stageCountsP,
        totalLeadsP,
        rankingLeadsP,
        stageHistoryP,
      ]);

      setTotalParceiros(parceirosRes.count || 0);
      const counts: Record<string, number> = {};
      activeStages.forEach((s) => { counts[s.value] = 0; });
      stageCountsPairs.forEach(([k, v]) => { counts[k] = v; });
      setStatusCounts(counts);
      setTotalLeads(totalLeadsCount);
      setSignedContractsCount(counts["contrato_assinado"] || 0);

      // Ranking + lista de responsáveis a partir do dataset leve
      const nomeMap = new Map(consultores.map((p) => [p.id, p.nome]));
      const parceiroMap = new Map<string, { total: number; convertidos: number; assinados: number }>();
      rankingLeads.forEach((l: any) => {
        const s = l.status_lead || "novo_lead";
        const entry = parceiroMap.get(l.parceiro_id) || { total: 0, convertidos: 0, assinados: 0 };
        entry.total += 1;
        if (["lead_convertido", "contrato_enviado", "contrato_assinado"].includes(s)) entry.convertidos += 1;
        if (s === "contrato_assinado") entry.assinados += 1;
        parceiroMap.set(l.parceiro_id, entry);
      });
      setResponsaveis(
        Array.from(new Set(rankingLeads.map((l: any) => l.nome_responsavel).filter(Boolean))).sort() as string[],
      );
      const rankingList: RankingItem[] = Array.from(parceiroMap.entries())
        .map(([id, data]) => ({ parceiro_id: id, nome: nomeMap.get(id) || "—", ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
      setRanking(rankingList);

      // Métricas de tempo médio por etapa — derivadas do dataset leve + histórico de etapas
      const leadById = new Map(rankingLeads.map((l: any) => [l.id, l]));
      const currentStageByLead = new Map(
        (stageHistoryRows || []).filter((s: any) => leadById.has(s.lead_id)).map((s: any) => [s.lead_id, s.data_entrada]),
      );
      const stageTotals = new Map<string, { totalDias: number; totalLeads: number }>();
      rankingLeads.forEach((lead: any) => {
        const etapa = lead.status_lead || "novo_lead";
        if (etapa === "lead_perdido") return;
        const dataEntrada = currentStageByLead.get(lead.id);
        const dias = dataEntrada
          ? Math.max(0, Math.floor((Date.now() - new Date(dataEntrada as string).getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
        const current = stageTotals.get(etapa) || { totalDias: 0, totalLeads: 0 };
        current.totalDias += dias;
        current.totalLeads += 1;
        stageTotals.set(etapa, current);
      });
      const metrics: StageMetric[] = Array.from(stageTotals.entries())
        .map(([etapa, data]) => ({
          etapa,
          tempo_medio: Number((data.totalDias / data.totalLeads).toFixed(1)),
          total_leads: data.totalLeads,
        }))
        .sort((a, b) => (orders[a.etapa] ?? getPipelineStageOrder(a.etapa)) - (orders[b.etapa] ?? getPipelineStageOrder(b.etapa)));
      setStageMetrics(metrics);
      if (metrics.length > 0) {
        const bn = metrics.reduce((max, m) => (m.tempo_medio > max.tempo_medio ? m : max), metrics[0]);
        setBottleneck(bn);
      } else {
        setBottleneck(null);
      }

      // Leads parados — lista operacional limitada a 100 itens (não é base para totais exatos)
      const stalledCandidates = (stageHistoryRows || []).filter((s: any) => leadById.has(s.lead_id));
      if (stalledCandidates.length > 0) {
        const stalled: StalledLead[] = stalledCandidates.map((s: any) => {
          const lead = leadById.get(s.lead_id);
          const dias = Math.max(0, Math.floor((Date.now() - new Date(s.data_entrada).getTime()) / (1000 * 60 * 60 * 24)));
          const dias_totais = lead?.data_cadastro
            ? Math.max(0, Math.floor((Date.now() - new Date(lead.data_cadastro).getTime()) / (1000 * 60 * 60 * 24)))
            : 0;
          return {
            id: s.lead_id,
            nome_fantasia: (lead as any)?.nome_fantasia || "—",
            etapa: (lead as any)?.status_lead || s.etapa || "novo_lead",
            dias,
            dias_totais,
            parceiro_nome: nomeMap.get((lead as any)?.parceiro_id || "") || "—",
          };
        })
          .sort((a: StalledLead, b: StalledLead) => b.dias - a.dias)
          .slice(0, 100);
        setStalledLeads(stalled);
      } else {
        setStalledLeads([]);
      }
    };
    load();
  }, [selectedPanel, selectedConsultor, selectedResponsavel, dateFilter, consultores]);

  const medals = ["🥇", "🥈", "🥉"];

  const conversionRate = totalLeads > 0
    ? Math.round((signedContractsCount / totalLeads) * 100)
    : 0;

  const getStageLabel = (stage: string) => stageLabels[stage] || getPipelineStageLabel(stage);

  const filteredStalledLeads = stalledLeads.filter((lead) =>
    lead.nome_fantasia.toLowerCase().includes(stalledLeadSearch.trim().toLowerCase())
  );

  const navigateToLeadsByStatus = (status: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("status", status);
    navigate(`/admin/painel/${selectedPanel}?${params.toString()}`);
  };

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
              <p className="text-3xl font-display font-bold">{formatCount(totalParceiros)}</p>
            </div>
          </div>
        </div>
        <div className="stat-card cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all" onClick={() => navigate(`/admin/painel/${selectedPanel}`)}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Leads</p>
              <p className="text-3xl font-display font-bold">{formatCount(totalLeads)}</p>
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
          {pipelineStages.filter((s) => s.value !== "lead_perdido").map((s) => {
            const style = STATUS_STYLE[s.value] || { icon: FileText, colorClass: "bg-primary/10 text-primary" };
            const Icon = style.icon;
            const count = statusCounts[s.value] || 0;
            const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
            return (
              <Card key={s.value} className="border-border cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all min-w-[130px] sm:min-w-0 shrink-0 sm:shrink" onClick={() => navigateToLeadsByStatus(s.value)}>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-1 leading-tight">{s.label}</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-xl font-display font-bold">{formatCount(count)}</p>
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
                    <div
                      key={m.etapa}
                      className="space-y-1 cursor-pointer rounded-md transition-colors hover:bg-secondary/50"
                      onClick={() => navigateToLeadsByStatus(m.etapa)}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className={`${isBottleneck ? "font-semibold text-destructive" : ""}`}>
                          {getStageLabel(m.etapa)}
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
                      {getStageLabel(bottleneck.etapa)} — Tempo médio: {bottleneck.tempo_medio} dias
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
            <p className="text-xs text-muted-foreground">Lista operacional dos 100 leads há mais tempo parados — não é base para totais exatos.</p>
          </CardHeader>
          <CardContent>
            {stalledLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sem leads parados.</p>
            ) : (
              <div className="space-y-3">
                <Input
                  value={stalledLeadSearch}
                  onChange={(e) => setStalledLeadSearch(e.target.value)}
                  placeholder="Filtrar por cliente..."
                />
                {filteredStalledLeads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente encontrado.</p>
                ) : (
                  <div className="max-h-[520px] overflow-y-auto pr-2">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Dias na etapa</TableHead>
                          <TableHead className="text-right">Dias totais</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStalledLeads.map((l) => (
                          <TableRow key={l.id} className="cursor-pointer" onClick={() => navigateToLeadsByStatus(l.etapa)}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{l.nome_fantasia}</p>
                                <p className="text-[10px] text-muted-foreground">{l.parceiro_nome}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {getStageLabel(l.etapa)}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${getDaysColor(l.dias)}`}>
                              {l.dias}d
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {l.dias_totais}d
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
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
                      <TableCell className="text-right">{formatCount(r.total)}</TableCell>
                      <TableCell className="text-right">{formatCount(r.convertidos)}</TableCell>
                      <TableCell className="text-right">{formatCount(r.assinados)}</TableCell>
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
