import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Download, Loader2, Plus, Trash2, Upload } from "lucide-react";

type LeadOption = { id: string; nome_fantasia: string };
type ContatoRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  empresa: string | null;
  comentario: string | null;
  lead_id: string | null;
};

const emptyForm = {
  nome: "",
  telefone: "",
  email: "",
  empresa: "",
  comentario: "",
  vincularLead: false,
  lead_id: "",
};

const AdminContatos = () => {
  const { isInternalUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [form, setForm] = useState({ ...emptyForm });
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  const leadMap = useMemo(() => {
    const map: Record<string, string> = {};
    leads.forEach((l) => { map[l.id] = l.nome_fantasia; });
    return map;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return leads.slice(0, 8);
    return leads.filter((l) => l.nome_fantasia.toLowerCase().includes(q)).slice(0, 8);
  }, [leadSearch, leads]);

  const loadData = async () => {
    setLoading(true);
    const [contatosRes, leadsRes] = await Promise.all([
      (supabase as any)
        .from("lead_contatos")
        .select("id, nome, telefone, email, empresa, comentario, lead_id")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("leads").select("id, nome_fantasia").order("nome_fantasia", { ascending: true }),
    ]);
    if (contatosRes.error) toast.error("Erro ao carregar contatos");
    if (leadsRes.error) toast.error("Erro ao carregar leads");
    setContatos((contatosRes.data as ContatoRow[]) || []);
    setLeads((leadsRes.data as LeadOption[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isInternalUser) loadData();
  }, [isInternalUser]);

  if (!isInternalUser) return <Navigate to="/admin" replace />;

  const validate = () => {
    if (!form.nome.trim() || !form.telefone.trim() || !form.email.trim() || !form.empresa.trim() || !form.comentario.trim()) {
      toast.error("Preencha todos os campos obrigatórios");
      return false;
    }
    if (form.vincularLead && !form.lead_id) {
      toast.error("Selecione o lead vinculado");
      return false;
    }
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone.trim(),
      email: form.email.trim(),
      empresa: form.empresa.trim(),
      comentario: form.comentario.trim(),
      observacao: form.comentario.trim(),
      lead_id: form.vincularLead ? form.lead_id : null,
      created_by: user?.id || null,
    };
    const { error } = await (supabase as any).from("lead_contatos").insert(payload);
    if (error) {
      toast.error(error.message || "Erro ao salvar contato");
    } else {
      toast.success("Contato cadastrado");
      setForm({ ...emptyForm });
      setLeadSearch("");
      loadData();
    }
    setSaving(false);
  };

  const downloadCsvTemplate = () => {
    const csv = "name,email,phone,company,comment\nJoão Silva,joao@email.com,27999999999,Empresa X,Observação";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-contatos.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportContacts = () => {
    const rows = contatos.map((c) => [c.nome || "", c.email || "", c.telefone || "", c.empresa || "", (c.comentario || "").replace(/\n/g, " ")]);
    const csv = ["name,email,phone,company,comment", ...rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    setImporting(true);
    const text = await file.text();
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length <= 1) { toast.error("CSV vazio"); setImporting(false); return; }
    const existingEmails = new Set(contatos.map((c) => (c.email || "").toLowerCase()).filter(Boolean));
    const payload: any[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const [name, email, phone, company, ...rest] = cols.map((c) => c.replace(/^"|"$/g, "").trim());
      const comment = rest.join(",").trim();
      if (!name) continue;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (email && existingEmails.has(email.toLowerCase())) continue;
      payload.push({ nome: name, email: email || null, telefone: phone || null, empresa: company || null, comentario: comment || null, observacao: comment || null });
      if (email) existingEmails.add(email.toLowerCase());
    }
    if (!payload.length) { toast.error("Nenhuma linha válida para importar"); setImporting(false); return; }
    const { error } = await (supabase as any).from("lead_contatos").insert(payload);
    if (error) toast.error(error.message || "Erro ao importar");
    else { toast.success(`${payload.length} contatos importados`); setImportOpen(false); loadData(); }
    setImporting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este contato?")) return;
    const { error } = await (supabase as any).from("lead_contatos").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Contato excluído");
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text text-[#32b89b] shadow-none">Contatos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportContacts}>
            <Download className="h-4 w-4 mr-1" /> Exportar contatos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Importar contatos
          </Button>
        </div>
      </div>
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo contato
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={200} />
              </div>
              <div className="space-y-1">
                <Label>Telefone *</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} maxLength={30} />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
              </div>
              <div className="space-y-1">
                <Label>Empresa *</Label>
                <Input value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} maxLength={200} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Comentário *</Label>
              <Textarea value={form.comentario} onChange={(e) => setForm({ ...form, comentario: e.target.value })} maxLength={500} rows={2} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="vincularLead"
                  checked={form.vincularLead}
                  onCheckedChange={(checked) => {
                    const v = !!checked;
                    setForm({ ...form, vincularLead: v, lead_id: v ? form.lead_id : "" });
                    if (!v) setLeadSearch("");
                  }}
                />
                <Label htmlFor="vincularLead">Vincular a Lead</Label>
              </div>
              {form.vincularLead && (
                <div className="rounded-md border border-border p-2 space-y-2">
                  <Input
                    placeholder="Digite para buscar lead..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                  />
                  <div className="max-h-40 overflow-auto space-y-1">
                    {filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, lead_id: lead.id });
                          setLeadSearch(lead.nome_fantasia);
                        }}
                        className={`w-full text-left px-2 py-1 rounded text-sm hover:bg-muted ${form.lead_id === lead.id ? "bg-muted" : ""}`}
                      >
                        {lead.nome_fantasia}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar contato
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Lista de contatos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : contatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
          ) : (
            <div className="space-y-2">
              {contatos.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">{c.empresa || "-"}</p>
                    <p className="text-xs text-muted-foreground">{c.telefone || "-"} • {c.email || "-"}</p>
                    <p className="text-xs mt-1">{c.comentario || "-"}</p>
                    <p className="text-[11px] text-primary mt-1">
                      {c.lead_id ? `Lead vinculado: ${leadMap[c.lead_id] || c.lead_id}` : "Sem lead vinculado"}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar contatos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={downloadCsvTemplate}>
              <Download className="h-4 w-4 mr-1" /> Baixar modelo CSV
            </Button>
            <Input type="file" accept=".csv" onChange={(e) => handleImportFile(e.target.files?.[0])} disabled={importing} />
            {importing ? <p className="text-xs text-muted-foreground">Importando...</p> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContatos;
