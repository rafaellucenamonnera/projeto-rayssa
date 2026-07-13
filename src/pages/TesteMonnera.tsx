import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  QUESTIONNAIRE,
  buildDiagnostico,
  RESULT_COLOR_CLASSES,
  type Answers,
  type Diagnostico,
} from "@/lib/testeMonnera";
import logoMonnera from "@/assets/logo-monnera.jpg";

interface LeadForm {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  empresa: string;
  cargo: string;
  segmento: string;
}

const EMPTY_LEAD: LeadForm = {
  nome: "",
  sobrenome: "",
  email: "",
  telefone: "",
  empresa: "",
  cargo: "",
  segmento: "",
};

const STORAGE_KEY = "monnera_teste_monnera_v1";
const LEAD_ID_KEY = "monnera_teste_monnera_lead_id";

const TOTAL_STEPS = QUESTIONNAIRE.length; // 1 dados + N blocos (sem confirmação)
const RESULT_STEP = TOTAL_STEPS + 1;

const readUtm = (): Record<string, string> => {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((k) => {
    const v = params.get(k);
    if (v) utm[k] = v;
  });
  return utm;
};

export default function TesteMonnera() {
  const { slugConsultor } = useParams<{ slugConsultor?: string }>();
  const [step, setStep] = useState(0);
  const [lead, setLead] = useState<LeadForm>(EMPTY_LEAD);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [reuniaoRequested, setReuniaoRequested] = useState(false);
  const [initialSubmitDone, setInitialSubmitDone] = useState(false);
  const [showForm, setShowForm] = useState(() => step > 0 || step >= RESULT_STEP);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Restaura progresso
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.lead) setLead(parsed.lead);
        if (parsed?.answers) setAnswers(parsed.answers);
        if (typeof parsed?.step === "number") setStep(parsed.step);
      }
      const savedLeadId = localStorage.getItem(LEAD_ID_KEY);
      if (savedLeadId) {
        setLeadId(savedLeadId);
        setInitialSubmitDone(true);
      }
    } catch {}
  }, []);

  // Persiste progresso
  useEffect(() => {
    if (step >= RESULT_STEP) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lead, answers, step }));
    } catch {}
  }, [lead, answers, step]);

  // Preserva progresso salvo na visibilidade do formulário
  useEffect(() => {
    if (step > 0 || step >= RESULT_STEP) {
      setShowForm(true);
    }
  }, [step]);

  const diagnostico: Diagnostico | null = useMemo(
    () => (step >= TOTAL_STEPS ? buildDiagnostico(answers) : null),
    [answers, step]
  );

  const progressValue = step === 0 ? 5 : Math.min(100, Math.round((step / TOTAL_STEPS) * 100));

  const validateLead = () => {
    if (!lead.nome.trim()) return "Informe seu nome";
    if (!lead.email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) return "Informe um email válido";
    if (!lead.telefone.trim()) return "Informe um telefone";
    if (!lead.empresa.trim()) return "Informe o nome da empresa";
    return null;
  };

  const validateBlock = (blockIndex: number): boolean => {
    const block = QUESTIONNAIRE[blockIndex];
    if (!block) return true;
    const next: Record<string, string> = {};
    block.questions.forEach((q) => {
      if (!q.required) return;
      const v = answers[q.id];
      let missing = false;
      if (q.type === "single") missing = typeof v !== "string" || v === "";
      else if (q.type === "multi") missing = !Array.isArray(v) || (v as string[]).length === 0;
      else if (q.type === "scale05") missing = typeof v !== "number";
      if (missing) next[q.id] = "Escolha ao menos uma opção para seguir.";
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = async () => {
    if (step === 0) {
      const err = validateLead();
      if (err) {
        toast.error(err);
        return;
      }
      // Cria/atualiza lead parcial antes de avançar para o questionário
      setSubmitting(true);
      try {
        const payload = {
          lead: {
            nome: lead.nome,
            sobrenome: lead.sobrenome,
            email: lead.email,
            telefone: lead.telefone,
            empresa: lead.empresa,
            cargo: lead.cargo,
            segmento: lead.segmento,
          },
          partner_slug: slugConsultor ?? null,
        };
        const { data, error } = await (supabase as any).rpc(
          "upsert_teste_monnera_started_lead",
          { p_payload: payload }
        );
        if (error) throw error;
        const newLeadId = (data?.lead_id as string) || null;
        if (!newLeadId) {
          toast.error("Não foi possível registrar seu contato. Tente novamente.");
          return;
        }
        setLeadId(newLeadId);
        try {
          localStorage.setItem(LEAD_ID_KEY, newLeadId);
        } catch {}
      } catch (e: any) {
        console.error("upsert_teste_monnera_started_lead", e);
        toast.error(e?.message || "Erro ao registrar seu contato. Tente novamente.");
        return;
      } finally {
        setSubmitting(false);
      }
    } else {
      // step >= 1 → validar o bloco atual antes de avançar
      const ok = validateBlock(step - 1);
      if (!ok) return;
    }
    setStep((s) => s + 1);
  };

  const goBack = () => setStep((s) => Math.max(0, s - 1));

  const openDiagnosticForm = () => {
    setShowForm(true);
    window.setTimeout(() => {
      document
        .getElementById("teste-monnera-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const resetTeste = () => {
    setStep(0);
    setLead(EMPTY_LEAD);
    setAnswers({});
    setLeadId(null);
    setReuniaoRequested(false);
    setInitialSubmitDone(false);
    setShowForm(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEAD_ID_KEY);
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitDiagnostico = async (solicitouReuniao: boolean): Promise<string | null> => {
    if (!diagnostico) return null;
    setSubmitting(true);
    try {
      const payload = {
        lead: {
          nome: lead.nome,
          sobrenome: lead.sobrenome,
          email: lead.email,
          telefone: lead.telefone,
          empresa: lead.empresa,
          cargo: lead.cargo,
          segmento: lead.segmento || String(answers["segmento"] || ""),
        },
        answers,
        scores: {
          icp: undefined, // scores estão em diagnostico via computeScores no back-end? preservamos aqui
        },
        classificacao: diagnostico.classificacao,
        result_color: diagnostico.result_color,
        result_title: diagnostico.result_title,
        result_summary: diagnostico.result_summary,
        pontos_atencao: diagnostico.pontos_atencao,
        recomendacao: diagnostico.recomendacao,
        leitura_sdr: diagnostico.leitura_sdr,
        priority: diagnostico.priority,
        solicitou_reuniao: solicitouReuniao,
        utm: readUtm(),
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        partner_slug: slugConsultor ?? null,
        lead_id: leadId ?? null,
      };
      // Reinjetamos os scores completos (o TS acima limpou por engano)
      const { computeScores } = await import("@/lib/testeMonnera");
      (payload as any).scores = computeScores(answers);

      const { data, error } = await (supabase as any).rpc("submit_teste_monnera", { p_payload: payload });
      if (error) throw error;
      const newLeadId = (data?.lead_id as string) || null;
      if (newLeadId) {
        setLeadId(newLeadId);
        try { localStorage.setItem(LEAD_ID_KEY, newLeadId); } catch {}
      }
      return newLeadId;
    } catch (e: any) {
      console.error("submit_teste_monnera", e);
      toast.error(e?.message || "Erro ao enviar diagnóstico");
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleShowResult = async () => {
    // Etapa final antes de ver o resultado: cria/atualiza lead
    if (initialSubmitDone) {
      setStep(RESULT_STEP);
      return;
    }
    setStep(RESULT_STEP);
    const id = await submitDiagnostico(false);
    if (id) {
      setInitialSubmitDone(true);
    }
  };

  const handleSolicitarReuniao = async () => {
    if (reuniaoRequested) return;
    const id = await submitDiagnostico(true);
    if (id) {
      setReuniaoRequested(true);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  };

  const setAnswer = (id: string, value: string | string[] | number) =>
    setAnswers((prev) => ({ ...prev, [id]: value }));

  // Renderização por step
  const renderQuestion = (q: (typeof QUESTIONNAIRE)[number]["questions"][number]) => {
    const value = answers[q.id];
    if (q.type === "single") {
      return (
        <RadioGroup
          value={typeof value === "string" ? value : ""}
          onValueChange={(v) => setAnswer(q.id, v)}
          className="space-y-2"
        >
          {q.options?.map((o) => (
            <label
              key={o.value}
              htmlFor={`${q.id}-${o.value}`}
              className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:border-primary/60"
            >
              <RadioGroupItem id={`${q.id}-${o.value}`} value={o.value} className="mt-0.5" />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </RadioGroup>
      );
    }
    if (q.type === "multi") {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-2">
          {q.options?.map((o) => {
            const checked = arr.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:border-primary/60"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v
                      ? Array.from(new Set([...arr, o.value]))
                      : arr.filter((x) => x !== o.value);
                    setAnswer(q.id, next);
                  }}
                />
                <span className="text-sm">{o.label}</span>
              </label>
            );
          })}
        </div>
      );
    }
    // scale05
    const num = typeof value === "number" ? value : value ? Number(value) : null;
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {[0, 1, 2, 3, 4, 5].map((n) => {
            const selected = num === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setAnswer(q.id, n)}
                className={`h-10 w-10 rounded-md border text-sm font-semibold transition-colors ${
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/60"
                }`}
              >
                {n}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{q.minLabel || "0"}</span>
          <span>{q.maxLabel || "5"}</span>
        </div>
      </div>
    );
  };

  // === LAYOUTS ===
  const heroSection = (
    <section className="bg-background">
      <div className="container mx-auto grid gap-5 px-4 py-5 sm:gap-6 sm:py-8 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.75fr)] md:items-center md:gap-8 md:py-10">
        <div className="space-y-5 sm:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logoMonnera}
                alt="Monnera"
                className="h-8 w-auto object-contain"
              />
              <p className="text-sm font-medium text-primary">Diagnóstico educativo Monnera</p>
            </div>
            <Button className="h-10 w-full text-sm sm:w-auto" onClick={openDiagnosticForm}>
              Fazer diagnóstico gratuito
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
            Sua empresa paga prêmio ou apenas chama comissão de prêmio?
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Em menos de 4 minutos, descubra se sua empresa consegue pagar premiações com mais segurança, clareza e controle sem transformar incentivo em dor de cabeça operacional e passivo trabalhista.
          </p>
          <p className="text-sm text-muted-foreground">
            Muitas empresas querem premiar melhor, vender mais e reconhecer desempenho, mas travam na dúvida: estou pagando do jeito certo? O cálculo vira planilha manual, a apuração consome tempo, o pagamento em dinheiro ou recarga em cartão de benefício gera retrabalho e a falta de rastreabilidade aumenta o medo de estar fazendo errado.
          </p>
          <div className="flex flex-col items-start gap-3">
            <Button className="h-11 text-sm sm:h-12 sm:text-base" onClick={openDiagnosticForm}>
              Fazer diagnóstico gratuito
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Resultado educativo. Não substitui validação jurídica ou contábil. Ao continuar, você concorda com o uso dos dados informados para contato comercial da Monnera, conforme a LGPD.
            </p>
          </div>
        </div>

        <Card className="self-start border-border bg-card/70 md:self-center">
          <CardHeader className="px-4 py-4 sm:px-5">
            <CardTitle className="text-base font-semibold">O diagnóstico avalia</CardTitle>
            <p className="text-xs leading-5 text-muted-foreground">
              Quatro pontos que costumam gerar dúvida antes de pagar premiações.
            </p>
          </CardHeader>
          <CardContent className="grid gap-2 px-4 pb-4 text-sm text-muted-foreground sm:px-5 sm:pb-5">
            {[
              { title: "Comissão ou premiação", copy: "Separação entre incentivo, comissão e pagamento recorrente." },
              { title: "Governança e legalidade", copy: "Regras, aceite e registros antes do pagamento." },
              { title: "Metas e potencial de vendas", copy: "Campanhas com metas por loja, rede e colaborador." },
              { title: "Cálculo e pagamento", copy: "Apuração, conciliação e rastreabilidade do valor pago." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 p-2.5 sm:p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 hidden text-xs leading-5 text-muted-foreground sm:block">{item.copy}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );

  const leadFormSection = (
    <section id="teste-monnera-form" className="bg-background py-8 md:py-12">
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Seus dados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nome">Nome *</Label>
              <Input id="nome" value={lead.nome} onChange={(e) => setLead({ ...lead, nome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="sobrenome">Sobrenome</Label>
              <Input id="sobrenome" value={lead.sobrenome} onChange={(e) => setLead({ ...lead, sobrenome: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">Email corporativo *</Label>
              <Input id="email" type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone *</Label>
              <Input id="telefone" value={lead.telefone} onChange={(e) => setLead({ ...lead, telefone: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="empresa">Empresa *</Label>
              <Input id="empresa" value={lead.empresa} onChange={(e) => setLead({ ...lead, empresa: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" value={lead.cargo} onChange={(e) => setLead({ ...lead, cargo: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="segmento">Segmento</Label>
              <Input id="segmento" placeholder="Ex: farmácia, matcon, vestuário, veículos..." value={lead.segmento} onChange={(e) => setLead({ ...lead, segmento: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={goNext} size="lg" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Começar diagnóstico
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );

  const renderBlock = () => {
    const block = QUESTIONNAIRE[step - 1];
    if (!block) return null;
    const isConfirmation = block.id === "confirmacao";
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-6 space-y-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Etapa {step} de {TOTAL_STEPS}</p>
            <h2 className="font-display text-xl font-semibold mt-1">{block.title}</h2>
            {block.description && <p className="text-sm text-muted-foreground mt-1">{block.description}</p>}
          </div>

          {isConfirmation ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Suas respostas serão usadas para gerar um diagnóstico educativo. Ao continuar,
                registramos seus dados para retornarmos com o resultado e possíveis próximos passos.
              </p>
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                Resultado educativo. Não substitui validação jurídica ou contábil.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {block.questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-sm font-medium">{q.label}</Label>
                  {q.helper && <p className="text-xs text-muted-foreground">{q.helper}</p>}
                  {renderQuestion(q)}
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack} disabled={submitting}>Voltar</Button>
            {isConfirmation ? (
              <Button onClick={handleShowResult} disabled={submitting} size="lg">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ver diagnóstico
              </Button>
            ) : (
              <Button onClick={goNext} disabled={submitting}>Próximo</Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderResult = () => {
    if (!diagnostico) return null;
    const colorCls = RESULT_COLOR_CLASSES[diagnostico.result_color];
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className={`border-2 ${colorCls.card}`}>
          <CardContent className="p-6 space-y-3">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${colorCls.badge}`}>
              Diagnóstico {colorCls.label}
            </span>
            <h2 className="font-display text-2xl font-semibold">{diagnostico.result_title}</h2>
            <p className="text-sm text-muted-foreground">{diagnostico.result_summary}</p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { label: "Governança", value: diagnostico.classificacao.governanca },
            { label: "Campanhas", value: diagnostico.classificacao.campanhas },
          ].map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
                <p className="text-lg font-semibold capitalize mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {diagnostico.pontos_atencao.length > 0 && (
          <Card>
            <CardContent className="p-6 space-y-2">
              <h3 className="font-display text-base font-semibold">Pontos de atenção</h3>
              <ul className="space-y-2">
                {diagnostico.pontos_atencao.map((p, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6 space-y-3">
            <h3 className="font-display text-base font-semibold">Recomendação</h3>
            <p className="text-sm">{diagnostico.recomendacao}</p>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Resultado educativo. Não substitui validação jurídica ou contábil.
            </p>
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardContent className="p-6 space-y-4 text-center">
            {reuniaoRequested ? (
              <>
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="text-sm">
                  Recebemos seu diagnóstico. Uma tarefa foi criada no painel comercial para contato em até 24h.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-display text-lg font-semibold">Quer avançar com um especialista?</h3>
                <p className="text-sm text-muted-foreground">
                  Podemos conduzir uma conversa objetiva sobre como aplicar isso na sua operação.
                </p>
                <Button size="lg" onClick={handleSolicitarReuniao} disabled={submitting || !leadId}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Agendar conversa com especialista Monnera
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="outline" onClick={resetTeste}>
            Refazer diagnóstico
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    document.title = "Teste Monnera — Diagnóstico de campanhas de incentivo";
    const ensureMeta = (attr: "name" | "property", key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    ensureMeta("name", "description", "Descubra em minutos como está a governança, clareza e pagamento das suas campanhas de incentivo. Diagnóstico educativo Monnera.");
    ensureMeta("property", "og:title", "Teste Monnera — Diagnóstico de campanhas de incentivo");
    ensureMeta("property", "og:description", "Um diagnóstico rápido e educativo para avaliar como sua empresa organiza campanhas, comissão e pagamentos.");
    ensureMeta("property", "og:type", "website");
    ensureMeta("name", "twitter:card", "summary_large_image");
  }, []);

  return (
    <>
      <div className="teste-monnera-theme min-h-screen bg-background">
        <header className="border-b border-border">
          <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-4">
            <span className="font-display text-lg font-semibold text-foreground">Monnera</span>
            <span className="text-xs text-muted-foreground">Teste Monnera</span>
          </div>
          {step > 0 && step <= TOTAL_STEPS && (
            <div className="max-w-5xl mx-auto px-4 pb-3">
              <Progress value={progressValue} className="h-1.5" />
            </div>
          )}
        </header>
        <main className="px-4 py-8 md:py-12">
          {step === 0 && (
            <>
              {heroSection}
              {showForm && leadFormSection}
            </>
          )}
          {step > 0 && step <= TOTAL_STEPS && renderBlock()}
          {step >= RESULT_STEP && renderResult()}
        </main>
      </div>
    </>
  );
}
