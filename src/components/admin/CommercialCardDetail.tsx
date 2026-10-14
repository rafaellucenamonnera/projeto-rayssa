import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, Loader2, MessageSquare, Pencil, Send } from "lucide-react";
import { AttachmentPicker, CommentAttachmentList, StagedAttachment, uploadStagedAttachments } from "./CommentAttachments";
import { LeadContatos } from "./LeadContatos";
import {
  CANAL_OPTIONS, IMPACTO_OPTIONS, MERCADO_OPTIONS, TIPO_NEGOCIO_OPTIONS,
  canalLabel, impactoLabel, impactoTagClass, mercadoLabel, tipoNegocioLabel,
} from "@/lib/commercialPanel";

type Stage = { value: string; label: string };

interface Props {
  lead: any;
  stages: Stage[];
  parceiroNome?: string | null;
  userName: string;
  canEdit: boolean;
  canComment: boolean;
  canInsertFile: boolean;
  onSaved: (patch: Record<string, any>) => void;
}

type TimelineItem =
  | { kind: "comment"; id: string; at: string; who: string; text: string }
  | { kind: "move"; id: string; at: string; who: string; stage: string };

const fmtDateTime = (v: string) =>
  `${new Date(v).toLocaleDateString("pt-BR")} ${new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

export const CommercialCardDetail = ({ lead, stages, parceiroNome, userName, canEdit, canComment, canInsertFile, onSaved }: Props) => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ razao_social: "", cnpj: "", mercado: "", tipo_negocio: "", impacto: "", canal: "" });
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const [sending, setSending] = useState(false);

  const stageLabel = useMemo(() => {
    const map = new Map(stages.map((s) => [s.value, s.label]));
    return (v: string) => map.get(v) || (v === "lead_perdido" ? "Perdidos" : v);
  }, [stages]);

  const startEdit = () => {
    setForm({
      razao_social: lead.razao_social || lead.nome_fantasia || "",
      cnpj: lead.cnpj || "",
      mercado: lead.mercado || "",
      tipo_negocio: lead.tipo_negocio || "",
      impacto: lead.impacto || "",
      canal: lead.canal || "",
    });
    setEditing(true);
  };

  const save = async () => {
    if (!form.razao_social.trim()) return toast.error("Preencha Empresa (Razão Social).");
    if (!form.canal) return toast.error("Preencha o Canal.");
    const cnpj = form.cnpj.replace(/\D/g, "");
    if (cnpj && cnpj.length !== 14) return toast.error("O CNPJ precisa ter 14 números.");
    setSaving(true);
    const patch = {
      razao_social: form.razao_social.trim(),
      cnpj: cnpj || null,
      mercado: form.mercado || null,
      tipo_negocio: form.tipo_negocio || null,
      impacto: form.impacto || null,
      canal: form.canal,
    };
    const { error } = await supabase.from("leads").update(patch as any).eq("id", lead.id);
    setSaving(false);
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    toast.success("Card atualizado.");
    setEditing(false);
    onSaved(patch);
  };

  const loadTimeline = async () => {
    setLoadingTimeline(true);
    const [commentsRes, movesRes] = await Promise.all([
      supabase.from("lead_comments").select("id,usuario,comentario,data_comentario").eq("lead_id", lead.id),
      supabase.from("lead_stage_history").select("id,etapa,data_entrada,moved_by").eq("lead_id", lead.id),
    ]);
    const moves = (movesRes.data as any[]) || [];
    const ids = [...new Set(moves.map((m) => m.moved_by).filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("user_id,nome").in("user_id", ids);
      (data || []).forEach((p: any) => names.set(p.user_id, p.nome));
    }
    const list: TimelineItem[] = [
      ...((commentsRes.data as any[]) || []).map((c) => ({ kind: "comment" as const, id: c.id, at: c.data_comentario, who: c.usuario, text: c.comentario })),
      ...moves.map((m) => ({ kind: "move" as const, id: m.id, at: m.data_entrada, who: names.get(m.moved_by) || "Sistema", stage: m.etapa })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(list);
    setLoadingTimeline(false);
  };

  useEffect(() => {
    setEditing(false);
    void loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.status_lead]);

  const send = async () => {
    if (!user) return toast.error("Sessão expirada. Entre novamente.");
    if (!text.trim()) return toast.error("Escreva a atualização antes de enviar.");
    setSending(true);
    try {
      const { data: comment, error } = await supabase.from("lead_comments").insert({
        lead_id: lead.id,
        etapa: lead.status_lead || "",
        usuario: userName,
        user_id: user.id,
        comentario: text.trim().slice(0, 500),
      } as any).select("id").single();
      if (error) throw error;
      if (staged.length && comment?.id) {
        await uploadStagedAttachments(staged, { commentId: comment.id, leadId: lead.id, userId: user.id });
      }
      setText("");
      setStaged([]);
      toast.success("Atualização registrada.");
      void loadTimeline();
    } catch (e: any) {
      toast.error(`Não foi possível registrar: ${e?.message || "erro desconhecido"}`);
    } finally {
      setSending(false);
    }
  };

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );

  const selectField = (label: string, key: keyof typeof form, options: readonly { value: string; label: string }[]) => (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <select className={selectClass} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}>
        <option value="">Selecione</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Cabeçalho</h3>
          {canEdit && !editing && (
            <Button size="sm" variant="outline" onClick={startEdit}><Pencil className="mr-1 h-3 w-3" />Editar</Button>
          )}
          {editing && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
              <Button size="sm" onClick={save} disabled={saving}>{saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Salvar</Button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">Empresa (Razão Social) *</p>
              <Input value={form.razao_social} maxLength={200} onChange={(e) => setForm((p) => ({ ...p, razao_social: e.target.value }))} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">CNPJ</p>
              <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="14 números" />
            </div>
            {selectField("Canal *", "canal", CANAL_OPTIONS)}
            {selectField("Mercado", "mercado", MERCADO_OPTIONS)}
            {selectField("Tipo", "tipo_negocio", TIPO_NEGOCIO_OPTIONS)}
            {selectField("Impacto", "impacto", IMPACTO_OPTIONS)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("Empresa (Razão Social)", lead.razao_social || lead.nome_fantasia)}</div>
            {field("CNPJ", lead.cnpj)}
            {field("Canal", canalLabel(lead.canal) && (
              <span>
                {canalLabel(lead.canal)}
                {lead.canal === "parceiros" && parceiroNome && (
                  <span className="block text-xs text-muted-foreground">Indicado por: {parceiroNome}</span>
                )}
              </span>
            ))}
            {field("Mercado", mercadoLabel(lead.mercado))}
            {field("Tipo", tipoNegocioLabel(lead.tipo_negocio))}
            {field("Impacto", lead.impacto && (
              <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${impactoTagClass(lead.impacto)}`}>
                Impacto {impactoLabel(lead.impacto)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <LeadContatos leadId={lead.id} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4" />Atualizações</h3>
        {canComment && (
          <div className="space-y-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva uma atualização..." rows={2} maxLength={500} />
            {canInsertFile && <AttachmentPicker staged={staged} onChange={setStaged} disabled={sending} />}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{text.length}/500</span>
              <Button size="sm" onClick={send} disabled={sending || !text.trim()}>
                {sending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}Registrar
              </Button>
            </div>
          </div>
        )}

        {loadingTimeline ? (
          <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">Nenhuma atualização ainda.</p>
        ) : (
          <ol className="relative ml-2 space-y-4 border-l border-border pl-4">
            {items.map((it) => (
              <li key={`${it.kind}-${it.id}`} className="relative">
                <span className={`absolute -left-[22px] top-1 flex h-3 w-3 rounded-full border-2 border-background ${it.kind === "move" ? "bg-primary" : "bg-muted-foreground"}`} />
                <p className="text-xs text-muted-foreground">{fmtDateTime(it.at)} · {it.who}</p>
                {it.kind === "move" ? (
                  <p className="flex items-center gap-1 text-sm font-medium"><ArrowRightLeft className="h-3 w-3" />Card movido para {stageLabel(it.stage)}</p>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm">{it.text}</p>
                    <CommentAttachmentList commentId={it.id} />
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};
