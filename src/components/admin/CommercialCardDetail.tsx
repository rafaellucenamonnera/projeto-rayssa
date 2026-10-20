import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRightLeft, CheckCircle2, FileText, Eye, Loader2, MessageSquare, Pencil, Send } from "lucide-react";
import { AttachmentPicker, CommentAttachmentList, StagedAttachment, uploadStagedAttachments } from "./CommentAttachments";
import { LeadContatos } from "./LeadContatos";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialRegistrationLink, CommercialRegistrationTab } from "./CommercialRegistrationTab";
import {
  CANAL_OPTIONS, IMPACTO_OPTIONS, MERCADO_OPTIONS, TIPO_NEGOCIO_OPTIONS,
  canalLabel, impactoLabel, impactoTagClass, mercadoLabel, tipoNegocioLabel,
  TEMPERATURA_OPTIONS, temperaturaLabel, temperaturaTagClass, daysWithoutUpdate, staleLevel, propostaStatusLabel,
  missingQualification,
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
  onEmitProposal?: () => void;
  vendedores?: { user_id: string; nome: string }[];
  onMove?: (newStatus: string) => void;
}

type TimelineItem =
  | { kind: "comment"; id: string; at: string; who: string; text: string }
  | { kind: "move"; id: string; at: string; who: string; stage: string }
  | { kind: "proposal"; id: string; at: string; who: string; event: "emitida" | "aberta" | "aceita"; name: string };

