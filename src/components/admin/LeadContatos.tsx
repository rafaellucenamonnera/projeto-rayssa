import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Users, Plus, Pencil, Trash2, X, Check, Star } from "lucide-react";

interface LeadContatosProps {
  leadId: string;
}

interface Contato {
  id: string;
  lead_id: string;
  nome: string;
  cargo: string | null;
  email: string | null;
  telefone: string | null;
  observacao: string | null;
  principal: boolean;
}

const empty = { nome: "", cargo: "", email: "", telefone: "", observacao: "", principal: false };

export const LeadContatos = ({ leadId }: LeadContatosProps) => {
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...empty });

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("lead_contatos")
      .select("*")
      .eq("lead_id", leadId)
      .order("principal", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Erro ao carregar contatos");
    } else {
      setContatos((data as Contato[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (leadId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const resetForm = () => {
    setForm({ ...empty });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (c: Contato) => {
    setEditingId(c.id);
    setShowForm(true);
    setForm({
      nome: c.nome,
      cargo: c.cargo || "",
      email: c.email || "",
      telefone: c.telefone || "",
      observacao: c.observacao || "",
      principal: c.principal,
    });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do contato");
      return;
    }
    setSaving(true);
    const payload: any = {
      lead_id: leadId,
      nome: form.nome.trim(),
      cargo: form.cargo.trim() || null,
      email: form.email.trim() || null,
      telefone: form.telefone.trim() || null,
      observacao: form.observacao.trim() || null,
      principal: form.principal,
    };

    let error;
    if (editingId) {
      ({ error } = await (supabase as any)
        .from("lead_contatos")
        .update(payload)
        .eq("id", editingId));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id || null;
      ({ error } = await (supabase as any).from("lead_contatos").insert(payload));
    }

    if (error) {
      toast.error(error.message || "Erro ao salvar contato");
    } else {
      toast.success(editingId ? "Contato atualizado" : "Contato adicionado");
      resetForm();
      load();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este contato?")) return;
    const { error } = await (supabase as any).from("lead_contatos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Contato excluído");
      load();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4" /> Contatos do lead
        </h4>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="mr-1 h-4 w-4" /> Adicionar
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={200} />
            </div>
            <div>
              <Label className="text-xs">Cargo</Label>
              <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} maxLength={120} />
            </div>
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} maxLength={30} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              maxLength={500}
              rows={2}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="principal"
              checked={form.principal}
              onCheckedChange={(v) => setForm({ ...form, principal: !!v })}
            />
            <Label htmlFor="principal" className="text-xs cursor-pointer">Marcar como contato principal</Label>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <Button size="sm" variant="ghost" onClick={resetForm} disabled={saving}>
              <X className="mr-1 h-4 w-4" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
              {editingId ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : contatos.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">Nenhum contato cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {contatos.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{c.nome}</span>
                    {c.principal && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                        <Star className="h-3 w-3" /> Principal
                      </span>
                    )}
                  </div>
                  {c.cargo && <div className="text-xs text-muted-foreground">{c.cargo}</div>}
                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {c.email && <div>📧 {c.email}</div>}
                    {c.telefone && <div>📞 {c.telefone}</div>}
                  </div>
                  {c.observacao && (
                    <p className="text-xs mt-2 whitespace-pre-wrap text-foreground/80">{c.observacao}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
