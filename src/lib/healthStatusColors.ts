// Paleta padronizada para Status do Cliente (Painel Saúde) e Nível de Impacto.
// Usada nos filtros (AdminLeads) e nos cards (PipelineKanban) do Painel Sucesso.

export type HealthStatusKey =
  | "CHURN" | "EVENTUAL" | "CRITICO" | "RISCO"
  | "ATENCAO" | "MONITORAR" | "SAUDAVEL" | "RECENTE" | "SEM_STATUS_CLIENTE";

export type ImpactKey = "ALTO" | "MEDIO" | "BAIXO" | "MINIMO" | "SEM_IMPACTO";

const stripDiacritics = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const normalize = (s?: string | null) =>
  stripDiacritics((s || "").toString())
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();

export const normalizeHealthStatus = (s?: string | null): HealthStatusKey => {
  const v = normalize(s);
  if (!v) return "SEM_STATUS_CLIENTE";
  if (v.includes("CHURN")) return "CHURN";
  if (v.includes("EVENTUAL")) return "EVENTUAL";
  if (v.includes("CRIT")) return "CRITICO";
  if (v.includes("RISCO")) return "RISCO";
  if (v.includes("ATEN")) return "ATENCAO";
  if (v.includes("MONITOR")) return "MONITORAR";
  if (v.includes("SAUD")) return "SAUDAVEL";
  if (v.includes("RECENT")) return "RECENTE";
  return "SEM_STATUS_CLIENTE";
};

export const normalizeImpact = (s?: string | null): ImpactKey => {
  const v = normalize(s);
  if (!v) return "SEM_IMPACTO";
  if (v.includes("ALTO")) return "ALTO";
  if (v.includes("MED")) return "MEDIO";
  if (v.includes("BAIX")) return "BAIXO";
  if (v.includes("MINIM")) return "MINIMO";
  return "SEM_IMPACTO";
};

export interface ColorTokens {
  hex: string;          // cor sólida principal (para dot/tarja)
  bgClass: string;      // classe Tailwind para fundo sólido
  textOnClass: string;  // classe de texto para uso sobre o fundo sólido
  softBgClass: string;  // fundo suave (para faixa de impacto atrás dos badges)
  borderClass: string;  // borda mais saturada
  label: string;
}

export const HEALTH_STATUS_ORDER: HealthStatusKey[] = [
  "CHURN", "EVENTUAL", "CRITICO", "RISCO",
  "ATENCAO", "MONITORAR", "SAUDAVEL", "RECENTE", "SEM_STATUS_CLIENTE",
];

export const IMPACT_ORDER: ImpactKey[] = ["ALTO", "MEDIO", "BAIXO", "MINIMO", "SEM_IMPACTO"];

const HEALTH_PALETTE: Record<HealthStatusKey, ColorTokens> = {
  CHURN:     { hex: "#7f1d1d", bgClass: "bg-red-50",       textOnClass: "text-red-800",       softBgClass: "bg-red-50",       borderClass: "border-red-200",       label: "CHURN" },
  EVENTUAL:  { hex: "#9a3412", bgClass: "bg-orange-50",    textOnClass: "text-orange-800",    softBgClass: "bg-orange-50",    borderClass: "border-orange-200",    label: "EVENTUAL" },
  CRITICO:   { hex: "#dc2626", bgClass: "bg-red-50",       textOnClass: "text-red-700",       softBgClass: "bg-red-50",       borderClass: "border-red-200",       label: "CRÍTICO" },
  RISCO:     { hex: "#b45309", bgClass: "bg-amber-50",     textOnClass: "text-amber-800",     softBgClass: "bg-amber-50",     borderClass: "border-amber-200",     label: "RISCO" },
  ATENCAO:   { hex: "#a16207", bgClass: "bg-yellow-50",    textOnClass: "text-yellow-800",    softBgClass: "bg-yellow-50",    borderClass: "border-yellow-200",    label: "ATENÇÃO" },
  MONITORAR: { hex: "#2563eb", bgClass: "bg-blue-50",      textOnClass: "text-blue-700",      softBgClass: "bg-blue-50",      borderClass: "border-blue-200",      label: "MONITORAR" },
  SAUDAVEL:  { hex: "#00624b", bgClass: "bg-[#e7f4f0]",    textOnClass: "text-[#003729]",     softBgClass: "bg-[#e7f4f0]",    borderClass: "border-[#b9d8d0]",    label: "SAUDÁVEL" },
  RECENTE:   { hex: "#0f766e", bgClass: "bg-teal-50",      textOnClass: "text-teal-800",      softBgClass: "bg-teal-50",      borderClass: "border-teal-200",      label: "RECENTE" },
  SEM_STATUS_CLIENTE: { hex: "#4f6d65", bgClass: "bg-[#f5faf8]", textOnClass: "text-[#4f6d65]", softBgClass: "bg-[#f5faf8]", borderClass: "border-[#d7e9e4]", label: "Sem status" },
};

const IMPACT_PALETTE: Record<ImpactKey, ColorTokens> = {
  ALTO:   { hex: "#dc2626", bgClass: "bg-red-50",       textOnClass: "text-red-700",       softBgClass: "bg-red-50",       borderClass: "border-red-200",       label: "ALTO" },
  MEDIO:  { hex: "#c2410c", bgClass: "bg-orange-50",    textOnClass: "text-orange-800",    softBgClass: "bg-orange-50",    borderClass: "border-orange-200",    label: "MÉDIO" },
  BAIXO:  { hex: "#a16207", bgClass: "bg-yellow-50",    textOnClass: "text-yellow-800",    softBgClass: "bg-yellow-50",    borderClass: "border-yellow-200",    label: "BAIXO" },
  MINIMO: { hex: "#4f6d65", bgClass: "bg-[#f5faf8]",    textOnClass: "text-[#4f6d65]",     softBgClass: "bg-[#f5faf8]",    borderClass: "border-[#d7e9e4]",    label: "MÍNIMO" },
  SEM_IMPACTO: { hex: "#4f6d65", bgClass: "bg-[#f5faf8]", textOnClass: "text-[#4f6d65]", softBgClass: "bg-[#f5faf8]", borderClass: "border-[#d7e9e4]", label: "Sem impacto" },
};

export const healthStatusColor = (s?: string | null): ColorTokens =>
  HEALTH_PALETTE[normalizeHealthStatus(s)];

export const impactColor = (s?: string | null): ColorTokens =>
  IMPACT_PALETTE[normalizeImpact(s)];

export const healthStatusLabel = (s?: string | null) => healthStatusColor(s).label;
export const impactLabel = (s?: string | null) => impactColor(s).label;
