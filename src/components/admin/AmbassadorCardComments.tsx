import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send, Pencil, Trash2, X, Check, Paperclip, Download } from "lucide-react";

interface AmbassadorCardCommentsProps {
  cardId: string;
  currentStage: string;
  userName: string;
  canInsertMessage?: boolean;
  canEditMessage?: boolean;
  canDeleteMessage?: boolean;
  canInsertFile?: boolean;
}

interface Attachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

interface Comment {
  id: string;
  etapa: string;
  usuario: string;
  comentario: string;
  data_comentario: string;
  user_id: string;
  ambassador_card_comment_attachments?: Attachment[];
}

const BUCKET = "lead-comment-attachments";
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_COMMENT = 5;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const ACCEPT_ATTR =
  ".pdf,.jpg,.jpeg,.png,.doc,.docx,application/pdf,image/jpeg,image/png,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isAllowed(file: File): boolean {
  if (ALLOWED_MIME.has(file.type)) return true;
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx")
  );
}

function extOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "bin";
}

export const AmbassadorCardComments = ({
  cardId,
  currentStage,
  userName,
  canInsertMessage = true,
  canEditMessage = true,
  canDeleteMessage = true,
  canInsertFile = true,
}: AmbassadorCardCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [staged, setStaged] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const loadComments = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("ambassador_card_comments")
      .select(
        "*,ambassador_card_comment_attachments(id,storage_path,file_name,mime_type,size_bytes)"
      )
      .eq("ambassador_card_id", cardId)
      .order("data_comentario", { ascending: false });
    if (!error) setComments((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const accepted: File[] = [];
    for (const f of files) {
      if (!isAllowed(f)) {
        toast.error(`Formato não suportado: ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`Arquivo excede 10 MB: ${f.name}`);
        continue;
      }
      accepted.push(f);
    }
    setStaged((prev) => {
      const merged = [...prev, ...accepted];
      if (merged.length > MAX_FILES_PER_COMMENT) {
        toast.error(`Máximo ${MAX_FILES_PER_COMMENT} anexos por comentário`);
        return merged.slice(0, MAX_FILES_PER_COMMENT);
      }
      return merged;
    });
  };

  const removeStaged = (idx: number) => {
    setStaged((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!canInsertMessage) {
      toast.error("Sem permissão para inserir mensagem");
      return;
    }
    if (!newComment.trim()) {
      toast.error("Escreva um comentário");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: comment, error } = await (supabase as any)
        .from("ambassador_card_comments")
        .insert({
          ambassador_card_id: cardId,
          etapa: currentStage,
          usuario: userName,
          user_id: user.id,
          comentario: newComment.trim().slice(0, 500),
        })
        .select("id")
        .single();
      if (error) throw error;

      if (staged.length > 0 && comment?.id) {
        for (const file of staged) {
          try {
            const uid = (crypto as any).randomUUID
              ? (crypto as any).randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const path = `ambassador_cards/${cardId}/${comment.id}/${uid}.${extOf(file.name)}`;
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
            if (upErr) throw upErr;
            const { error: metaErr } = await (supabase as any)
              .from("ambassador_card_comment_attachments")
              .insert({
                comment_id: comment.id,
                ambassador_card_id: cardId,
                storage_path: path,
                file_name: file.name,
                mime_type: file.type || "application/octet-stream",
                size_bytes: file.size,
                created_by: user.id,
              });
            if (metaErr) throw metaErr;
          } catch (e: any) {
            toast.error(`Erro ao anexar arquivo: ${e?.message || "falha desconhecida"}`);
          }
        }
      }

      setNewComment("");
      setStaged([]);
      loadComments();
    } catch (error: any) {
      toast.error(`Erro ao adicionar comentário: ${error?.message || "falha desconhecida"}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (commentId: string) => {
    if (!canEditMessage) {
      toast.error("Sem permissão para editar mensagem");
      return;
    }
    if (!editingText.trim()) return;
    try {
      const { error } = await (supabase as any)
        .from("ambassador_card_comments")
        .update({ comentario: editingText.trim().slice(0, 500) })
        .eq("id", commentId);
      if (error) throw error;
      toast.success("Comentário atualizado");
      setEditingId(null);
      setEditingText("");
      loadComments();
    } catch (error: any) {
      toast.error(`Erro ao editar comentário: ${error?.message || "falha desconhecida"}`);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!canDeleteMessage) {
      toast.error("Sem permissão para excluir mensagem");
      return;
    }
    try {
      const { error } = await (supabase as any)
        .from("ambassador_card_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
      toast.success("Comentário excluído");
      setDeletingId(null);
      loadComments();
    } catch (error: any) {
      toast.error(`Erro ao excluir comentário: ${error?.message || "falha desconhecida"}`);
    }
  };

  const openAttachment = async (a: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(a.storage_path, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(`Erro ao abrir anexo: ${e?.message || "falha desconhecida"}`);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Histórico de Conversa
      </h3>

      {canInsertMessage && (
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
            placeholder="Adicionar comentário..."
            rows={2}
            maxLength={500}
          />
          {canInsertFile && (
            <div className="space-y-1">
              <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Paperclip className="h-3 w-3" />
                Anexar arquivo (PDF, JPG, PNG, DOC, DOCX — máx. 10 MB, {MAX_FILES_PER_COMMENT} por comentário)
                <input
                  type="file"
                  multiple
                  accept={ACCEPT_ATTR}
                  className="hidden"
                  onChange={handleFilesSelected}
                  disabled={submitting || staged.length >= MAX_FILES_PER_COMMENT}
                />
              </label>
              {staged.length > 0 && (
                <ul className="space-y-1">
                  {staged.map((f, i) => (
                    <li key={i} className="flex items-center justify-between rounded bg-secondary/50 px-2 py-1 text-xs">
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removeStaged(i)}
                        className="p-0.5 hover:bg-destructive/10 rounded"
                        title="Remover"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{newComment.length}/500</span>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
              {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((c) => {
            const isOwner = c.user_id === currentUserId;
            const isEditing = editingId === c.id;
            const isDeleting = deletingId === c.id;
            const attachments = c.ambassador_card_comment_attachments || [];
            return (
              <div key={c.id} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{c.usuario}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.data_comentario).toLocaleDateString("pt-BR")}{" "}
                      {new Date(c.data_comentario).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isOwner && !isEditing && !isDeleting && (canEditMessage || canDeleteMessage) && (
                      <>
                        {canEditMessage && (
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditingText(c.comentario);
                            }}
                            className="p-0.5 hover:bg-primary/10 rounded"
                            title="Editar comentário"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        {canDeleteMessage && (
                          <button
                            onClick={() => setDeletingId(c.id)}
                            className="p-0.5 hover:bg-destructive/10 rounded"
                            title="Excluir comentário"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <Textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value.slice(0, 500))}
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleEdit(c.id)}>
                        <Check className="mr-1 h-3 w-3" /> Salvar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEditingId(null);
                          setEditingText("");
                        }}
                      >
                        <X className="mr-1 h-3 w-3" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : isDeleting ? (
                  <div className="pt-1 space-y-2">
                    <p className="text-xs text-destructive">Tem certeza que deseja excluir este comentário?</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(c.id)}>
                        Confirmar exclusão
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDeletingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm whitespace-pre-wrap">{c.comentario}</p>
                    {attachments.length > 0 && (
                      <ul className="space-y-1 pt-1">
                        {attachments.map((a) => (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => openAttachment(a)}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              title="Abrir anexo"
                            >
                              <Download className="h-3 w-3" />
                              {a.file_name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
