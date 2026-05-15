import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface MonneraUser {
  id: string;
  user_id: string;
  nome: string;
  telefone: string | null;
  email: string;
  nivel_acesso: string;
  ativo: boolean;
  primeiro_acesso: boolean;
  data_criacao: string;
  can_be_responsible?: boolean;
}

const AdminUsuarios = () => {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<MonneraUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<MonneraUser | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    email: "",
    telefone: "",
    nivel_acesso: "gestor_conta",
  });

  const loadUsers = async () => {
    setLoadError(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        method: "GET",
      });
      if (error) throw error;
      const list = Array.isArray(data) ? data : [];
      const { data: flags } = await supabase.from("profiles").select("user_id,can_be_responsible");
      const flagMap: Record<string, boolean> = {};
      (flags || []).forEach((f: any) => { flagMap[f.user_id] = !!f.can_be_responsible; });
      setUsers(list.map((u: any) => ({ ...u, can_be_responsible: flagMap[u.user_id] ?? false })));
    } catch (error: any) {
      const msg = String(error?.message || "");
      if (msg.includes("Não autorizado") || msg.includes("Acesso negado")) {
        const errorMsg = "Erro ao carregar usuários: acesso permitido somente para administrador.";
        setLoadError(errorMsg);
        toast.error(errorMsg);
      } else {
        const errorMsg = "Não foi possível carregar usuários no momento. Tente novamente ou contate o suporte.";
        setLoadError(errorMsg);
        toast.error(`Falha ao conectar com backend: ${msg || "Edge Function não respondeu"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.email) {
      toast.error("Nome e email são obrigatórios");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        method: "POST",
        body: {
          ...form,
          redirect_url: `${window.location.origin}/primeiro-acesso`,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário criado! Email de convite enviado.");
      setDialogOpen(false);
      setForm({ nome: "", email: "", telefone: "", nivel_acesso: "gestor_conta" });
      loadUsers();
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error);
      const msg = String(error?.message || "");
      if (msg.includes("Failed to send a request to the Edge Function")) {
        toast.error("Edge Function não respondeu");
      } else if (msg.includes("Não autorizado") || msg.includes("Acesso negado")) {
        toast.error("Erro ao criar usuário: acesso permitido somente para administrador.");
      } else {
        toast.error("Erro ao criar usuário: " + (error?.message || "mensagem indisponível"));
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId: string, nome: string) => {
    if (!confirm(`Excluir o usuário ${nome}?`)) return;

    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        method: "DELETE",
        body: { user_id: userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Usuário excluído");
      loadUsers();
    } catch (error: any) {
      toast.error("Erro: " + error.message);
    }
  };

  const toggleResponsible = async (user: MonneraUser, value: boolean) => {
    setUsers((prev) => prev.map((x) => (x.user_id === user.user_id ? { ...x, can_be_responsible: value } : x)));
    const { error } = await supabase.from("profiles").update({ can_be_responsible: value } as any).eq("user_id", user.user_id);
    if (error) {
      setUsers((prev) => prev.map((x) => (x.user_id === user.user_id ? { ...x, can_be_responsible: !value } : x)));
      toast.error("Erro ao atualizar permissão de responsável.");
    } else {
      toast.success(value ? "Usuário pode ser responsável por cards." : "Usuário não pode mais ser responsável por cards.");
    }
  };

  const openEdit = (user: MonneraUser) => {
    setEditingUser(user);
    setEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingEdit(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        method: "PATCH",
        body: {
          user_id: editingUser.user_id,
          nome: editingUser.nome,
          telefone: editingUser.telefone,
          nivel_acesso: editingUser.nivel_acesso,
          ativo: editingUser.ativo,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Usuário atualizado com sucesso.");
      setEditOpen(false);
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error("Erro ao salvar usuário: " + (error?.message || "Tente novamente."));
    } finally {
      setSavingEdit(false);
    }
  };

  const nivelLabel = (nivel: string) => {
    switch (nivel) {
      case "admin": return "Administrador";
      case "gestor_conta": return "Gestor de Conta";
      default: return nivel;
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-display font-bold">Usuários Monnera</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="sm:size-default">
              <Plus className="mr-1 sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Novo Usuário</span><span className="sm:hidden">Novo</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display">Cadastrar Usuário Monnera</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" />
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@monnera.com" />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <Label>Nível de Acesso *</Label>
                <Select value={form.nivel_acesso} onValueChange={(v) => setForm({ ...form, nivel_acesso: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gestor_conta">Gestor de Conta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Cadastrar
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {loadError ? (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 space-y-3">
              <p className="text-sm text-destructive">{loadError}</p>
              <div className="flex gap-2">
                <Button onClick={loadUsers} variant="outline" size="sm">Tentar novamente</Button>
                <Button onClick={() => window.location.reload()} size="sm">Atualizar usuários</Button>
              </div>
            </div>
          ) : null}

          {/* Mobile card view */}
          <div className="space-y-3 lg:hidden">
            {users.map((u) => (
              <Card key={u.id} className="border-border">
                <CardContent className="p-3 sm:p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{u.nome}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} className="shrink-0 h-8 w-8">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u.user_id, u.nome)} className="text-destructive hover:text-destructive shrink-0 h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                      {nivelLabel(u.nivel_acesso)}
                    </span>
                    {u.primeiro_acesso ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-destructive/10 text-destructive">Pendente</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary">Ativo</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tel: </span>
                      <span>{u.telefone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data: </span>
                      <span>{new Date(u.data_criacao).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {users.length === 0 && (
              <p className="text-center py-8 text-muted-foreground text-sm">Nenhum usuário cadastrado.</p>
            )}
          </div>

          {/* Desktop table */}
          <Card className="border-border hidden lg:block">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Telefone</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nível</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Status</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium">Resp. cards</th>
                      <th className="text-left py-3 px-4 text-muted-foreground font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-3 px-4">{u.nome}</td>
                        <td className="py-3 px-4">{u.email}</td>
                        <td className="py-3 px-4">{u.telefone || "-"}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                            {nivelLabel(u.nivel_acesso)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {u.primeiro_acesso ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-destructive/10 text-destructive">Pendente</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">Ativo</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(u.data_criacao).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="py-3 px-4">
                          <Switch
                            checked={!!u.can_be_responsible}
                            onCheckedChange={(v) => toggleResponsible(u, v)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(u.user_id, u.nome)} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p className="text-center py-8 text-muted-foreground">Nenhum usuário cadastrado.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Editar usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={editingUser.nome} onChange={(e) => setEditingUser({ ...editingUser, nome: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={editingUser.email || ""} disabled />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input value={editingUser.telefone || ""} onChange={(e) => setEditingUser({ ...editingUser, telefone: e.target.value })} />
              </div>
              <div>
                <Label>Nível de Acesso</Label>
                <Select value={editingUser.nivel_acesso} onValueChange={(v) => setEditingUser({ ...editingUser, nivel_acesso: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="gestor_conta">Gestor de Conta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editingUser.ativo ? "ativo" : "inativo"} onValueChange={(v) => setEditingUser({ ...editingUser, ativo: v === "ativo" })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={savingEdit}>
                {savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar alterações
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuarios;
