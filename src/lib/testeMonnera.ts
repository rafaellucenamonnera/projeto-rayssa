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

export type PracticalAction = {
  tema: string;
  ponto?: string;
  acao?: string;
  caminho_manual?: string;
  caminho_monnera?: string;
};

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
  practical_actions: PracticalAction[];
  next_steps: string[];
  manual_path: string[];
  monnera_path: string[];
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
      {
        id: "quantidade_cnpjs",
        type: "single",
        label: "A operação responde por quantos CNPJs ativos ou unidades com CNPJ próprio?",
        required: true,
        options: [
          { value: "1", label: "1 CNPJ", weights: { icp: 3 } },
          { value: "2_5", label: "Entre 2 e 5 CNPJs", weights: { icp: 6, campanhas: 1, pagamentos: 1 } },
          { value: "5_10", label: "Entre 5 e 10 CNPJs", weights: { icp: 9, campanhas: 2, pagamentos: 2 } },
          { value: "10_20", label: "Entre 10 e 20 CNPJs", weights: { icp: 12, campanhas: 3, pagamentos: 3 } },
          { value: "20_50", label: "Entre 20 e 50 CNPJs", weights: { icp: 14, campanhas: 4, pagamentos: 4 } },
          { value: "acima_50", label: "Acima de 50", weights: { icp: 15, campanhas: 5, pagamentos: 5 } },
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
        required: true,
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
        required: true,
      },
      {
        id: "termo_comunicacao",
        type: "scale05",
        label: "Há termo/regulamento formal comunicado antes de cada campanha?",
        minLabel: "Nunca",
        maxLabel: "Sempre",
        scaleWeight: { governanca: -1.2 },
        required: true,
      },
      {
        id: "regras_acessiveis",
        type: "scale05",
        label: "As regras ficam acessíveis para o time consultar?",
        minLabel: "Nunca",
        maxLabel: "Sempre",
        scaleWeight: { governanca: -1.0 },
        required: true,
      },
      {
        id: "apuracao",
        type: "scale05",
        label: "A apuração de resultados é clara e previsível?",
        minLabel: "Muito confusa",
        maxLabel: "Muito clara",
        scaleWeight: { governanca: -1.2 },
        required: true,
      },
      {
        id: "auditabilidade",
        type: "scale05",
        label: "Se precisassem auditar 6 meses atrás, conseguem reconstruir todos os cálculos?",
        minLabel: "Impossível",
        maxLabel: "Trivial",
        scaleWeight: { governanca: -1.4 },
        required: true,
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
        required: true,
      },
      {
        id: "desempenho_superior",
        type: "scale05",
        label: "Vocês conseguem identificar e premiar quem performa acima da média?",
        minLabel: "Não conseguem",
        maxLabel: "Conseguem sempre",
        scaleWeight: { campanhas: 1.2 },
        required: true,
      },
      {
        id: "campanhas_parceiros",
        type: "single",
        label: "Vocês estruturam campanhas com fornecedores, indústrias ou parceiros?",
        required: true,
        options: [
          { value: "sim", label: "Sim", weights: { campanhas: 6 } },
          { value: "parcialmente", label: "Parcialmente", weights: { campanhas: 3 } },
          { value: "nao", label: "Não", weights: { governanca: 4 } },
        ],
      },
      {
        id: "acesso_colaboradores",
        type: "single",
        label: "O time tem acesso liberado às campanhas dos parceiros (regras, metas, resultados)?",
        required: true,
        options: [
          { value: "sim", label: "Sim", weights: { campanhas: 6 } },
          { value: "parcialmente", label: "Parcialmente", weights: { campanhas: 3 } },
          { value: "nao", label: "Não", weights: { governanca: 4 } },
        ],
      },
      {
        id: "retorno_parceiros",
        type: "single",
        label: "Vocês retornam resultados aos parceiros com clareza e rastreabilidade?",
        required: true,
        options: [
          { value: "sim", label: "Sim", weights: { campanhas: 6 } },
          { value: "parcialmente", label: "Parcialmente", weights: { campanhas: 3 } },
          { value: "nao", label: "Não", weights: { governanca: 4 } },
        ],
      },
    ],
  },
  {
    id: "prioridade",
    title: "Prioridade para os próximos 90 dias",
    questions: [
      {
        id: "prioridade_90d",
        type: "multi",
        label: "Qual é a prioridade para os próximos 90 dias? (marque todas que se aplicam)",
        required: true,
        options: [
          { value: "resultado", label: "Aumentar vendas com campanhas mais bem estruturadas", weights: { campanhas: 8 } },
          { value: "governanca", label: "Organizar regras, metas e governança antes de ampliar incentivos", weights: { campanhas: 6, governanca: 3 } },
          { value: "engajamento", label: "Engajar o time com metas claras, acompanhamento e reconhecimento", weights: { campanhas: 5 } },
          { value: "custo", label: "Reduzir retrabalho, erro operacional e tempo de conferência", weights: { campanhas: 4, pagamentos: 3 } },
        ],
      },
      {
        id: "dor_principal",
        type: "multi",
        label: "Qual é a dor principal hoje? (marque todas que se aplicam)",
        required: true,
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
    id: "pagamentos",
    title: "Pagamentos aos participantes",
    questions: [
      {
        id: "meio_pagamento",
        type: "multi",
        label: "Como vocês pagam hoje o incentivo aos participantes? (marque todos)",
        required: true,
        options: [
          { value: "folha", label: "Dinheiro em folha", weights: { pagamentos: 5, governanca: 3 } },
          { value: "pix_manual", label: "PIX manual", weights: { pagamentos: 6, governanca: 3 } },
          { value: "beneficio", label: "Cartão de benefício", weights: { pagamentos: 3 } },
          { value: "monnera", label: "Cartão pré-pago Monnera", weights: { pagamentos: -2 } },
          { value: "nenhum", label: "Ainda não paga incentivo", weights: { pagamentos: 4 } },
        ],
      },
      {
        id: "conciliacao",
        type: "scale05",
        label: "Quão fácil é conciliar o que foi apurado com o que foi efetivamente pago?",
        minLabel: "Quase impossível",
        maxLabel: "Simples, rápido e bem controlado",
        scaleWeight: { pagamentos: -1.2 },
        helper: "Quanto maior a nota, menor o risco.",
        required: true,
      },
      {
        id: "complexidade_encerramento",
        type: "scale05",
        label: "Hoje, quão complexo é encerrar uma campanha, conferir resultados e deixar tudo pronto para pagamento?",
        minLabel: "Quase impossível",
        maxLabel: "Simples, rápido e bem controlado",
        // Invertido: nota BAIXA = mais dor operacional. Contribuição efetiva = (5 - nota) * 1.2 em pagamentos.
        // Implementado como peso negativo somado ao baseline (+6) aplicado a `pagamentos` em computeScores.
        scaleWeight: { pagamentos: -1.2 },
        helper: "Quanto menor a nota, maior a dor operacional identificada.",
        required: true,
      },
      {
        id: "ciclos_campanha",
        type: "multi",
        label: "Que ciclos de campanha vocês costumam rodar? (marque todos)",
        required: true,
        options: [
          { value: "semanais", label: "Campanhas semanais / ciclos curtos", weights: { campanhas: 3 } },
          { value: "mensais", label: "Fechamento mensal", weights: { campanhas: 2 } },
          { value: "sazonais", label: "Sazonais / datas comerciais", weights: { campanhas: 2 } },
          { value: "parceiros", label: "Ações pontuais com parceiros", weights: { campanhas: 2 } },
        ],
      },
    ],
  },
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function computeScores(answers: Answers): Scores {
  // Baselines:
  // - governanca começa em 30 (assume risco) e é reduzida por respostas boas (pesos negativos).
  // - pagamentos começa em 6 para permitir que `complexidade_encerramento` e `conciliacao` usem
  //   pesos negativos e produzam contribuição efetiva positiva quando a nota é baixa (mais dor).
  const scores: Scores = { icp: 0, governanca: 30, campanhas: 0, pagamentos: 6 };

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
  if (scale("conciliacao") <= 2) pontos.push("Conciliar apurado x pago é difícil hoje — abre espaço para erro, atraso e insatisfação de participantes.");
  if (scale("complexidade_encerramento") <= 2) pontos.push("Encerrar campanha e deixar pronto para pagar consome esforço alto — indica processo manual e frágil.");

  const meio = answers["meio_pagamento"];
  if (Array.isArray(meio)) {
    const arr = meio as string[];
    const manual = arr.includes("folha") || arr.includes("pix_manual");
    const misto = arr.length >= 2 && !arr.every((v) => v === "monnera");
    if (manual) pontos.push("Pagamento via folha ou PIX manual aumenta risco trabalhista e retrabalho de conciliação.");
    else if (misto) pontos.push("Uso de múltiplos meios de pagamento sem trilha única dificulta rastreabilidade e conciliação.");
  }

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
