// Regras do Painel Comercial (versão com Mercado, Tipo, Impacto e MRR).

export const COMMERCIAL_STAGE_PROSPECTS = "etapa_comercial_prospects";
export const COMMERCIAL_STAGE_MQL = "etapa_comercial_mql";
export const COMMERCIAL_STAGE_PERDIDOS = "etapa_comercial_1781718801678";

export const MERCADO_OPTIONS = [
  { value: "farma", label: "Farma" },
  { value: "pet", label: "Pet" },
  { value: "material_construcao", label: "Material de Construção" },
  { value: "autopecas", label: "Autopeças" },
  { value: "alimentar", label: "Alimentar" },
  { value: "outros", label: "Outros" },
] as const;

export const TIPO_NEGOCIO_OPTIONS = [
  { value: "varejo", label: "Varejo" },
  { value: "distribuicao", label: "Distribuição" },
  { value: "operador_logistico", label: "Operador Logístico" },
  { value: "industria", label: "Indústria" },
] as const;

export const IMPACTO_OPTIONS = [
  { value: "alto", label: "Alto" },
  { value: "medio", label: "Médio" },
  { value: "baixo", label: "Baixo" },
] as const;

export const CANAL_OPTIONS = [
  { value: "parceiros", label: "Parceiros" },
  { value: "prospeccao", label: "Prospecção" },
  { value: "trafego_pago", label: "Tráfego Pago" },
  { value: "eventos", label: "Eventos" },
] as const;

const labelOf = (list: readonly { value: string; label: string }[], v?: string | null) =>
  list.find((o) => o.value === v)?.label ?? null;

export const mercadoLabel = (v?: string | null) => labelOf(MERCADO_OPTIONS, v);
export const tipoNegocioLabel = (v?: string | null) => labelOf(TIPO_NEGOCIO_OPTIONS, v);
export const canalLabel = (v?: string | null) => labelOf(CANAL_OPTIONS, v);
export const impactoLabel = (v?: string | null) => labelOf(IMPACTO_OPTIONS, v);

export const impactoTagClass = (v?: string | null) => {
  if (v === "alto") return "bg-red-600 text-white border-red-700";
  if (v === "medio") return "bg-orange-500 text-white border-orange-600";
  if (v === "baixo") return "bg-yellow-300 text-yellow-950 border-yellow-500";
  return "";
};

/** Colunas que aceitam card sem Mercado, Tipo e Impacto. */
const STAGES_WITHOUT_QUALIFICATION = [COMMERCIAL_STAGE_PROSPECTS, COMMERCIAL_STAGE_PERDIDOS, "lead_perdido"];

/** Retorna os nomes dos campos que faltam para mover o card para a coluna. */
export const missingQualification = (
  lead: { mercado?: string | null; tipo_negocio?: string | null; impacto?: string | null; canal?: string | null; temperatura?: string | null },
  targetStage: string,
): string[] => {
  const isLost = targetStage === COMMERCIAL_STAGE_PERDIDOS || targetStage === "lead_perdido";
  if (isLost) return [];
  const missing: string[] = [];
  if (!lead.canal) missing.push("Canal");
  if (STAGES_WITHOUT_QUALIFICATION.includes(targetStage)) return missing;
  if (!lead.mercado) missing.push("Mercado");
  if (!lead.tipo_negocio) missing.push("Tipo");
  if (!lead.impacto) missing.push("Impacto");
  if (targetStage !== COMMERCIAL_STAGE_MQL && !lead.temperatura) missing.push("Temperatura");
  return missing;
};

/** Validação do cadastro de um card novo. */
export const validateNewCommercialCard = (card: {
  razao_social: string;
  canal: string;
  parceiro_id?: string | null;
  contatos: { nome: string; telefone: string }[];
}): string[] => {
  const errs: string[] = [];
  if (!card.razao_social.trim()) errs.push("Empresa (Razão Social)");
  if (!card.canal) errs.push("Canal");
  if (card.canal === "parceiros" && !card.parceiro_id) errs.push("Embaixador Monnera que indicou");
  if (!card.contatos.some((c) => c.nome.trim())) errs.push("Nome de pelo menos um contato");
  return errs;
};

export const TEMPERATURA_OPTIONS = [
  { value: "fria", label: "Fria" },
  { value: "morna", label: "Morno" },
  { value: "quente", label: "Quente" },
] as const;
export const temperaturaLabel = (v?: string | null) => labelOf(TEMPERATURA_OPTIONS, v);
export const temperaturaTagClass = (v?: string | null) => {
  if (v === "fria") return "bg-blue-600 text-white border-blue-700";
  if (v === "morna") return "bg-yellow-400 text-yellow-950 border-yellow-500";
  if (v === "quente") return "bg-red-600 text-white border-red-700";
  return "";
};

/** Da coluna Contrato Assinado em diante não se conta dias sem atualização. */
export const STAGES_WITHOUT_UPDATE_COUNT = ["contrato_assinado", "etapa_comercial_kickoff", COMMERCIAL_STAGE_PERDIDOS, "lead_perdido"];

/** Dias completos desde a última atualização (null quando não se aplica). */
export const daysWithoutUpdate = (lastUpdate: string | null | undefined, stage: string, now = Date.now()): number | null => {
  if (!lastUpdate || STAGES_WITHOUT_UPDATE_COUNT.includes(stage)) return null;
  const t = new Date(lastUpdate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86400000));
};

/** Até 2 dias sem atualização: amarelo. Mais de 2 dias: vermelho. Atualizado hoje: sem linha. */
export const staleLevel = (days: number | null): "yellow" | "red" | null => {
  if (days == null || days < 1) return null;
  return days > 2 ? "red" : "yellow";
};

export const propostaStatusLabel = (v?: string | null) =>
  v === "aberta" ? "Proposta aberta" : v === "emitida" ? "Proposta emitida" : null;
