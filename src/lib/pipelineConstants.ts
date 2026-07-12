export const PIPELINE_STAGES = [
  { value: "novo_lead", label: "Lead" },
  { value: "contato_realizado", label: "Contato Realizado" },
  { value: "reuniao_agendada", label: "Reunião Agendada" },
  { value: "reuniao_realizada", label: "Reunião Realizada" },
  { value: "proposta_enviada", label: "Proposta Enviada" },
  { value: "lead_convertido", label: "Lead Convertido" },
  { value: "contrato_enviado", label: "Contrato Enviado" },
  { value: "contrato_assinado", label: "Contrato Assinado" },
  { value: "lead_perdido", label: "Lead Perdido" },
] as const;

export const PIPELINE_LABELS: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label])
);

// Legacy mapping for backward compatibility
PIPELINE_LABELS["proposta_comercial"] = "Proposta Enviada";
PIPELINE_LABELS["etapa_comercial_1783879107510"] = "Lead Qualificado";

export const PIPELINE_STAGE_ORDER: Record<string, number> = Object.fromEntries(
  PIPELINE_STAGES.map((s, index) => [s.value, index])
);

PIPELINE_STAGE_ORDER["proposta_comercial"] = PIPELINE_STAGE_ORDER.proposta_enviada;

export const getPipelineStageLabel = (stage: string) => {
  if (PIPELINE_LABELS[stage]) return PIPELINE_LABELS[stage];

  return stage
    .split("_")
    .filter((part) => !/^\d+$/.test(part))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const getPipelineStageOrder = (stage: string) =>
  PIPELINE_STAGE_ORDER[stage] ?? PIPELINE_STAGES.length;

export type PipelineStatus = (typeof PIPELINE_STAGES)[number]["value"];
