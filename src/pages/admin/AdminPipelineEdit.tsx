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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Undo2 } from "lucide-react";

type Stage = {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  panel_key: string;
};

type Panel = { id: string; name: string; sort_order: number };

type HistoryActionType =
  | "rename_stage"
  | "add_stage"
  | "delete_stage"
  | "rename_panel"
  | "create_panel"
  | "delete_panel";

type HistoryRow = {
  id: string;
  panel_id: string;
  action_type: HistoryActionType;
  summary: string;
  snapshot: any;
  created_at: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
};

const DIALOG_TITLE = "Deseja realmente excluir e ou editar o painel?";

export default function AdminPipelineEdit() {
  const { isInternalUser, isAdmin, user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [canManagePanels, setCanManagePanels] = useState(false);
  const [checked, setChecked] = useState(false);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>("");
  const [stageCache, setStageCache] = useState<Record<string, Stage[]>>({});
  const [loading, setLoading] = useState(false);
  const [creatingPanel, setCreatingPanel] = useState(false);
  const [newPanelName, setNewPanelName] = useState("");
  const [newColumns, setNewColumns] = useState<string[]>(["Novo"]);

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [savingAction, setSavingAction] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [stageInputKey, setStageInputKey] = useState(0);
  const [panelInputKey, setPanelInputKey] = useState(0);

  const stages = stageCache[selectedPanelId] || [];
  const currentPanel = panels.find((p) => p.id === selectedPanelId);

  const openConfirm = (cfg: Omit<ConfirmState, "open">) => {
    setConfirmState({ ...cfg, open: true });
  };
  const closeConfirm = () => setConfirmState((s) => (s ? { ...s, open: false } : s));

  // ---------- Permissions ----------
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
    const canManage = (perms || []).some(
      (p: any) => p.permitido && ["editar", "criar_estagio"].includes(p.acao),
    );
    setAllowed(can);
    setCanManagePanels(canManage);
    setChecked(true);
  };

  // ---------- Loaders ----------
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

  const loadHistory = async (panelId: string) => {
    if (!panelId) {
      setHistory([]);
      return;
    }
    const { data, error } = await (supabase as any)
      .from("pipeline_panel_edit_history")
      .select("id, panel_id, action_type, summary, snapshot, created_at")
      .eq("panel_id", panelId)
      .is("reverted_at", null)
      .order("created_at", { ascending: false })
      .limit(3);
    if (error) {
      console.error("[loadHistory]", error);
      setHistory([]);
      return;
    }
    setHistory((data as HistoryRow[]) || []);
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
    if (allowed && selectedPanelId) {
      loadPanelStages(selectedPanelId);
      loadHistory(selectedPanelId);
    } else {
      setHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, selectedPanelId]);

  if (!isInternalUser) return <Navigate to="/admin/login" replace />;
  if (checked && !allowed) return <Navigate to="/admin" replace />;

  // ---------- Helpers: history ----------
  const recordHistory = async (
    panelId: string,
    actionType: HistoryActionType,
    summary: string,
    snapshot: any,
  ) => {
    const { error } = await (supabase as any)
      .from("pipeline_panel_edit_history")
      .insert({
        panel_id: panelId,
        action_type: actionType,
        summary,
        snapshot,
        created_by: user?.id ?? null,
      });
    if (error) console.error("[recordHistory]", error);
  };

  // ---------- Helpers: cards ----------
  const countCardsInStage = async (panelId: string, stageValue: string) => {
    const [leadsRes, repRes] = await Promise.all([
      (supabase as any)
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("panel_id", panelId)
        .eq("status_lead", stageValue),
      (supabase as any)
        .from("representative_cards")
        .select("id", { count: "exact", head: true })
        .eq("panel_id", panelId)
        .eq("stage_id", stageValue),
    ]);
    const leads = leadsRes.count || 0;
    const representative_cards = repRes.count || 0;
    return { leads, representative_cards, total: leads + representative_cards };
  };

  const countCardsInPanel = async (panelId: string) => {
    const [leadsRes, repRes] = await Promise.all([
      (supabase as any)
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("panel_id", panelId),
      (supabase as any)
        .from("representative_cards")
        .select("id", { count: "exact", head: true })
        .eq("panel_id", panelId),
    ]);
    const leads = leadsRes.count || 0;
    const representative_cards = repRes.count || 0;
    return { leads, representative_cards, total: leads + representative_cards };
  };

  const moveStageCards = async (panelId: string, fromValue: string, toValue: string) => {
    const [leadsRes, repRes] = await Promise.all([
      (supabase as any)
        .from("leads")
        .update({ status_lead: toValue })
        .eq("panel_id", panelId)
        .eq("status_lead", fromValue),
      (supabase as any)
        .from("representative_cards")
        .update({ stage_id: toValue })
        .eq("panel_id", panelId)
        .eq("stage_id", fromValue),
    ]);
    if (leadsRes.error) console.error("[moveStageCards leads]", leadsRes.error);
    if (repRes.error) console.error("[moveStageCards representative_cards]", repRes.error);
  };

  // ---------- Panel actions ----------
  const savePanelName = (panel: Panel, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === panel.name) {
      setPanelInputKey((k) => k + 1);
      return;
    }
    openConfirm({
      title: DIALOG_TITLE,
      description: "Confirme para salvar a alteração no painel.",
      confirmLabel: "Confirmar",
      onCancel: () => setPanelInputKey((k) => k + 1),
      onConfirm: async () => {
        setSavingAction(true);
        const snapshot = {
          panel: { id: panel.id, name: panel.name, sort_order: panel.sort_order },
          previous_name: panel.name,
        };
        const { error } = await (supabase as any)
          .from("pipeline_panels")
          .update({ name: trimmed })
          .eq("id", panel.id);
        if (error) {
          toast.error("Erro ao salvar painel");
          setPanelInputKey((k) => k + 1);
        } else {
          await recordHistory(
            panel.id,
            "rename_panel",
            `Renomeou painel "${panel.name}" → "${trimmed}"`,
            snapshot,
          );
          toast.success("Painel atualizado");
          await loadPanels();
          await loadHistory(panel.id);
        }
        setSavingAction(false);
      },
    });
  };

  const createPanel = async () => {
    if (!isAdmin && !canManagePanels) return;
    if (creatingPanel) return;
    const panelName = newPanelName.trim();
    if (!panelName) {
      toast.error("Nome do painel é obrigatório");
      return;
    }
    if (panels.some((p) => p.name.toLowerCase() === panelName.toLowerCase())) {
      toast.error("Já existe um painel com esse nome");
      return;
    }
    const cleanedColumns = newColumns.map((c) => c.trim()).filter(Boolean);
    if (cleanedColumns.length === 0) {
      toast.error("Adicione pelo menos uma coluna");
      return;
    }
    if (new Set(cleanedColumns.map((c) => c.toLowerCase())).size !== cleanedColumns.length) {
      toast.error("Não pode haver colunas duplicadas");
      return;
    }
    setCreatingPanel(true);
    const newId = `painel_${Date.now().toString(36)}`;
    const { data, error } = await (supabase as any)
      .from("pipeline_panels")
      .insert({
        id: newId,
        name: panelName,
        sort_order: panels.length + 1,
      })
      .select("id, name, sort_order")
      .single();
    if (error || !data?.id) {
      setCreatingPanel(false);
      toast.error("Erro ao criar painel");
      return;
    }
    const { data: insertedStages, error: stageError } = await (supabase as any)
      .from("pipeline_stages_config")
      .insert(
        cleanedColumns.map((columnName, index) => ({
          value: `etapa_${newId}_${index + 1}`,
          label: columnName,
          sort_order: index + 1,
          panel_key: newId,
        })),
      )
      .select("id, value, label, sort_order, panel_key");
    if (stageError) {
      await (supabase as any).from("pipeline_panels").delete().eq("id", newId);
      setCreatingPanel(false);
      toast.error("Não foi possível criar o painel");
      return;
    }
    const snapshot = {
      panel: { id: data.id, name: data.name, sort_order: data.sort_order },
      stages: insertedStages || [],
    };
    await recordHistory(
      data.id,
      "create_panel",
      `Criou painel "${data.name}" com ${(insertedStages || []).length} coluna(s)`,
      snapshot,
    );
    toast.success("Painel criado com sucesso");
    await loadPanels();
    setSelectedPanelId(data.id);
    setNewPanelName("");
    setNewColumns(["Novo"]);
    setCreatingPanel(false);
    await loadHistory(data.id);
  };

  const deletePanel = async () => {
    if (!isAdmin || !selectedPanelId) return;
    const panel = panels.find((p) => p.id === selectedPanelId);
    if (!panel) return;

    const panelStages = stageCache[selectedPanelId] || [];
    const counts = await countCardsInPanel(selectedPanelId);
    openConfirm({
      title: DIALOG_TITLE,
      description: `Todas as ${panelStages.length} coluna(s) e ${counts.total} card(s) associados serão afetados. Esta ação pode ser desfeita usando o botão Reverter.`,
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        setSavingAction(true);
        // Load full stages snapshot
        const { data: stagesSnap } = await (supabase as any)
          .from("pipeline_stages_config")
          .select("id, value, label, sort_order, panel_key")
          .eq("panel_key", selectedPanelId)
          .order("sort_order", { ascending: true });
        const snapshot = {
          panel: { id: panel.id, name: panel.name, sort_order: panel.sort_order },
          stages: stagesSnap || [],
          affected_cards: {
            leads: counts.leads,
            representative_cards: counts.representative_cards,
          },
        };
        await recordHistory(
          panel.id,
          "delete_panel",
          `Excluiu painel "${panel.name}" (${(stagesSnap || []).length} coluna(s))`,
          snapshot,
        );

        const { error: stageError } = await (supabase as any)
          .from("pipeline_stages_config")
          .delete()
          .eq("panel_key", selectedPanelId);
        if (stageError) {
          toast.error("Erro ao excluir colunas do painel");
          setSavingAction(false);
          return;
        }
        const { error: panelError } = await (supabase as any)
          .from("pipeline_panels")
          .delete()
          .eq("id", selectedPanelId);
        if (panelError) {
          toast.error("Erro ao excluir painel");
          setSavingAction(false);
          return;
        }
        toast.success("Painel excluído");
        setStageCache((prev) => {
          const next = { ...prev };
          delete next[selectedPanelId];
          return next;
        });
        const deletedId = selectedPanelId;
        setSelectedPanelId("");
        await loadPanels();
        await loadHistory(deletedId);
        setSavingAction(false);
      },
    });
  };

  // ---------- Stage actions ----------
  const saveLabel = (stage: Stage, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === stage.label) {
      setStageInputKey((k) => k + 1);
      return;
    }
    // Count affected cards
    (async () => {
      const counts = await countCardsInStage(stage.panel_key, stage.value);
      const description =
        counts.total > 0
          ? `Esta alteração impactará ${counts.total} card(s) existentes nesta coluna (leads + representantes).`
          : "Confirme para salvar a alteração.";
      openConfirm({
        title: DIALOG_TITLE,
        description,
        confirmLabel: "Confirmar",
        onCancel: () => setStageInputKey((k) => k + 1),
        onConfirm: async () => {
          setSavingAction(true);
          const snapshot = {
            stage: { ...stage },
            previous_label: stage.label,
          };
          const { error } = await (supabase as any)
            .from("pipeline_stages_config")
            .update({ label: trimmed })
            .eq("id", stage.id)
            .eq("panel_key", stage.panel_key);
          if (error) {
            toast.error("Erro ao salvar");
            setStageInputKey((k) => k + 1);
          } else {
            await recordHistory(
              stage.panel_key,
              "rename_stage",
              `Renomeou coluna "${stage.label}" → "${trimmed}"`,
              snapshot,
            );
            toast.success("Atualizado");
            await loadPanelStages(stage.panel_key, true);
            await loadHistory(stage.panel_key);
          }
          setSavingAction(false);
        },
      });
    })();
  };

  const addStage = async () => {
    const value = `etapa_${selectedPanelId}_${Date.now()}`;
    const sort_order = stages.length + 1;
    const { data, error } = await (supabase as any)
      .from("pipeline_stages_config")
      .insert({
        value,
        label: "Nova coluna",
        sort_order,
        panel_key: selectedPanelId,
      })
      .select("id, value, label, sort_order, panel_key")
      .single();
    if (error || !data) {
      toast.error("Erro ao criar");
      return;
    }
    await recordHistory(
      selectedPanelId,
      "add_stage",
      `Criou coluna "${data.label}"`,
      { stage: data },
    );
    await loadPanelStages(selectedPanelId, true);
    await loadHistory(selectedPanelId);
  };

  const removeStage = async (stage: Stage) => {
    const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);
    if (sorted[0]?.id === stage.id) {
      toast.error("A primeira coluna não pode ser excluída");
      return;
    }
    const prev = [...sorted].reverse().find((s) => s.sort_order < stage.sort_order) || null;
    const counts = await countCardsInStage(stage.panel_key, stage.value);
    const description =
      counts.total > 0
        ? `Esta coluna possui ${counts.total} card(s) (leads + representantes). Ao excluir, eles serão movidos para a coluna anterior: "${prev?.label ?? "—"}".`
        : "Esta ação pode ser desfeita usando o botão Reverter (últimas 3).";
    openConfirm({
      title: DIALOG_TITLE,
      description,
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        setSavingAction(true);
        const snapshot = {
          stage: { ...stage },
          previous_stage: prev ? { value: prev.value, label: prev.label } : null,
          moved_cards: {
            leads: counts.leads,
            representative_cards: counts.representative_cards,
          },
        };
        // 1) record history BEFORE destructive mutation
        await recordHistory(
          stage.panel_key,
          "delete_stage",
          `Excluiu coluna "${stage.label}"${counts.total > 0 ? ` (${counts.total} card(s) movidos)` : ""}`,
          snapshot,
        );
        // 2) move cards to previous stage
        if (counts.total > 0 && prev) {
          await moveStageCards(stage.panel_key, stage.value, prev.value);
        }
        // 3) delete stage
        const { error } = await (supabase as any)
          .from("pipeline_stages_config")
          .delete()
          .eq("id", stage.id)
          .eq("panel_key", stage.panel_key);
        if (error) {
          toast.error(
            "Erro ao excluir coluna. Histórico foi gravado; use o botão Reverter para restaurar.",
          );
        } else {
          toast.success("Coluna excluída");
        }
        await loadPanelStages(stage.panel_key, true);
        await loadHistory(stage.panel_key);
        setSavingAction(false);
      },
    });
  };

  // ---------- Revert ----------
  const handleRevert = async () => {
    if (history.length === 0 || savingAction) return;
    const entry = history[0];
    setSavingAction(true);
    try {
      const s = entry.snapshot || {};
      let toastMsg = "Edição revertida";
      switch (entry.action_type) {
        case "rename_stage": {
          const { error } = await (supabase as any)
            .from("pipeline_stages_config")
            .update({ label: s.previous_label })
            .eq("id", s.stage.id);
          if (error) throw error;
          break;
        }
        case "add_stage": {
          const { error } = await (supabase as any)
            .from("pipeline_stages_config")
            .delete()
            .eq("id", s.stage.id);
          if (error) throw error;
          break;
        }
        case "delete_stage": {
          const { error: insErr } = await (supabase as any)
            .from("pipeline_stages_config")
            .insert({
              id: s.stage.id,
              value: s.stage.value,
              label: s.stage.label,
              sort_order: s.stage.sort_order,
              panel_key: s.stage.panel_key,
            });
          if (insErr) throw insErr;
          const moved = (s.moved_cards?.leads || 0) + (s.moved_cards?.representative_cards || 0);
          if (s.previous_stage && moved > 0) {
            await moveStageCards(s.stage.panel_key, s.previous_stage.value, s.stage.value);
            toastMsg =
              "Coluna restaurada. Cards atualmente na coluna anterior foram devolvidos à coluna restaurada.";
          } else {
            toastMsg = "Coluna restaurada";
          }
          break;
        }
        case "rename_panel": {
          const { error } = await (supabase as any)
            .from("pipeline_panels")
            .update({ name: s.previous_name })
            .eq("id", s.panel.id);
          if (error) throw error;
          break;
        }
        case "create_panel": {
          await (supabase as any)
            .from("pipeline_stages_config")
            .delete()
            .eq("panel_key", s.panel.id);
          const { error } = await (supabase as any)
            .from("pipeline_panels")
            .delete()
            .eq("id", s.panel.id);
          if (error) throw error;
          if (selectedPanelId === s.panel.id) setSelectedPanelId("");
          toastMsg = "Criação do painel revertida";
          break;
        }
        case "delete_panel": {
          const { error: panErr } = await (supabase as any)
            .from("pipeline_panels")
            .insert({
              id: s.panel.id,
              name: s.panel.name,
              sort_order: s.panel.sort_order,
            });
          if (panErr) throw panErr;
          if (Array.isArray(s.stages) && s.stages.length > 0) {
            const { error: stErr } = await (supabase as any)
              .from("pipeline_stages_config")
              .insert(
                s.stages.map((st: Stage) => ({
                  id: st.id,
                  value: st.value,
                  label: st.label,
                  sort_order: st.sort_order,
                  panel_key: st.panel_key,
                })),
              );
            if (stErr) throw stErr;
          }
          toastMsg = "Painel restaurado (cards não são recriados)";
          break;
        }
        default:
          throw new Error("Tipo de ação desconhecido");
      }
      await (supabase as any)
        .from("pipeline_panel_edit_history")
        .update({ reverted_at: new Date().toISOString() })
        .eq("id", entry.id);
      toast.success(toastMsg);
      await loadPanels();
      if (selectedPanelId) await loadPanelStages(selectedPanelId, true);
      await loadHistory(entry.panel_id);
      setStageInputKey((k) => k + 1);
      setPanelInputKey((k) => k + 1);
    } catch (err: any) {
      console.error("[handleRevert]", err);
      toast.error("Erro ao reverter edição");
    } finally {
      setSavingAction(false);
    }
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">Selecionar Painel</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRevert}
                disabled={history.length === 0 || savingAction}
                title="Reverte a última edição registrada para o painel selecionado"
              >
                {savingAction ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4 mr-1" />
                )}
                Reverter última edição ({history.length}/3)
              </Button>
              {(isAdmin || canManagePanels) && (
                <>
                  <Button size="sm" onClick={createPanel} disabled={creatingPanel}>
                    {creatingPanel ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Salvar
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={deletePanel}
                      disabled={!selectedPanelId || savingAction}
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Excluir Painel
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isAdmin || canManagePanels) && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Nome do novo painel</Label>
                <Input
                  value={newPanelName}
                  onChange={(e) => setNewPanelName(e.target.value)}
                  maxLength={80}
                  placeholder="Ex: Painel Expansão"
                  className="max-w-md"
                  disabled={!isAdmin && !canManagePanels}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Colunas do novo painel</Label>
                {newColumns.map((column, index) => (
                  <div key={index} className="flex items-center gap-2 max-w-md">
                    <Input
                      value={column}
                      onChange={(e) =>
                        setNewColumns((prev) =>
                          prev.map((item, idx) => (idx === index ? e.target.value : item)),
                        )
                      }
                      placeholder={`Coluna ${index + 1}`}
                      disabled={!isAdmin && !canManagePanels}
                    />
                    {(isAdmin || canManagePanels) && newColumns.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-8 w-8 shrink-0"
                        onClick={() =>
                          setNewColumns((prev) => prev.filter((_, idx) => idx !== index))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {(isAdmin || canManagePanels) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNewColumns((prev) => [...prev, ""])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Coluna
                  </Button>
                )}
              </div>
            </>
          )}
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
                key={`${currentPanel.id}-${panelInputKey}`}
                defaultValue={currentPanel.name}
                maxLength={80}
                className="max-w-md"
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== currentPanel.name)
                    savePanelName(currentPanel, e.target.value.trim());
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
            <Button size="sm" onClick={addStage} disabled={savingAction}>
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
                    key={`${s.id}-${stageInputKey}`}
                    defaultValue={s.label}
                    onBlur={(e) => {
                      if (e.target.value !== s.label) saveLabel(s, e.target.value);
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
                      onClick={() => removeStage(s)}
                      disabled={savingAction}
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

      <AlertDialog
        open={!!confirmState?.open}
        onOpenChange={(open) => {
          if (!open) {
            confirmState?.onCancel?.();
            closeConfirm();
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">
              {confirmState?.title ?? DIALOG_TITLE}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">
              {confirmState?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                confirmState?.onCancel?.();
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={confirmState?.destructive ? "bg-destructive hover:bg-destructive/90" : ""}
              onClick={async () => {
                const fn = confirmState?.onConfirm;
                closeConfirm();
                if (fn) await fn();
              }}
            >
              {confirmState?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
