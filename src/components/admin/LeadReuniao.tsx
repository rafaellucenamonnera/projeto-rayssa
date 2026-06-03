import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, Video, Loader2, AlertTriangle, Pencil } from "lucide-react";
import { EditReuniaoDialog } from "./EditReuniaoDialog";

interface LeadReuniaoProps {
  leadId: string;
  currentStage: string;
  onMoveToRealizada?: () => void;
}

interface Reuniao {
  id: string;
  data_reuniao: string | null;
  horario_reuniao: string | null;
  tipo_reuniao: string;
  link_reuniao: string | null;
  observacao: string | null;
  resumo: string | null;
  google_meet_link: string | null;
  realizada: boolean;
}

export const LeadReuniao = ({ leadId, currentStage, onMoveToRealizada }: LeadReuniaoProps) => {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResumo, setShowResumo] = useState<string | null>(null);
  const [resumo, setResumo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReuniao, setEditingReuniao] = useState<Reuniao | null>(null);

  const loadReunioes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reunioes")
      .select("*")
      .eq("lead_id", leadId)
      .order("data_reuniao", { ascending: false, nullsFirst: false });
    setReunioes((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    loadReunioes();
  }, [leadId]);

  const isPast = (dataStr: string | null, horaStr: string | null) => {
    if (!dataStr || !horaStr) return false;
    const dt = new Date(`${dataStr}T${horaStr}`);
    return dt < new Date();
  };

  const handleSaveResumo = async (reuniaoId: string) => {
    if (!resumo.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reunioes")
        .update({ resumo: resumo.trim(), realizada: true } as any)
        .eq("id", reuniaoId);
      if (error) throw error;
      toast.success("Resumo salvo!");
      setShowResumo(null);
      setResumo("");
      loadReunioes();
      if (onMoveToRealizada) onMoveToRealizada();
    } catch {
      toast.error("Erro ao salvar resumo");
    } finally {
      setSaving(false);
    }
  };

  const tipoLabel: Record<string, string> = { online: "Online", presencial: "Presencial", telefone: "Telefone" };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (reunioes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        Reuniões
      </h3>
      {reunioes.map((r) => {
        const past = isPast(r.data_reuniao, r.horario_reuniao);
        const meetLink = r.google_meet_link || r.link_reuniao;

        return (
          <div key={r.id} className="bg-secondary/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  {new Date(r.data_reuniao + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {r.horario_reuniao.slice(0, 5)}
                </span>
                <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                  {tipoLabel[r.tipo_reuniao] || r.tipo_reuniao}
                </span>
              </div>
              {!r.realizada && (
                <button
                  onClick={() => { setEditingReuniao(r); setEditDialogOpen(true); }}
                  className="p-1 hover:bg-primary/10 rounded"
                  title="Editar reunião"
                >
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {meetLink && (
              <a href={meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                <Video className="h-3 w-3" /> Abrir reunião
              </a>
            )}

            {r.observacao && <p className="text-xs text-muted-foreground">{r.observacao}</p>}

            {r.resumo && (
              <div className="text-xs border-t border-border pt-2 mt-1">
                <span className="font-medium">Resumo: </span>{r.resumo}
              </div>
            )}

            {past && !r.realizada && (
              <div className="border-t border-border pt-2 mt-1 space-y-2">
                <div className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3 w-3" />
                  A reunião já ocorreu. Deseja registrar o resumo?
                </div>
                {showResumo === r.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={resumo}
                      onChange={(e) => setResumo(e.target.value.slice(0, 500))}
                      rows={2}
                      maxLength={500}
                      placeholder="Resumo da reunião..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveResumo(r.id)} disabled={saving}>
                        {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                        Salvar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowResumo(null); setResumo(""); }}>
                        Depois
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowResumo(r.id)}>
                    Sim, registrar resumo
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}

      <EditReuniaoDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        reuniao={editingReuniao}
        onSaved={loadReunioes}
      />
    </div>
  );
};
