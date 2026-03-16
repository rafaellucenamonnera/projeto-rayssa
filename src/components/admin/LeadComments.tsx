import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { PIPELINE_LABELS } from "@/lib/pipelineConstants";

interface LeadCommentsProps {
  leadId: string;
  currentStage: string;
  userName: string;
}

interface Comment {
  id: string;
  etapa: string;
  usuario: string;
  comentario: string;
  data_comentario: string;
}

export const LeadComments = ({ leadId, currentStage, userName }: LeadCommentsProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_comments")
      .select("*")
      .eq("lead_id", leadId)
      .order("data_comentario", { ascending: false });
    if (!error) setComments((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadComments();
  }, [leadId]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await supabase.from("lead_comments").insert({
        lead_id: leadId,
        etapa: currentStage,
        usuario: userName,
        user_id: user.id,
        comentario: newComment.trim().slice(0, 500),
      } as any);

      if (error) throw error;
      setNewComment("");
      loadComments();
    } catch (err: any) {
      toast.error("Erro ao adicionar comentário");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        Histórico de Conversa
      </h3>

      {/* Add comment */}
      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value.slice(0, 500))}
          placeholder="Adicionar comentário..."
          rows={2}
          maxLength={500}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{newComment.length}/500</span>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !newComment.trim()}>
            {submitting ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
            Enviar
          </Button>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Nenhum comentário ainda.</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((c) => (
            <div key={c.id} className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{c.usuario}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.data_comentario).toLocaleDateString("pt-BR")} {new Date(c.data_comentario).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                {PIPELINE_LABELS[c.etapa] || c.etapa}
              </span>
              <p className="text-sm">{c.comentario}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
