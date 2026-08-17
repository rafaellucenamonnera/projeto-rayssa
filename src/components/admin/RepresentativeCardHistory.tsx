import { useCallback, useEffect, useState } from "react";
import { History, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type HistoryRow = {
  id: string;
  action: string;
  actor_label: string | null;
  actor_user_id: string | null;
  source_stage_id: string | null;
  destination_stage_id: string | null;
  payload: Record<string, any> | null;
  created_at: string;
};

interface Props {
  cardId: string;
  stageLabels?: Record<string, string>;
}

const ACTION_LABELS: Record<string, string> = {
  card_created: "Card criado",
  card_updated: "Card editado",
  stage_changed: "Mudança de etapa",
  task_created: "Tarefa criada",
  task_updated: "Tarefa editada",
  task_completed: "Tarefa concluída",
  task_deleted: "Tarefa excluída",
  attachment_added: "Anexo incluído",
  attachment_removed: "Anexo removido",
  block_created: "Bloqueio criado",
  block_resolved: "Bloqueio resolvido",
  note_updated: "Observação atualizada",
  notification_created: "Notificação enviada",
  notification_read: "Notificação lida",
};

export const RepresentativeCardHistory = ({ cardId, stageLabels = {} }: Props) => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("representative_card_history")
      .select("id,action,actor_label,actor_user_id,source_stage_id,destination_stage_id,payload,created_at")
      .eq("representative_card_id", cardId)
      .order("created_at", { ascending: false })
      .limit(200);
    setLoading(false);

    if (error) {
      toast.error("Erro ao carregar histórico do card");
      return;
    }
    setRows((data as HistoryRow[]) || []);
  }, [cardId]);

  useEffect(() => {
    load();
  }, [load]);

  const stageName = (value?: string | null) => (value ? stageLabels[value] || value : null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4" /> Histórico operacional
        </h3>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {rows.length === 0 && !loading ? (
        <p className="text-sm text-muted-foreground">Nenhum registro no histórico deste card ainda.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const from = stageName(row.source_stage_id);
            const to = stageName(row.destination_stage_id);
            const details = Object.entries(row.payload || {})
              .filter(([, value]) => value !== null && value !== "" && value !== undefined)
              .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);

            return (
              <div key={row.id} className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{ACTION_LABELS[row.action] || row.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    por {row.actor_user_id ? row.actor_label || "usuário" : "processo do sistema"}
                  </span>
                </div>

                {row.action === "stage_changed" && (from || to) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {from || "—"} → {to || "—"}
                  </p>
                )}

                {details.length > 0 && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{details.join(" • ")}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RepresentativeCardHistory;
