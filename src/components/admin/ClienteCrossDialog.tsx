import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import CardAttachments from "@/components/admin/CardAttachments";
import { formatBytes, uploadCardAttachment, validateAttachment } from "@/lib/cardAttachments";
import { logCardEvent } from "@/lib/crossCardEvents";

const emptyForm = {
  full_name: "",
  cnpj: "",
  focal_name: "",
  phone: "",
  email: "",
  contratante_monnera: "",
  vendor_name: "",
  vendor_phone: "",
  vendor_email: "",
  notes: "",
};

type ClienteForm = typeof emptyForm;

interface ClienteCrossDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
  firstStageId?: string;
  card?: any | null;
  onSaved: (card: any) => void;
}

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export const ClienteCrossDialog = ({ open, onOpenChange, panelId, firstStageId, card, onSaved }: ClienteCrossDialogProps) => {
  const isEdit = !!card?.id;
  const [form, setForm] = useState<ClienteForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPendingFiles([]);
    if (card) {
      setForm({
        full_name: card.full_name || card.nome_fantasia || "",
        cnpj: card.cnpj || "",
        focal_name: card.focal_name || "",
        phone: card.phone || card.telefone_responsavel || "",
        email: card.email || card.email_responsavel || "",
        contratante_monnera: card.contratante_monnera || "",
        vendor_name: card.vendor_name || "",
        vendor_phone: card.vendor_phone || "",
        vendor_email: card.vendor_email || "",
        notes: card.notes || card.descricao_necessidade || "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [open, card]);

  const set = (key: keyof ClienteForm, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const addPendingFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: File[] = [];
    for (const file of Array.from(files)) {
      const invalid = validateAttachment(file);
      if (invalid) toast.error(invalid);
      else accepted.push(file);
    }
    setPendingFiles((prev) => [...prev, ...accepted]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSave = async () => {
    const fullName = form.full_name.trim();
    const phone = form.phone.trim();
    const email = form.email.trim().toLowerCase();
    const cnpj = form.cnpj.replace(/\D/g, "");
    if (!fullName) return toast.error("Nome do parceiro é obrigatório.");
    if (email && !isEmail(email)) return toast.error("Informe um e-mail válido do focal.");
    if (form.vendor_email.trim() && !isEmail(form.vendor_email.trim().toLowerCase())) {
      return toast.error("E-mail do vendedor responsável inválido.");
    }
    if (form.notes.length > 500) return toast.error("Anotações devem ter no máximo 500 caracteres.");

    setSaving(true);
    try {
      if (cnpj) {
        let dupQuery = (supabase as any)
          .from("representative_cards")
          .select("id")
          .eq("panel_id", isEdit ? card.panel_id : panelId)
          .eq("cnpj", cnpj)
          .limit(1);
        if (isEdit) dupQuery = dupQuery.neq("id", card.id);
        const { data: dup } = await dupQuery;
        if (dup && dup.length > 0) {
          toast.error("Já existe um cliente com este CNPJ.");
          setSaving(false);
          return;
        }
      }

      const payload: any = {
        full_name: fullName,
        cnpj: cnpj || null,
        focal_name: form.focal_name.trim() || null,
        focal_phone: phone || null,
        focal_email: email || null,
        phone,
        email,
        contratante_monnera: form.contratante_monnera.trim() || null,
        vendor_name: form.vendor_name.trim() || null,
        vendor_phone: form.vendor_phone.trim() || null,
        vendor_email: form.vendor_email.trim().toLowerCase() || null,
        notes: form.notes.trim() || null,
      };

      let saved: any = null;
      if (isEdit) {
        const { data, error } = await (supabase as any)
          .from("representative_cards")
          .update(payload)
          .eq("id", card.id)
          .select("*")
          .single();
        if (error) throw error;
        saved = data;
      } else {
        if (!firstStageId) throw new Error("Não há colunas configuradas para este painel.");
        const auth = await supabase.auth.getUser();
        const userId = auth.data.user?.id;
        if (!userId) throw new Error("Usuário autenticado não identificado.");
        const { data, error } = await (supabase as any)
          .from("representative_cards")
          .insert({
            ...payload,
            panel_id: panelId,
            stage_id: firstStageId,
            source: "Cadastro manual",
            responsible_user_id: userId,
            created_by_user_id: userId,
          })
          .select("*")
          .single();
        if (error) throw error;
        saved = data;

        for (const file of pendingFiles) {
          try {
            await uploadCardAttachment(saved.id, file);
          } catch (e: any) {
            toast.error(`Erro ao anexar "${file.name}": ${e?.message || "falha no envio"}`);
          }
        }
      }

      if (saved?.id) {
        await logCardEvent(
          saved.id,
          isEdit ? "card_updated" : "card_created",
          { nome: saved.full_name, cnpj: saved.cnpj || null },
          null,
          isEdit ? null : saved.stage_id,
        );
      }
      toast.success(isEdit ? "Cliente atualizado." : "Cliente cadastrado.");
      onSaved(saved);
      onOpenChange(false);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("representative_cards_panel_cnpj_uniq")) {
        toast.error("Já existe um cliente com este CNPJ.");
      } else {
        toast.error(msg || "Erro ao salvar cliente");
      }

    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cliente" : "Add Cliente"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label>Nome do Parceiro *</Label>
              <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label>CNPJ do Parceiro</Label>
              <Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} maxLength={20} placeholder="00000000000000" />
            </div>
            <div className="space-y-1">
              <Label>Focal Parceiro</Label>
              <Input value={form.focal_name} onChange={(e) => set("focal_name", e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label>E-mail *</Label>
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} maxLength={255} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Contratante Monnera</Label>
              <Input value={form.contratante_monnera} onChange={(e) => set("contratante_monnera", e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Vendedor responsável</Label>
              <Input value={form.vendor_name} onChange={(e) => set("vendor_name", e.target.value)} maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label>Telefone do vendedor</Label>
              <Input value={form.vendor_phone} onChange={(e) => set("vendor_phone", e.target.value)} maxLength={30} />
            </div>
            <div className="space-y-1">
              <Label>E-mail do vendedor</Label>
              <Input type="email" value={form.vendor_email} onChange={(e) => set("vendor_email", e.target.value)} maxLength={255} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Anotações</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value.slice(0, 500))} maxLength={500} rows={3} />
            <p className="text-[11px] text-muted-foreground text-right">{form.notes.length}/500</p>
          </div>

          {isEdit ? (
            <CardAttachments cardId={card.id} />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" /> Documentos (PDF, Excel, JPG/PNG)
                </p>
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()}>
                  <Paperclip className="h-3.5 w-3.5 mr-1" /> Anexar
                </Button>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
                onChange={(e) => addPendingFiles(e.target.files)}
              />
              {pendingFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum documento selecionado.</p>
              ) : (
                <ul className="space-y-1">
                  {pendingFiles.map((file, index) => (
                    <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs truncate flex-1">{file.name}</span>
                      <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClienteCrossDialog;
