import { createClient } from "npm:@supabase/supabase-js@2";

type DriveClientRow = {
  source_row: number;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  nome_responsavel: string;
  email_responsavel: string;
  telefone_responsavel: string;
  cidade: string;
  erp_utilizado: string;
  quantidade_lojas: number;
  quantidade_funcionarios: number | null;
  valor_mensalidade: number | null;
  valor_campanhas: number | null;
  valor_pagamento: number | null;
  impacto: string;
  risco: string;
  consultor: string;
  csat: number | null;
  categoria: string;
  juros_recebidos: number | null;
  multas_recebidas: number | null;
  receita_taxa_boleto: number | null;
};
const normalizeCNPJ = (value: string) => (value || "").replace(/\D/g, "").slice(0, 14);
const toNumber = (value: string) => {
  if (!value?.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};
const normalizeHeader = (header: string) => header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const pick = (source: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};
const FINANCIAL_CATEGORY_MAP: Record<string, keyof Pick<DriveClientRow, "juros_recebidos" | "multas_recebidas" | "valor_campanhas" | "valor_pagamento" | "receita_taxa_boleto" | "valor_mensalidade">> = {
  juros_recebidos: "juros_recebidos",
  multas_recebidas: "multas_recebidas",
  receita_campanha: "valor_campanhas",
  receita_ordem_pagamento: "valor_pagamento",
  receita_taxa_boleto: "receita_taxa_boleto",
  receitas_mensalidades: "valor_mensalidade",
};
const normalizeCategoryLabel = (value: string) => normalizeHeader(value).replace(/^receitas?_/, "receita_");
const extractPrimaryNumericValue = (row: Record<string, string>) => {
  const direct = toNumber(pick(row, "valor", "valor_total", "total", "mes_atual", "atual"));
  if (direct !== null) return direct;
  const keys = Object.keys(row).filter((k) => !["contratante", "empresa", "nome_fantasia", "cnpj", "categoria", "cs", "responsavel", "responsavel_cs"].includes(k));
  for (let i = keys.length - 1; i >= 0; i--) {
    const parsed = toNumber(row[keys[i]] || "");
    if (parsed !== null) return parsed;
  }
  return null;
};
const parseCsv = (raw: string) => {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [] as Record<string, string>[];
  const parseLine = (line: string) => {
    const values: string[] = []; let current = ""; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') { if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
      else if (char === "," && !inQuotes) { values.push(current.trim()); current = ""; }
      else current += char;
    }
    values.push(current.trim()); return values;
  };
  const headers = parseLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cols = parseLine(line);
    return headers.reduce<Record<string, string>>((acc, h, idx) => { acc[h] = cols[idx] || ""; return acc; }, {});
  });
};
const SUCCESS_PANEL_SPREADSHEET_ID = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID")?.trim() || "1Ao69-CKVhwmTxzRAhpHotw3Ny_3kU7Id34k4qLTAyo8";
const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const buildGoogleSheetsCsvUrl = () => {
  const gid = Deno.env.get("GOOGLE_SHEETS_GID")?.trim() || "0";
  return `https://docs.google.com/spreadsheets/d/${SUCCESS_PANEL_SPREADSHEET_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`;
};
const isValidClientRow = (cnpj: string, name: string) => normalizeCNPJ(cnpj).length === 14 && normalizeCompanyName(name).length > 0;
const buildStatusCampanhaCsvUrl = () => {
  const gid = Deno.env.get("GOOGLE_SHEETS_STATUS_CAMPANHA_GID")?.trim();
  if (!gid) return null;
  return `https://docs.google.com/spreadsheets/d/${SUCCESS_PANEL_SPREADSHEET_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`;
};
const buildCsatCsvUrl = () => {
  const gid = Deno.env.get("GOOGLE_SHEETS_CSAT_GID")?.trim();
  if (!gid) return null;
  return `https://docs.google.com/spreadsheets/d/${SUCCESS_PANEL_SPREADSHEET_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`;
};
const buildPainelSaudeCsvUrl = () => {
  const gid = Deno.env.get("GOOGLE_SHEETS_PAINEL_SAUDE_GID")?.trim();
  if (!gid) return null;
  return `https://docs.google.com/spreadsheets/d/${SUCCESS_PANEL_SPREADSHEET_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`;
};
const normalizeCompanyName = (value: string) => (value || "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, " ")
  .replace(/[^\w\s]/g, " ")
  .replace(/_/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toUpperCase();
const scoreNameSimilarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = new Set(a.split(" "));
  const sb = new Set(b.split(" "));
  let intersect = 0;
  sa.forEach((token) => { if (sb.has(token)) intersect++; });
  return intersect / Math.max(sa.size, sb.size, 1);
};
const parseMonthHeader = (key: string) => {
  const k = normalizeHeader(key);
  const mmyyyy = k.match(/(0?[1-9]|1[0-2])[_/-](20\d{2})/);
  if (mmyyyy) return { month: Number(mmyyyy[1]), year: Number(mmyyyy[2]) };
  const monthText = PT_MONTHS.findIndex((m) => k.includes(m));
  const yearMatch = k.match(/(20\d{2})/);
  if (monthText >= 0 && yearMatch) return { month: monthText + 1, year: Number(yearMatch[1]) };
  return null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const sheetCsvUrl = buildGoogleSheetsCsvUrl();
  const counters = { processed: 0, created: 0, updated: 0, skipped: 0 };
  const errors: Array<{ row?: number; cnpj?: string; message: string }> = [];
  console.log("[sync-drive-clients] Início da sincronização");
  const [csvResponse, statusCsvResponse, csatCsvResponse, painelSaudeCsvResponse] = await Promise.all([
    fetch(sheetCsvUrl, { headers: { "Cache-Control": "no-cache" } }),
    (() => {
      const statusUrl = buildStatusCampanhaCsvUrl();
      if (!statusUrl) return Promise.resolve(null);
      return fetch(statusUrl, { headers: { "Cache-Control": "no-cache" } });
    })(),
    (() => {
      const csatUrl = buildCsatCsvUrl();
      if (!csatUrl) return Promise.resolve(null);
      return fetch(csatUrl, { headers: { "Cache-Control": "no-cache" } });
    })(),
    (() => {
      const healthUrl = buildPainelSaudeCsvUrl();
      if (!healthUrl) return Promise.resolve(null);
      return fetch(healthUrl, { headers: { "Cache-Control": "no-cache" } });
    })(),
  ]);
  if (!csvResponse.ok) return new Response(JSON.stringify({ ok: false, error: `Falha ao ler planilha Google Sheets (status ${csvResponse.status}). Verifique permissões da planilha/aba e credenciais de acesso público.` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const rows = parseCsv(await csvResponse.text());
  const sourceMeta = {
    spreadsheet_id: SUCCESS_PANEL_SPREADSHEET_ID,
    sheet_gid: Deno.env.get("GOOGLE_SHEETS_GID")?.trim() || "0",
    sheet_name: Deno.env.get("GOOGLE_SHEETS_SHEET_NAME")?.trim() || "Receita / Contratante",
  };
  console.log(`[sync-drive-clients] Origem ${sourceMeta.sheet_name} (gid=${sourceMeta.sheet_gid}) | Total lido: ${rows.length}`);
  const statusRows = statusCsvResponse?.ok ? parseCsv(await statusCsvResponse.text()) : [];
  const csatRows = csatCsvResponse?.ok ? parseCsv(await csatCsvResponse.text()) : [];
  const painelSaudeRows = painelSaudeCsvResponse?.ok ? parseCsv(await painelSaudeCsvResponse.text()) : [];
  const now = new Date();
  const currentMonth = { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
  const previousMonth = currentMonth.month === 1
    ? { month: 12, year: currentMonth.year - 1 }
    : { month: currentMonth.month - 1, year: currentMonth.year };
  const statusByCompany = new Map<string, { current: string; previous: string; currentMonth: string; previousMonth: string; similarity: boolean }>();
  const csatByCompany = new Map<string, { current: number | null; previous: number | null; currentMonth: string; previousMonth: string; similarity: boolean }>();
  const healthByCompany = new Map<string, { status: string; impact: string; similarity: boolean }>();
  for (const row of statusRows) {
    const rawName = pick(row, "razao_social", "contratante", "empresa", "nome_fantasia");
    const normalizedName = normalizeCompanyName(rawName);
    if (!normalizedName) continue;
    let statusCurrent = "";
    let statusPrevious = "";
    for (const [key, value] of Object.entries(row)) {
      const parsed = parseMonthHeader(key);
      if (!parsed) continue;
      if (parsed.month === currentMonth.month && parsed.year === currentMonth.year) statusCurrent = value.trim();
      if (parsed.month === previousMonth.month && parsed.year === previousMonth.year) statusPrevious = value.trim();
    }
    statusByCompany.set(normalizedName, {
      current: statusCurrent,
      previous: statusPrevious,
      currentMonth: `${String(currentMonth.month).padStart(2, "0")}/${currentMonth.year}`,
      previousMonth: `${String(previousMonth.month).padStart(2, "0")}/${previousMonth.year}`,
      similarity: false,
    });
  }
  for (const row of csatRows) {
    const rawName = pick(row, "razao_social", "contratante", "empresa", "nome_fantasia");
    const normalizedName = normalizeCompanyName(rawName);
    if (!normalizedName) continue;
    let csatCurrent: number | null = null;
    let csatPrevious: number | null = null;
    for (const [key, value] of Object.entries(row)) {
      const parsed = parseMonthHeader(key);
      if (!parsed) continue;
      if (parsed.month === currentMonth.month && parsed.year === currentMonth.year) csatCurrent = toNumber(value);
      if (parsed.month === previousMonth.month && parsed.year === previousMonth.year) csatPrevious = toNumber(value);
    }
    csatByCompany.set(normalizedName, {
      current: csatCurrent,
      previous: csatPrevious,
      currentMonth: `${String(currentMonth.month).padStart(2, "0")}/${currentMonth.year}`,
      previousMonth: `${String(previousMonth.month).padStart(2, "0")}/${previousMonth.year}`,
      similarity: false,
    });
  }
  for (const row of painelSaudeRows) {
    const rawName = pick(row, "contratante", "razao_social", "empresa", "nome_fantasia");
    const status = pick(row, "status", "saude");
    const impact = pick(row, "impacto", "impact");
    const normalizedName = normalizeCompanyName(rawName);
    if (!normalizedName || (!status && !impact)) continue;
    healthByCompany.set(normalizedName, { status, impact, similarity: false });
  }
  const normalizeText = (value: string) => (value || "").trim().toLowerCase();
  const parsedRows: DriveClientRow[] = [];
  let currentClient: DriveClientRow | null = null;
  rows.forEach((r, index) => {
    const sourceRow = index + 2;
    const cnpj = normalizeCNPJ(pick(r, "cnpj", "documento"));
    const rowLabel = pick(r, "contratante", "empresa", "nome_fantasia", "categoria");
    if (isValidClientRow(cnpj, rowLabel)) {
      if (currentClient) parsedRows.push(currentClient);
      currentClient = {
        source_row: sourceRow,
        cnpj,
        nome_fantasia: pick(r, "nome_fantasia", "empresa", "contratante") || "Cliente sem nome",
        razao_social: pick(r, "razao_social"),
        nome_responsavel: pick(r, "nome_responsavel", "responsavel", "cs", "responsavel_cs") || "Responsável",
        email_responsavel: pick(r, "email_responsavel", "email") || "drive@monnera.local",
        telefone_responsavel: pick(r, "telefone_responsavel", "telefone"),
        cidade: pick(r, "cidade"),
        erp_utilizado: pick(r, "erp_utilizado", "erp", "sistema") || "Não informado",
        quantidade_lojas: Number(pick(r, "quantidade_lojas", "qtd_lojas", "lojas") || 1) || 1,
        quantidade_funcionarios: toNumber(pick(r, "quantidade_funcionarios", "qtd_funcionarios", "funcionarios")),
        valor_mensalidade: toNumber(pick(r, "mensalidade", "valor_mensalidade")),
        valor_campanhas: toNumber(pick(r, "receita_campanha", "valor_campanhas")),
        valor_pagamento: toNumber(pick(r, "receita_pagamento", "valor_pagamento", "receita_ordem_pagamento")),
        impacto: pick(r, "impacto"),
        risco: pick(r, "risco", "saude"),
        consultor: pick(r, "consultor"),
        csat: toNumber(pick(r, "csat")),
        categoria: pick(r, "categoria"),
        juros_recebidos: toNumber(pick(r, "juros_recebidos")),
        multas_recebidas: toNumber(pick(r, "multas_recebidas")),
        receita_taxa_boleto: toNumber(pick(r, "receita_taxa_boleto")),
      };
      return;
    }
    const normalizedCategory = normalizeCategoryLabel(rowLabel);
    const mappedField = FINANCIAL_CATEGORY_MAP[normalizedCategory];
    if (currentClient && mappedField) {
      currentClient[mappedField] = extractPrimaryNumericValue(r);
      return;
    }
    if (!currentClient && rowLabel) {
      counters.skipped++;
      errors.push({ row: sourceRow, message: "Linha sem cliente associado" });
    }
  });
  if (currentClient) parsedRows.push(currentClient);
  const validRows = parsedRows.map((r) => ({
    ...r,
    valor_mensalidade: r.valor_mensalidade ?? 0,
    valor_campanhas: r.valor_campanhas ?? 0,
    valor_pagamento: r.valor_pagamento ?? 0,
    revenue_total: (r.valor_mensalidade ?? 0) + (r.valor_campanhas ?? 0) + (r.valor_pagamento ?? 0) + (r.juros_recebidos ?? 0) + (r.multas_recebidas ?? 0) + (r.receita_taxa_boleto ?? 0),
  })).map((r) => {
    const normalized = normalizeCompanyName(r.razao_social || r.nome_fantasia);
    let status = statusByCompany.get(normalized);
    if (!status && normalized) {
      let bestScore = 0;
      let best: typeof status | undefined;
      for (const [name, candidate] of statusByCompany.entries()) {
        const score = scoreNameSimilarity(normalized, name);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }
      if (bestScore >= 0.72 && best) status = { ...best, similarity: true };
    }
    let csat = csatByCompany.get(normalized);
    if (!csat && normalized) {
      let bestScore = 0;
      let best: typeof csat | undefined;
      for (const [name, candidate] of csatByCompany.entries()) {
        const score = scoreNameSimilarity(normalized, name);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }
      if (bestScore >= 0.72 && best) csat = { ...best, similarity: true };
    }
    const csatVariation = csat?.current != null && csat?.previous != null ? (csat.current - csat.previous) : null;
    const csatDirection = csatVariation == null ? null : csatVariation > 0 ? "up" : csatVariation < 0 ? "down" : "neutral";
    let health = healthByCompany.get(normalized);
    if (!health && normalized) {
      let bestScore = 0;
      let best: typeof health | undefined;
      for (const [name, candidate] of healthByCompany.entries()) {
        const score = scoreNameSimilarity(normalized, name);
        if (score > bestScore) { bestScore = score; best = candidate; }
      }
      if (bestScore >= 0.72 && best) health = { ...best, similarity: true };
    }
    return {
      ...r,
      campaign_status_current: status?.current || null,
      campaign_status_previous: status?.previous || null,
      campaign_status_current_month: status?.currentMonth || null,
      campaign_status_previous_month: status?.previousMonth || null,
      campaign_status_similarity_match: status?.similarity || false,
      csat_current: csat?.current ?? null,
      csat_previous: csat?.previous ?? null,
      csat_variation: csatVariation,
      csat_direction: csatDirection,
      csat_current_month: csat?.currentMonth ?? null,
      csat_previous_month: csat?.previousMonth ?? null,
      csat_similarity_match: csat?.similarity || false,
      health_status: health?.status || null,
      impact_level: health?.impact || null,
      health_similarity_match: health?.similarity || false,
    };
  }).filter((r) => {
    if (r.cnpj.length === 14) return true;
    counters.skipped++;
    errors.push({ row: r.source_row, cnpj: r.cnpj, message: "CNPJ inválido ou vazio" });
    return false;
  });
  const { data: defaultPartner } = await supabase.from("parceiros_comerciais").select("id").eq("ativo", true).limit(1).maybeSingle();
  if (!defaultPartner?.id) return new Response(JSON.stringify({ ok: false, error: "Nenhum parceiro ativo disponível" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const { data: existingLeads, error: existingError } = await supabase.from("leads").select("id,cnpj,nome_fantasia,razao_social,nome_responsavel,email_responsavel,telefone_responsavel,cidade,erp_utilizado,quantidade_lojas,quantidade_funcionarios,valor_mensalidade,valor_campanhas,valor_pagamento,consultor,impacto,risco,csat,revenue_total,status,categoria,juros_recebidos,multas_recebidas,receita_taxa_boleto,valor_mensalidade_anterior,valor_campanhas_anterior,valor_pagamento_anterior,campaign_status_current,campaign_status_previous,campaign_status_current_month,campaign_status_previous_month,csat_current,csat_previous,csat_variation,csat_direction,csat_current_month,csat_previous_month,health_status,impact_level").eq("status", "sucesso");
  if (existingError) return new Response(JSON.stringify({ ok: false, error: existingError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const existingByCnpj = new Map((existingLeads || [])
    .map((lead) => [cleanCnpj(lead.cnpj || ""), lead] as const)
    .filter(([cnpj]) => cnpj.length === 14));
  const existingByNamePhone = new Map((existingLeads || [])
    .filter((lead) => lead.nome_fantasia && lead.telefone_responsavel)
    .map((lead) => [`${normalizeText(lead.nome_fantasia)}::${(lead.telefone_responsavel || "").replace(/\D/g, "")}`, lead] as const));
  const existingByNameEmail = new Map((existingLeads || [])
    .filter((lead) => lead.nome_fantasia && lead.email_responsavel)
    .map((lead) => [`${normalizeText(lead.nome_fantasia)}::${normalizeText(lead.email_responsavel || "")}`, lead] as const));
  const { data: sucessoStage } = await supabase
    .from("pipeline_stages_config")
    .select("value")
    .eq("panel_key", "sucesso")
    .eq("label", "Onboarding Sucesso")
    .maybeSingle();
  const successStageValue = sucessoStage?.value || "novo_lead";

  for (const row of validRows) {
    counters.processed++;
    try {
      const existing = existingByCnpj.get(row.cnpj)
        || existingByNamePhone.get(`${normalizeText(row.nome_fantasia)}::${(row.telefone_responsavel || "").replace(/\D/g, "")}`)
        || existingByNameEmail.get(`${normalizeText(row.nome_fantasia)}::${normalizeText(row.email_responsavel)}`);
      if (!existing) {
        const { source_row: _sr, campaign_status_similarity_match: _csm, csat_similarity_match: _csim, health_similarity_match: _hsm, ...insertRow } = row;
        const { error } = await supabase.from("leads").insert({ ...insertRow, status: "sucesso", status_lead: successStageValue, origem: "google_drive", parceiro_id: defaultPartner.id } as never);
        if (error) throw error; counters.created++; continue;
      }
      const updatePayload: Record<string, string | number | null> = {};
      ([
        ["nome_fantasia", existing.nome_fantasia, row.nome_fantasia], ["nome_responsavel", existing.nome_responsavel, row.nome_responsavel], ["email_responsavel", existing.email_responsavel, row.email_responsavel],
        ["razao_social", (existing as { razao_social?: string | null }).razao_social ?? null, row.razao_social || null],
        ["telefone_responsavel", existing.telefone_responsavel, row.telefone_responsavel], ["cidade", existing.cidade, row.cidade], ["erp_utilizado", existing.erp_utilizado, row.erp_utilizado],
        ["quantidade_lojas", existing.quantidade_lojas, row.quantidade_lojas], ["quantidade_funcionarios", existing.quantidade_funcionarios, row.quantidade_funcionarios], ["valor_mensalidade", existing.valor_mensalidade, row.valor_mensalidade], ["valor_campanhas", existing.valor_campanhas, row.valor_campanhas], ["valor_pagamento", (existing as { valor_pagamento?: number | null }).valor_pagamento, row.valor_pagamento], ["consultor", (existing as { consultor?: string | null }).consultor ?? null, row.consultor || null], ["impacto", (existing as { impacto?: string | null }).impacto ?? null, row.impacto || null], ["risco", (existing as { risco?: string | null }).risco ?? null, row.risco || null], ["csat", (existing as { csat?: number | null }).csat ?? null, row.csat], ["categoria", (existing as { categoria?: string | null }).categoria ?? null, row.categoria || null], ["juros_recebidos", (existing as { juros_recebidos?: number | null }).juros_recebidos ?? null, row.juros_recebidos], ["multas_recebidas", (existing as { multas_recebidas?: number | null }).multas_recebidas ?? null, row.multas_recebidas], ["receita_taxa_boleto", (existing as { receita_taxa_boleto?: number | null }).receita_taxa_boleto ?? null, row.receita_taxa_boleto], ["revenue_total", (existing as { revenue_total?: number | null }).revenue_total ?? null, (row as { revenue_total: number }).revenue_total], ["campaign_status_current", (existing as { campaign_status_current?: string | null }).campaign_status_current ?? null, (row as { campaign_status_current?: string | null }).campaign_status_current ?? null], ["campaign_status_previous", (existing as { campaign_status_previous?: string | null }).campaign_status_previous ?? null, (row as { campaign_status_previous?: string | null }).campaign_status_previous ?? null], ["campaign_status_current_month", (existing as { campaign_status_current_month?: string | null }).campaign_status_current_month ?? null, (row as { campaign_status_current_month?: string | null }).campaign_status_current_month ?? null], ["campaign_status_previous_month", (existing as { campaign_status_previous_month?: string | null }).campaign_status_previous_month ?? null, (row as { campaign_status_previous_month?: string | null }).campaign_status_previous_month ?? null], ["csat_current", (existing as { csat_current?: number | null }).csat_current ?? null, (row as { csat_current?: number | null }).csat_current ?? null], ["csat_previous", (existing as { csat_previous?: number | null }).csat_previous ?? null, (row as { csat_previous?: number | null }).csat_previous ?? null], ["csat_variation", (existing as { csat_variation?: number | null }).csat_variation ?? null, (row as { csat_variation?: number | null }).csat_variation ?? null], ["csat_direction", (existing as { csat_direction?: string | null }).csat_direction ?? null, (row as { csat_direction?: string | null }).csat_direction ?? null], ["csat_current_month", (existing as { csat_current_month?: string | null }).csat_current_month ?? null, (row as { csat_current_month?: string | null }).csat_current_month ?? null], ["csat_previous_month", (existing as { csat_previous_month?: string | null }).csat_previous_month ?? null, (row as { csat_previous_month?: string | null }).csat_previous_month ?? null], ["health_status", (existing as { health_status?: string | null }).health_status ?? null, (row as { health_status?: string | null }).health_status ?? null], ["impact_level", (existing as { impact_level?: string | null }).impact_level ?? null, (row as { impact_level?: string | null }).impact_level ?? null],
      ] as Array<[string, string | number | null, string | number | null]>).forEach(([key, oldValue, newValue]) => { if ((oldValue ?? null) !== (newValue ?? null)) updatePayload[key] = newValue; });
      if ((existing as { valor_mensalidade_anterior?: number | null }).valor_mensalidade_anterior == null && existing.valor_mensalidade !== row.valor_mensalidade) updatePayload.valor_mensalidade_anterior = existing.valor_mensalidade;
      if ((existing as { valor_campanhas_anterior?: number | null }).valor_campanhas_anterior == null && existing.valor_campanhas !== row.valor_campanhas) updatePayload.valor_campanhas_anterior = existing.valor_campanhas;
      if ((existing as { valor_pagamento_anterior?: number | null }).valor_pagamento_anterior == null && (existing as { valor_pagamento?: number | null }).valor_pagamento !== row.valor_pagamento) updatePayload.valor_pagamento_anterior = (existing as { valor_pagamento?: number | null }).valor_pagamento ?? null;
      if (Object.keys(updatePayload).length > 0) { const { error } = await supabase.from("leads").update(updatePayload as never).eq("id", existing.id); if (error) throw error; counters.updated++; }
    } catch (error) {
      counters.skipped++;
      errors.push({ row: row.source_row, cnpj: row.cnpj, message: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }
  console.log(`[sync-drive-clients] Resultado: processados=${counters.processed}, criados=${counters.created}, atualizados=${counters.updated}, ignorados=${counters.skipped}, erros=${errors.length}`);
  await supabase.from("sync_job_logs").insert({ job_name: "sync_drive_clients", processed_count: counters.processed, created_count: counters.created, updated_count: counters.updated, error_count: errors.length } as never);
  return new Response(JSON.stringify({ success: true, ...counters, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