const fmtDateTime = (v: string) =>
  `${new Date(v).toLocaleDateString("pt-BR")} ${new Date(v).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;

const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground";

export const CommercialCardDetail = ({ lead, stages, parceiroNome, userName, canEdit, canComment, canInsertFile, onSaved, onEmitProposal, vendedores = [], onMove }: Props) => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ razao_social: "", cnpj: "", mercado: "", tipo_negocio: "", impacto: "", canal: "", temperatura: "", responsible_user_id: "", quantidade_lojas: "", numero_vendedores: "", volume_premiacao_comissao: "" });
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
      temperatura: lead.temperatura || "",
      responsible_user_id: lead.responsible_user_id || "",
      quantidade_lojas: lead.quantidade_lojas != null ? String(lead.quantidade_lojas) : "",
      numero_vendedores: lead.numero_vendedores != null ? String(lead.numero_vendedores) : "",
      volume_premiacao_comissao: lead.volume_premiacao_comissao != null ? String(lead.volume_premiacao_comissao).replace(".", ",") : "",
    });
    setEditing(true);
  };

  const toInt = (v: string) => (v.trim() === "" ? null : Number.parseInt(v.replace(/\D/g, ""), 10));
  const toMoney = (v: string) => {
    if (v.trim() === "") return null;
    const n = Number(v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  const save = async () => {
    if (!form.razao_social.trim()) return toast.error("Preencha Empresa (Razão Social).");
    if (!form.canal) return toast.error("Preencha o Canal.");
    const stage = lead.status_lead || "";
    const lojas = toInt(form.quantidade_lojas);
    const vendedoresN = toInt(form.numero_vendedores);
    const premiacao = toMoney(form.volume_premiacao_comissao);
    if (Number.isNaN(premiacao as number)) return toast.error("Valor pago em premiação inválido.");
    const missingNow = missingQualification(
      { ...form, mercado: "x", tipo_negocio: "x", quantidade_lojas: lojas, numero_vendedores: vendedoresN, volume_premiacao_comissao: premiacao },
      stage,
    ).filter((f) => !["Canal", "Mercado", "Tipo"].includes(f));
    if (missingNow.length)
      return toast.error(`Preencha ${missingNow.join(", ")}: obrigatórios depois de Reunião Realizada.`);
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
      temperatura: form.temperatura || null,
      responsible_user_id: form.responsible_user_id || null,
      quantidade_lojas: lojas,
      numero_vendedores: vendedoresN,
      volume_premiacao_comissao: premiacao,
    };
    const { error } = await supabase.from("leads").update(patch as any).eq("id", lead.id);
    setSaving(false);
    if (error) return toast.error(`Não foi possível salvar: ${error.message}`);
    toast.success("Card atualizado.");
    setEditing(false);
    onSaved(patch);
  };

  const [proposals, setProposals] = useState<any[]>([]);
  const cancelProposal = async (p: any) => {
    const reason = window.prompt("Motivo do cancelamento (mínimo 5 caracteres). Depois de cancelada, o cliente não conseguirá mais abrir esta proposta.");
    if (reason == null) return;
    if (reason.trim().length < 5) { toast.error("Informe um motivo com pelo menos 5 caracteres."); return; }
    const { error } = await supabase.rpc("cancel_commercial_proposal" as any, { p_proposal_id: p.id, p_reason: reason.trim() } as any);
    if (error) { toast.error("Não foi possível cancelar a proposta."); return; }
    toast.success("Proposta cancelada. O link não abre mais para o cliente.");
    onSaved({});
    void loadTimeline();
  };
  const loadTimeline = async () => {
    setLoadingTimeline(true);
    const [commentsRes, movesRes, propRes] = await Promise.all([
      supabase.from("lead_comments").select("id,usuario,comentario,data_comentario").eq("lead_id", lead.id),
      supabase.from("lead_stage_history").select("id,etapa,data_entrada,moved_by").eq("lead_id", lead.id),
      supabase.from("commercial_proposals").select("id,proposal_name,created_at,opened_at,accepted_at,accepted_by_name,created_by_user_id,token,version,proposal_canceled_at").eq("lead_id", lead.id),
    ]);
    const props = (propRes.data as any[]) || [];
    setProposals([...props].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    const moves = (movesRes.data as any[]) || [];
    const ids = [...new Set([...moves.map((m) => m.moved_by), ...props.map((p) => p.created_by_user_id)].filter(Boolean))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data } = await supabase.from("profiles").select("user_id,nome").in("user_id", ids);
      (data || []).forEach((p: any) => names.set(p.user_id, p.nome));
    }
    const list: TimelineItem[] = [
      ...((commentsRes.data as any[]) || []).map((c) => ({ kind: "comment" as const, id: c.id, at: c.data_comentario, who: c.usuario, text: c.comentario })),
      ...moves.map((m) => ({ kind: "move" as const, id: m.id, at: m.data_entrada, who: names.get(m.moved_by) || "Sistema", stage: m.etapa })),
      ...props.map((p) => ({ kind: "proposal" as const, id: `${p.id}-e`, at: p.created_at, who: names.get(p.created_by_user_id) || "Sistema", event: "emitida" as const, name: p.proposal_name || "" })),
      ...props.filter((p) => p.opened_at).map((p) => ({ kind: "proposal" as const, id: `${p.id}-a`, at: p.opened_at, who: "Cliente", event: "aberta" as const, name: p.proposal_name || "" })),
      ...props.filter((p) => p.accepted_at).map((p) => ({ kind: "proposal" as const, id: `${p.id}-c`, at: p.accepted_at, who: p.accepted_by_name || "Cliente", event: "aceita" as const, name: p.proposal_name || "" })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setItems(list);
    setLoadingTimeline(false);
  };

  useEffect(() => {
    setEditing(false);
  }, [lead.id]);

  useEffect(() => {
    void loadTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.status_lead, lead.ultima_atualizacao_at, lead.proposta_status, lead.proposta_status_at]);

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
      // The comment trigger changes the lead's activity timestamp, not this row.
      onSaved({});
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

  const [accepting, setAccepting] = useState(false);
  const markAccepted = async () => {
    if (!user) return toast.error("Sessão expirada. Entre novamente.");
    if (!window.confirm("Confirmar que o cliente aceitou a proposta?")) return;
    setAccepting(true);
    const at = new Date().toISOString();
    const { error } = await supabase.from("leads").update({ proposta_status: "aceita", proposta_status_at: at } as any).eq("id", lead.id);
    if (error) { setAccepting(false); return toast.error(`Não foi possível alterar: ${error.message}`); }
    await supabase.from("lead_comments").insert({
      lead_id: lead.id, etapa: lead.status_lead || "", usuario: userName, user_id: user.id,
      comentario: "Status da proposta alterado para Proposta Aceita pelo vendedor.",
    } as any);
    setAccepting(false);
    toast.success("Proposta marcada como aceita.");
    onSaved({ proposta_status: "aceita", proposta_status_at: at });
    void loadTimeline();
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
      <CommercialRegistrationLink lead={lead} onSaved={onSaved} />
      <Tabs key={lead.id} defaultValue="principal">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="principal">Informações principais</TabsTrigger>
          <TabsTrigger value="cadastro">Cadastro e contrato</TabsTrigger>
        </TabsList>
        <TabsContent value="cadastro" className="mt-4"><CommercialRegistrationTab lead={lead} /></TabsContent>
        <TabsContent value="principal" className="mt-4 space-y-6">
      {(() => {
        const days = daysWithoutUpdate(lead.ultima_atualizacao_at, lead.status_lead || "");
        const level = staleLevel(days);
        if (!level) return null;
        return (
          <div className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold ${level === "red" ? "bg-red-600 text-white" : "bg-yellow-400 text-yellow-950"}`}>
            <span>Sem atualização</span>
            <span>{days} {days === 1 ? "dia" : "dias"}</span>
          </div>
        );
      })()}
      <section className="rounded-lg border border-border p-4">
        {onMove && (
          <div className="mb-3 flex items-center gap-2">
            <label htmlFor="mover-para" className="text-xs font-medium text-muted-foreground whitespace-nowrap">Mover para</label>
            <select
              id="mover-para"
              className={selectClass}
              value={lead.status_lead || ""}
              onChange={(e) => { if (e.target.value && e.target.value !== lead.status_lead) onMove(e.target.value); }}
            >
              {!stages.some((s) => s.value === lead.status_lead) && <option value={lead.status_lead || ""}>Sem etapa</option>}
              {stages.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        )}
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
            {selectField("Temperatura", "temperatura", TEMPERATURA_OPTIONS)}
            {selectField("Vendedor Responsável", "responsible_user_id", vendedores.map((v) => ({ value: v.user_id, label: v.nome })))}
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Número de lojas</p>
              <Input inputMode="numeric" value={form.quantidade_lojas} onChange={(e) => setForm((p) => ({ ...p, quantidade_lojas: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Número de vendedores</p>
              <Input inputMode="numeric" value={form.numero_vendedores} onChange={(e) => setForm((p) => ({ ...p, numero_vendedores: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs text-muted-foreground">Valor pago em premiação (R$)</p>
              <Input inputMode="decimal" placeholder="Ex.: 1.500,00" value={form.volume_premiacao_comissao} onChange={(e) => setForm((p) => ({ ...p, volume_premiacao_comissao: e.target.value }))} />
            </div>
            <p className="sm:col-span-2 text-xs text-muted-foreground">Lojas, vendedores e premiação são obrigatórios para o card sair de Reunião Realizada.</p>
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
            {field("Vendedor Responsável", vendedores.find((v) => v.user_id === lead.responsible_user_id)?.nome)}
            {field("Número de lojas", lead.quantidade_lojas != null ? String(lead.quantidade_lojas) : null)}
            {field("Número de vendedores", lead.numero_vendedores != null ? String(lead.numero_vendedores) : null)}
            {field("Valor pago em premiação", lead.volume_premiacao_comissao != null ? Number(lead.volume_premiacao_comissao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null)}
            {field("Temperatura", lead.temperatura && (
              <span className={`inline-block rounded border px-2 py-0.5 text-xs font-semibold ${temperaturaTagClass(lead.temperatura)}`}>
                {temperaturaLabel(lead.temperatura)}
              </span>
            ))}
            {field("Proposta", (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">{propostaStatusLabel(lead.proposta_status) || "Nenhuma proposta enviada"}</span>
                {lead.proposta_status && lead.proposta_status !== "aceita" && (canEdit || user?.id === lead.responsible_user_id) && (
                  <Button size="sm" variant="outline" onClick={markAccepted} disabled={accepting}>
                    {accepting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}Marcar como aceita
                  </Button>
                )}
                {onEmitProposal && (
                  <Button size="sm" variant="outline" onClick={onEmitProposal}><FileText className="mr-1 h-3 w-3" />Emitir proposta</Button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <LeadContatos leadId={lead.id} />
          <div className="mt-4 space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Propostas emitidas</h4>
            {proposals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma proposta emitida para este card.</p>
            ) : (
              <ul className="space-y-1">
                {proposals.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <a href={`/proposta/${p.token}`} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                      {p.proposal_name || `Proposta v${p.version ?? 1}`}
                    </a>
                    <span className="text-xs text-muted-foreground">
                      emitida em {new Date(p.created_at).toLocaleString("pt-BR")}
                      {p.proposal_canceled_at ? " · cancelada" : p.accepted_at ? " · aceita" : p.opened_at ? " · aberta" : ""}
                    </span>
                    {canEdit && !p.proposal_canceled_at && !p.accepted_at && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => cancelProposal(p)}>Cancelar proposta</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
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
                <span className={`absolute -left-[22px] top-1 flex h-3 w-3 rounded-full border-2 border-background ${it.kind === "move" ? "bg-primary" : it.kind === "proposal" ? "bg-accent" : "bg-muted-foreground"}`} />
                <p className="text-xs text-muted-foreground">{fmtDateTime(it.at)} · {it.who}</p>
                {it.kind === "proposal" ? (
                  <p className="flex items-center gap-1 text-sm font-medium">
                    {it.event === "aceita" ? <CheckCircle2 className="h-3 w-3" /> : it.event === "aberta" ? <Eye className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {it.event === "aceita" ? "Proposta aceita pelo cliente" : it.event === "aberta" ? "Proposta aberta pelo cliente" : "Proposta enviada"}{it.name ? ` · ${it.name}` : ""}
                  </p>
                ) : it.kind === "move" ? (
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
