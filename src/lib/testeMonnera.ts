// Fonte única de perguntas, scoring e diagnóstico do Teste Monnera.
// Usada pela landing pública e pela dobra do card no painel comercial.

export type QuestionType = "single" | "multi" | "scale05";

export interface QuestionOption {
  value: string;
  label: string;
  /** Peso somado ao score da dimensão indicada quando esta opção é escolhida. */
  weights?: Partial<Record<Dimension, number>>;
}

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  helper?: string;
  options?: QuestionOption[];
  /** Para scale05: peso multiplicado pelo valor (0..5) e somado à dimensão. */
  scaleWeight?: Partial<Record<Dimension, number>>;
  minLabel?: string;
  maxLabel?: string;
  required?: boolean;
}

export interface Block {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
}

export type Dimension = "icp" | "governanca" | "campanhas" | "pagamentos";

export type Answers = Record<string, string | string[] | number>;

export interface Scores {
  icp: number;
  governanca: number;
  campanhas: number;
  pagamentos: number;
}

export type ResultColor = "verde" | "amarelo" | "vermelho" | "cinza";

export interface LeituraSDR {
  prioridade: "alta" | "media" | "baixa";
  dor_principal: string;
  gancho: string;
  proximo_passo: string;
}

export interface Diagnostico {
  result_color: ResultColor;
  result_title: string;
  result_summary: string;
  pontos_atencao: string[];
  recomendacao: string;
  leitura_sdr: LeituraSDR;
  priority: "alta" | "media" | "baixa";
  classificacao: {
    icp: "baixo" | "medio" | "alto";
    governanca: "baixa" | "media" | "alta";
    campanhas: "baixa" | "media" | "alta";
    pagamentos: "baixa" | "media" | "alta";
  };
}

