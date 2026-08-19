import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Não existe conexão oficial do Canva disponível neste workspace, portanto a
 * geração automática de material permanece desativada. O link público é
 * inserido manualmente, validado e só então libera a continuidade do fluxo.
 *
 * A validação é única e compartilhada com o backend (src/lib/canvaLink.ts e
 * supabase/functions/_shared/canvaLink.ts usam exatamente a mesma regra).
 */
export { validateCanvaPublicLink } from "@/lib/canvaLink";
import { validateCanvaPublicLink } from "@/lib/canvaLink";

const NOTIFY_USERS = [
  "d8e99940-2d3a-45e6-8170-0bf2f5fc98a9", // rafael.lucena@monnera.com.br
  "87842ad6-9a02-4e66-82ac-65f2743a2596", // maycon.santos@monnera.com.br
];


interface Props {
  cardId: string;
  canEdit: boolean;
  cardName?: string | null;
  codigoMonnera?: string | null;
  canvaPublicUrl?: string | null;
  onSaved?: (publicUrl: string) => void;
}

export default function CanvaPublicLinkSection({
  cardId, canEdit, cardName, codigoMonnera, canvaPublicUrl, onSaved,
}: Props) {
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(canvaPublicUrl ?? null);

  useEffect(() => { setSaved(canvaPublicUrl ?? null); }, [canvaPublicUrl]);

  const notifyPendency = async (message: string) => {
    for (const user of NOTIFY_USERS) {
      await supabase.rpc("create_notification", {
        p_recipient_user_id: user,
        p_type: "cross_block_created",
        p_title: "Material Canva pendente",
        p_message: message,
        p_lead_id: null,
        p_task_id: null,
        p_comment_id: null,
        p_action_url: "/admin/leads",
        p_metadata: { card_id: cardId, etapa: "canva_link_publico" },
        p_actor_user_id: null,
        p_delivery_key: `canva_pendencia_${cardId}_${Date.now()}`,
      });
    }
  };

  const handleSave = async () => {
    const validation = validateCanvaPublicLink(link);
    if (!validation.ok) {
      toast.error(validation.reason!);
      await notifyPendency(`Card ${cardName ?? cardId}: link Canva recusado — ${validation.reason}`);
      return;
    }
    if (!codigoMonnera) {
      toast.error("Card sem código Monnera confirmado.");
      await notifyPendency(`Card ${cardName ?? cardId}: link Canva não pôde ser salvo — código Monnera ausente.`);
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.rpc("register_canva_material", {
      p_card_id: cardId,
      p_codigo: codigoMonnera,
      p_template_design_id: null,
      p_design_id: link.trim().split("/").pop() ?? null,
      p_view_url: link.trim(),
      p_edit_url: null,
      p_edited_page: 12,
      p_source: "manual",
      p_metadata: { origem: "link_publico_manual", canva_conector: false },
      p_public_url: link.trim(),
    });
    setSaving(false);

    const result = data as any;
    if (error || result?.ok === false) {
      const reason = result?.error ?? error?.message ?? "Falha ao salvar o link.";
      toast.error(reason);
      await notifyPendency(`Card ${cardName ?? cardId}: falha ao registrar o link Canva — ${reason}`);
      return;
    }

    setSaved(link.trim());
    setLink("");
    toast.success("Link público confirmado. Fluxo liberado para a próxima etapa.");
    onSaved?.(link.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Material Canva — link público</CardTitle>
        <CardDescription>
          Geração automática desativada (sem conexão Canva disponível). Informe o link público de apresentação
          (https://canva.link/...). Links de edição não são aceitos. O card só avança e o onboarding só é liberado
          depois deste link confirmado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {saved ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Link confirmado
            </Badge>
            <Button variant="ghost" size="sm" asChild>
              <a href={saved} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" /> Abrir material
              </a>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" /> Pendente: nenhum link público confirmado neste card.
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor={`canva-link-${cardId}`}>Link público</Label>
          <Input
            id={`canva-link-${cardId}`}
            placeholder="https://canva.link/xxxxxxxxxxxx"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={!canEdit || saving}
          />
        </div>
        <Button onClick={handleSave} disabled={!canEdit || saving || !link.trim()}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Validar e salvar link
        </Button>
      </CardContent>
    </Card>
  );
}
