import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

type IntegrationEvent = {
  id: string;
  provider: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  status: string;
  error: string | null;
  created_at: string;
};

type JiraLink = {
  id: string;
  lead_id: string;
  jira_issue_key: string | null;
  sync_status: string;
  last_error: string | null;
  synced_at: string | null;
  created_at: string;
};

const AdminIntegracoes = () => {
  const { isAdmin } = useAuth();
  const [syncingSlack, setSyncingSlack] = useState(false);
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [jiraLinks, setJiraLinks] = useState<JiraLink[]>([]);
  const [slackUsersCount, setSlackUsersCount] = useState<number | null>(null);

  const loadIntegrationStatus = async () => {
    const [eventsRes, jiraRes, slackCountRes] = await Promise.all([
      (supabase as any)
        .from("integration_events")
        .select("id,provider,event_type,entity_type,entity_id,status,error,created_at")
        .order("created_at", { ascending: false })
        .limit(12),
      (supabase as any)
        .from("jira_card_links")
        .select("id,lead_id,jira_issue_key,sync_status,last_error,synced_at,created_at")
        .order("created_at", { ascending: false })
        .limit(8),
      (supabase as any)
        .from("slack_users")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);
    setEvents((eventsRes.data || []) as IntegrationEvent[]);
    setJiraLinks((jiraRes.data || []) as JiraLink[]);
    setSlackUsersCount(slackCountRes.count ?? null);
  };

  useEffect(() => {
    if (isAdmin) void loadIntegrationStatus();
  }, [isAdmin]);

  const syncSlackUsers = async () => {
    setSyncingSlack(true);
    try {
      const { data, error } = await supabase.functions.invoke("slack-sync-users", { method: "POST" });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Slack sincronizado: ${data.active ?? 0} usuários ativos`);
      await loadIntegrationStatus();
    } catch (error: any) {
      toast.error("Erro ao sincronizar Slack: " + (error.message || "Erro desconhecido"));
    } finally {
      setSyncingSlack(false);
    }
  };

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text text-[#32b89b] shadow-none">Integrações</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Slack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Usuários ativos sincronizados</span>
              <Badge variant="secondary">{slackUsersCount ?? "—"}</Badge>
            </div>
            <Button size="sm" onClick={syncSlackUsers} disabled={syncingSlack}>
              {syncingSlack ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sincronizar usuários Slack
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jira</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {jiraLinks.length === 0 ? (
              <p className="text-muted-foreground">Nenhum card sincronizado ainda.</p>
            ) : jiraLinks.map((link) => (
              <div key={link.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{link.jira_issue_key || "Pendente"}</span>
                  <Badge variant={link.sync_status === "synced" ? "default" : "secondary"}>{link.sync_status}</Badge>
                </div>
                {link.last_error && <p className="mt-1 text-xs text-destructive">{link.last_error}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {events.length === 0 ? (
            <p className="text-muted-foreground">Nenhum evento registrado.</p>
          ) : events.map((event) => (
            <div key={event.id} className="flex flex-col gap-1 rounded-md border border-border p-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{event.provider} · {event.event_type}</p>
                <p className="text-xs text-muted-foreground">{event.entity_type}: {event.entity_id}</p>
                {event.error && <p className="text-xs text-destructive">{event.error}</p>}
              </div>
              <Badge variant={event.status === "sent" ? "default" : "secondary"}>{event.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIntegracoes;
