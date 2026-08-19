// Validação única do link público do Canva (mesma regra do front, src/lib/canvaLink.ts).
// Aceito exclusivamente: https://canva.link/<token>

export const CANVA_PUBLIC_LINK_RE = /^https:\/\/canva\.link\/[A-Za-z0-9]+$/;

export interface CanvaLinkValidation {
  ok: boolean;
  reason?: string;
}

export function validateCanvaPublicLink(url: string | null | undefined): CanvaLinkValidation {
  const value = (url ?? "").trim();
  if (!value) return { ok: false, reason: "Link público do material ausente." };
  if (/\/edit(\?|$)/i.test(value) || /canva\.com\/design\//i.test(value)) {
    return { ok: false, reason: "Link de edição não é aceito. Use o link público de apresentação." };
  }
  if (/canva\.com\/d\/s_/i.test(value)) {
    return { ok: false, reason: "Link temporário do Canva não é aceito." };
  }
  if (/canva\.com\/d\//i.test(value)) {
    return { ok: false, reason: "Links https://www.canva.com/d/... não são aceitos. Use https://canva.link/..." };
  }
  if (!CANVA_PUBLIC_LINK_RE.test(value)) {
    return { ok: false, reason: "Formato inválido. O link deve ser https://canva.link/..." };
  }
  return { ok: true };
}

export const isCanvaPublicLink = (url: string | null | undefined) => validateCanvaPublicLink(url).ok;
