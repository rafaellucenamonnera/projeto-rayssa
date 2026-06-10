import { useEffect, useRef, useState } from "react";
import { Paperclip, X, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_MAX_PER_COMMENT,
  ATTACHMENT_MAX_SIZE_BYTES,
  isAllowedMime,
} from "@/lib/campaignFlow";

const BUCKET = "lead-comment-attachments";

export type StagedAttachment = {
  id: string;
  file: File;
};

type AttachmentRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

interface AttachmentPickerProps {
  staged: StagedAttachment[];
  onChange: (next: StagedAttachment[]) => void;
  disabled?: boolean;
}

export const AttachmentPicker = ({ staged, onChange, disabled }: AttachmentPickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...staged];
    for (const file of Array.from(files)) {
      if (next.length >= ATTACHMENT_MAX_PER_COMMENT) {
        toast.error(`Máximo de ${ATTACHMENT_MAX_PER_COMMENT} anexos por comentário`);
        break;
      }
      if (file.size > ATTACHMENT_MAX_SIZE_BYTES) {
        toast.error(`${file.name}: excede 10 MB`);
        continue;
      }
      if (!isAllowedMime(file.type || "", file.name)) {
        toast.error(`${file.name}: tipo não permitido (use imagem, PDF, CSV, XLS ou XLSX)`);
        continue;
      }
      next.push({ id: `${Date.now()}-${file.name}-${Math.random()}`, file });
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || staged.length >= ATTACHMENT_MAX_PER_COMMENT}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="mr-1 h-3 w-3" /> Anexar ({staged.length}/{ATTACHMENT_MAX_PER_COMMENT})
      </Button>
      {staged.length > 0 && (
        <ul className="space-y-1">
          {staged.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded border border-border bg-secondary/40 px-2 py-1 text-xs"
            >
              <span className="truncate">
                {s.file.name} <span className="text-muted-foreground">({(s.file.size / 1024).toFixed(0)} KB)</span>
              </span>
              <button
                type="button"
                onClick={() => onChange(staged.filter((x) => x.id !== s.id))}
                className="ml-2 text-muted-foreground hover:text-destructive"
                title="Remover"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export async function uploadStagedAttachments(
  staged: StagedAttachment[],
  params: { commentId: string; leadId: string; userId: string },
) {
  if (staged.length === 0) return;
  for (const s of staged) {
    const safeName = s.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${params.leadId}/${params.commentId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, s.file, { contentType: s.file.type || "application/octet-stream", upsert: false });
    if (upErr) throw upErr;
    const { error: insErr } = await (supabase as any).from("lead_comment_attachments").insert({
      comment_id: params.commentId,
      lead_id: params.leadId,
      storage_path: path,
      file_name: s.file.name,
      mime_type: s.file.type || "application/octet-stream",
      size_bytes: s.file.size,
      created_by: params.userId,
    });
    if (insErr) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw insErr;
    }
  }
}

interface CommentAttachmentListProps {
  commentId: string;
}

export const CommentAttachmentList = ({ commentId }: CommentAttachmentListProps) => {
  const [items, setItems] = useState<AttachmentRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("lead_comment_attachments")
      .select("id,storage_path,file_name,mime_type,size_bytes")
      .eq("comment_id", commentId)
      .order("created_at", { ascending: true })
      .then(({ data }: any) => setItems(data || []));
  }, [commentId]);

  const open = async (row: AttachmentRow) => {
    setBusy(row.id);
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 300);
    setBusy(null);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (items.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {items.map((it) => (
        <li key={it.id}>
          <button
            type="button"
            onClick={() => open(it)}
            disabled={busy === it.id}
            className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10"
          >
            {busy === it.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            <span className="truncate">{it.file_name}</span>
            <span className="text-muted-foreground">({(it.size_bytes / 1024).toFixed(0)} KB)</span>
          </button>
        </li>
      ))}
    </ul>
  );
};
