import { useEffect, useMemo, useState, type DragEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";

type Prioridade = "baixa" | "media" | "alta" | "critica";

interface SuccessCard {
  contratante_cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  segmento: string | null;
  municipio: string | null;
  uf: string | null;
  meses_monnera: number | null;
  mensalidade: number | null;
  status_campanha: string | null;
  classificacao: string | null;
  prioridade: Prioridade | null;
  motivo_classificacao: string | null;
  acao_recomendada: string | null;
  stage_id: string | null;
  venda_total: number | null;
  venda_premiada: number | null;
  aderencia: number | null;
  dias_sem_sincronizacao_media: number | null;
  dias_atraso_venda_media: number | null;
  quantidade_cnpjs_sem_sincronizacao: number | null;
  quantidade_cnpjs_atraso_venda: number | null;
  cs_name_snapshot: string | null;
  csat_exp: number | null;
  csat_dono: number | null;
  nps: number | null;
}

interface Stage {
  value: string;
  label: string;
  accent: string;
}

const STAGES: Stage[] = [
  { value: "saudavel",   label: "Saudável",    accent: "bg-emerald-500" },
  { value: "monitorar",  label: "Monitorar",   accent: "bg-sky-500" },
  { value: "risco",      label: "Em Risco",    accent: "bg-amber-500" },
  { value: "critico",    label: "Crítico",     accent: "bg-red-500" },
  { value: "resgate",    label: "Em Resgate",  accent: "bg-fuchsia-500" },
];

const PRIORIDADE_STYLE: Record<Prioridade, string> = {
  critica: "bg-red-50 text-red-700 border-red-200",
  alta:    "bg-orange-50 text-orange-700 border-orange-200",
  media:   "bg-amber-50 text-amber-800 border-amber-200",
  baixa:   "bg-emerald-50 text-emerald-700 border-emerald-200",
};
const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};

const fmtBRL = (v: number | null | undefined) =>
  typeof v === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
    : "—";
const fmtCNPJ = (c: string) =>
  c?.length === 14
    ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
    : c;
const fmtNum = (v: number | null | undefined, d = 0) =>
  typeof v === "number" ? v.toFixed(d) : "—";
const fmtScore = (v: number | null | undefined) => (typeof v === "number" ? String(v) : "—");

const campaignStatusClass = (status?: string | null) => {
  const s = (status || "").toUpperCase();
  if (s.includes("ATIVA")) return "bg-[#e7f4f0] text-[#003729] border-[#b9d8d0]";
  if (s.includes("PAGA")) return "bg-teal-50 text-teal-800 border-teal-200";
  if (s.includes("CHURN")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("INATIVA")) return "bg-[#f5faf8] text-[#4f6d65] border-[#d7e9e4]";
  if (s.includes("IMPLEMENT")) return "bg-[#e7f4f0] text-[#003729] border-[#b9d8d0]";
  return "bg-secondary/40 text-foreground border-border";
};