export const QUESTIONNAIRE: Block[] = [
  {
    id: "empresa",
    title: "Sobre a empresa",
    questions: [
      {
        id: "porte",
        type: "single",
        label: "Porte da operação de vendas com incentivo",
        required: true,
        options: [
          { value: "ate_10", label: "Até 10 pessoas envolvidas", weights: { icp: 3 } },
          { value: "11_50", label: "De 11 a 50 pessoas", weights: { icp: 7 } },
          { value: "51_200", label: "De 51 a 200 pessoas", weights: { icp: 10 } },
          { value: "mais_200", label: "Mais de 200 pessoas", weights: { icp: 8 } },
        ],
      },
      {
        id: "participacao_decisao",
        type: "single",
        label: "Qual seu papel na decisão sobre campanhas de incentivo?",
        required: true,
        options: [
          { value: "decisor", label: "Decisor final", weights: { icp: 10 } },
          { value: "influenciador", label: "Influenciador chave", weights: { icp: 7 } },
          { value: "operacional", label: "Operacional/execução", weights: { icp: 4 } },
          { value: "nenhum", label: "Sem envolvimento direto", weights: { icp: 1 } },
        ],
      },
    ],
  },
  {
    id: "formatos",
    title: "Formatos de incentivo em uso",
    questions: [
      {
        id: "formatos_uso",
        type: "multi",
        label: "Quais formatos vocês usam hoje? (marque todos)",
        options: [
          { value: "comissao", label: "Comissão sobre venda", weights: { governanca: 4 } },
          { value: "premiacao", label: "Premiação por meta", weights: { governanca: 4 } },
          { value: "bonus", label: "Bônus discricionário", weights: { governanca: 5 } },
          { value: "campanha_sazonal", label: "Campanhas sazonais", weights: { governanca: 3 } },
          { value: "ranking", label: "Ranking/gamificação", weights: { governanca: 3 } },
          { value: "nenhum", label: "Nenhum formato estruturado", weights: { governanca: 6 } },
        ],
      },
    ],
  },
  {
    id: "governanca",
    title: "Governança e clareza",
    questions: [
      {
        id: "separacao_verbas",
        type: "scale05",
        label: "Quão bem separadas estão salário, comissão e prêmio nos seus registros?",
        minLabel: "Totalmente misturados",
        maxLabel: "Totalmente separados",
        scaleWeight: { governanca: -1.2 },
        helper: "Quanto maior a nota, menor o risco de confusão contábil.",
      },
      {
        id: "termo_comunicacao",
        type: "scale05",
        label: "Há termo/regulamento formal comunicado antes de cada campanha?",
        minLabel: "Nunca",
        maxLabel: "Sempre",
        scaleWeight: { governanca: -1.2 },
      },
      {
        id: "regras_acessiveis",
        type: "scale05",
        label: "As regras ficam acessíveis para o time consultar?",
        minLabel: "Nunca",
        maxLabel: "Sempre",
        scaleWeight: { governanca: -1.0 },
      },
      {
        id: "apuracao",
        type: "scale05",
        label: "A apuração de resultados é clara e previsível?",
        minLabel: "Muito confusa",
        maxLabel: "Muito clara",
        scaleWeight: { governanca: -1.2 },
      },
      {
        id: "auditabilidade",
        type: "scale05",
        label: "Se precisassem auditar 6 meses atrás, conseguem reconstruir todos os cálculos?",
        minLabel: "Impossível",
        maxLabel: "Trivial",
        scaleWeight: { governanca: -1.4 },
      },
    ],
  },
  {
    id: "campanhas_capacidade",
    title: "Capacidade das campanhas",
    questions: [
      {
        id: "metas_definidas",
        type: "scale05",
        label: "As metas são bem calibradas ao potencial real do time?",
        minLabel: "Sem calibragem",
        maxLabel: "Muito bem calibradas",
        scaleWeight: { campanhas: 1.2 },
      },
      {
        id: "desempenho_superior",
        type: "scale05",
        label: "Vocês conseguem identificar e premiar quem performa acima da média?",
        minLabel: "Não conseguem",
        maxLabel: "Conseguem sempre",
        scaleWeight: { campanhas: 1.2 },
      },
    ],
  },
  {
    id: "prioridade",
    title: "Prioridade para os próximos 90 dias",
    questions: [
      {
        id: "prioridade_90d",
        type: "single",
        label: "Qual é a prioridade mais importante para os próximos 90 dias?",
        options: [
          { value: "resultado", label: "Aumentar volume de vendas", weights: { campanhas: 8 } },
          { value: "governanca", label: "Organizar governança e regras", weights: { campanhas: 6 } },
          { value: "engajamento", label: "Engajar o time", weights: { campanhas: 5 } },
          { value: "custo", label: "Reduzir custo/erro operacional", weights: { campanhas: 4 } },
        ],
      },
      {
        id: "dor_principal",
        type: "multi",
        label: "Qual é a dor principal hoje? (marque todas que se aplicam)",
        options: [
          { value: "regras", label: "Regras confusas e discussões toda apuração", weights: { campanhas: 8 } },
          { value: "pagamento", label: "Pagamento demorado ou errado", weights: { campanhas: 6, pagamentos: 4 } },
          { value: "engajamento", label: "Time não engaja nas campanhas", weights: { campanhas: 7 } },
          { value: "resultado", label: "Campanha não move o ponteiro", weights: { campanhas: 6 } },
          { value: "outra", label: "Outra", weights: { campanhas: 3 } },
        ],
      },
    ],
  },
  {
    id: "confirmacao",
    title: "Confirmação",
    description: "Revise antes de gerar o diagnóstico.",
    questions: [],
  },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function computeScores(answers: Answers): Scores {
  const scores: Scores = { icp: 0, governanca: 30, campanhas: 0, pagamentos: 0 };
  // Governança começa em 30 (assumindo risco) e é reduzida por respostas boas (pesos negativos).
  // Formatos "sem estrutura" adicionam 6.

  QUESTIONNAIRE.forEach((block) => {
    block.questions.forEach((q) => {
      const ans = answers[q.id];
      if (ans === undefined || ans === null) return;

      if (q.type === "single" && typeof ans === "string") {
        const opt = q.options?.find((o) => o.value === ans);
        if (opt?.weights) {
          (Object.keys(opt.weights) as Dimension[]).forEach((k) => {
            scores[k] += opt.weights![k] || 0;
          });
        }
      } else if (q.type === "multi" && Array.isArray(ans)) {
        ans.forEach((v) => {
          const opt = q.options?.find((o) => o.value === v);
          if (opt?.weights) {
            (Object.keys(opt.weights) as Dimension[]).forEach((k) => {
              scores[k] += opt.weights![k] || 0;
            });
          }
        });
      } else if (q.type === "scale05" && q.scaleWeight) {
        const num = typeof ans === "number" ? ans : parseFloat(String(ans));
        if (!Number.isNaN(num)) {
          (Object.keys(q.scaleWeight) as Dimension[]).forEach((k) => {
            scores[k] += (q.scaleWeight![k] || 0) * num;
          });
        }
      }
    });
  });

  return {
    icp: Math.round(clamp(scores.icp, 0, 30)),
    governanca: Math.round(clamp(scores.governanca, 0, 50)),
    campanhas: Math.round(clamp(scores.campanhas, 0, 40)),
    pagamentos: Math.round(clamp(scores.pagamentos, 0, 30)),
  };
}

export function classify(scores: Scores) {
  return {
    icp: scores.icp >= 20 ? "alto" : scores.icp >= 10 ? "medio" : "baixo",
    governanca: scores.governanca >= 30 ? "alta" : scores.governanca >= 15 ? "media" : "baixa",
    campanhas: scores.campanhas >= 25 ? "alta" : scores.campanhas >= 12 ? "media" : "baixa",
    pagamentos: scores.pagamentos >= 18 ? "alta" : scores.pagamentos >= 9 ? "media" : "baixa",
  } as Diagnostico["classificacao"];
}

export function buildDiagnostico(answers: Answers): Diagnostico {
  const scores = computeScores(answers);
  const classificacao = classify(scores);

  let color: ResultColor;
  if (scores.icp < 10 && scores.governanca < 15) {
    color = "cinza";
  } else if (scores.governanca >= 30) {
    color = "vermelho";
  } else if (scores.governanca >= 15) {
    color = "amarelo";
  } else {
    color = "verde";
  }

  const titulos: Record<ResultColor, string> = {
    verde: "Base sólida com espaço para amplificar resultados",
    amarelo: "Fundamentos parciais — organização traria previsibilidade",
    vermelho: "Sinais claros de que a operação precisa de estrutura",
    cinza: "Ainda cedo para um diagnóstico completo",
  };

  const resumos: Record<ResultColor, string> = {
    verde:
      "Sua operação já tem clareza suficiente para operar com incentivo. O ganho agora está em desenhar campanhas que movam o resultado com mais consistência.",
    amarelo:
      "Existem partes da governança que já funcionam, mas outras deixam margem para retrabalho, discussão de apuração ou perda de engajamento do time.",
    vermelho:
      "A forma como incentivo é calculado, comunicado e pago hoje tende a gerar dúvidas frequentes e retrabalho. Organizar isso é o passo com maior retorno no curto prazo.",
    cinza:
      "As respostas indicam operação incipiente ou pouco envolvimento na decisão. Um diagnóstico mais preciso exige uma conversa antes de avançar.",
  };

  const pontos: string[] = [];
  const scale = (id: string) => {
    const v = answers[id];
    return typeof v === "number" ? v : v ? parseFloat(String(v)) : NaN;
  };

  if (scale("separacao_verbas") <= 2) pontos.push("Salário, comissão e prêmio ainda aparecem misturados nos registros, o que dificulta análise e conciliação.");
  if (scale("termo_comunicacao") <= 2) pontos.push("Não há termo/regulamento formal comunicado antes de cada campanha — isso costuma virar discussão na apuração.");
  if (scale("regras_acessiveis") <= 2) pontos.push("As regras não ficam acessíveis para o time, o que reduz engajamento e clareza de meta.");
  if (scale("apuracao") <= 2) pontos.push("A apuração está pouco previsível, o que abre espaço para retrabalho e insatisfação.");
  if (scale("auditabilidade") <= 2) pontos.push("Reconstruir cálculos passados é difícil hoje — auditoria e explicação a stakeholders ficam custosas.");
  if (answers["formatos_uso"] && Array.isArray(answers["formatos_uso"]) && (answers["formatos_uso"] as string[]).includes("nenhum")) {
    pontos.push("Sem formatos estruturados, o incentivo fica dependente de decisões pontuais e perde previsibilidade.");
  }

  const recomendacoes: Record<ResultColor, string> = {
    verde:
      "Aprofundar em desenho de campanhas de alto impacto e experimentação, mantendo a governança atual.",
    amarelo:
      "Estruturar termo padrão de campanha, tornar as regras acessíveis e separar verbas antes de escalar novas mecânicas.",
    vermelho:
      "Reorganizar base: separar verbas, formalizar regulamento, tornar apuração auditável e revisar meio de pagamento antes de lançar novas campanhas.",
    cinza:
      "Conversar com um especialista Monnera para mapear cenário e definir se um diagnóstico completo faz sentido agora.",
  };

  const priority: Diagnostico["priority"] =
    color === "vermelho" && classificacao.icp !== "baixo"
      ? "alta"
      : color === "amarelo" && classificacao.icp === "alto"
      ? "alta"
      : color === "cinza"
      ? "baixa"
      : "media";

  const dorMap: Record<string, string> = {
    regras: "Regras confusas e discussões toda apuração",
    pagamento: "Pagamento demorado ou errado",
    engajamento: "Time não engaja nas campanhas",
    resultado: "Campanha não move o ponteiro",
    outra: "Outra",
  };
  const dorRaw = answers["dor_principal"];
  const dorIds: string[] = Array.isArray(dorRaw)
    ? (dorRaw as string[])
    : dorRaw
    ? [String(dorRaw)]
    : [];
  const dor = dorIds.length > 0
    ? dorIds.map((id) => dorMap[id] || id).join(" · ")
    : "Não informada";

  const gancho =
    color === "vermelho"
      ? "Mostrar como a Monnera separa verbas, formaliza regulamento e deixa tudo auditável em uma única operação."
      : color === "amarelo"
      ? "Mostrar como pequenos ajustes de governança já destravam previsibilidade e engajamento."
      : color === "verde"
      ? "Mostrar como escalar mecânicas de campanha mantendo o controle atual."
      : "Entender melhor o momento da empresa antes de propor caminho.";

  const proximoPasso =
    color === "cinza"
      ? "Conversa de descoberta de 20 minutos."
      : priority === "alta"
      ? "Reunião com especialista em até 48h para desenhar plano de organização."
      : "Reunião de apresentação em até 5 dias úteis.";

  return {
    result_color: color,
    result_title: titulos[color],
    result_summary: resumos[color],
    pontos_atencao: pontos.slice(0, 5),
    recomendacao: recomendacoes[color],
    leitura_sdr: {
      prioridade: priority,
      dor_principal: dor,
      gancho,
      proximo_passo: proximoPasso,
    },
    priority,
    classificacao,
  };
}

export const RESULT_COLOR_CLASSES: Record<ResultColor, { badge: string; card: string; label: string }> = {
  verde: { badge: "bg-emerald-100 text-emerald-800 border-emerald-300", card: "border-emerald-300 bg-emerald-50/40", label: "Verde" },
  amarelo: { badge: "bg-amber-100 text-amber-800 border-amber-300", card: "border-amber-300 bg-amber-50/40", label: "Amarelo" },
  vermelho: { badge: "bg-red-100 text-red-800 border-red-300", card: "border-red-300 bg-red-50/40", label: "Vermelho" },
  cinza: { badge: "bg-muted text-muted-foreground border-border", card: "border-border bg-secondary/40", label: "Cinza" },
};
