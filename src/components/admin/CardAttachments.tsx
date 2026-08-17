import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import {
  CardAttachment,
  formatBytes,
  getCardAttachmentUrl,
  listCardAttachments,
  removeCardAttachment,
  uploadCardAttachment,
} from "@/lib/cardAttachments";

interface CardAttachmentsProps {
  cardId: string;
  canEdit?: boolean;
  /** Quando informado, cada anexo gera registro no histórico do card. */
  trackHistory?: boolean;
}

export const CardAttachments = ({ cardId, canEdit = true, trackHistory = false }: CardAttachmentsProps) => {

  const [items, setItems] = useState<CardAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listCardAttachments(cardId));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao carregar anexos");
    } finally {
      setLoading(false);
    }
  }, [cardId]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadCardAttachment(cardId, file);
      }
      toast.success("Anexo(s) enviado(s)");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar anexo");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDownload = async (att: CardAttachment) => {
    try {
      const url = await getCardAttachmentUrl(att);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao abrir arquivo");
    }
  };

  const handleRemove = async (att: CardAttachment) => {
    if (!confirm(`Remover o anexo "${att.file_name}"?`)) return;
    try {
      await removeCardAttachment(att);
      setItems((prev) => prev.filter((i) => i.id !== att.id));
      toast.success("Anexo removido");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover anexo");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Paperclip className="h-3.5 w-3.5" /> Documentos anexados (PDF, Word, Excel/CSV, JPG/PNG — máx. 10 MB)
        </p>
        {canEdit && (
          <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Paperclip className="h-3.5 w-3.5 mr-1" />}
            Anexar
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum documento anexado.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((att) => (
            <li key={att.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs truncate flex-1">{att.file_name}</span>
              <span className="text-[11px] text-muted-foreground">{formatBytes(att.size_bytes)}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(att)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleRemove(att)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CardAttachments;
