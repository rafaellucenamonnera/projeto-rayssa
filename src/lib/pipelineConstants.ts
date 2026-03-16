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

export type PipelineStatus = (typeof PIPELINE_STAGES)[number]["value"];
