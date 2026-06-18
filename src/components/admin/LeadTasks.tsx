import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Loader2, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cardActionUrl, createNotifications } from "@/lib/notifications";

type UserOption = {
  user_id: string;
  nome: string;
  can_be_responsible?: boolean;
};

type LeadTask = {
  id: string;
  lead_id: string;
  titulo: string;
  due_at: string;
  due_date?: string | null;
  assigned_to: string;
  status: "pendente" | "concluida";
  created_at: string;
  participants?: string[];
};

interface LeadTasksProps {
  leadId: string;
  leadName?: string;
  canCreateTask?: boolean;
  canCompleteTask?: boolean;
}

const toLocalInputValue = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const dueMeta = (dueAt: string, status: string) => {
  if (status === "concluida") return { label: "Concluída", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" };
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff < 0) return { label: "Vencida", className: "bg-red-500/10 text-red-700 border-red-500/30" };
  if (diff <= 24 * 60 * 60 * 1000) return { label: "Até 24h", className: "bg-orange-500/10 text-orange-700 border-orange-500/30" };
  if (diff <= 48 * 60 * 60 * 1000) return { label: "Até 48h", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" };
  return { label: "No prazo", className: "bg-secondary text-muted-foreground border-border" };
};

export const LeadTasks = ({ leadId, leadName = "card", canCreateTask = true, canCompleteTask = true }: LeadTasksProps) => {
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [filter, setFilter] = useState<"abertas" | "minhas" | "vencidas" | "concluidas">("abertas");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.user_id, u.nome])), [users]);

  const loadTasks = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_tasks")
      .select("id,lead_id,titulo,due_at,due_date,assigned_to,status,created_at,lead_task_participants(user_id)")
      .eq("lead_id", leadId)
      .order("status", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar tarefas");
      return;
    }
    setTasks(
      ((data as any[]) || []).map((task) => ({
        ...task,
        due_at: task.due_at || (task.due_date ? `${task.due_date}T23:59:00` : ""),
        participants: (task.lead_task_participants || []).map((p: any) => p.user_id),
      })),
    );
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
    const loadUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id,nome,ativo,can_be_responsible")
        .eq("ativo", true)
        .order("nome", { ascending: true });
      const loaded = ((data as any) || []).map((u: any) => ({
        user_id: u.user_id,
        nome: u.nome,
        can_be_responsible: !!u.can_be_responsible,
      }));
      setUsers(loaded);
    };
    loadUsers();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [leadId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === "abertas") return task.status !== "concluida";
      if (filter === "concluidas") return task.status === "concluida";
      if (filter === "minhas") return task.status !== "concluida" && (task.assigned_to === currentUserId || task.participants?.includes(currentUserId || ""));
      if (filter === "vencidas") return task.status !== "concluida" && new Date(task.due_at).getTime() < Date.now();
      return true;
    });
  }, [currentUserId, filter, tasks]);

  const toggleParticipant = (userId: string) => {
    setParticipants((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const createTask = async () => {
    const cleanTitle = titulo.trim();
    if (!cleanTitle) return toast.error("Informe o título da tarefa");
    if (!dueAt) return toast.error("Informe data e hora da entrega");
    if (!assignedTo) return toast.error("Selecione o responsável pela entrega");

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const payload = {
      lead_id: leadId,
      titulo: cleanTitle,
      due_at: new Date(dueAt).toISOString(),
      due_date: dueAt.slice(0, 10),
      assigned_to: assignedTo,
      created_by: auth.user?.id || null,
    };
    const { data, error } = await (supabase as any)
      .from("lead_tasks")
      .insert(payload)
      .select("id,lead_id,titulo,due_at,due_date,assigned_to,status,created_at")
      .single();

    if (error) {
      setSaving(false);
      toast.error("Erro ao criar tarefa");
      return;
    }

    const participantRows = participants
      .filter((userId) => userId !== assignedTo)
      .map((userId) => ({ task_id: data.id, user_id: userId }));
    if (participantRows.length > 0) {
      await (supabase as any).from("lead_task_participants").insert(participantRows);
    }

    const recipients = Array.from(new Set([assignedTo, ...participants])).filter(Boolean);
    await createNotifications(
      recipients.map((recipientUserId) => ({
        recipientUserId,
        type: "task_assigned",
        title: recipientUserId === assignedTo ? "Você recebeu uma tarefa" : "Você foi envolvido em uma tarefa",
        message: `Tarefa "${cleanTitle}" no card ${leadName}, com prazo em ${new Date(payload.due_at).toLocaleString("pt-BR")}.`,
        leadId,
        taskId: data.id,
        actionUrl: cardActionUrl(leadId),
        metadata: { due_at: payload.due_at, assigned_to: assignedTo },
        deliveryKey: `task-${data.id}-created-${recipientUserId}`,
      })),
    );

    setSaving(false);
    setTasks((prev) => [...prev, { ...(data as LeadTask), participants }]);
    setTitulo("");
    setDueAt("");
    setAssignedTo("");
    setParticipants([]);
    toast.success("Tarefa criada e envolvidos notificados");
  };

  const completeTask = async (task: LeadTask) => {
    const { error } = await supabase
      .from("lead_tasks")
      .update({ status: "concluida", completed_at: new Date().toISOString() })
      .eq("id", task.id);
    if (error) {
      toast.error("Erro ao concluir tarefa");
      return;
    }
    setTasks((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: "concluida" } : item)));
    toast.success("Tarefa concluída");
  };

  return (
    <div className="space-y-3">
      {canCreateTask && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_190px_180px_auto]">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nova tarefa" maxLength={120} />
            <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {users.filter((u) => u.can_be_responsible).map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createTask} disabled={saving} className="shrink-0">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Criar
            </Button>
          </div>

          <div className="rounded-md border border-border p-2">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Envolvidos</p>
            <div className="grid max-h-28 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
              {users.map((u) => (
                <label key={u.user_id} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-secondary/60">
                  <Checkbox checked={participants.includes(u.user_id)} onCheckedChange={() => toggleParticipant(u.user_id)} />
                  <span className="truncate">{u.nome}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          ["abertas", "Abertas"],
          ["minhas", "Minhas"],
          ["vencidas", "Vencidas"],
          ["concluidas", "Concluídas"],
        ].map(([value, label]) => (
          <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value as any)}>
            {label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando tarefas...
        </div>
      ) : filteredTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma tarefa para este filtro.</p>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const meta = dueMeta(task.due_at, task.status);
            return (
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-medium ${task.status === "concluida" ? "text-muted-foreground line-through" : ""}`}>
                      {task.titulo}
                    </p>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </div>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(task.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    Responsável: {usersById[task.assigned_to] || "—"}
                    {task.participants && task.participants.length > 0 ? ` · Envolvidos: ${task.participants.map((id) => usersById[id]).filter(Boolean).join(", ")}` : ""}
                  </p>
                </div>
                {task.status !== "concluida" && (
                  <Button size="sm" variant="outline" onClick={() => completeTask(task)}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Concluir
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
