import { useMemo, useState } from "react";
import { Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
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
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

/** Valor estimado total do contrato do lead (setup + mensalidade*lojas*parcelas + campanhas). */
const leadContractValue = (l: KanbanLeadCardData): number => {
  const setup = Number(l.valor_setup || 0);
  const mens = Number(l.valor_mensalidade || 0);
  const lojas = Number(l.quantidade_lojas || 0);
  const parcelas = Number(l.qtd_parcelas || 0);
  const camp = Number(l.valor_campanhas || 0);
  return setup + mens * (lojas || 1) * (parcelas || 1) + camp;
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
    return g;
  }, [leads, stages]);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    stages.forEach((s) => {
      t[s.value] = (grouped[s.value] || []).reduce((sum, l) => sum + leadContractValue(l), 0);
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
                      setSelectedCardId(l.id);
                    }}
                    onDoubleClick={() => onOpenLead(l)}
                    className={`group rounded-md border border-border bg-background p-2.5 cursor-pointer hover:border-primary/60 transition-colors ${dragId === l.id ? "opacity-50" : ""} ${selectedCardId === l.id ? "ring-1 ring-primary/60" : ""}`}
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
