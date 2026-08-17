import { useCallback, useEffect, useState } from "react";
import { Loader2, NotebookPen, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logCardEvent } from "@/lib/crossCardEvents";

interface Props {
  cardId: string;
  canEdit: boolean;
  onSaved?: () => void;
}

type NoteRow = {
  id: string;
  content: string;
  updated_at: string;
};

export const RepresentativeCardNotes = ({ cardId, canEdit, onSaved }: Props) => {
  const [note, setNote] = useState<NoteRow | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("representative_card_notes")
      .select("id,content,updated_at")
      .eq("representative_card_id", cardId)
      .maybeSingle();
    setLoading(false);

    if (error) {
      toast.error("Erro ao carregar observações");
      return;
    }

    setNote((data as NoteRow) || null);
    setContent((data as NoteRow)?.content || "");
  }, [cardId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const clean = content.trim();
    if (!clean) return toast.error("Escreva a observação antes de salvar.");

    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id || null;
    const previous = note?.content || null;

    const { data, error } = note
      ? await (supabase as any)
          .from("representative_card_notes")
          .update({ content: clean, updated_by: userId })
          .eq("id", note.id)
          .select("id,content,updated_at")
          .single()
      : await (supabase as any)
          .from("representative_card_notes")
          .insert({ representative_card_id: cardId, content: clean, created_by: userId, updated_by: userId })
          .select("id,content,updated_at")
          .single();

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar observação");
      return;
    }

    setNote(data as NoteRow);
    await logCardEvent(cardId, "note_updated", {
      conteudo_anterior: previous,
      conteudo_atual: clean,
    });
    onSaved?.();
    toast.success("Observação salva. O histórico registrou a versão anterior.");
  };

  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <NotebookPen className="h-4 w-4" /> Observações operacionais
      </h3>
      <p className="text-xs text-muted-foreground">
        Registro livre da operação. Não substitui etapa, tarefa ou regra do processo.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando observações...
        </div>
      ) : (
        <>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ex.: cliente pediu retorno após o fechamento do mês."
            rows={4}
            disabled={!canEdit}
          />
          {note && (
            <p className="text-xs text-muted-foreground">
              Última atualização em {new Date(note.updated_at).toLocaleString("pt-BR")}. Versões anteriores ficam no histórico do card.
            </p>
          )}
          {canEdit && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar observação
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default RepresentativeCardNotes;
