import { memo, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, ChevronDown, ChevronUp, Copy, GripVertical, Pencil, Trash2, UserRound, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { healthStatusColor, impactColor, normalizeHealthStatus, normalizeImpact } from "@/lib/healthStatusColors";

interface KanbanLeadCardData {
  id: string;
  stage_id?: string;
  nome_fantasia: string;
  nome_responsavel?: string;
  status_lead?: string;
  status?: string;
  valor_setup?: number | null;
  valor_mensalidade?: number | null;
  valor_campanhas?: number | null;
  qtd_parcelas?: number | null;
  quantidade_lojas?: number | null;
  parceiro_id?: string;
  data_cadastro?: string;
  updated_at?: string;
  valor_mensalidade_anterior?: number | null;
  valor_campanhas_anterior?: number | null;
  valor_pagamento?: number | null;
  valor_pagamento_anterior?: number | null;
  revenue_total?: number | null;
  campaign_status_current?: string | null;
  campaign_status_previous?: string | null;
  campaign_status_current_month?: string | null;
  campaign_status_previous_month?: string | null;
  csat_current?: number | null;
  csat_previous?: number | null;
  csat_variation?: number | null;
  csat_direction?: "up" | "down" | "neutral" | null;
  health_status?: string | null;
  impact_level?: string | null;
  consultor?: string | null;
  revenue_current?: number | null;
  revenue_previous?: number | null;
  revenue_variation?: number | null;
  revenue_current_month?: string | null;
  revenue_previous_month?: string | null;
  partner_code?: string | null;
  proposta_url?: string | null;
}

interface PipelineStage {
  value: string;
  label: string;
}

interface PipelineKanbanProps {
  leads: KanbanLeadCardData[];
  parceirosMap: Record<string, string>;
  onMoveLead: (leadId: string, newStage: string) => void;
  onOpenLead: (lead: KanbanLeadCardData) => void;
  stages: PipelineStage[];
  canCloneCard?: boolean;
  canEditCard?: boolean;
  canDeleteCard?: boolean;
  onCloneCard?: (lead: KanbanLeadCardData) => void;
  onEditCard?: (lead: KanbanLeadCardData) => void;
  onDeleteCard?: (lead: KanbanLeadCardData) => void;
  onAssignResponsible?: (lead: KanbanLeadCardData) => void;
  /** Mapa lead_id -> ISO date de entrada no estágio atual (lead_stage_history.data_entrada). */
  stageEntryMap?: Record<string, string>;
  /** Ativa regras do painel comercial: contador de dias, tarja amarela/vermelha e ordenação por dias. */
  commercialMode?: boolean;
  showCampaignStatus?: boolean;
  showCsInsteadOfPartner?: boolean;
}

const campaignStatusClass = (status?: string | null) => {
  const s = (status || "").toUpperCase();
  if (s.includes("ATIVA")) return "bg-[#e7f4f0] text-[#003729] border-[#b9d8d0]";
  if (s.includes("PAGA") && s.includes("PARC")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("PAGA")) return "bg-teal-50 text-teal-800 border-teal-200";
  if (s.includes("CHURN")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("INATIVA")) return "bg-[#f5faf8] text-[#4f6d65] border-[#d7e9e4]";
  if (s.includes("IMPLEMENT")) return "bg-[#e7f4f0] text-[#003729] border-[#b9d8d0]";
  if (s.includes("AG") && s.includes("FUND")) return "bg-orange-50 text-orange-800 border-orange-200";
  return "bg-secondary/40 text-foreground border-border";
};
const csatMeta = (direction?: string | null) => {
  if (direction === "up") return { icon: ArrowUp, color: "text-[#00624b]" };
  if (direction === "down") return { icon: ArrowDown, color: "text-red-600" };
  return { icon: ArrowRight, color: "text-muted-foreground" };
};
const healthStatusClass = (status?: string | null) => {
  const s = (status || "").toUpperCase();
  if (s.includes("CHURN")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("CRIT")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("RISCO")) return "bg-orange-50 text-orange-800 border-orange-200";
  if (s.includes("ATEN")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("MONITOR")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (s.includes("EVENTUAL")) return "bg-orange-50 text-orange-800 border-orange-200";
  if (s.includes("RECENTE")) return "bg-teal-50 text-teal-800 border-teal-200";
  if (s.includes("SAUD")) return "bg-[#e7f4f0] text-[#003729] border-[#b9d8d0]";
  return "bg-secondary/40 text-foreground border-border";
};
const impactClass = (impact?: string | null) => {
  const s = (impact || "").toUpperCase();
  if (s.includes("ALTO")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("MEDIO") || s.includes("MÉDIO")) return "bg-orange-50 text-orange-800 border-orange-200";
  if (s.includes("BAIXO")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("MINIMO") || s.includes("MÍNIMO")) return "bg-[#f5faf8] text-[#4f6d65] border-[#d7e9e4]";
  return "bg-secondary/40 text-foreground border-border";
};

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** Receita total do lead, persistida no backend (mensalidade + campanhas). */
const leadContractValue = (l: KanbanLeadCardData): number => Number(l.revenue_total || 0);

const EPSILON = 0.0001;

const pct = (value: number) => `${value > 0 ? "+" : ""}${Math.round(value * 100)}%`;

const variation = (current?: number | null, previous?: number | null) => {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev <= 0) {
    if (cur <= 0) return 0;
    return 1;
  }
  return (cur - prev) / prev;
};

const trendMeta = (v: number) => {
  if (v > EPSILON) return { icon: ArrowUp, color: "text-emerald-600", label: "Alta" };
  if (v < -EPSILON) return { icon: ArrowDown, color: "text-red-600", label: "Queda" };
  return { icon: ArrowRight, color: "text-muted-foreground", label: "Estável" };
};

const daysSince = (isoDate?: string) => {
  if (!isoDate) return 0;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 0;
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};

const leadPriorityScore = (l: KanbanLeadCardData): number => {
  const mensalidadeVar = variation(l.valor_mensalidade, l.valor_mensalidade_anterior);
  const campanhasVar = variation(l.valor_campanhas, l.valor_campanhas_anterior);
  const pagamentoVar = variation(l.valor_pagamento, l.valor_pagamento_anterior);

  const receitaDrop = Math.max(0, -(mensalidadeVar + campanhasVar + pagamentoVar));
  const diasSemInteracao = daysSince(l.updated_at || l.data_cadastro);
  const valorFinanceiro = leadContractValue(l);

  return receitaDrop * 100 + diasSemInteracao * 1.5 + Math.log10(valorFinanceiro + 1) * 12;
};

export const PipelineKanban = memo(({
  leads,
  parceirosMap,
  onMoveLead,
  onOpenLead,
  canCloneCard = false,
  canEditCard = false,
  canDeleteCard = false,
  onCloneCard,
  onEditCard,
  onDeleteCard,
  onAssignResponsible,
  stages,
  showCampaignStatus = false,
  showCsInsteadOfPartner = false,
  stageEntryMap,
  commercialMode = false,
}: PipelineKanbanProps) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  const stageDaysByLead = useMemo(() => {
    if (!stageEntryMap) return {};
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(stageEntryMap).map(([leadId, iso]) => {
        const d = new Date(iso);
        const days = Number.isNaN(d.getTime())
          ? null
          : Math.max(0, Math.floor((now - d.getTime()) / (1000 * 60 * 60 * 24)));
        return [leadId, days];
      }),
    ) as Record<string, number | null>;
  }, [stageEntryMap]);

  const grouped = useMemo(() => {
    const g: Record<string, KanbanLeadCardData[]> = {};
    stages.forEach((s) => { g[s.value] = []; });
    leads.forEach((l) => {
      const s = l.stage_id || l.status_lead || l.status || "novo_lead";
      if (g[s]) g[s].push(l);
    });
    Object.keys(g).forEach((stageKey) => {
      if (commercialMode) {
        g[stageKey] = g[stageKey].sort(
          (a, b) => (stageDaysByLead[b.id] ?? -1) - (stageDaysByLead[a.id] ?? -1),
        );
      } else {
        g[stageKey] = g[stageKey].sort((a, b) => leadPriorityScore(b) - leadPriorityScore(a));
      }
    });
    return g;
  }, [leads, stages, commercialMode, stageDaysByLead]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    stages.forEach((s) => {
      t[s.value] = (grouped[s.value] || []).reduce(
        (sum, l) => sum + Number(l.revenue_total ?? leadContractValue(l)),
        0,
      );
    });
    return t;
  }, [grouped, stages]);

  return (
    <div className="flex h-[calc(100vh-230px)] min-h-[360px] gap-3 overflow-x-auto overflow-y-hidden pb-3">
      {stages.map((s) => {
        const items = grouped[s.value] || [];
        const isOver = overStage === s.value;
        return (
          <div
            key={s.value}
            className={`flex h-full shrink-0 w-[260px] flex-col rounded-lg border bg-card/40 transition-colors ${isOver ? "border-primary ring-1 ring-primary/40" : "border-border"}`}
            onDragOver={(e) => { e.preventDefault(); setOverStage(s.value); }}
            onDragLeave={() => setOverStage((cur) => (cur === s.value ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              const id = dragId || e.dataTransfer.getData("text/plain");
              setDragId(null);
              if (!id) return;
              const lead = leads.find((l) => l.id === id);
              const cur = lead?.stage_id || lead?.status_lead || lead?.status;
              if (cur === s.value) return;
              onMoveLead(id, s.value);
            }}
          >
            <div className="shrink-0 z-50 border-b border-border/70 bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide truncate">{s.label}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{items.length}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total: <span className="font-medium text-foreground">{fmt(totals[s.value])}</span></p>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {items.map((l) => {
                const valor = leadContractValue(l);
                const statusTokens = showCsInsteadOfPartner ? healthStatusColor(l.health_status) : null;
                const impactTokens = showCsInsteadOfPartner ? impactColor(l.impact_level) : null;
                const hasStatus = showCsInsteadOfPartner && normalizeHealthStatus(l.health_status) !== "SEM_STATUS_CLIENTE";
                const hasImpact = showCsInsteadOfPartner && normalizeImpact(l.impact_level) !== "SEM_IMPACTO";
                const isExpanded = expandedCardId === l.id;
                const revVar = typeof l.revenue_variation === "number" ? l.revenue_variation : null;
                const revTrend = revVar == null ? null : revVar > EPSILON ? "up" : revVar < -EPSILON ? "down" : "neutral";
                const RevIcon = revTrend === "up" ? ArrowUp : revTrend === "down" ? ArrowDown : ArrowRight;
                const revColor = revTrend === "up" ? "text-[#00624b]" : revTrend === "down" ? "text-red-600" : "text-muted-foreground";
                const days = commercialMode ? (stageDaysByLead[l.id] ?? null) : null;
                const stripeClass =
                  days == null ? "" :
                  days >= 10 ? "bg-red-500" :
                  days >= 5 ? "bg-yellow-400" : "";
                const badgeClass =
                  days == null ? "bg-secondary text-foreground border-border" :
                  days >= 10 ? "bg-red-500 text-white border-red-600" :
                  days >= 5 ? "bg-yellow-400 text-black border-yellow-500" :
                  "bg-secondary text-foreground border-border";
                return (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(l.id);
                      e.dataTransfer.setData("text/plain", l.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => { setDragId(null); setOverStage(null); }}
                    onClick={() => {
                      if (selectedCardId === l.id) {
                        onOpenLead(l);
                        return;
                      }
                      setSelectedCardId(l.id);
                    }}
                    onDoubleClick={(e) => {
                      if (!showCsInsteadOfPartner) return;
                      e.stopPropagation();
                      e.preventDefault();
                      setExpandedCardId((prev) => (prev === l.id ? null : l.id));
                    }}
                    className={`group relative rounded-md border border-border bg-background overflow-hidden cursor-pointer hover:border-primary/60 transition-colors ${showCsInsteadOfPartner ? "p-0" : "p-2.5"} ${dragId === l.id ? "opacity-50" : ""} ${selectedCardId === l.id ? "ring-1 ring-primary/60" : ""}`}
                    title={commercialMode && days != null ? `${days} dia${days === 1 ? "" : "s"} nesta coluna` : (showCsInsteadOfPartner ? (isExpanded ? "Duplo clique para recolher" : "Duplo clique para expandir") : (selectedCardId === l.id ? "Clique para abrir" : "Clique para selecionar"))}
                  >
                    {commercialMode && stripeClass && (
                      <div className={`absolute top-0 left-0 right-0 h-1 ${stripeClass}`} />
                    )}
                    {commercialMode && days != null && (
                      <span
                        className={`absolute top-1 right-1 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badgeClass}`}
                      >
                        {days}d
                      </span>
                    )}
                    {showCsInsteadOfPartner && statusTokens && (
                      <div className={`px-2.5 py-1 ${statusTokens.bgClass} ${statusTokens.textOnClass} flex items-center justify-between gap-2`}>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" title={l.nome_fantasia}>{l.nome_fantasia}</p>
                          <p className="text-[9px] uppercase tracking-wide opacity-80">{hasStatus ? statusTokens.label : "Sem status do cliente"}</p>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          : <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />}
                      </div>
                    )}
                    <div className={showCsInsteadOfPartner ? "px-2.5 py-2" : ""}>

                    {selectedCardId === l.id && (canEditCard || canDeleteCard || canCloneCard) && (
                      <div className="flex justify-end gap-1 mb-1.5 flex-wrap">
                        {canEditCard && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={(e) => { e.stopPropagation(); onEditCard?.(l); }}
                          >
                            <Pencil className="mr-1 h-3 w-3" /> Editar
                          </Button>
                        )}
                        {canDeleteCard && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={(e) => { e.stopPropagation(); onDeleteCard?.(l); }}
                          >
                            <Trash2 className="mr-1 h-3 w-3" /> Excluir
                          </Button>
                        )}
                        {canCloneCard && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloneCard?.(l);
                            }}
                          >
                            <Copy className="mr-1 h-3 w-3" /> Clonar
                          </Button>
                        )}
                        {canEditCard && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px]"
                            onClick={(e) => { e.stopPropagation(); onAssignResponsible?.(l); }}
                            title="Definir responsável"
                          >
                            <UserRound className="mr-1 h-3 w-3" /> Responsável
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        {!showCsInsteadOfPartner && (
                          <p className="text-xs font-medium truncate">{l.nome_fantasia}</p>
                        )}
                        {l.partner_code && (
                          <p className="text-[10px] font-mono text-primary truncate">{l.partner_code}</p>
                        )}
                        {showCsInsteadOfPartner ? (
                          l.nome_responsavel && (
                            <p className="text-[10px] text-muted-foreground truncate">Ação: {l.nome_responsavel}</p>
                          )
                        ) : (
                          l.nome_responsavel && (
                            <p className="text-[10px] text-muted-foreground truncate">{l.nome_responsavel}</p>
                          )
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-primary truncate">
                            {showCsInsteadOfPartner
                              ? `CS: ${l.consultor || "—"}`
                              : (parceirosMap[l.parceiro_id || ""] || "—")}
                          </span>
                          {!showCsInsteadOfPartner && valor > 0 && (
                            <span className="text-[10px] font-semibold whitespace-nowrap">{fmt(valor)}</span>
                          )}
                        </div>
                        <div className={`mt-1.5 ${showCsInsteadOfPartner && impactTokens ? `${impactTokens.softBgClass} border-l-2 ${impactTokens.borderClass} rounded-sm p-1` : ""}`}>
                          {showCsInsteadOfPartner && impactTokens && (
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-0.5">
                              Impacto: <span className="font-semibold text-foreground">{hasImpact ? impactTokens.label : "—"}</span>
                            </p>
                          )}
                          {showCsInsteadOfPartner && !isExpanded ? (
                            <div
                              className="flex items-center justify-between gap-2"
                              title={l.revenue_current_month && l.revenue_previous_month ? `Atual: ${l.revenue_current_month} · Anterior: ${l.revenue_previous_month}` : "Receita do cliente"}
                            >
                              <span className="text-[10px] text-muted-foreground">Receita</span>
                              <span className="flex items-center gap-1">
                                <span className="text-xs font-semibold">{l.revenue_current != null ? fmt(Number(l.revenue_current)) : "—"}</span>
                                {revVar != null && (
                                  <span className={`flex items-center gap-0.5 text-[10px] font-medium ${revColor}`}>
                                    <RevIcon className="h-3 w-3" /> {pct(revVar)}
                                  </span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {[
                                { key: "Mensalidade", current: l.valor_mensalidade, previous: l.valor_mensalidade_anterior },
                                { key: "Campanha", current: l.valor_campanhas, previous: l.valor_campanhas_anterior },
                                { key: "Pagamento", current: l.valor_pagamento, previous: l.valor_pagamento_anterior },
                              ].map((metric) => {
                                const v = variation(metric.current, metric.previous);
                                const trend = trendMeta(v);
                                const Icon = trend.icon;
                                return (
                                  <div key={metric.key} className="flex items-center gap-0.5 text-[9px] px-1 py-0.5 rounded bg-secondary/40">
                                    <span className="text-muted-foreground">{metric.key}</span>
                                    <span className={`flex items-center gap-0.5 font-medium ${trend.color}`}>
                                      <Icon className="h-2.5 w-2.5" /> {pct(v)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        {showCampaignStatus && (!showCsInsteadOfPartner || isExpanded) && (
                          <div className="mt-2 space-y-1">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Campanha atual ({l.campaign_status_current_month || "mês atual"})</p>
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${campaignStatusClass(l.campaign_status_current)}`}>{l.campaign_status_current || "Sem status"}</span>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-1">Mês anterior ({l.campaign_status_previous_month || "mês anterior"})</p>
                            <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${campaignStatusClass(l.campaign_status_previous)}`}>{l.campaign_status_previous || "Sem status"}</span>
                          </div>
                        )}
                        {showCampaignStatus && (!showCsInsteadOfPartner || isExpanded) && l.csat_current != null && (
                          <div className="mt-2 flex items-center gap-1 text-[10px]">
                            <Info className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">CSAT:</span>
                            <span className="font-semibold">{l.csat_current.toFixed(1).replace(".", ",")}</span>
                            {l.csat_variation != null && l.csat_direction && (
                              <span className={`flex items-center gap-0.5 ${csatMeta(l.csat_direction).color}`}>
                                {(() => {
                                  const Icon = csatMeta(l.csat_direction).icon;
                                  return <Icon className="h-2.5 w-2.5" />;
                                })()}
                                {l.csat_variation > 0 ? "+" : ""}{l.csat_variation.toFixed(1).replace(".", ",")}
                              </span>
                            )}
                          </div>
                        )}
                        {showCampaignStatus && !showCsInsteadOfPartner && (l.health_status || l.impact_level) && (
                          <div className="mt-2 grid grid-cols-2 gap-1">
                            <div>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Status</p>
                              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${healthStatusClass(l.health_status)}`}>{l.health_status || "—"}</span>
                            </div>
                            <div>
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Impacto</p>
                              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${impactClass(l.impact_level)}`}>{l.impact_level || "—"}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <p className="text-[11px] text-muted-foreground/70 text-center py-4">Solte um lead aqui</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
