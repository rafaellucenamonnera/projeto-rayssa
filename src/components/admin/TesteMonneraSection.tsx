import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { QUESTIONNAIRE, RESULT_COLOR_CLASSES, type ResultColor, type PracticalAction } from "@/lib/testeMonnera";

interface Diagnostico {
  id: string;
  submitted_at: string;
  respondent_nome: string | null;
  respondent_sobrenome: string | null;
  respondent_email: string | null;
  respondent_telefone: string | null;
  respondent_empresa: string | null;
  respondent_cargo: string | null;
  respondent_segmento: string | null;
  answers: Record<string, any>;
  scores: { icp?: number; governanca?: number; campanhas?: number; pagamentos?: number };
  classificacao: Record<string, string>;
  result_color: ResultColor | null;
  result_title: string | null;
  result_summary: string | null;
  pontos_atencao: string[] | null;
  recomendacao: string | null;
  leitura_sdr: {
    prioridade?: string;
    dor_principal?: string;
    gancho?: string;
    proximo_passo?: string;
  } | null;
  solicitou_reuniao: boolean;
  practical_actions?: PracticalAction[] | null;
  next_steps?: string[] | null;
  manual_path?: string | string[] | null;
  monnera_path?: string | string[] | null;
}

const labelForOption = (blockIdx: number, qId: string, value: string): string => {
  const q = QUESTIONNAIRE[blockIdx]?.questions.find((x) => x.id === qId);
  const opt = q?.options?.find((o) => o.value === value);
  return opt?.label || value;
};

