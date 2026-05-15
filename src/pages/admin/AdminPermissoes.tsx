import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const AdminPermissoes = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<Array<{ user_id: string; nome: string; email: string; ativo?: boolean; can_be_responsible?: boolean }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [panels, setPanels] = useState<Array<{ id: string; name: string }>>([]);
  const [panelPermissions, setPanelPermissions] = useState<Record<string, boolean>>({});
  const [loadUsersError, setLoadUsersError] = useState<string | null>(null);
  const [canBeResponsible, setCanBeResponsible] = useState<boolean>(false);

  const modules = useMemo(
    () => [
      { key: "leads", label: "LEADS", actions: ["acessar", "criar", "editar", "excluir", "mover_pipeline", "editar_financeiro"] },
      { key: "contatos", label: "CONTATOS", actions: ["acessar", "criar", "editar", "excluir", "vincular_lead"] },
      { key: "atividades", label: "ATIVIDADES", actions: ["acessar", "criar", "editar", "excluir"] },
      { key: "email", label: "E-MAIL", actions: ["acessar", "enviar", "receber", "configurar_gmail"] },
      { key: "pipeline", label: "PIPELINE", actions: ["criar_etapa", "editar_etapa", "excluir_etapa", "clonar_card"] },
      { key: "configuracao_painel", label: "CONFIGURAÇÃO PAINEL", actions: ["visualizar", "editar", "criar_estagio", "excluir_estagio"] },
      { key: "configuracoes", label: "CONFIGURAÇÕES", actions: ["acessar", "gerenciar_permissoes", "gerenciar_usuarios"] },
    ],
    [],
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const loadUsers = async () => {
    setLoading(true);
    setLoadUsersError(null);
    const { data, error } = await supabase.functions.invoke("admin-create-user", { method: "GET" });
    if (error) {
      console.error("[AdminPermissoes] Falha ao listar usuários via Edge Function", error);
      const msg = String(error.message || "");
      const isAuthError = msg.includes("Não autorizado") || msg.includes("Acesso negado") || msg.includes("401") || msg.includes("403");

      if (isAuthError) {
        setLoadUsersError("Não foi possível carregar permissões no momento. Tente novamente ou contate o suporte.");
        toast.error("Não foi possível carregar permissões no momento. Tente novamente ou contate o suporte.");
        setLoading(false);
        return;
      }

      // Fallback resiliente: lê profiles direto quando a Edge Function estiver indisponível.
      const { data: profiles, error: profilesError } = await (supabase as any)
        .from("profiles")
        .select("user_id, nome, ativo, can_be_responsible")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (profilesError) {
        setLoadUsersError("Não foi possível carregar permissões no momento. Tente novamente ou contate o suporte.");
        toast.error(`Falha ao conectar com backend: ${error.message || "Edge Function não respondeu"}`);
        setLoading(false);
        return;
      }

      const fallbackList = (profiles || [])
        .filter((u: any) => u.user_id)
        .map((u: any) => ({ user_id: u.user_id, nome: u.nome, email: "", ativo: u.ativo, can_be_responsible: !!u.can_be_responsible }));
      setUsers(fallbackList);
      if (fallbackList.length > 0) setSelectedUserId(fallbackList[0].user_id);
      toast.warning("Conexão com backend instável. Carregamos os usuários em modo alternativo.");
      setLoading(false);
      return;
    }
    const list = (Array.isArray(data) ? data : []).filter((u: any) => u.ativo !== false && u.user_id);
    if (list.length === 0) {
      toast.error("Usuário não encontrado na base");
    }
    setUsers(list);
    if (list.length > 0) setSelectedUserId(list[0].user_id);
    setLoading(false);
  };

  const loadPermissions = async (userId: string) => {
    if (!userId) return;
    const { data, error } = await (supabase as any)
      .from("module_permissions")
      .select("modulo, acao, permitido")
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao carregar permissões");
      return;
    }
    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[`${row.modulo}.${row.acao}`] = !!row.permitido;
    });
    setPermissions(map);
  };

  const loadPanels = async () => {
    const { data, error } = await (supabase as any)
      .from("pipeline_panels")
      .select("id,name")
      .order("sort_order", { ascending: true });
    if (error) return;
    setPanels(data || []);
  };

  const loadPanelPermissions = async (userId: string) => {
    if (!userId) return;
    const selectedUser = users.find((u) => u.user_id === userId);
    if (selectedUser?.email === "admin@monnera.com") {
      const fullMap = panels.reduce<Record<string, boolean>>((acc, p) => ({ ...acc, [p.id]: true }), {});
      setPanelPermissions(fullMap);
      return;
    }
    const { data } = await (supabase as any)
      .from("user_panel_permissions")
      .select("panel_id, can_access")
      .eq("user_id", userId);
    const map: Record<string, boolean> = {};
    (data || []).forEach((row: any) => {
      map[row.panel_id] = !!row.can_access;
    });
    setPanelPermissions(map);
  };

  useEffect(() => {
    loadUsers();
    loadPanels();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadPermissions(selectedUserId);
      loadPanelPermissions(selectedUserId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, users, panels.length]);

  const togglePermission = (modulo: string, acao: string, checked: boolean) => {
    setPermissions((prev) => ({ ...prev, [`${modulo}.${acao}`]: checked }));
  };

  const handleSave = async () => {
    if (!selectedUserId) {
      toast.error("Selecione um usuário");
      return;
    }
    setSaving(true);
    const { data: authUser } = await supabase.auth.getUser();
    const updates = modules.flatMap((m) =>
      m.actions.map((a) => ({
        user_id: selectedUserId,
        modulo: m.key,
        acao: a,
        permitido: !!permissions[`${m.key}.${a}`],
        updated_by: authUser.user?.id || null,
      })),
    );
    const { error } = await (supabase as any)
      .from("module_permissions")
      .upsert(updates, { onConflict: "user_id,modulo,acao" });
    if (error) {
      toast.error("Erro ao salvar permissões");
      setSaving(false);
      return;
    }
    const panelRows = panels.map((p) => ({
      user_id: selectedUserId,
      panel_id: p.id,
      can_access: !!panelPermissions[p.id],
      updated_by: authUser.user?.id || null,
    }));
    const { error: panelError } = await (supabase as any)
      .from("user_panel_permissions")
      .upsert(panelRows, { onConflict: "user_id,panel_id" });
    if (panelError) {
      toast.error("Erro ao salvar permissões por painel");
      setSaving(false);
      return;
    }
    await (supabase as any).from("permission_change_logs").insert(
      updates.map((u) => ({
        user_id: u.user_id,
        modulo: u.modulo,
        acao: u.acao,
        permitido: u.permitido,
        changed_by: u.updated_by,
      })),
    );
    toast.success("Permissões salvas");
    setSaving(false);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">Permissões</h1>
      <Card>
        <CardHeader>
          <CardTitle>RBAC por módulo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              {loadUsersError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 space-y-3">
                  <p className="text-sm text-destructive">{loadUsersError}</p>
                  <div className="flex gap-2">
                    <Button onClick={loadUsers} variant="outline" size="sm">Tentar novamente</Button>
                    <Button onClick={() => window.location.reload()} size="sm">Recarregar permissões</Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2 max-w-md">
                <Label>Usuário</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.nome} ({u.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {modules.map((module) => (
                  <div key={module.key} className="border border-border rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-sm text-primary">{module.label}</h3>
                    <div className="space-y-2">
                      {module.actions.map((action) => {
                        const id = `${module.key}.${action}`;
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={!!permissions[id]}
                              onCheckedChange={(checked) => togglePermission(module.key, action, !!checked)}
                            />
                            <Label htmlFor={id} className="text-sm capitalize cursor-pointer">
                              {action.replace(/_/g, " ")}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-primary">Permissões por Painel</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {panels.map((panel) => (
                    <div key={panel.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`panel-${panel.id}`}
                        checked={!!panelPermissions[panel.id]}
                        onCheckedChange={(checked) =>
                          setPanelPermissions((prev) => ({ ...prev, [panel.id]: !!checked }))
                        }
                      />
                      <Label htmlFor={`panel-${panel.id}`} className="text-sm cursor-pointer">
                        {panel.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar Permissões
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPermissoes;
