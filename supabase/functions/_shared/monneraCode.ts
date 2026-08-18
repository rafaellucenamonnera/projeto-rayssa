// Validação do código Monnera (8 caracteres A-Z0-9), com lista de códigos demonstrativos proibidos.
export const DEMO_MONNERA_CODES = new Set([
  "3SAXJF92",
  "UB5PXGDB",
  "XXXXXXX",
  "XXXXXXXX",
  "QATEST01",
]);

export type CodeValidation = { ok: true; code: string } | { ok: false; reason: string };

export function validateMonneraCode(raw: string | null | undefined, opts?: { allowTest?: boolean }): CodeValidation {
  const code = (raw ?? "").trim().toUpperCase();
  if (!code) return { ok: false, reason: "Código ausente." };
  if (code.startsWith("MNR-") || code.includes("-")) {
    return { ok: false, reason: "Formato não confirmado: código não pode conter hífen." };
  }
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    return { ok: false, reason: "Código deve ter exatamente 8 caracteres (A-Z, 0-9)." };
  }
  if (DEMO_MONNERA_CODES.has(code) && !(opts?.allowTest && code === "QATEST01")) {
    return { ok: false, reason: "Código demonstrativo/de teste não é aceito em card real." };
  }
  return { ok: true, code };
}

// Extrai o primeiro código plausível de um texto livre (corpo de e-mail, comentário Jira).
export function extractMonneraCode(text: string): string | null {
  const matches = text.toUpperCase().match(/\b[A-Z0-9]{8}\b/g);
  if (!matches) return null;
  for (const candidate of matches) {
    if (!/[0-9]/.test(candidate) || !/[A-Z]/.test(candidate)) continue;
    if (DEMO_MONNERA_CODES.has(candidate)) continue;
    return candidate;
  }
  return null;
}