export function TesteMonneraSection({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diag, setDiag] = useState<Diagnostico | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await (supabase as any)
          .from("teste_monnera_diagnosticos")
          .select("*")
          .eq("lead_id", leadId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (alive) setDiag(data as Diagnostico | null);
      } catch (e) {
        console.error("TesteMonneraSection load", e);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [leadId]);

  if (!loading && !diag) return null;

  const colorCls = diag?.result_color ? RESULT_COLOR_CLASSES[diag.result_color] : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Questionário de Qualificação</h3>
          {colorCls && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colorCls.badge}`}>
              {colorCls.label}
            </span>
          )}
          {diag?.solicitou_reuniao && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">
              Reunião solicitada
            </span>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1 text-xs">{open ? "Recolher" : "Ver detalhes"}</span>
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-3 space-y-4 text-sm">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando diagnóstico…
          </div>
        )}

        {diag && (
          <>
            {diag.solicitou_reuniao && (
              <div className="rounded-md border border-primary/30 bg-primary/10 p-3">
                <p className="text-sm font-medium text-primary">
                  O cliente solicitou contato com um especialista Monnera ao final do Teste Monnera.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Priorize o retorno comercial. O cliente demonstrou interesse ativo em conversar sobre o diagnóstico e próximos passos.
                </p>
              </div>
            )}

            {(diag.result_title || diag.result_summary) && (
              <div className={`rounded-md border p-3 ${colorCls?.card || ""}`}>
                {diag.result_title && <p className="font-semibold">{diag.result_title}</p>}
                {diag.result_summary && (
                  <p className="text-xs text-muted-foreground mt-1">{diag.result_summary}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: "icp", label: "ICP" },
                { key: "governanca", label: "Governança" },
                { key: "campanhas", label: "Campanhas" },
                { key: "pagamentos", label: "Pagamentos" },
              ].map((s) => (
                <div key={s.key} className="rounded border border-border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">{s.label}</p>
                  <p className="text-sm font-semibold">
                    {(diag.scores as any)?.[s.key] ?? "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {(diag.classificacao as any)?.[s.key] || "—"}
                  </p>
                </div>
              ))}
            </div>

            {diag.recomendacao && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground">Recomendação</p>
                <p className="text-sm">{diag.recomendacao}</p>
              </div>
            )}

            {diag.leitura_sdr && (
              <div className="rounded border border-border p-3 space-y-1">
                <p className="text-[10px] uppercase text-muted-foreground">Leitura SDR</p>
                <p className="text-xs"><span className="font-semibold">Prioridade:</span> {diag.leitura_sdr.prioridade || "—"}</p>
                <p className="text-xs"><span className="font-semibold">Dor:</span> {diag.leitura_sdr.dor_principal || "—"}</p>
                <p className="text-xs"><span className="font-semibold">Gancho:</span> {diag.leitura_sdr.gancho || "—"}</p>
                <p className="text-xs"><span className="font-semibold">Próximo passo:</span> {diag.leitura_sdr.proximo_passo || "—"}</p>
              </div>
            )}

            {(() => {
              const nextSteps = Array.isArray(diag.next_steps) ? diag.next_steps.filter(Boolean) : [];
              if (nextSteps.length === 0) return null;
              return (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">O que fazer agora</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {nextSteps.map((p, i) => (<li key={i}>{p}</li>))}
                  </ul>
                </div>
              );
            })()}

            {(() => {
              const raw = diag.manual_path;
              const items = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
              if (items.length === 0) return null;
              return (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Caminho manual</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {items.map((p, i) => (<li key={i}>{p}</li>))}
                  </ul>
                </div>
              );
            })()}

            {(() => {
              const raw = diag.monnera_path;
              const items = Array.isArray(raw) ? raw.filter(Boolean) : raw ? [raw] : [];
              if (items.length === 0) return null;
              return (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Como a Monnera pode automatizar</p>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {items.map((p, i) => (<li key={i}>{p}</li>))}
                  </ul>
                </div>
              );
            })()}

            {(() => {
              const list = Array.isArray(diag.practical_actions) ? diag.practical_actions : [];
              if (list.length === 0) return null;
              const grouped = new Map<string, PracticalAction[]>();
              list.forEach((a) => {
                const arr = grouped.get(a.tema) ?? [];
                arr.push(a);
                grouped.set(a.tema, arr);
              });
              return (
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground mb-1">Ações práticas por tema</p>
                  <div className="space-y-2">
                    {Array.from(grouped).map(([tema, items]) => (
                      <div key={tema} className="rounded border border-border p-2 space-y-1">
                        <p className="text-xs font-semibold">{tema}</p>
                        <ul className="space-y-1">
                          {items.map((it, idx) => (
                            <li key={idx} className="text-[11px] leading-snug space-y-0.5">
                              {it.ponto && <p className="text-muted-foreground">{it.ponto}</p>}
                              {it.acao && <p><span className="font-semibold">Ação: </span>{it.acao}</p>}
                              {it.caminho_manual && <p><span className="font-semibold">Manual: </span>{it.caminho_manual}</p>}
                              {it.caminho_monnera && <p><span className="font-semibold">Com Monnera: </span>{it.caminho_monnera}</p>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {Array.isArray(diag.pontos_atencao) && diag.pontos_atencao.length > 0 && (
              <div>
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Pontos de atenção</p>
                <ul className="list-disc pl-4 space-y-1 text-xs">
                  {diag.pontos_atencao.map((p, i) => (<li key={i}>{p}</li>))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase text-muted-foreground mb-2">Respostas</p>
              <div className="space-y-3">
                {QUESTIONNAIRE.map((block, bIdx) => {
                  const blockAnswers = block.questions.filter((q) => diag.answers?.[q.id] !== undefined);
                  if (blockAnswers.length === 0) return null;
                  return (
                    <div key={block.id} className="rounded border border-border p-2">
                      <p className="text-xs font-semibold mb-1">{block.title}</p>
                      <ul className="space-y-1">
                        {blockAnswers.map((q) => {
                          const a = diag.answers[q.id];
                          let rendered: string;
                          if (q.type === "single" && typeof a === "string") rendered = labelForOption(bIdx, q.id, a);
                          else if (q.type === "multi" && Array.isArray(a)) rendered = a.map((v) => labelForOption(bIdx, q.id, v)).join(", ");
                          else if (q.type === "scale05") rendered = `${a}/5`;
                          else rendered = String(a);
                          return (
                            <li key={q.id} className="text-xs">
                              <span className="text-muted-foreground">{q.label}</span>{" "}
                              <span className="font-medium">{rendered}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground border-t pt-2">
              Enviado em {new Date(diag.submitted_at).toLocaleString("pt-BR")} por{" "}
              {diag.respondent_nome} {diag.respondent_sobrenome || ""} — {diag.respondent_email}
            </div>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default TesteMonneraSection;
