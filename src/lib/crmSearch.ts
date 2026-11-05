export type CrmSearchCard = {
  full_name?: string | null;
  nome_fantasia?: string | null;
  contratante_monnera?: string | null;
  focal_name?: string | null;
  vendor_name?: string | null;
  email?: string | null;
  focal_email?: string | null;
  codigo_monnera?: string | null;
  cnpj?: string | null;
  phone?: string | null;
  focal_phone?: string | null;
  vendor_phone?: string | null;
};

export const normalizeText = (v: string | null | undefined): string =>
  (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export const digitsOnly = (v: string | null | undefined): string => (v || "").replace(/\D/g, "");

/** Levenshtein distance ≤ 1 check. */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function matchesCrmSearch(card: CrmSearchCard, term: string): boolean {
  const words = normalizeText(term).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = normalizeText(
    [card.full_name, card.nome_fantasia, card.contratante_monnera, card.focal_name, card.vendor_name, card.email, card.focal_email, card.codigo_monnera].filter(Boolean).join(" "),
  );
  const tokens = text.split(/[^a-z0-9@._-]+/).filter(Boolean);
  const digits = [card.cnpj, card.phone, card.focal_phone, card.vendor_phone].map(digitsOnly).filter(Boolean);

  return words.every((w) => {
    if (text.includes(w)) return true;
    const wd = digitsOnly(w);
    if (wd.length >= 4 && wd.length >= w.replace(/[.\-/()]/g, "").length && digits.some((d) => d.includes(wd))) return true;
    if (w.length >= 5) return tokens.some((t) => withinOneEdit(t, w));
    return false;
  });
}

export const formatCnpj = (v: string | null | undefined): string => {
  const d = digitsOnly(v);
  if (d.length !== 14) return v || "";
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
};
