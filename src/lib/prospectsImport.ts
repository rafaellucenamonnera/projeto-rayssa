// Importação em massa de cards para a coluna Lista Prospects (Painel Comercial).
import { CANAL_OPTIONS, IMPACTO_OPTIONS, MERCADO_OPTIONS, TEMPERATURA_OPTIONS, TIPO_NEGOCIO_OPTIONS } from "./commercialPanel";

export const PROSPECT_TEMPLATE_COLUMNS = [
  "Empresa (Razão Social) *",
  "CNPJ",
  "Canal *",
  "Embaixador Monnera que indicou",
  "Mercado",
  "Tipo",
  "Impacto",
  "Temperatura",
  "Vendedor Responsável",
  "Contato - Nome *",
  "Contato - Cargo",
  "Contato - Telefone",
  "Contato - E-mail",
] as const;

export type ProspectRow = {
  linha: number;
  razao_social: string;
  cnpj: string | null;
  canal: string;
  parceiro_id: string | null;
  mercado: string | null;
  tipo_negocio: string | null;
  impacto: string | null;
  temperatura: string | null;
  responsible_user_id: string | null;
  contato: { nome: string; cargo: string | null; telefone: string | null; email: string | null };
};

export type ProspectRowError = { linha: number; erros: string[] };

const norm = (v: unknown) =>
  String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const pick = (list: readonly { value: string; label: string }[], raw: unknown) => {
  const n = norm(raw);
  if (!n) return { value: null as string | null, invalid: false };
  const hit = list.find((o) => norm(o.label) === n || norm(o.value) === n);
  return { value: hit?.value ?? null, invalid: !hit };
};

const findByName = <T extends { nome: string }>(list: T[], raw: unknown) => {
  const n = norm(raw);
  if (!n) return { item: null as T | null, invalid: false };
  const matches = list.filter((x) => norm(x.nome) === n);
  return { item: matches.length === 1 ? matches[0] : null, invalid: matches.length !== 1 };
};

/** Valida e converte as linhas da planilha. Linhas totalmente vazias são ignoradas. */
export const parseProspectRows = (
  rows: Record<string, unknown>[],
  ctx: { parceiros: { id: string; nome: string }[]; vendedores: { user_id: string; nome: string }[] },
): { ok: ProspectRow[]; errors: ProspectRowError[] } => {
  const ok: ProspectRow[] = [];
  const errors: ProspectRowError[] = [];
  const seenCnpj = new Set<string>();
  const get = (r: Record<string, unknown>, col: string) => {
    const key = Object.keys(r).find((k) => norm(k).replace(/\s*\*$/, "") === norm(col).replace(/\s*\*$/, ""));
    return key ? r[key] : "";
  };

  rows.forEach((r, i) => {
    const linha = i + 2; // linha 1 = cabeçalho
    if (PROSPECT_TEMPLATE_COLUMNS.every((c) => !String(get(r, c) ?? "").trim())) return;
    const erros: string[] = [];
    const razao = String(get(r, "Empresa (Razão Social) *") ?? "").trim();
    if (!razao) erros.push("Empresa (Razão Social) obrigatória");

    const cnpjRaw = String(get(r, "CNPJ") ?? "").replace(/\D/g, "");
    if (cnpjRaw && cnpjRaw.length !== 14) erros.push("CNPJ precisa ter 14 números");
    if (cnpjRaw && seenCnpj.has(cnpjRaw)) erros.push("CNPJ repetido na planilha");
    if (cnpjRaw) seenCnpj.add(cnpjRaw);

    const canal = pick(CANAL_OPTIONS, get(r, "Canal *"));
    if (!canal.value) erros.push(canal.invalid ? "Canal inválido" : "Canal obrigatório");

    const emb = findByName(ctx.parceiros, get(r, "Embaixador Monnera que indicou"));
    if (emb.invalid) erros.push("Embaixador Monnera não encontrado");
    if (canal.value === "parceiros" && !emb.item) erros.push("Canal Parceiros exige o Embaixador Monnera que indicou");

    const mercado = pick(MERCADO_OPTIONS, get(r, "Mercado"));
    if (mercado.invalid) erros.push("Mercado inválido");
    const tipo = pick(TIPO_NEGOCIO_OPTIONS, get(r, "Tipo"));
    if (tipo.invalid) erros.push("Tipo inválido");
    const impacto = pick(IMPACTO_OPTIONS, get(r, "Impacto"));
    if (impacto.invalid) erros.push("Impacto inválido");
    const temp = pick(TEMPERATURA_OPTIONS, get(r, "Temperatura"));
    if (temp.invalid) erros.push("Temperatura inválida");

    const vend = findByName(ctx.vendedores, get(r, "Vendedor Responsável"));
    if (vend.invalid) erros.push("Vendedor Responsável não encontrado");

    const nome = String(get(r, "Contato - Nome *") ?? "").trim();
    if (!nome) erros.push("Nome do contato obrigatório");
    const email = String(get(r, "Contato - E-mail") ?? "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push("E-mail do contato inválido");

    if (erros.length) return errors.push({ linha, erros });
    ok.push({
      linha,
      razao_social: razao,
      cnpj: cnpjRaw || null,
      canal: canal.value!,
      parceiro_id: emb.item?.id ?? null,
      mercado: mercado.value,
      tipo_negocio: tipo.value,
      impacto: impacto.value,
      temperatura: temp.value,
      responsible_user_id: vend.item?.user_id ?? null,
      contato: {
        nome,
        cargo: String(get(r, "Contato - Cargo") ?? "").trim() || null,
        telefone: String(get(r, "Contato - Telefone") ?? "").trim() || null,
        email: email || null,
      },
    });
  });
  return { ok, errors };
};
