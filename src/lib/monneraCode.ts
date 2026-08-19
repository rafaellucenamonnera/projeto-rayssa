// Exibição do Código Monnera no painel Onb Clientes Cross.
// Usa somente o código já salvo no card. Códigos de exemplo nunca aparecem como válidos.

export const DEMO_MONNERA_CODES = new Set(["3SAXJF92", "UB5PXGDB", "XXXXXXX", "XXXXXXXX"]);

export type MonneraCodeDisplay =
  | { state: "aguardando"; label: "aguardando"; code: null }
  | { state: "exemplo"; label: string; code: string }
  | { state: "formato_nao_confirmado"; label: string; code: string }
  | { state: "valido"; label: string; code: string };

export function describeMonneraCode(raw: string | null | undefined): MonneraCodeDisplay {
  const code = (raw ?? "").trim().toUpperCase();
  if (!code) return { state: "aguardando", label: "aguardando", code: null };
  if (DEMO_MONNERA_CODES.has(code)) return { state: "exemplo", label: `${code} (exemplo — inválido)`, code };
  if (!/^[A-Z0-9]{8}$/.test(code)) return { state: "formato_nao_confirmado", label: `${code} (formato não confirmado)`, code };
  return { state: "valido", label: code, code };
}

/** Texto pronto para a linha "Código Monnera: ..." abaixo do nome do parceiro. */
export function monneraCodeLabel(raw: string | null | undefined): string {
  return describeMonneraCode(raw).label;
}
