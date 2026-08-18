import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { History, Link2Off, RefreshCw } from "lucide-react";

interface Props {
  cardId: string;
  canEdit?: boolean;
}

interface ProvenanceRow {
  id: string;
  field_name: string;
  field_value: string | null;
  source: string;
  evidence: string | null;
  status: string;
  created_at: string;
}

interface SourceLinkRow {
  id: string;
  source: string;
  source_record_id: string | null;
  thread_id: string | null;
  link_mode: string;
  justification: string | null;
  active: boolean;
  created_at: string;
  unlinked_at: string | null;
  unlink_justification: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  email: "Gmail",
  whatsapp: "WhatsApp",
  jira: "Jira",
  jira_webhook: "Jira (webhook)",
  jira_email: "Jira (e-mail)",
  card_vinculado: "Card vinculado",
  manual: "Manual",
  sistema: "Sistema",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  consolidado: "default",
  divergente: "destructive",
  registrado: "secondary",
  descartado: "outline",
};

export default function CardOriginTimeline({ cardId, canEdit }: Props) {
  const { toast } = useToast();
  const [provenance, setProvenance] = useState<ProvenanceRow[]>([]);
  const [links, setLinks] = useState<SourceLinkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [prov, lnk] = await Promise.all([
      (supabase as any)
        .from("card_field_provenance")
        .select("id, field_name, field_value, source, evidence, status, created_at")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(80),
      (supabase as any)
        .from("card_source_links")
        .select("id, source, source_record_id, thread_id, link_mode, justification, active, created_at, unlinked_at, unlink_justification")
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);
    setProvenance(prov.data ?? []);
    setLinks(lnk.data ?? []);
    setLoading(false);
  }, [cardId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleUnlink = async (linkId: string) => {
    if (justification.trim().length < 5) {
      toast({ title: "Justificativa obrigatória", description: "Explique o motivo do desvínculo.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).rpc("unlink_source_from_card", {
      p_link_id: linkId,
      p_justification: justification.trim(),
    });
    setSaving(false);
    if (error) {
      toast({ title: "Falha ao desfazer vínculo", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Vínculo desfeito", description: "Mensagens, arquivos e tarefas foram preservados." });
    setUnlinkTarget(null);
    setJustification("");
    void load();
  };

  const divergences = provenance.filter((p) => p.status === "divergente");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="h-4 w-4" /> Origem das informações
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {divergences.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 space-y-1">
            <p className="font-medium">
              {divergences.length} divergência(s) aguardando decisão manual — liberação automática bloqueada.
            </p>
            {divergences.slice(0, 4).map((d) => (
              <p key={d.id} className="text-xs text-muted-foreground">
                {d.field_name}: origem {SOURCE_LABELS[d.source] ?? d.source} propôs “{d.field_value}”
              </p>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Origens vinculadas</p>
          {links.length === 0 && <p className="text-muted-foreground text-xs">Nenhuma origem vinculada a este card.</p>}
          {links.map((l) => (
            <div key={l.id} className="rounded-md border p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={l.active ? "default" : "outline"}>{SOURCE_LABELS[l.source] ?? l.source}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {l.link_mode === "manual" ? "vínculo manual" : "vínculo automático"} •{" "}
                    {new Date(l.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                {canEdit && l.active && (
                  <Button variant="outline" size="sm" onClick={() => setUnlinkTarget(l.id)}>
                    <Link2Off className="h-3.5 w-3.5 mr-1" /> Desfazer
                  </Button>
                )}
              </div>
              {l.thread_id && <p className="text-xs text-muted-foreground break-all">thread: {l.thread_id}</p>}
              {l.justification && <p className="text-xs text-muted-foreground">Justificativa: {l.justification}</p>}
              {!l.active && (
                <p className="text-xs text-muted-foreground">
                  Desvinculado em {l.unlinked_at ? new Date(l.unlinked_at).toLocaleString("pt-BR") : "—"}
                  {l.unlink_justification ? ` — ${l.unlink_justification}` : ""}
                </p>
              )}
              {unlinkTarget === l.id && (
                <div className="space-y-2 pt-1">
                  <Textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Justificativa do desvínculo (obrigatória)"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => void handleUnlink(l.id)} disabled={saving}>
                      Confirmar desvínculo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setUnlinkTarget(null); setJustification(""); }}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Campos e evidências</p>
          {provenance.length === 0 && (
            <p className="text-muted-foreground text-xs">Nenhum registro de proveniência para este card.</p>
          )}
          {provenance.map((p) => (
            <div key={p.id} className="rounded-md border p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.field_name}</span>
                <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
              </div>
              <p className="break-all">{p.field_value || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {SOURCE_LABELS[p.source] ?? p.source} • {new Date(p.created_at).toLocaleString("pt-BR")}
              </p>
              {p.evidence && <p className="text-xs text-muted-foreground italic break-words">“{p.evidence}”</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
