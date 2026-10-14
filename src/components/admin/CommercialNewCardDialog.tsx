import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  CANAL_OPTIONS, COMMERCIAL_STAGE_MQL, COMMERCIAL_STAGE_PROSPECTS, IMPACTO_OPTIONS, MERCADO_OPTIONS, TIPO_NEGOCIO_OPTIONS,
  missingQualification, validateNewCommercialCard,
} from "@/lib/commercialPanel";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parceiros: { id: string; nome: string }[];
  defaultParceiroId?: string | null;
  onCreated: () => void;
}

type Contato = { nome: string; cargo: string; telefone: string; email: string };
const emptyContato: Contato = { nome: "", cargo: "", telefone: "", email: "" };
const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

export const CommercialNewCardDialog = ({ open, onOpenChange, parceiros, defaultParceiroId, onCreated }: Props) => {
  const initial = () => ({
    razao_social: "", cnpj: "", mercado: "", tipo_negocio: "", impacto: "", canal: "",
    parceiro_id: "", stage: COMMERCIAL_STAGE_PROSPECTS,
  });
  const [form, setForm] = useState(initial);
  const [contatos, setContatos] = useState<Contato[]>([{ ...emptyContato }]);
  const [saving, setSaving] = useState(false);

  const reset = () => { setForm(initial()); setContatos([{ ...emptyContato }]); };
  const set = (k: keyof ReturnType<typeof initial>, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setContato = (i: number, k: keyof Contato, v: string) =>
    setContatos((list) => list.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));

  const submit = async () => {
    const errs = validateNewCommercialCard({ ...form, contatos });
    if (errs.length) return toast.error(`Preencha: ${errs.join(", ")}.`);
    const missing = missingQualification(form, form.stage);
    if (missing.length) return toast.error(`Para entrar em MQL, preencha: ${missing.join(", ")}.`);
    const cnpj = form.cnpj.replace(/\D/g, "");
    if (cnpj && cnpj.length !== 14) return toast.error("O CNPJ precisa ter 14 números.");
    const parceiroId = form.canal === "parceiros" ? form.parceiro_id : (form.parceiro_id || defaultParceiroId);
    if (!parceiroId) return toast.error("Escolha o Embaixador Monnera responsável.");

    const filled = contatos.filter((c) => c.nome.trim());
    const principal = filled[0];
    setSaving(true);
    const { data, error } = await supabase.from("leads").insert({
      nome_fantasia: form.razao_social.trim(),
      razao_social: form.razao_social.trim(),
      cnpj: cnpj || null,
      mercado: form.mercado || null,
      tipo_negocio: form.tipo_negocio || null,
      impacto: form.impacto || null,
      canal: form.canal,
      parceiro_id: parceiroId,
      panel_id: "comercial",
      status: form.stage,
      status_lead: form.stage,
      origem: "cadastro_painel",
      nome_responsavel: principal.nome.trim(),
      telefone_responsavel: principal.telefone.trim(),
      email_responsavel: principal.email.trim().toLowerCase() || null,
    } as any).select("id").single();
    if (error) {
      setSaving(false);
      return toast.error(error.message.includes("duplicate") ? "Já existe um card com esse CNPJ ou e-mail." : `Não foi possível criar: ${error.message}`);
    }
    const { error: cErr } = await (supabase as any).from("lead_contatos").insert(
      filled.map((c, i) => ({
        lead_id: data.id, nome: c.nome.trim(), cargo: c.cargo.trim() || null,
        telefone: c.telefone.trim() || null, email: c.email.trim().toLowerCase() || null, principal: i === 0,
      })),
    );
    setSaving(false);
    if (cErr) toast.error(`Card criado, mas os contatos não foram salvos: ${cErr.message}`);
    else toast.success("Card criado.");
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Novo card</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs text-muted-foreground">Empresa (Razão Social) *</p>
            <Input value={form.razao_social} maxLength={200} onChange={(e) => set("razao_social", e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">CNPJ</p>
            <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="14 números" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Coluna</p>
            <select className={selectClass} value={form.stage} onChange={(e) => set("stage", e.target.value)}>
              <option value={COMMERCIAL_STAGE_PROSPECTS}>Lista Prospects</option>
              <option value={COMMERCIAL_STAGE_MQL}>MQL</option>
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Canal *</p>
            <select className={selectClass} value={form.canal} onChange={(e) => set("canal", e.target.value)}>
              <option value="">Selecione</option>
              {CANAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              {form.canal === "parceiros" ? "Embaixador Monnera que indicou *" : "Embaixador Monnera responsável"}
            </p>
            <select className={selectClass} value={form.parceiro_id} onChange={(e) => set("parceiro_id", e.target.value)}>
              <option value="">{form.canal === "parceiros" ? "Selecione" : "Você (padrão)"}</option>
              {parceiros.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
          {([["Mercado", "mercado", MERCADO_OPTIONS], ["Tipo", "tipo_negocio", TIPO_NEGOCIO_OPTIONS], ["Impacto", "impacto", IMPACTO_OPTIONS]] as const).map(([label, key, opts]) => (
            <div key={key}>
              <p className="mb-1 text-xs text-muted-foreground">{label}{form.stage === COMMERCIAL_STAGE_MQL ? " *" : ""}</p>
              <select className={selectClass} value={form[key]} onChange={(e) => set(key, e.target.value)}>
                <option value="">Selecione</option>
                {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Contatos</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setContatos((l) => [...l, { ...emptyContato }])} aria-label="Adicionar contato">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {contatos.map((c, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-2">
              <Input placeholder={i === 0 ? "Nome *" : "Nome"} value={c.nome} onChange={(e) => setContato(i, "nome", e.target.value)} />
              <Input placeholder="Cargo" value={c.cargo} onChange={(e) => setContato(i, "cargo", e.target.value)} />
              <Input placeholder="Telefone" value={c.telefone} onChange={(e) => setContato(i, "telefone", e.target.value)} />
              <div className="flex gap-2">
                <Input placeholder="E-mail" type="email" value={c.email} onChange={(e) => setContato(i, "email", e.target.value)} />
                {contatos.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" aria-label="Remover contato" onClick={() => setContatos((l) => l.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Criar card</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
