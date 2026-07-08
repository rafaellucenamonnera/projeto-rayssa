// Constantes do fluxo de Criação de Campanhas.
// Os valores vêm de public.pipeline_stages_config (panel_key='sucesso'|'campanhas').
// Helpers também tentam resolver por label, para tolerar pequenas renomeações.

export const SUCESSO_STAGE_CRIACAO_CAMPANHA = "etapa_sucesso_1777903393480";

export const CAMPANHAS_STAGE_CONSTRUCAO = "etapa_campanhas_1781056513527";
export const CAMPANHAS_STAGE_PRIMEIRA = "etapa_campanhas_1781056626070";
export const CAMPANHAS_STAGE_AGUARDANDO_CLIENTE = "etapa_campanhas_1781056849363";
export const CAMPANHAS_STAGE_EM_EXECUCAO = "etapa_campanhas_1781056861987";
export const CAMPANHAS_STAGE_CONCLUIDA = "etapa_campanhas_1781057426192";

export const SLA_SUCESSO_TO_CAMPANHA_HOURS = 48;
export const SLA_CAMPANHAS_AGUARDANDO_CLIENTE_HOURS = 24;

export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ATTACHMENT_MAX_PER_COMMENT = 5;

export const ATTACHMENT_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export const ATTACHMENT_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/csv,.csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isAllowedMime(mime: string, fileName: string): boolean {
  if (ATTACHMENT_ALLOWED_MIME.includes(mime)) return true;
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".csv") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".doc") ||
    lower.endsWith(".docx")
  );
}
