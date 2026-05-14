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

type Panel = { id: string; name: string; sort_order: number };

export default function AdminPipelineEdit() {
  const { isInternalUser, isAdmin } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [stageCache, setStageCache] = useState<Record<string, Stage[]>>({});
  const [loading, setLoading] = useState(false);
  const [creatingPanel, setCreatingPanel] = useState(false);

  const stages = stageCache[selectedPanelId] || [];
  const currentPanel = panels.find((p) => p.id === selectedPanelId);

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

  const loadPanels = async () => {
    const { data, error } = await (supabase as any)
      .from("pipeline_panels")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar painéis");
      return;
    }
    const list = (data as Panel[]) || [];
    setPanels(list);
    if (list.length && !selectedPanelId) setSelectedPanelId(list[0].id);
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
    if (allowed) loadPanels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (allowed && selectedPanelId) loadPanelStages(selectedPanelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, selectedPanelId]);

  if (!isInternalUser) return <Navigate to="/admin/login" replace />;
  if (checked && !allowed) return <Navigate to="/admin" replace />;

  const savePanelName = async (id: string, name: string) => {
    const { error } = await (supabase as any)
      .from("pipeline_panels")
      .update({ name })
      .eq("id", id);
    if (error) toast.error("Erro ao salvar painel");
    else {
      toast.success("Painel atualizado");
      loadPanels();
    }
  };

  const createPanel = async () => {
    if (!isAdmin || creatingPanel) return;
    const rawName = window.prompt("Nome do novo painel:");
    if (rawName === null) return;
    const name = rawName.trim();
    if (!name) {
      toast.error("Informe um nome para o painel");
      return;
    }
    if (panels.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast.error("Já existe um painel com esse nome");
      return;
    }
    setCreatingPanel(true);
    const newId = `painel_${Date.now().toString(36)}`;
    const { data, error } = await (supabase as any)
      .from("pipeline_panels")
      .insert({
        id: newId,
        name,
        sort_order: panels.length + 1,
      })
      .select("id")
      .single();
    if (error || !data?.id) {
      toast.error("Erro ao criar painel");
      setCreatingPanel(false);
      return;
    }
    const stageValue = `etapa_${data.id}_novo`;
    const { error: stageError } = await (supabase as any)
      .from("pipeline_stages_config")
      .insert({
        value: stageValue,
        label: "Novo",
        sort_order: 1,
        panel_key: data.id,
      });
    if (stageError) {
      await (supabase as any).from("pipeline_panels").delete().eq("id", data.id);
      toast.error("Erro ao criar coluna padrão. Painel revertido.");
      setCreatingPanel(false);
      return;
    }
    toast.success("Painel criado");
    await loadPanels();
    setSelectedPanelId(data.id);
    setCreatingPanel(false);
  };

  const deletePanel = async () => {
    if (!isAdmin || !selectedPanelId) return;
    if (!confirm("Excluir painel e todas as colunas relacionadas?")) return;

    const { error: stageError } = await (supabase as any)
      .from("pipeline_stages_config")
      .delete()
      .eq("panel_key", selectedPanelId);
    if (stageError) {
      toast.error("Erro ao excluir colunas do painel");
      return;
    }

    const { error: panelError } = await (supabase as any)
      .from("pipeline_panels")
      .delete()
      .eq("id", selectedPanelId);
    if (panelError) {
      toast.error("Erro ao excluir painel");
      return;
    }

    toast.success("Painel excluído");
    setStageCache((prev) => {
      const next = { ...prev };
      delete next[selectedPanelId];
      return next;
    });
    setSelectedPanelId("");
    loadPanels();
  };

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
          Gerencie os painéis e as colunas de cada um.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Selecionar Painel</CardTitle>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={createPanel} disabled={creatingPanel}>
                  {creatingPanel ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Novo Painel
                </Button>
                <Button size="sm" variant="destructive" onClick={deletePanel} disabled={!selectedPanelId}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir Painel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Painel</Label>
            <Select value={selectedPanelId} onValueChange={setSelectedPanelId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {panels.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentPanel && isAdmin && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Nome do painel selecionado
              </Label>
              <Input
                key={currentPanel.id}
                defaultValue={currentPanel.name}
                maxLength={80}
                className="max-w-md"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== currentPanel.name)
                    savePanelName(currentPanel.id, e.target.value.trim());
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                ID interno: {currentPanel.id}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Colunas do painel</CardTitle>
          {isAdmin && selectedPanelId && (
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
