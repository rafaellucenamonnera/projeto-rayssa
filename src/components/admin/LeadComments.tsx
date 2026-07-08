import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send, Pencil, Trash2, X, Check } from "lucide-react";
import { PIPELINE_LABELS } from "@/lib/pipelineConstants";
import { createNotifications } from "@/lib/notifications";
import { AttachmentPicker, CommentAttachmentList, StagedAttachment, uploadStagedAttachments } from "./CommentAttachments";

interface LeadCommentsProps {
  leadId: string;
  currentStage: string;
  userName: string;
  actionBasePath?: string;
  canInsertMessage?: boolean;
  canEditMessage?: boolean;
  canDeleteMessage?: boolean;
  canInsertFile?: boolean;
  submitLabel?: string;
}

interface Comment {
  id: string;
  etapa: string;
  usuario: string;
  comentario: string;
  data_comentario: string;
  user_id: string;
  lead_comment_attachments?: CommentAttachment[];
}

interface CommentAttachment {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}

type MentionUser = {
  user_id: string;
  nome: string;
};

export const LeadComments = ({
  leadId,
  currentStage,
  userName,
  actionBasePath = "/admin/painel-comercial",
  canInsertMessage = true,
  canEditMessage = true,
  canDeleteMessage = true,
  canInsertFile = true,
}: LeadCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [users, setUsers] = useState<MentionUser[]>([]);
  const [selectedMentionIds, setSelectedMentionIds] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
    const loadMentionUsers = async () => {
      const [{ data: profileUsers }, { data: roles }] = await Promise.all([
        supabase
      .from("profiles")
      .select("user_id,nome,ativo,can_be_responsible")
      .eq("ativo", true)
          .order("nome", { ascending: true }),
        (supabase as any).from("user_roles").select("user_id,role").eq("role", "admin"),
      ]);
      const adminIds = new Set(((roles as any[]) || []).map((role) => role.user_id));
      const internalUsers = ((profileUsers as any) || [])
        .filter((u: any) => u.can_be_responsible || adminIds.has(u.user_id))
        .map((u: any) => ({ user_id: u.user_id, nome: u.nome }));
      setUsers(internalUsers);
    };
    loadMentionUsers();
  }, []);

  const loadComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_comments")
      .select("*,lead_comment_attachments(id,storage_path,file_name,mime_type,size_bytes)")
      .eq("lead_id", leadId)
      .order("data_comentario", { ascending: false });
    if (!error) setComments((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, [leadId]);

  const handleSubmit = async () => {
    if (!canInsertMessage) {
      toast.error("Sem permissão para inserir mensagem");
      return;
    }
    if (!newComment.trim() && stagedAttachments.length === 0) return;
    if (!newComment.trim()) {
      toast.error("Escreva um comentário antes de anexar arquivos");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: comment, error } = await supabase.from("lead_comments").insert({
        lead_id: leadId,
        etapa: currentStage,
        usuario: userName,
        user_id: user.id,
        comentario: newComment.trim().slice(0, 500),
      } as any).select("id").single();

      if (error) throw error;

      if (stagedAttachments.length > 0 && comment?.id) {
        try {
          await uploadStagedAttachments(stagedAttachments, {
            commentId: comment.id,
            leadId,
            userId: user.id,
          });
        } catch (e: any) {
          toast.error("Comentário salvo, mas falhou ao enviar anexos: " + (e?.message || ""));
        }
      }

      const mentionedIds = Array.from(new Set(selectedMentionIds)).filter((id) => id !== user.id);
      if (mentionedIds.length > 0 && comment?.id) {
        await (supabase as any).from("lead_comment_mentions").insert(
          mentionedIds.map((mentioned_user_id) => ({
            comment_id: comment.id,
            lead_id: leadId,
            mentioned_user_id,
            created_by: user.id,
          })),
        );
        await createNotifications(
          mentionedIds.map((recipientUserId) => ({
            recipientUserId,
            type: "comment_mention",
            title: "Nota",
            message: `${userName} mencionou você no card.`,
            leadId,
            commentId: comment.id,
            actionUrl: `${actionBasePath}?card=${leadId}`,
            metadata: { comment_preview: newComment.trim().slice(0, 140) },
            deliveryKey: `comment-${comment.id}-mention-${recipientUserId}`,
          })),
        );
      }
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_user_id", user.id)
        .eq("lead_id", leadId)
        .eq("type", "comment_mention")
        .is("read_at", null);
      setNewComment("");
      setSelectedMentionIds([]);
      setMentionQuery("");
      setStagedAttachments([]);
      loadComments();
    } catch {
      toast.error("Erro ao adicionar comentário");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentChange = (value: string) => {
    const sliced = value.slice(0, 500);
    setNewComment(sliced);
    const match = sliced.match(/@([\p{L}\p{N}._-]*)$/u);
    setMentionQuery(match ? match[1].toLowerCase() : "");
  };

  const addMention = (user: MentionUser) => {
    const nextText = newComment.replace(/@([\p{L}\p{N}._-]*)$/u, `@${user.nome} `).slice(0, 500);
    setNewComment(nextText);
    setSelectedMentionIds((prev) => (prev.includes(user.user_id) ? prev : [...prev, user.user_id]));
    setMentionQuery("");
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@[\p{L}\p{N}À-ÿ._ -]+)/gu);
    return parts.map((part, index) =>
      part.startsWith("@") ? (
        <span key={`${part}-${index}`} className="font-medium text-primary">{part}</span>
      ) : (
        <span key={`${part}-${index}`}>{part}</span>
      ),
    );
  };

  const mentionSuggestions = mentionQuery
    ? users.filter((u) => u.nome.toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];

  const handleEdit = async (commentId: string) => {
    if (!canEditMessage) {
      toast.error("Sem permissão para editar mensagem");
      return;
    }
    if (!editingText.trim()) return;
    try {
      const { error } = await supabase
        .from("lead_comments")
        .update({ comentario: editingText.trim().slice(0, 500) } as any)
        .eq("id", commentId);
      if (error) throw error;
      toast.success("Comentário atualizado");
      setEditingId(null);
      setEditingText("");
      loadComments();
    } catch {
      toast.error("Erro ao editar comentário");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!canDeleteMessage) {
      toast.error("Sem permissão para excluir mensagem");
      return;
    }
    try {
      const { error } = await supabase
        .from("lead_comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
      toast.success("Comentário excluído");
      setDeletingId(null);
      loadComments();
    } catch {
      toast.error("Erro ao excluir comentário");
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Histórico de Conversa
      </h3>

      {/* Add comment */}
      {canInsertMessage && (
        <div className="space-y-2">
          <Textarea
            value={newComment}
            onChange={(e) => handleCommentChange(e.target.value)}
            placeholder="Adicionar comentário..."
            rows={2}
            maxLength={500}
          />
          {mentionSuggestions.length > 0 && (
            <div className="rounded-md border border-border bg-popover p-1 shadow-sm">
              {mentionSuggestions.map((u) => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => addMention(u)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  @{u.nome}
                </button>
              ))}
            </div>
          )}
          {selectedMentionIds.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Mencionando: {selectedMentionIds.map((id) => users.find((u) => u.user_id === id)?.nome).filter(Boolean).join(", ")}
            </p>
          )}
          {canInsertFile && (
            <AttachmentPicker staged={stagedAttachments} onChange={setStagedAttachments} disabled={submitting} />
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{newComment.length}/500</span>
            <Button size="sm" onClick={handleSubmit} disabled={submitting || (!newComment.trim() && stagedAttachments.length === 0)}>
              {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
              Enviar
            </Button>
          </div>
        </div>
      )}

      {/* Comments list */}
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

            return (
              <div key={c.id} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{c.usuario}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(c.data_comentario).toLocaleDateString("pt-BR")} {new Date(c.data_comentario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isOwner && !isEditing && !isDeleting && (canEditMessage || canDeleteMessage) && (
                      <>
                        {canEditMessage && (
                          <button
                            onClick={() => { setEditingId(c.id); setEditingText(c.comentario); }}
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
                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                  {PIPELINE_LABELS[c.etapa] || c.etapa}
                </span>

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
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(null); setEditingText(""); }}>
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
                    <p className="text-sm">{renderCommentText(c.comentario)}</p>
                    <CommentAttachmentList commentId={c.id} />
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
