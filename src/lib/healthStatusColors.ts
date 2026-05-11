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
  CHURN:     { hex: "#7f1d1d", bgClass: "bg-red-900",    textOnClass: "text-red-50",     softBgClass: "bg-red-900/20",    borderClass: "border-red-700/60",    label: "CHURN" },
  EVENTUAL:  { hex: "#c2410c", bgClass: "bg-orange-700", textOnClass: "text-orange-50",  softBgClass: "bg-orange-700/20", borderClass: "border-orange-500/60", label: "EVENTUAL" },
  CRITICO:   { hex: "#dc2626", bgClass: "bg-red-600",    textOnClass: "text-red-50",     softBgClass: "bg-red-600/20",    borderClass: "border-red-500/60",    label: "CRÍTICO" },
  RISCO:     { hex: "#d97706", bgClass: "bg-amber-600",  textOnClass: "text-amber-50",   softBgClass: "bg-amber-600/20",  borderClass: "border-amber-500/60",  label: "RISCO" },
  ATENCAO:   { hex: "#ca8a04", bgClass: "bg-yellow-600", textOnClass: "text-yellow-50",  softBgClass: "bg-yellow-600/20", borderClass: "border-yellow-500/60", label: "ATENÇÃO" },
  MONITORAR: { hex: "#2563eb", bgClass: "bg-blue-600",   textOnClass: "text-blue-50",    softBgClass: "bg-blue-600/20",   borderClass: "border-blue-500/60",   label: "MONITORAR" },
  SAUDAVEL:  { hex: "#16a34a", bgClass: "bg-green-600",  textOnClass: "text-green-50",   softBgClass: "bg-green-600/20",  borderClass: "border-green-500/60",  label: "SAUDÁVEL" },
  RECENTE:   { hex: "#0891b2", bgClass: "bg-cyan-600",   textOnClass: "text-cyan-50",    softBgClass: "bg-cyan-600/20",   borderClass: "border-cyan-500/60",   label: "RECENTE" },
  SEM_STATUS_CLIENTE: { hex: "#475569", bgClass: "bg-slate-600", textOnClass: "text-slate-50", softBgClass: "bg-slate-600/20", borderClass: "border-slate-500/60", label: "Sem status" },
};

const IMPACT_PALETTE: Record<ImpactKey, ColorTokens> = {
  ALTO:   { hex: "#dc2626", bgClass: "bg-red-600",    textOnClass: "text-red-50",    softBgClass: "bg-red-600/15",    borderClass: "border-red-500/60",    label: "ALTO" },
  MEDIO:  { hex: "#ea580c", bgClass: "bg-orange-600", textOnClass: "text-orange-50", softBgClass: "bg-orange-600/15", borderClass: "border-orange-500/60", label: "MÉDIO" },
  BAIXO:  { hex: "#ca8a04", bgClass: "bg-yellow-600", textOnClass: "text-yellow-50", softBgClass: "bg-yellow-600/15", borderClass: "border-yellow-500/60", label: "BAIXO" },
  MINIMO: { hex: "#64748b", bgClass: "bg-slate-500",  textOnClass: "text-slate-50",  softBgClass: "bg-slate-500/15",  borderClass: "border-slate-400/60",  label: "MÍNIMO" },
  SEM_IMPACTO: { hex: "#475569", bgClass: "bg-slate-700", textOnClass: "text-slate-50", softBgClass: "bg-slate-700/15", borderClass: "border-slate-500/60", label: "Sem impacto" },
};

export const healthStatusColor = (s?: string | null): ColorTokens =>
  HEALTH_PALETTE[normalizeHealthStatus(s)];

export const impactColor = (s?: string | null): ColorTokens =>
  IMPACT_PALETTE[normalizeImpact(s)];

export const healthStatusLabel = (s?: string | null) => healthStatusColor(s).label;
export const impactLabel = (s?: string | null) => impactColor(s).label;
