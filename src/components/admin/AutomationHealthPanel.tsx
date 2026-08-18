import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, RefreshCw } from "lucide-react";

interface RunRow {
  id: string;
  stage: string;
  card_id: string | null;
  status: string;
  error: string | null;
  origin: string | null;
  attempt: number;
  started_at: string;
  finished_at: string | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sucesso: "default",
  erro: "destructive",
  timeout: "destructive",
  duplicado: "secondary",
  ignorado: "outline",
  iniciado: "secondary",
};

export default function AutomationHealthPanel() {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("all");
  const [cardFilter, setCardFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("automation_runs")
      .select("id, stage, card_id, status, error, origin, attempt, started_at, finished_at")
      .order("started_at", { ascending: false })
      .limit(200);
    setRuns(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stages = useMemo(() => Array.from(new Set(runs.map((r) => r.stage))).sort(), [runs]);

  const lastByStage = useMemo(() => {
    const map = new Map<string, RunRow>();
    for (const r of runs) if (!map.has(r.stage)) map.set(r.stage, r);
    return Array.from(map.values());
  }, [runs]);

  const filtered = useMemo(
    () =>
      runs.filter(
        (r) =>
          (stage === "all" || r.stage === stage) &&
          (!cardFilter.trim() || (r.card_id ?? "").includes(cardFilter.trim())),
      ),
    [runs, stage, cardFilter],
  );

  const failures = filtered.filter((r) => r.status === "erro" || r.status === "timeout");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Activity className="h-4 w-4" /> Saúde das automações
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger>
              <SelectValue placeholder="Etapa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as etapas</SelectItem>
              {stages.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Filtrar por card_id" value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {lastByStage.map((r) => (
            <div key={r.stage} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.stage}</span>
                <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                última execução: {new Date(r.started_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))}
          {lastByStage.length === 0 && <p className="text-muted-foreground text-xs">Nenhuma execução registrada.</p>}
        </div>

        {failures.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-1">
            <p className="font-medium">{failures.length} falha(s) recente(s)</p>
            {failures.slice(0, 5).map((f) => (
              <p key={f.id} className="text-xs text-muted-foreground break-words">
                {f.stage} • {new Date(f.started_at).toLocaleString("pt-BR")} — {f.error ?? "sem detalhe"}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-1 max-h-80 overflow-auto">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.stage}</span>
                <Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground break-all">
                {new Date(r.started_at).toLocaleString("pt-BR")} • tentativa {r.attempt}
                {r.origin ? ` • origem ${r.origin}` : ""}
                {r.card_id ? ` • card ${r.card_id}` : ""}
              </p>
              {r.error && <p className="text-xs text-destructive break-words">{r.error}</p>}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground text-xs">Nenhum registro para o filtro atual.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
