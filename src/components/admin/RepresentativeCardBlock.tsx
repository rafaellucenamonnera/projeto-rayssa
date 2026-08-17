import { useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notifyCrossCard } from "@/lib/crossCardEvents";

interface Props {
  card: any;
  panelId: string;
  stageLabel?: string;
  canEdit: boolean;
  onChanged?: (patch: Record<string, any>) => void;
}

export const RepresentativeCardBlock = ({ card, panelId, stageLabel, canEdit, onChanged }: Props) => {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isBlocked = !!card?.is_blocked;

  const apply = async (block: boolean) => {
    const clean = reason.trim();
    if (block && !clean) return toast.error("Descreva o motivo do bloqueio.");

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const now = new Date().toISOString();

    const patch = block
      ? {
          is_blocked: true,
          blocked_reason: clean,
          blocked_at: now,
          blocked_by: auth.user?.id || null,
          blocked_source: "usuario",
          unblocked_at: null,
        }
      : {
          is_blocked: false,
          unblocked_at: now,
        };

    const { error } = await (supabase as any).from("representative_cards").update(patch).eq("id", card.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao atualizar bloqueio: " + error.message);
      return;
    }

    await notifyCrossCard({
      cardId: card.id,
      panelId,
      type: block ? "cross_block_created" : "cross_block_resolved",
      title: block ? "Card bloqueado" : "Bloqueio resolvido",
      cliente: card.full_name || card.nome_fantasia,
      cnpj: card.cnpj,
      etapa: stageLabel,
      motivo: block ? clean : card.blocked_reason,
      evidencia: block ? "Bloqueio registrado manualmente no card." : "Bloqueio marcado como resolvido no card.",
      acaoRealizada: block ? "Movimentação de etapa suspensa." : "Movimentação de etapa liberada.",
      decisaoNecessaria: block ? "Validar a informação pendente antes de avançar." : "Confirmar continuidade do fluxo.",
      proximoPasso: block ? "Resolver a pendência e liberar o card." : "Seguir para a próxima etapa do processo.",
      deliveryKey: `cross-block-${card.id}-${now}`,
    });

    onChanged?.(patch);
    setReason("");
    toast.success(block ? "Card bloqueado. Ele não poderá mudar de etapa." : "Bloqueio resolvido.");
  };

  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {isBlocked ? <ShieldAlert className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-emerald-600" />}
          Bloqueio operacional
        </h3>
        <Badge variant="outline" className={isBlocked ? "border-destructive/40 bg-destructive/10 text-destructive" : ""}>
          {isBlocked ? "Bloqueado" : "Liberado"}
        </Badge>
      </div>

      {isBlocked ? (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>Motivo: {card.blocked_reason || "—"}</p>
          <p>Desde: {card.blocked_at ? new Date(card.blocked_at).toLocaleString("pt-BR") : "—"}</p>
          <p>Origem: {card.blocked_source || "—"}</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Use o bloqueio quando não houver 100% de certeza sobre a informação. Cards bloqueados não mudam de etapa.
        </p>
      )}

      {canEdit && (
        <>
          {!isBlocked && (
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo do bloqueio (obrigatório)"
              rows={2}
            />
          )}
          <Button size="sm" variant={isBlocked ? "outline" : "destructive"} onClick={() => apply(!isBlocked)} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isBlocked ? "Resolver bloqueio" : "Bloquear card"}
          </Button>
        </>
      )}
    </div>
  );
};

export default RepresentativeCardBlock;
