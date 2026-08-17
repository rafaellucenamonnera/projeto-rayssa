import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Loader2, Pencil, Plus, Trash2, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createNotifications } from "@/lib/notifications";
import { logCardEvent, notifyCrossCard } from "@/lib/crossCardEvents";

type UserOption = {
  user_id: string;
  nome: string;
  can_be_responsible?: boolean;
};

type RepresentativeTask = {
  id: string;
  representative_card_id: string;
  titulo: string;
  descricao?: string | null;
  due_at: string;
  due_date?: string | null;
  assigned_to: string;
  status: "pendente" | "concluida";
  created_at: string;
  completed_note?: string | null;
  deleted_at?: string | null;
};

interface RepresentativeCardTasksProps {
  cardId: string;
  cardName?: string;
  panelId: string;
  actionUrl?: string;
  canDelete?: boolean;
  cardCnpj?: string | null;
  stageLabel?: string | null;
}

const SELECT_COLS =
  "id,representative_card_id,titulo,descricao,due_at,due_date,assigned_to,status,created_at,completed_note,deleted_at";

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const dueMeta = (dueAt: string, status: string) => {
  if (status === "concluida") {
    return { label: "Concluída", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30" };
  }

  const diff = new Date(dueAt).getTime() - Date.now();

  if (diff < 0) return { label: "Vencida", className: "bg-red-500/10 text-red-700 border-red-500/30" };
  if (diff <= 24 * 60 * 60 * 1000) return { label: "Até 24h", className: "bg-orange-500/10 text-orange-700 border-orange-500/30" };
  if (diff <= 48 * 60 * 60 * 1000) return { label: "Até 48h", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" };

  return { label: "No prazo", className: "bg-secondary text-muted-foreground border-border" };
};

export const RepresentativeCardTasks = ({
  cardId,
  cardName = "card",
  panelId,
  actionUrl,
  canDelete = false,
  cardCnpj = null,
  stageLabel = null,
}: RepresentativeCardTasksProps) => {
  const [tasks, setTasks] = useState<RepresentativeTask[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [filter, setFilter] = useState<"abertas" | "minhas" | "vencidas" | "concluidas">("abertas");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<RepresentativeTask | null>(null);
  const [editForm, setEditForm] = useState({ titulo: "", descricao: "", dueAt: "", assignedTo: "", status: "pendente" });
  const [completing, setCompleting] = useState<RepresentativeTask | null>(null);
  const [completeNote, setCompleteNote] = useState("");

  const usersById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.user_id, u.nome])) as Record<string, string>,
    [users],
  );

  const notifyCross = (type: string, title: string, task: RepresentativeTask, extra: Partial<Parameters<typeof notifyCrossCard>[0]> = {}) =>
    notifyCrossCard({
      cardId,
      panelId,
      type,
      title,
      cliente: cardName,
      cnpj: cardCnpj,
      etapa: stageLabel,
      motivo: `Tarefa "${task.titulo}"`,
      evidencia: `Prazo ${new Date(task.due_at).toLocaleString("pt-BR")} • responsável ${usersById[task.assigned_to] || "—"}`,
      actionUrl,
      extraRecipients: [task.assigned_to],
      deliveryKey: `${type}-${task.id}-${Date.now()}`,
      ...extra,
    });

  const loadTasks = async () => {
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("representative_card_tasks")
      .select(SELECT_COLS)
      .eq("representative_card_id", cardId)
      .is("deleted_at", null)
      .order("status", { ascending: false })
      .order("due_at", { ascending: true, nullsFirst: false });

    setLoading(false);

    if (error) {
      toast.error("Erro ao carregar tarefas");
      return;
    }

    setTasks(((data as any[]) || []) as RepresentativeTask[]);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));

    const loadUsers = async () => {
      const [{ data: profiles }, { data: panelUsers }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id,nome,ativo,can_be_responsible").eq("ativo", true).order("nome", { ascending: true }),
        (supabase as any).from("user_panel_permissions").select("user_id,can_access").eq("panel_id", panelId).eq("can_access", true),
        (supabase as any).from("user_roles").select("user_id,role").eq("role", "admin"),
      ]);

      const allowedIds = new Set(((panelUsers as any[]) || []).map((row) => row.user_id));
      const adminIds = new Set(((roles as any[]) || []).map((row) => row.user_id));

      adminIds.forEach((userId) => allowedIds.add(userId));

      const loaded: UserOption[] = ((profiles as any[]) || [])
        .filter((u) => allowedIds.has(u.user_id))
        .map((u) => ({
          user_id: u.user_id,
          nome: u.nome,
          can_be_responsible: !!u.can_be_responsible || adminIds.has(u.user_id),
        }));

      setUsers(loaded);
    };

    loadUsers();
  }, [panelId]);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === "abertas") return task.status !== "concluida";
      if (filter === "concluidas") return task.status === "concluida";
      if (filter === "minhas") return task.status !== "concluida" && task.assigned_to === currentUserId;
      if (filter === "vencidas") return task.status !== "concluida" && new Date(task.due_at).getTime() < Date.now();
      return true;
    });
  }, [currentUserId, filter, tasks]);

  const createTask = async () => {
    const cleanTitle = titulo.trim();

    if (!cleanTitle) return toast.error("Informe o título da tarefa");
    if (!dueAt) return toast.error("Informe data e hora da entrega");
    if (!assignedTo) return toast.error("Selecione o responsável pela entrega");

    setSaving(true);

    const { data: auth } = await supabase.auth.getUser();

    const payload = {
      representative_card_id: cardId,
      titulo: cleanTitle,
      descricao: descricao.trim() || null,
      due_at: new Date(dueAt).toISOString(),
      assigned_to: assignedTo,
      created_by: auth.user?.id || null,
    };

    const { data, error } = await (supabase as any)
      .from("representative_card_tasks")
      .insert(payload)
      .select(SELECT_COLS)
      .single();

    if (error) {
      setSaving(false);
      toast.error("Erro ao criar tarefa");
      return;
    }

    await createNotifications([
      {
        recipientUserId: assignedTo,
        type: "task_assigned",
        title: "Tarefa",
        message: `Tarefa "${cleanTitle}" no card ${cardName}, com prazo em ${new Date(payload.due_at).toLocaleString("pt-BR")}.`,
        actionUrl,
        representativeCardId: cardId,
        metadata: {
          due_at: payload.due_at,
          assigned_to: assignedTo,
          representative_card_id: cardId,
          representative_task_id: data.id,
        },
        deliveryKey: `representative-task-${data.id}-created-${assignedTo}`,
      },
    ]);

    await logCardEvent(cardId, "task_created", {
      tarefa_id: data.id,
      titulo: cleanTitle,
      prazo: payload.due_at,
      responsavel: assignedTo,
    });

    await notifyCross("cross_task_created", "Tarefa criada", data as RepresentativeTask, {
      acaoRealizada: "Tarefa criada no card.",
      decisaoNecessaria: "Confirmar o responsável e o prazo.",
      proximoPasso: "Executar a tarefa dentro do prazo.",
    });

    setSaving(false);
    setTasks((prev) => [...prev, data as RepresentativeTask]);
    setTitulo("");
    setDescricao("");
    setDueAt("");
    setAssignedTo("");
    toast.success("Tarefa criada e responsável notificado");
  };

  const openEdit = (task: RepresentativeTask) => {
    setEditing(task);
    setEditForm({
      titulo: task.titulo,
      descricao: task.descricao || "",
      dueAt: toLocalInput(task.due_at),
      assignedTo: task.assigned_to,
      status: task.status,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const cleanTitle = editForm.titulo.trim();
    if (!cleanTitle) return toast.error("Informe o título da tarefa");
    if (!editForm.dueAt) return toast.error("Informe data e hora da entrega");
    if (!editForm.assignedTo) return toast.error("Selecione o responsável");

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();

    const patch: Record<string, any> = {
      titulo: cleanTitle,
      descricao: editForm.descricao.trim() || null,
      due_at: new Date(editForm.dueAt).toISOString(),
      assigned_to: editForm.assignedTo,
      status: editForm.status,
      updated_by: auth.user?.id || null,
    };

    if (editForm.status === "pendente") {
      patch.completed_at = null;
    }

    const { data, error } = await (supabase as any)
      .from("representative_card_tasks")
      .update(patch)
      .eq("id", editing.id)
      .select(SELECT_COLS)
      .single();

    setSaving(false);

    if (error) {
      toast.error("Erro ao editar tarefa");
      return;
    }

    const updated = data as RepresentativeTask;
    setTasks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));

    await logCardEvent(cardId, "task_updated", {
      tarefa_id: updated.id,
      antes: {
        titulo: editing.titulo,
        prazo: editing.due_at,
        responsavel: editing.assigned_to,
        status: editing.status,
      },
      depois: {
        titulo: updated.titulo,
        prazo: updated.due_at,
        responsavel: updated.assigned_to,
        status: updated.status,
      },
    });

    await notifyCross("cross_task_updated", "Tarefa editada", updated, {
      acaoRealizada: "Tarefa atualizada no card.",
      decisaoNecessaria: "Validar se o novo prazo e responsável estão corretos.",
      proximoPasso: "Executar a tarefa conforme atualizada.",
    });

    setEditing(null);
    toast.success("Tarefa atualizada");
  };

  const confirmComplete = async () => {
    if (!completing) return;
    const note = completeNote.trim();
    if (!note) return toast.error("Informe a conclusão da tarefa para fechar.");

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();

    const { error } = await (supabase as any)
      .from("representative_card_tasks")
      .update({
        status: "concluida",
        completed_at: new Date().toISOString(),
        completed_note: note.slice(0, 500),
        updated_by: auth.user?.id || null,
      })
      .eq("id", completing.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao concluir tarefa");
      return;
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === completing.id ? { ...item, status: "concluida", completed_note: note.slice(0, 500) } : item,
      ),
    );

    await logCardEvent(cardId, "task_completed", {
      tarefa_id: completing.id,
      titulo: completing.titulo,
      conclusao: note.slice(0, 500),
    });

    await notifyCross("cross_task_completed", "Tarefa concluída", completing, {
      acaoRealizada: "Tarefa concluída com nota de encerramento.",
      evidencia: note.slice(0, 300),
      decisaoNecessaria: "Conferir se a entrega atende ao processo.",
      proximoPasso: "Seguir com a próxima etapa do card.",
    });

    setCompleting(null);
    setCompleteNote("");
    toast.success("Tarefa concluída");
  };

  const removeTask = async (task: RepresentativeTask) => {
    if (!canDelete) return;
    if (!window.confirm(`Excluir a tarefa "${task.titulo}"? O histórico será preservado.`)) return;

    const { data: auth } = await supabase.auth.getUser();

    const { error } = await (supabase as any)
      .from("representative_card_tasks")
      .update({ deleted_at: new Date().toISOString(), updated_by: auth.user?.id || null })
      .eq("id", task.id);

    if (error) {
      toast.error("Erro ao excluir tarefa");
      return;
    }

    setTasks((prev) => prev.filter((item) => item.id !== task.id));

    await logCardEvent(cardId, "task_deleted", { tarefa_id: task.id, titulo: task.titulo });
    await notifyCross("cross_task_deleted", "Tarefa excluída", task, {
      acaoRealizada: "Tarefa removida da lista (exclusão lógica, histórico preservado).",
      decisaoNecessaria: "Confirmar se a tarefa não é mais necessária.",
      proximoPasso: "Recriar a tarefa caso a demanda continue.",
    });

    toast.success("Tarefa excluída (histórico preservado)");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_190px_180px_auto]">
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nova tarefa" maxLength={120} />
        <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />

        <Select value={assignedTo} onValueChange={setAssignedTo}>
          <SelectTrigger>
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            {users.filter((u) => u.can_be_responsible).map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={createTask} disabled={saving} className="shrink-0">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Criar
        </Button>
      </div>

      <Textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Descrição da tarefa (opcional)"
        rows={2}
      />

      <div className="flex flex-wrap gap-2">
        {([
          ["abertas", "Abertas"],
          ["minhas", "Minhas"],
          ["vencidas", "Vencidas"],
          ["concluidas", "Concluídas"],
        ] as const).map(([value, label]) => (
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
              <div key={task.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-medium ${task.status === "concluida" ? "text-muted-foreground line-through" : ""}`}>
                      {task.titulo}
                    </p>
                    <Badge variant="outline" className={meta.className}>
                      {meta.label}
                    </Badge>
                  </div>

                  {task.descricao && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{task.descricao}</p>}

                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(task.due_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>

                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" />
                    Responsável: {usersById[task.assigned_to] || "—"}
                  </p>

                  {task.completed_note && (
                    <p className="text-xs text-muted-foreground">Conclusão: {task.completed_note}</p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(task)} title="Editar tarefa">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  {task.status !== "concluida" && (
                    <Button size="sm" variant="outline" onClick={() => { setCompleting(task); setCompleteNote(""); }}>
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Concluir
                    </Button>
                  )}

                  {canDelete && (
                    <Button size="sm" variant="ghost" onClick={() => removeTask(task)} title="Excluir tarefa">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={editForm.titulo}
              onChange={(e) => setEditForm((p) => ({ ...p, titulo: e.target.value }))}
              placeholder="Título"
              maxLength={120}
            />
            <Textarea
              value={editForm.descricao}
              onChange={(e) => setEditForm((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Descrição"
              rows={3}
            />
            <Input
              type="datetime-local"
              value={editForm.dueAt}
              onChange={(e) => setEditForm((p) => ({ ...p, dueAt: e.target.value }))}
            />
            <Select value={editForm.assignedTo} onValueChange={(v) => setEditForm((p) => ({ ...p, assignedTo: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.filter((u) => u.can_be_responsible).map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={editForm.status} onValueChange={(v) => setEditForm((p) => ({ ...p, status: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!completing} onOpenChange={(open) => !open && setCompleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Concluir tarefa</DialogTitle>
          </DialogHeader>
          <Textarea
            value={completeNote}
            onChange={(e) => setCompleteNote(e.target.value)}
            placeholder="Descreva a conclusão da tarefa (obrigatório)"
            rows={4}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleting(null)}>Cancelar</Button>
            <Button onClick={confirmComplete} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
