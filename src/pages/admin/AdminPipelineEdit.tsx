import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

type Stage = {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  panel_key: string;
};

const PANELS = [
  { id: "comercial", label: "Painel Comercial" },
  { id: "onboarding", label: "Painel Onboarding / Integração" },
  { id: "sucesso", label: "Painel Sucesso" },
  { id: "campanhas", label: "Painel Criação Campanhas" },
];

export default function AdminPipelineEdit() {
  const { isInternalUser, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [selectedPanelId, setSelectedPanelId] = useState(PANELS[0].id);
  const [stageCache, setStageCache] = useState<Record<string, Stage[]>>({});
  const [loading, setLoading] = useState(false);

  const stages = stageCache[selectedPanelId] || [];

  const loadPermission = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setChecked(true);
      return;
    }
    if (isAdmin) {
      setAllowed(true);
      setChecked(true);
      return;
    }
    const { data: perms } = await (supabase as any)
      .from("module_permissions")
      .select("acao,permitido")
      .eq("user_id", auth.user.id)
      .eq("modulo", "configuracao_painel");
    const can = (perms || []).some((p: any) => p.permitido && p.acao === "visualizar");
    setAllowed(can);
    setChecked(true);
  };

  const loadPanelStages = async (panelId: string, force = false) => {
    if (!panelId) return;
    if (!force && stageCache[panelId]) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("pipeline_stages_config")
      .select("id, value, label, sort_order, panel_key")
      .eq("panel_key", panelId)
      .order("sort_order", { ascending: true });
    if (error) toast.error("Erro ao carregar estágios");
    setStageCache((prev) => ({ ...prev, [panelId]: (data as Stage[]) || [] }));
    setLoading(false);
  };

  useEffect(() => {
    if (isInternalUser) loadPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInternalUser, isAdmin]);

  useEffect(() => {
    if (allowed) loadPanelStages(selectedPanelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, selectedPanelId]);

  if (!isInternalUser) return <Navigate to="/admin/login" replace />;
  if (checked && !allowed) return <Navigate to="/admin" replace />;

  const saveLabel = async (id: string, label: string) => {
    const { error } = await (supabase as any)
      .from("pipeline_stages_config")
      .update({ label })
      .eq("id", id)
      .eq("panel_key", selectedPanelId);
    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Atualizado");
      loadPanelStages(selectedPanelId, true);
    }
  };

  const addStage = async () => {
    const value = `etapa_${selectedPanelId}_${Date.now()}`;
    const { error } = await (supabase as any)
      .from("pipeline_stages_config")
      .insert({
        value,
        label: "Nova coluna",
        sort_order: stages.length + 1,
        panel_key: selectedPanelId,
      });
    if (error) toast.error("Erro ao criar");
    else loadPanelStages(selectedPanelId, true);
  };

  const removeStage = async (id: string) => {
    if (!confirm("Excluir coluna?")) return;
    const { error } = await (supabase as any)
      .from("pipeline_stages_config")
      .delete()
      .eq("id", id)
      .eq("panel_key", selectedPanelId);
    if (error) toast.error("Erro ao excluir");
    else loadPanelStages(selectedPanelId, true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text text-[#32b89b] shadow-none">
          Edição de Painel
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie as colunas dos painéis comerciais e operacionais.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Selecionar Painel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label className="text-xs text-muted-foreground">Painel</Label>
          <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PANELS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Colunas do painel</CardTitle>
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
