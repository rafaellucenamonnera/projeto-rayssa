import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  lead_id: string | null;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
};

const importantTypes = new Set([
  "card_responsible_assigned",
  "task_assigned",
  "task_deadline_48h",
  "task_deadline_24h",
  "comment_mention",
]);

const groupLabel = (createdAt: string) => {
  const date = new Date(createdAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.floor((today - itemDay) / 86400000);
  if (diffDays === 0) return "Hoje";
  if (diffDays <= 7) return "Esta semana";
  return "Anteriores";
};

export const NotificationCenter = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<AppNotification | null>(null);

  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const grouped = useMemo(() => {
    const result: Record<string, AppNotification[]> = { Hoje: [], "Esta semana": [], Anteriores: [] };
    notifications.forEach((item) => result[groupLabel(item.created_at)].push(item));
    return result;
  }, [notifications]);

  const loadNotifications = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("notifications")
      .select("id,type,title,message,lead_id,action_url,read_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setLoading(false);
    if (!error) setNotifications((data as AppNotification[]) || []);
  };

  useEffect(() => {
    loadNotifications();

    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id || null;
      if (!userId) return;
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_user_id=eq.${userId}` },
          (payload) => {
            const next = payload.new as AppNotification;
            setNotifications((prev) => [next, ...prev].slice(0, 50));
            if (importantTypes.has(next.type)) setActiveModal(next);
          },
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const markRead = async (notification: AppNotification) => {
    if (notification.read_at) return;
    await (supabase as any).rpc("mark_notification_read", { p_notification_id: notification.id });
    setNotifications((prev) =>
      prev.map((item) => (item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item)),
    );
  };

  const markAllRead = async () => {
    await (supabase as any).rpc("mark_all_notifications_read");
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((item) => ({ ...item, read_at: item.read_at || now })));
  };

  const openNotification = async (notification: AppNotification) => {
    await markRead(notification);
    setActiveModal(null);
    if (notification.action_url) navigate(notification.action_url);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative shrink-0" title="Notificações">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(380px,calc(100vw-1rem))] p-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-semibold">Notificações</p>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Marcar lidas
            </Button>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando
              </div>
            ) : notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma notificação.</p>
            ) : (
              Object.entries(grouped).map(([label, items]) =>
                items.length > 0 ? (
                  <div key={label} className="mb-2">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openNotification(item)}
                        className={`mb-1 w-full rounded-md border p-2 text-left transition-colors hover:border-primary/50 ${
                          item.read_at ? "border-border bg-background" : "border-primary/30 bg-primary/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium">{item.title}</p>
                          {!item.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.message}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null,
              )
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{activeModal?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{activeModal?.message}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveModal(null)}>
                Fechar
              </Button>
              {activeModal && (
                <Button onClick={() => openNotification(activeModal)}>
                  Abrir card
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
