import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logCardEvent, crossCardActionUrl } from "@/lib/crossCardEvents";
import {
  importWhatsappFile,
  validateWhatsappFile,
  STATUS_LABEL,
  PENDING_LABEL,
  type CrossCardRef,
  type Evidence,
  type PendingReason,
} from "@/lib/whatsappTriage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MessageSquare, RefreshCw, Upload, ExternalLink } from "lucide-react";

const CROSS_PANEL_ID = "painel_msj9fyji";

type ImportRow = {
  id: string;
  file_name: string;
  size_bytes: number | null;
  content_sha256: string;
  status: string;
  message_count: number;
  first_message_at: string | null;
  last_message_at: string | null;
  created_at: string;
};

type ExtractionRow = {
  id: string;
  import_id: string;
  cliente_nome: string | null;
  cnpj: string | null;
  cnpj_candidates: Array<{ cnpj: string; snippet: string }> | null;
  email: string | null;
  telefone: string | null;
  codigo_monnera: string | null;
  campanhas: string[] | null;
  metas: string[] | null;
  regras: string[] | null;
  pendencias: string[] | null;
  evidences: Evidence[] | null;
  pending_reasons: PendingReason[] | null;
  confidence: number;
  status: string;
  matched_card_id: string | null;
  linked_card_id: string | null;
  conversation_started_at: string | null;
  conversation_ended_at: string | null;
  message_count: number;
  reviewed: boolean;
  review_decision: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  triage_ok: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  triage_duplicado: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  triage_ambiguo: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  triage_divergencia_cnpj: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  triage_sem_cnpj: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  triage_sem_nome: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  aprovado: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejeitado: "bg-destructive/15 text-destructive border-destructive/30",
};

const fmtDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const fmtCnpj = (value?: string | null) =>
  value && value.length === 14
    ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
    : value || "—";

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-sm break-words">{value || "—"}</p>
  </div>
);