const classificacaoClass = (c?: string | null) => {
  const s = (c || "").toLowerCase();
  if (s.includes("crít") || s.includes("crit")) return "bg-red-50 text-red-700 border-red-200";
  if (s.includes("risco")) return "bg-orange-50 text-orange-700 border-orange-200";
  if (s.includes("monit") || s.includes("aten")) return "bg-amber-50 text-amber-800 border-amber-200";
  if (s.includes("saud") || s.includes("ok") || s.includes("verde")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-secondary/40 text-foreground border-border";
};

export default function AdminSuccessPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SuccessCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "lista">("kanban");

  // filters
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterCs, setFilterCs] = useState("all");
  const [filterPrioridade, setFilterPrioridade] = useState("all");
  const [filterClassificacao, setFilterClassificacao] = useState("all");
  const [filterCampaign, setFilterCampaign] = useState("all");
  const [filterStage, setFilterStage] = useState<string>("all");

  // drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("success_customer_cards_view")
        .select("*");
      if (cancel) return;
      if (error) {
        toast({ title: "Erro ao carregar Painel Sucesso", description: error.message, variant: "destructive" });
        setRows([]);
      } else {
        setRows((data || []) as SuccessCard[]);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [toast]);

  const csList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.cs_name_snapshot && set.add(r.cs_name_snapshot));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [rows]);

  const classificacoes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.classificacao && set.add(r.classificacao));
    return Array.from(set).sort();
  }, [rows]);

  const campaignList = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.status_campanha && set.add(r.status_campanha));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filterEmpresa.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.razao_social ?? ""} ${r.nome_fantasia ?? ""} ${r.contratante_cnpj}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterCs !== "all" && (r.cs_name_snapshot || "") !== filterCs) return false;
      if (filterPrioridade !== "all" && r.prioridade !== filterPrioridade) return false;
      if (filterClassificacao !== "all" && (r.classificacao || "") !== filterClassificacao) return false;
      if (filterCampaign !== "all" && (r.status_campanha || "") !== filterCampaign) return false;
      if (filterStage !== "all" && (r.stage_id || "monitorar") !== filterStage) return false;
      return true;
    });
  }, [rows, filterEmpresa, filterCs, filterPrioridade, filterClassificacao, filterCampaign, filterStage]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    STAGES.forEach((s) => { c[s.value] = 0; });
    rows.forEach((r) => {
      const s = r.stage_id || "monitorar";
      c[s] = (c[s] || 0) + 1;
    });
    return c;
  }, [rows]);

  const byStage = useMemo(() => {
    const m: Record<string, SuccessCard[]> = {};
    STAGES.forEach((s) => { m[s.value] = []; });
    filtered.forEach((r) => {
      const s = r.stage_id || "monitorar";
      if (!m[s]) m[s] = [];
      m[s].push(r);
    });
    return m;
  }, [filtered]);

  const moveCard = async (cnpj: string, newStage: string) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.contratante_cnpj === cnpj ? { ...r, stage_id: newStage } : r)));
    const { error } = await (supabase as any)
      .from("success_customers")
      .update({ stage_id: newStage })
      .eq("contratante_cnpj", cnpj);
    if (error) {
      setRows(prev);
      toast({ title: "Não foi possível mover o cliente", description: error.message, variant: "destructive" });
    }
  };

  const onDragStart = (e: DragEvent<HTMLDivElement>, id: string) => {
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const onDrop = (e: DragEvent<HTMLDivElement>, stage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    setDraggingId(null);
    if (!id) return;
    const card = rows.find((r) => r.contratante_cnpj === id);
    if (!card || (card.stage_id || "monitorar") === stage) return;
    moveCard(id, stage);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl sm:text-2xl font-display font-bold">Painel Sucesso do Cliente</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 transition-colors ${view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
            >Kanban</button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`px-3 py-1.5 transition-colors ${view === "lista" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
            >Lista</button>
          </div>
        </div>
      </div>

      {/* Stage summary cards */}
      <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
        {STAGES.map((s) => (
          <div
            key={s.value}
            onClick={() => setFilterStage(filterStage === s.value ? "all" : s.value)}
            className={`stat-card !p-3 sm:!p-4 cursor-pointer transition-all min-w-[120px] sm:min-w-0 shrink-0 sm:shrink ${filterStage === s.value ? "ring-2 ring-primary" : ""}`}
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${s.accent}`} />
                <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{s.label}</p>
              </div>
              <p className="text-xl sm:text-2xl font-display font-bold">{stageCounts[s.value] || 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3">
        <Input
          placeholder="Filtrar por empresa ou CNPJ..."
          value={filterEmpresa}
          onChange={(e) => setFilterEmpresa(e.target.value)}
        />
        <Select value={filterCs} onValueChange={setFilterCs}>
          <SelectTrigger><SelectValue placeholder="CS" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos CS</SelectItem>
            {csList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
          <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterClassificacao} onValueChange={setFilterClassificacao}>
          <SelectTrigger><SelectValue placeholder="Classificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas classificações</SelectItem>
            {classificacoes.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCampaign} onValueChange={setFilterCampaign}>
          <SelectTrigger><SelectValue placeholder="Status campanha" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {campaignList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : view === "kanban" ? (
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {STAGES.map((s) => {
              const cards = byStage[s.value] || [];
              return (
                <div
                  key={s.value}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, s.value)}
                  className="rounded-lg border border-border bg-card flex flex-col min-h-[300px]"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${s.accent}`} />
                      <span className="text-sm font-medium">{s.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>
                  </div>
                  <div className="p-2 space-y-2 flex-1">
                    {cards.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-6">
                        Arraste cartões para cá
                      </div>
                    )}
                    {cards.map((r) => (
                      <SuccessCardItem
                        key={r.contratante_cnpj}
                        card={r}
                        onDragStart={(e) => onDragStart(e, r.contratante_cnpj)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      ) : (
        <ListView rows={filtered} />
      )}
    </div>
  );
}

function SuccessCardItem({
  card,
  onDragStart,
}: {
  card: SuccessCard;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
}) {
  const nome = card.nome_fantasia || card.razao_social || "—";
  const razao = card.razao_social && card.nome_fantasia && card.razao_social !== card.nome_fantasia ? card.razao_social : null;
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="rounded-md border border-border bg-background p-2.5 text-xs shadow-sm hover:shadow transition-shadow cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm leading-tight truncate">{nome}</div>
          {razao && <div className="text-[11px] text-muted-foreground truncate">{razao}</div>}
          <div className="text-[11px] text-muted-foreground">{fmtCNPJ(card.contratante_cnpj)}</div>
        </div>
        {card.prioridade && (
          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap ${PRIORIDADE_STYLE[card.prioridade]}`}>
            {PRIORIDADE_LABEL[card.prioridade]}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {card.status_campanha && (
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${campaignStatusClass(card.status_campanha)}`}>
            {card.status_campanha}
          </span>
        )}
        {card.classificacao && (
          <span className={`px-1.5 py-0.5 rounded border text-[10px] ${classificacaoClass(card.classificacao)}`}>
            {card.classificacao}
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <Metric label="NPS" value={fmtScore(card.nps)} />
        <Metric label="CSAT Exp" value={fmtScore(card.csat_exp)} />
        <Metric label="CSAT Dono" value={fmtScore(card.csat_dono)} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Mensalidade</span>
        <span className="font-medium tabular-nums">{fmtBRL(card.mensalidade)}</span>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
        <div className="rounded border border-border px-1.5 py-1 bg-muted/30">
          <div className="text-muted-foreground">Sem sync</div>
          <div className="font-medium tabular-nums">{fmtNum(card.dias_sem_sincronizacao_media, 0)} d</div>
        </div>
        <div className="rounded border border-border px-1.5 py-1 bg-muted/30">
          <div className="text-muted-foreground">Atraso venda</div>
          <div className="font-medium tabular-nums">{fmtNum(card.dias_atraso_venda_media, 0)} d</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] border-t border-border pt-2">
        <span className="text-muted-foreground truncate">CS</span>
        <span className="truncate ml-2 text-right">{card.cs_name_snapshot || "—"}</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-1 py-1 bg-muted/30">
      <div className="text-[9px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="text-xs font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ListView({ rows }: { rows: SuccessCard[] }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-x-auto">
      <TooltipProvider>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>UF</TableHead>
              <TableHead>CS</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Classificação</TableHead>
              <TableHead>Campanha</TableHead>
              <TableHead className="text-center">NPS</TableHead>
              <TableHead className="text-center">CSAT Exp</TableHead>
              <TableHead className="text-center">CSAT Dono</TableHead>
              <TableHead className="text-right">Mensalidade</TableHead>
              <TableHead className="text-right">Sem sync</TableHead>
              <TableHead className="text-right">Atraso venda</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-muted-foreground py-10">
                  Nenhum cliente encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.contratante_cnpj}>
                <TableCell>
                  <div className="font-medium">{r.nome_fantasia || r.razao_social || "—"}</div>
                  <div className="text-xs text-muted-foreground">{fmtCNPJ(r.contratante_cnpj)}</div>
                </TableCell>
                <TableCell>{r.uf || "—"}</TableCell>
                <TableCell>{r.cs_name_snapshot || "—"}</TableCell>
                <TableCell>
                  {r.prioridade ? (
                    <span className={`px-1.5 py-0.5 rounded border text-[11px] ${PRIORIDADE_STYLE[r.prioridade]}`}>
                      {PRIORIDADE_LABEL[r.prioridade]}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {r.classificacao ? (
                    r.motivo_classificacao ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`px-1.5 py-0.5 rounded border text-[11px] cursor-help ${classificacaoClass(r.classificacao)}`}>
                            {r.classificacao}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{r.motivo_classificacao}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className={`px-1.5 py-0.5 rounded border text-[11px] ${classificacaoClass(r.classificacao)}`}>
                        {r.classificacao}
                      </span>
                    )
                  ) : "—"}
                </TableCell>
                <TableCell>
                  {r.status_campanha ? (
                    <span className={`px-1.5 py-0.5 rounded border text-[11px] ${campaignStatusClass(r.status_campanha)}`}>
                      {r.status_campanha}
                    </span>
                  ) : "—"}
                </TableCell>
                <TableCell className="text-center tabular-nums">{fmtScore(r.nps)}</TableCell>
                <TableCell className="text-center tabular-nums">{fmtScore(r.csat_exp)}</TableCell>
                <TableCell className="text-center tabular-nums">{fmtScore(r.csat_dono)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtBRL(r.mensalidade)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(r.dias_sem_sincronizacao_media, 0)} d</TableCell>
                <TableCell className="text-right tabular-nums">{fmtNum(r.dias_atraso_venda_media, 0)} d</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TooltipProvider>
    </div>
  );
}
