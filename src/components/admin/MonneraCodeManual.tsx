import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";
import { describeMonneraCode } from "@/lib/monneraCode";

interface Props {
  cardId: string;
  currentCode?: string | null;
  isAdmin: boolean;
  onApplied: (patch: { codigo_monnera: string; codigo_monnera_origem: string }) => void;
}

/**
 * Inserção manual do Código Monnera.
 * Usa exatamente a mesma rotina do fluxo automático (RPC apply_monnera_code_to_card):
 * mesma coluna, mesmas validações, mesmo histórico, notificações e idempotência.
 */
export default function MonneraCodeManual({ cardId, currentCode, isAdmin, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return null;

  const submit = async () => {
    const normalized = code.trim().toUpperCase();
    const info = describeMonneraCode(normalized);
    if (info.state !== "valido") {
      toast.error(
        info.state === "aguardando"
          ? "Informe o Código Monnera."
          : info.state === "exemplo"
            ? "Código demonstrativo não é aceito."
            : "Formato não confirmado: use exatamente 8 caracteres (A-Z, 0-9).",
      );
      return;
    }
    if (justificativa.trim().length < 10) {
      toast.error("Informe a justificativa (mínimo 10 caracteres).");
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("apply_monnera_code_to_card", {
        p_card_id: cardId,
        p_codigo: normalized,
        p_source: "manual_admin",
        p_evidence: {
          origem: "inserção manual no painel",
          justificativa: justificativa.trim().slice(0, 500),
          applied_at: new Date().toISOString(),
        },
      });
      if (error) throw error;

      // Mesmo pós-processamento do fluxo automático (simulação idempotente, sem efeitos).
      try {
        await supabase.functions.invoke("cross-onboarding-advance", { body: { card_id: cardId, dry_run: true } });
      } catch (_) { /* best-effort */ }

      toast.success("Código Monnera aplicado ao card.");
      onApplied({ codigo_monnera: normalized, codigo_monnera_origem: "Inserção manual (admin)" });
      setOpen(false);
      setCode("");
      setJustificativa("");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível aplicar o código.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <KeyRound className="mr-1 h-3.5 w-3.5" />
        {currentCode ? "Revisar Código Monnera" : "Adicionar Código Monnera"}
      </Button>

      <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Código Monnera</DialogTitle>
            <DialogDescription>
              O código segue as mesmas validações e o mesmo registro do recebimento automático.
              {currentCode ? ` Código atual: ${currentCode}.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Código Monnera *</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="8 caracteres (A-Z, 0-9)"
                className="font-mono"
                maxLength={8}
              />
            </div>
            <div className="space-y-1">
              <Label>Justificativa *</Label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Origem do código e motivo da inserção manual"
              />
              <p className="text-[11px] text-muted-foreground text-right">{justificativa.length}/500</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar código
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
