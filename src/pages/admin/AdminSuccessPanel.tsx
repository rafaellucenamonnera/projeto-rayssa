import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
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

const PRIORIDADE_ORDER: Record<Prioridade, number> = {
  critica: 0, alta: 1, media: 2, baixa: 3,
};

const PRIORIDADE_STYLE: Record<Prioridade, string> = {
  critica: "bg-red-500/15 text-red-300 border-red-500/40",
  alta: "bg-orange-500/15 text-orange-300 border-orange-500/40",
  media: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
  baixa: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  critica: "Crítica", alta: "Alta", media: "Média", baixa: "Baixa",
};

const fmtBRL = (v: number | null | undefined) =>
  typeof v === "number"
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
    : "—";

const fmtPct = (v: number | null | undefined) =>
  typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—";

const fmtCNPJ = (c: string) =>
  c.length === 14
    ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`
    : c;

const fmtNumber = (v: number | null | undefined, decimals = 1) =>
  typeof v === "number" ? v.toFixed(decimals) : "—";

const fmtScore = (v: number | null | undefined) =>
  typeof v === "number" ? String(v) : "—";

export default function AdminSuccessPanel() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SuccessCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [prioridade, setPrioridade] = useState<string>("todas");
  const [classificacao, setClassificacao] = useState<string>("todas");

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("success_customer_cards_view")
        .select("*");

      if (cancel) return;
      if (error) {
        toast({
          title: "Erro ao carregar Painel Sucesso",
          description: error.message,
          variant: "destructive",
        });
        setRows([]);
      } else {
        setRows((data || []) as SuccessCard[]);
      }
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [toast]);

  const classificacoes = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.classificacao && set.add(r.classificacao));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (prioridade !== "todas" && r.prioridade !== prioridade) return false;
        if (classificacao !== "todas" && r.classificacao !== classificacao) return false;
        if (q) {
          const hay = `${r.razao_social ?? ""} ${r.nome_fantasia ?? ""} ${r.contratante_cnpj}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pa = a.prioridade ? PRIORIDADE_ORDER[a.prioridade] : 99;
        const pb = b.prioridade ? PRIORIDADE_ORDER[b.prioridade] : 99;
        if (pa !== pb) return pa - pb;
        return (a.razao_social ?? "").localeCompare(b.razao_social ?? "");
      });
  }, [rows, search, prioridade, classificacao]);

  const counts = useMemo(() => {
    const c: Record<Prioridade, number> = { critica: 0, alta: 0, media: 0, baixa: 0 };
    rows.forEach((r) => { if (r.prioridade) c[r.prioridade] += 1; });
    return c;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Painel Sucesso</h1>
        <p className="text-sm text-muted-foreground">
          Saúde dos clientes ativos, priorização e indicadores de receita, vendas e CSAT.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["critica", "alta", "media", "baixa"] as Prioridade[]).map((p) => (
          <div
            key={p}
            className={`rounded-lg border px-4 py-3 ${PRIORIDADE_STYLE[p]}`}
          >
            <div className="text-xs uppercase tracking-wide opacity-80">{PRIORIDADE_LABEL[p]}</div>
            <div className="text-2xl font-semibold">{counts[p]}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <Input
          placeholder="Buscar por razão social, nome fantasia ou CNPJ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="md:max-w-sm"
        />
        <Select value={prioridade} onValueChange={setPrioridade}>
          <SelectTrigger className="md:w-48"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas prioridades</SelectItem>
            <SelectItem value="critica">Crítica</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={classificacao} onValueChange={setClassificacao}>
          <SelectTrigger className="md:w-56"><SelectValue placeholder="Classificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas classificações</SelectItem>
            {classificacoes.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>UF / Município</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead className="text-right">Mensalidade</TableHead>
                <TableHead className="text-right">Venda total</TableHead>
                <TableHead className="text-right">Venda premiada</TableHead>
                <TableHead className="text-right">Aderência</TableHead>
                <TableHead className="text-right">Dias s/ sync</TableHead>
                <TableHead className="text-right">Atraso venda</TableHead>
                <TableHead className="text-center">CSAT exp</TableHead>
                <TableHead className="text-center">CSAT dono</TableHead>
                <TableHead className="text-center">NPS</TableHead>
                <TableHead>CS</TableHead>
                <TableHead>Ação recomendada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  {Array.from({ length: 15 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}

              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={15} className="text-center text-muted-foreground py-10">
                    Nenhum cliente encontrado com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}

              {!loading && filtered.map((r) => (
                <TableRow key={r.contratante_cnpj}>
                  <TableCell>
                    <div className="font-medium">{r.razao_social ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.nome_fantasia ?? ""}
                      {r.nome_fantasia ? " · " : ""}
                      {fmtCNPJ(r.contratante_cnpj)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>{r.uf ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.municipio ?? ""}</div>
                  </TableCell>
                  <TableCell>
                    {r.prioridade ? (
                      <Badge variant="outline" className={PRIORIDADE_STYLE[r.prioridade]}>
                        {PRIORIDADE_LABEL[r.prioridade]}
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.motivo_classificacao ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="underline decoration-dotted underline-offset-4 cursor-help">
                            {r.classificacao ?? "—"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">{r.motivo_classificacao}</TooltipContent>
                      </Tooltip>
                    ) : (r.classificacao ?? "—")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.mensalidade)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.venda_total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtBRL(r.venda_premiada)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(r.aderencia)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(r.dias_sem_sincronizacao_media)}
                    {r.quantidade_cnpjs_sem_sincronizacao ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({r.quantidade_cnpjs_sem_sincronizacao} cnpj)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtNumber(r.dias_atraso_venda_media)}
                    {r.quantidade_cnpjs_atraso_venda ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({r.quantidade_cnpjs_atraso_venda} cnpj)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{fmtScore(r.csat_exp)}</TableCell>
                  <TableCell className="text-center tabular-nums">{fmtScore(r.csat_dono)}</TableCell>
                  <TableCell className="text-center tabular-nums">{fmtScore(r.nps)}</TableCell>
                  <TableCell>{r.cs_name_snapshot ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-xs">
                    {r.acao_recomendada ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="line-clamp-2 cursor-help">{r.acao_recomendada}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">{r.acao_recomendada}</TooltipContent>
                      </Tooltip>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TooltipProvider>
      </div>
    </div>
  );
}
