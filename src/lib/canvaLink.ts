// Validação única do link público do Canva (front e backend usam a mesma regra).
// Aceito exclusivamente: https://canva.link/<token>
// Rejeitado: links de edição, /design/, /d/s_ e https://www.canva.com/d/<token>.

export const CANVA_PUBLIC_LINK_RE = /^https:\/\/canva\.link\/[A-Za-z0-9]+$/;

export interface CanvaLinkValidation {
  ok: boolean;
  reason?: string;
}

export function validateCanvaPublicLink(url: string | null | undefined): CanvaLinkValidation {
  const value = (url ?? "").trim();
  if (!value) return { ok: false, reason: "Informe o link público do material." };
  if (/\/edit(\?|$)/i.test(value) || /canva\.com\/design\//i.test(value)) {
    return { ok: false, reason: "Link de edição não é aceito. Use o link público de apresentação." };
  }
  if (/canva\.com\/d\/s_/i.test(value)) {
    return { ok: false, reason: "Link temporário do Canva não é aceito." };
  }
  if (/canva\.com\/d\//i.test(value)) {
    return {
      ok: false,
      reason:
        "Links https://www.canva.com/d/... não são aceitos. Publique como apresentação e use o link https://canva.link/...",
    };
  }
  if (!CANVA_PUBLIC_LINK_RE.test(value)) {
    return { ok: false, reason: "Formato inválido. O link deve ser https://canva.link/..." };
  }
  return { ok: true };
}

export const isCanvaPublicLink = (url: string | null | undefined) => validateCanvaPublicLink(url).ok;
