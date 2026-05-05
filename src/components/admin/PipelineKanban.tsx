import { useMemo, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Copy, GripVertical, Pencil, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanLeadCardData {
  id: string;
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
}

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
  if (v > EPSILON) return { icon: ArrowUp, color: "text-emerald-500", label: "Alta" };
  if (v < -EPSILON) return { icon: ArrowDown, color: "text-red-500", label: "Queda" };
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

export const PipelineKanban = ({
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
}: PipelineKanbanProps) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const g: Record<string, KanbanLeadCardData[]> = {};
    stages.forEach((s) => { g[s.value] = []; });
    leads.forEach((l) => {
      const s = l.status_lead || l.status || "novo_lead";
      if (g[s]) g[s].push(l);
    });
    Object.keys(g).forEach((stageKey) => {
      g[stageKey] = g[stageKey].sort((a, b) => leadPriorityScore(b) - leadPriorityScore(a));
    });
    return g;
  }, [leads, stages]);

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
    <div className="flex gap-3 overflow-x-auto pb-3">
      {stages.map((s) => {
        const items = grouped[s.value] || [];
        const isOver = overStage === s.value;
        return (
          <div
            key={s.value}
            className={`shrink-0 w-[260px] rounded-lg border bg-card/40 transition-colors ${isOver ? "border-primary ring-1 ring-primary/40" : "border-border"}`}
            onDragOver={(e) => { e.preventDefault(); setOverStage(s.value); }}
            onDragLeave={() => setOverStage((cur) => (cur === s.value ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setOverStage(null);
              const id = dragId || e.dataTransfer.getData("text/plain");
              setDragId(null);
              if (!id) return;
              const lead = leads.find((l) => l.id === id);
              const cur = lead?.status_lead || lead?.status;
              if (cur === s.value) return;
              onMoveLead(id, s.value);
            }}
          >
            <div className="px-3 py-2 border-b border-border/60 sticky top-0 bg-card/80 backdrop-blur z-10">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide truncate">{s.label}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{items.length}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total: <span className="font-medium text-foreground">{fmt(totals[s.value])}</span></p>
            </div>

            <div className="p-2 space-y-2 min-h-[120px]">
              {items.map((l) => {
                const valor = leadContractValue(l);
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
                    className={`group rounded-md border border-border bg-background p-2.5 cursor-pointer hover:border-primary/60 transition-colors ${dragId === l.id ? "opacity-50" : ""} ${selectedCardId === l.id ? "ring-1 ring-primary/60" : ""}`}
                    title={selectedCardId === l.id ? "Clique para abrir" : "Clique para selecionar"}
                  >
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
                        <p className="text-xs font-medium truncate">{l.nome_fantasia}</p>
                        {l.nome_responsavel && (
                          <p className="text-[10px] text-muted-foreground truncate">{l.nome_responsavel}</p>
                        )}
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-primary truncate">{parceirosMap[l.parceiro_id || ""] || "—"}</span>
                          {valor > 0 && (
                            <span className="text-[10px] font-semibold whitespace-nowrap">{fmt(valor)}</span>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1">
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
};
