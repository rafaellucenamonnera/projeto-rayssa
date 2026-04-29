import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Stage = { id: string; value: string; label: string; sort_order: number };

export default function AdminPipelineEdit() {
  const { isInternalUser, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setChecked(true);
      setLoading(false);
      return;
    }

    let canAccess = isAdmin;
    if (!canAccess) {
      const { data: perms } = await (supabase as any)
        .from("module_permissions")
        .select("acao,permitido")
        .eq("user_id", auth.user.id)
        .eq("modulo", "configuracao_painel");
      canAccess = (perms || []).some((p: any) => p.permitido && p.acao === "visualizar");
    }
    setAllowed(canAccess);
    setChecked(true);

    if (canAccess) {
      const { data, error } = await (supabase as any)
        .from("pipeline_stages_config")
        .select("id, value, label, sort_order")
        .order("sort_order", { ascending: true });
      if (error) toast.error("Erro ao carregar etapas");
      setStages((data as Stage[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isInternalUser) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternalUser, isAdmin]);

  if (!isInternalUser) return <Navigate to="/admin/login" replace />;
  if (checked && !allowed) return <Navigate to="/admin" replace />;

  const saveLabel = async (id: string, label: string) => {
    const { error } = await (supabase as any)
      .from("pipeline_stages_config")
      .update({ label })
      .eq("id", id);
    if (error) toast.error("Erro ao salvar");
    else toast.success("Atualizado");
  };

  const addStage = async () => {
    const value = `etapa_${Date.now()}`;
    const { error } = await (supabase as any)
      .from("pipeline_stages_config")
      .insert({ value, label: "Nova coluna", sort_order: stages.length + 1 });
    if (error) toast.error("Erro ao criar");
    else load();
  };

  const removeStage = async (id: string) => {
    if (!confirm("Excluir coluna?")) return;
    const { error } = await (supabase as any)
      .from("pipeline_stages_config")
      .delete()
      .eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text text-[#32b89b] shadow-none">
          Edição de Painel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as colunas do pipeline comercial.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Colunas do pipeline</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={addStage}>
              <Plus className="h-4 w-4 mr-1" /> Nova coluna
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma coluna cadastrada.</p>
          ) : (
            <div className="space-y-2">
              {stages.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-md border border-border p-2"
                >
                  <span className="text-xs text-muted-foreground w-6 text-center">
                    {s.sort_order}
                  </span>
                  <Input
                    defaultValue={s.label}
                    onBlur={(e) => {
                      if (e.target.value !== s.label) saveLabel(s.id, e.target.value);
                    }}
                    maxLength={60}
                    disabled={!isAdmin}
                  />
                  <span className="text-[11px] text-muted-foreground hidden sm:inline truncate max-w-[160px]">
                    {s.value}
                  </span>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive h-8 w-8 shrink-0"
                      onClick={() => removeStage(s.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
