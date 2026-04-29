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
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<Array<{ user_id: string; nome: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const modules = useMemo(
    () => [
      { key: "leads", label: "LEADS", actions: ["acessar", "criar", "editar", "excluir", "mover_pipeline", "editar_financeiro"] },
      { key: "contatos", label: "CONTATOS", actions: ["acessar", "criar", "editar", "excluir", "vincular_lead"] },
      { key: "atividades", label: "ATIVIDADES", actions: ["acessar", "criar", "editar", "excluir"] },
      { key: "email", label: "E-MAIL", actions: ["acessar", "enviar", "receber", "configurar_gmail"] },
      { key: "pipeline", label: "PIPELINE", actions: ["criar_etapa", "editar_etapa", "excluir_etapa"] },
      { key: "configuracoes", label: "CONFIGURAÇÕES", actions: ["acessar", "gerenciar_permissoes", "gerenciar_usuarios"] },
    ],
    [],
  );

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const loadUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", { method: "GET" });
    if (error) {
      toast.error("Erro ao carregar usuários");
      setLoading(false);
      return;
    }
    const list = Array.isArray(data) ? data : [];
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

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) loadPermissions(selectedUserId);
  }, [selectedUserId]);

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