export default function AdminImportWhatsapp() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imports, setImports] = useState<ImportRow[]>([]);
  const [rows, setRows] = useState<ExtractionRow[]>([]);
  const [cards, setCards] = useState<CrossCardRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [fImport, setFImport] = useState("all");
  const [fStatus, setFStatus] = useState("all");
  const [fCliente, setFCliente] = useState("");
  const [fCnpj, setFCnpj] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [fConfidence, setFConfidence] = useState("0");
  const [fReviewed, setFReviewed] = useState("all");

  const [selected, setSelected] = useState<ExtractionRow | null>(null);
  const [edit, setEdit] = useState<Partial<ExtractionRow>>({});
  const [linkCardId, setLinkCardId] = useState<string>("none");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [importsRes, rowsRes, cardsRes] = await Promise.all([
        (supabase as any)
          .from("whatsapp_imports")
          .select("id,file_name,size_bytes,content_sha256,status,message_count,first_message_at,last_message_at,created_at")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("whatsapp_extractions")
          .select("*")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("representative_cards")
          .select("id,full_name,cnpj")
          .eq("panel_id", CROSS_PANEL_ID)
          .order("full_name"),
      ]);
      if (importsRes.error) throw importsRes.error;
      if (rowsRes.error) throw rowsRes.error;
      setImports((importsRes.data || []) as ImportRow[]);
      setRows((rowsRes.data || []) as ExtractionRow[]);
      setCards((cardsRes.data || []) as CrossCardRef[]);
    } catch (error: any) {
      toast.error(error.message || "Não foi possível carregar as importações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    let dup = 0;
    try {
      for (const file of Array.from(files)) {
        const invalid = validateWhatsappFile(file);
        if (invalid) {
          toast.error(invalid);
          continue;
        }
        try {
          const result = await importWhatsappFile(file, cards, user?.id ?? null);
          if (result.duplicate) {
            dup += 1;
            toast.warning(`"${file.name}" já foi importado (mesmo hash) — nada foi duplicado.`);
          } else {
            ok += 1;
          }
        } catch (error: any) {
          toast.error(`Erro em "${file.name}": ${error.message}`);
        }
      }
      if (ok) toast.success(`${ok} conversa(s) importada(s) em modo triagem.`);
      if (ok || dup) await load();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importById = useMemo(() => new Map(imports.map((i) => [i.id, i])), [imports]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const filtered = useMemo(() => {
    const minConf = Number(fConfidence) || 0;
    const from = fFrom ? new Date(fFrom).getTime() : null;
    const to = fTo ? new Date(fTo).getTime() + 86_400_000 : null;
    return rows.filter((r) => {
      if (fImport !== "all" && r.import_id !== fImport) return false;
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (fReviewed !== "all" && String(r.reviewed) !== fReviewed) return false;
      if (fCliente && !(r.cliente_nome || "").toLowerCase().includes(fCliente.toLowerCase())) return false;
      if (fCnpj && !(r.cnpj || "").includes(fCnpj.replace(/\D/g, ""))) return false;
      if (Number(r.confidence) < minConf) return false;
      const ref = new Date(r.conversation_started_at ?? r.created_at).getTime();
      if (from && ref < from) return false;
      if (to && ref > to) return false;
      return true;
    });
  }, [rows, fImport, fStatus, fReviewed, fCliente, fCnpj, fConfidence, fFrom, fTo]);

  const openRow = (row: ExtractionRow) => {
    setSelected(row);
    setEdit({
      cliente_nome: row.cliente_nome,
      cnpj: row.cnpj,
      email: row.email,
      telefone: row.telefone,
      codigo_monnera: row.codigo_monnera,
    });
    setLinkCardId(row.linked_card_id ?? row.matched_card_id ?? "none");
    setNotes(row.review_notes ?? "");
  };

  const saveReview = async (decision: "aprovado" | "rejeitado" | "revisado") => {
    if (!selected) return;
    setSaving(true);
    try {
      const linked = linkCardId !== "none" ? linkCardId : null;
      const payload: Record<string, unknown> = {
        cliente_nome: edit.cliente_nome ?? null,
        cnpj: edit.cnpj ? String(edit.cnpj).replace(/\D/g, "") || null : null,
        email: edit.email ?? null,
        telefone: edit.telefone ?? null,
        codigo_monnera: edit.codigo_monnera ?? null,
        linked_card_id: linked,
        reviewed: true,
        review_decision: decision,
        review_notes: notes || null,
        reviewed_by: user?.id ?? null,
        reviewed_at: new Date().toISOString(),
      };
      if (decision !== "revisado") payload.status = decision;

      const { error } = await (supabase as any)
        .from("whatsapp_extractions")
        .update(payload)
        .eq("id", selected.id);
      if (error) throw error;

      // Histórico operacional — nenhuma alteração é feita no card em si.
      if (linked) {
        await logCardEvent(linked, "whatsapp_triage_reviewed", {
          origem: "importacao_whatsapp",
          extraction_id: selected.id,
          arquivo: importById.get(selected.import_id)?.file_name ?? null,
          decisao: decision,
          cnpj: payload.cnpj,
          cliente: payload.cliente_nome,
          observacoes: notes || null,
        });
      }

      toast.success(
        decision === "rejeitado" ? "Registro rejeitado." : "Revisão registrada (nenhum card foi alterado).",
      );
      setSelected(null);
      await load();
    } catch (error: any) {
      toast.error(error.message || "Não foi possível salvar a revisão.");
    } finally {
      setSaving(false);
    }
  };

  const totals = useMemo(() => {
    const byStatus: Record<string, number> = {};
    rows.forEach((r) => (byStatus[r.status] = (byStatus[r.status] || 0) + 1));
    return byStatus;
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/painel-comercial" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">Importar WhatsApp</h1>
            <p className="text-xs text-muted-foreground">
              Modo triagem: nenhum card, tarefa ou anexo é criado ou alterado automaticamente.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.zip"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Enviar .txt ou .zip
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Arquivos importados ({imports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {imports.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma conversa importada ainda. Envie o export do WhatsApp (.txt ou .zip). Áudios, vídeos e imagens
              não são processados nesta versão.
            </p>
          )}
          {imports.slice(0, 6).map((imp) => (
            <div key={imp.id} className="flex flex-wrap items-center gap-2 text-xs border border-border rounded-md p-2">
              <span className="font-medium">{imp.file_name}</span>
              <Badge variant="outline">{imp.message_count} mensagens</Badge>
              <span className="text-muted-foreground">{fmtDate(imp.created_at)}</span>
              <span className="text-muted-foreground font-mono">sha256 {imp.content_sha256.slice(0, 12)}…</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {Object.entries(totals).map(([status, count]) => (
              <Badge key={status} variant="outline" className={STATUS_TONE[status] ?? ""}>
                {STATUS_LABEL[status] ?? status}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs">Arquivo</Label>
            <Select value={fImport} onValueChange={setFImport}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {imports.map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.file_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={fStatus} onValueChange={setFStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Cliente</Label>
            <Input value={fCliente} onChange={(e) => setFCliente(e.target.value)} placeholder="Nome" />
          </div>
          <div>
            <Label className="text-xs">CNPJ</Label>
            <Input value={fCnpj} onChange={(e) => setFCnpj(e.target.value)} placeholder="Somente dígitos" />
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Confiança mínima ({fConfidence}%)</Label>
            <Input type="range" min={0} max={100} step={5} value={fConfidence} onChange={(e) => setFConfidence(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Revisão</Label>
            <Select value={fReviewed} onValueChange={setFReviewed}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="false">Não revisadas</SelectItem>
                <SelectItem value="true">Revisadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Extrações ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum registro para os filtros selecionados.</p>
          )}
          {filtered.map((row) => (
            <button
              key={row.id}
              onClick={() => openRow(row)}
              className="w-full text-left border border-border rounded-md p-3 hover:bg-muted/40 transition-colors"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-sm">{row.cliente_nome || "Cliente não identificado"}</span>
                <Badge variant="outline" className={STATUS_TONE[row.status] ?? ""}>
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>
                <Badge variant="outline">Confiança {Math.round(Number(row.confidence))}%</Badge>
                {row.reviewed && <Badge variant="outline">Revisada</Badge>}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                <span>CNPJ {fmtCnpj(row.cnpj)}</span>
                <span>Código {row.codigo_monnera || "—"}</span>
                <span>{importById.get(row.import_id)?.file_name ?? "arquivo"}</span>
                <span>{fmtDate(row.conversation_started_at ?? row.created_at)}</span>
                <span>{row.message_count} mensagens</span>
              </div>
              {!!row.pending_reasons?.length && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {row.pending_reasons.map((p) => (
                    <Badge key={p.code} variant="outline" className="text-[10px]">
                      {PENDING_LABEL[p.code] ?? p.label}
                    </Badge>
                  ))}
                </div>
              )}
            </button>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Revisar extração</DialogTitle>
            <DialogDescription>
              Edite os dados, vincule manualmente a um card e registre a decisão. Nada é criado ou alterado no card.
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <Field label="Arquivo" value={importById.get(selected.import_id)?.file_name} />
                <Field label="Hash do arquivo" value={importById.get(selected.import_id)?.content_sha256} />
                <Field label="Período da conversa" value={`${fmtDate(selected.conversation_started_at)} → ${fmtDate(selected.conversation_ended_at)}`} />
                <Field label="Mensagens" value={String(selected.message_count)} />
                <Field label="Card sugerido" value={selected.matched_card_id ? cardById.get(selected.matched_card_id)?.full_name : "Nenhum"} />
                <Field label="Confiança" value={`${Math.round(Number(selected.confidence))}%`} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Input value={edit.cliente_nome ?? ""} onChange={(e) => setEdit({ ...edit, cliente_nome: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={edit.cnpj ?? ""} onChange={(e) => setEdit({ ...edit, cnpj: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input value={edit.email ?? ""} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={edit.telefone ?? ""} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Código Monnera</Label>
                  <Input value={edit.codigo_monnera ?? ""} onChange={(e) => setEdit({ ...edit, codigo_monnera: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Vincular manualmente a um card</Label>
                  <Select value={linkCardId} onValueChange={setLinkCardId}>
                    <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {cards.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.full_name} {c.cnpj ? `· ${fmtCnpj(c.cnpj)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!!selected.cnpj_candidates?.length && selected.cnpj_candidates.length > 1 && (
                <div>
                  <p className="text-xs font-medium mb-1">CNPJs alternativos encontrados</p>
                  <div className="space-y-1">
                    {selected.cnpj_candidates.map((c) => (
                      <p key={c.cnpj} className="text-xs text-muted-foreground rounded-md border border-border bg-muted/30 p-2">
                        <span className="font-mono">{fmtCnpj(c.cnpj)}</span> — “{c.snippet}”
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {(["campanhas", "metas", "regras", "pendencias"] as const).map((key) =>
                selected[key]?.length ? (
                  <div key={key}>
                    <p className="text-xs font-medium mb-1 capitalize">{key}</p>
                    <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-0.5">
                      {(selected[key] as string[]).map((v, i) => (
                        <li key={`${key}-${i}`}>{v}</li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}

              {!!selected.evidences?.length && (
                <div>
                  <p className="text-xs font-medium mb-1">Trechos originais que fundamentaram a extração</p>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {selected.evidences.map((ev, i) => (
                      <div key={i} className="text-xs rounded-md border border-border bg-muted/30 p-2">
                        <p className="font-medium">
                          {ev.field}: {ev.value}
                        </p>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {ev.author ? `${ev.author}: ` : ""}“{ev.snippet}”
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs">Observações da revisão</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={1000} />
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                {linkCardId !== "none" && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={crossCardActionUrl(CROSS_PANEL_ID, linkCardId)} target="_blank">
                      <ExternalLink className="h-4 w-4 mr-2" /> Abrir card
                    </Link>
                  </Button>
                )}
                <Button variant="outline" size="sm" disabled={saving} onClick={() => saveReview("revisado")}>
                  Marcar como revisada
                </Button>
                <Button variant="destructive" size="sm" disabled={saving} onClick={() => saveReview("rejeitado")}>
                  Rejeitar
                </Button>
                <Button size="sm" disabled={saving} onClick={() => saveReview("aprovado")}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Aprovar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
