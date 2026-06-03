import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ListTodo, Trash2, Plus, CalendarDays } from "lucide-react";

interface LeadTask {
  id: string;
  titulo: string;
  due_date: string | null;
  status: "pendente" | "concluida";
  completed_at: string | null;
  created_at: string;
}

interface LeadTasksProps {
  leadId: string;
}

export const LeadTasks = ({ leadId }: LeadTasksProps) => {
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [dueDate, setDueDate] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_tasks")
      .select("id, titulo, due_date, status, completed_at, created_at")
      .eq("lead_id", leadId)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error("Erro ao carregar tarefas");
      return;
    }
    setTasks((data as LeadTask[]) || []);
  };

  useEffect(() => {
    load();
  }, [leadId]);

  const addTask = async () => {
    const t = titulo.trim();
    if (!t) {
      toast.error("Informe o título da tarefa");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("lead_tasks").insert({
      lead_id: leadId,
      titulo: t.slice(0, 200),
      due_date: dueDate || null,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar tarefa");
      return;
    }
    setTitulo("");
    setDueDate("");
    toast.success("Tarefa criada");
    load();
  };

  const toggleStatus = async (task: LeadTask, checked: boolean) => {
    const novo = checked ? "concluida" : "pendente";
    const { error } = await (supabase as any)
      .from("lead_tasks")
      .update({
        status: novo,
        completed_at: checked ? new Date().toISOString() : null,
      })
      .eq("id", task.id);
    if (error) {
      toast.error("Erro ao atualizar tarefa");
      return;
    }
    setTasks((prev) =>
      prev.map((x) =>
        x.id === task.id
          ? { ...x, status: novo as LeadTask["status"], completed_at: checked ? new Date().toISOString() : null }
          : x,
      ),
    );
  };

  const removeTask = async (taskId: string) => {
    const { error } = await (supabase as any).from("lead_tasks").delete().eq("id", taskId);
    if (error) {
      toast.error("Erro ao excluir tarefa");
      return;
    }
    setTasks((prev) => prev.filter((x) => x.id !== taskId));
    toast.success("Tarefa excluída");
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";

  const isOverdue = (t: LeadTask) =>
    t.status === "pendente" && t.due_date && new Date(t.due_date + "T23:59:59") < new Date();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <ListTodo className="h-4 w-4" />
        Tarefas
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
        <Input
          placeholder="Nova tarefa..."
          value={titulo}
          maxLength={200}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
        />
        <Input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="sm:w-[160px]"
        />
        <Button onClick={addTask} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma tarefa registrada.</p>
      ) : (
        <ul className="space-y-1.5">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 bg-secondary/40 rounded-md px-2.5 py-1.5"
            >
              <Checkbox
                checked={t.status === "concluida"}
                onCheckedChange={(v) => toggleStatus(t, !!v)}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm truncate ${
                    t.status === "concluida" ? "line-through text-muted-foreground" : ""
                  }`}
                >
                  {t.titulo}
                </p>
                {t.due_date && (
                  <p
                    className={`text-[11px] flex items-center gap-1 ${
                      isOverdue(t) ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <CalendarDays className="h-3 w-3" />
                    {fmtDate(t.due_date)}
                    {isOverdue(t) && <span className="ml-1 font-medium">atrasada</span>}
                  </p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeTask(t.id)}
                title="Excluir tarefa"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
