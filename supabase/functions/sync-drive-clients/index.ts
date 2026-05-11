import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================================
// Sync Drive Clients
// Fonte primária: aba "Clientes" (gid configurável, default 1252292837) com
// colunas NOME FANTASIA, RAZAO SOCIAL, Carteira (CS Responsável).
// As demais abas (Receita / Contratante, Status Campanha, CSAT, Painel Saúde)
// apenas enriquecem cada cliente por similaridade da razão social.
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SPREADSHEET_ID = Deno.env.get("GOOGLE_SHEETS_SPREADSHEET_ID")?.trim() || "1Ao69-CKVhwmTxzRAhpHotw3Ny_3kU7Id34k4qLTAyo8";
const CLIENTS_GID = Deno.env.get("GOOGLE_SHEETS_CLIENTS_GID")?.trim() || "1252292837";
const REVENUE_GID = Deno.env.get("GOOGLE_SHEETS_GID")?.trim() || "0";
const STATUS_GID = Deno.env.get("GOOGLE_SHEETS_STATUS_CAMPANHA_GID")?.trim() || "";
const CSAT_GID = Deno.env.get("GOOGLE_SHEETS_CSAT_GID")?.trim() || "";
const HEALTH_GID = Deno.env.get("GOOGLE_SHEETS_PAINEL_SAUDE_GID")?.trim() || "409080197";

const csvUrl = (gid: string) => `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`;

const PT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const normalizeHeader = (h: string) =>
  h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const normalizeCNPJ = (v: string) => (v || "").replace(/\D/g, "").slice(0, 14);

const normalizeCompanyName = (v: string) =>
  (v || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim().toUpperCase();

const scoreNameSimilarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = new Set(a.split(" ").filter(Boolean));
  const sb = new Set(b.split(" ").filter(Boolean));
  let inter = 0;
  sa.forEach((t) => { if (sb.has(t)) inter++; });
  return inter / Math.max(sa.size, sb.size, 1);
};

const toNumber = (v: string) => {
  if (!v?.trim()) return null;
  const n = Number(v.replace(/[^\d,.\-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const pick = (row: Record<string, string>, ...keys: string[]) => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};

const parseCsv = (raw: string): Record<string, string>[] => {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const parseLine = (line: string) => {
    const out: string[] = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (c === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim()); return out;
  };
  const headers = parseLine(lines[0]).map(normalizeHeader);
  return lines.slice(1).map((line) => {
    const cols = parseLine(line);
    return headers.reduce<Record<string, string>>((a, h, i) => { a[h] = cols[i] || ""; return a; }, {});
  });
};

const parseMonthHeader = (key: string) => {
  const k = normalizeHeader(key);
  const mmyyyy = k.match(/(0?[1-9]|1[0-2])[_/-](20\d{2})/);
  if (mmyyyy) return { month: Number(mmyyyy[1]), year: Number(mmyyyy[2]) };
  const idx = PT_MONTHS.findIndex((m) => k.includes(m));
  const y = k.match(/(20\d{2})/);
  if (idx >= 0 && y) return { month: idx + 1, year: Number(y[1]) };
  return null;
};

// Matching utilitário: dado um nome normalizado, busca no map o melhor candidato.
const lookupBySimilarity = <T,>(map: Map<string, T>, normalized: string, threshold = 0.85): { value: T; similarity: boolean } | null => {
  if (!normalized) return null;
  const exact = map.get(normalized);
  if (exact) return { value: exact, similarity: false };
  let bestScore = 0;
  let best: T | undefined;
  for (const [name, candidate] of map.entries()) {
    const s = scoreNameSimilarity(normalized, name);
    if (s > bestScore) { bestScore = s; best = candidate; }
  }
  if (bestScore >= threshold && best) return { value: best, similarity: true };
  return null;
};

type ClientRow = {
  source_row: number;
  cnpj: string;
  nome_fantasia: string;
  razao_social: string;
  consultor: string;
};

type RevenueData = {
  valor_mensalidade: number | null;
  valor_campanhas: number | null;
  valor_pagamento: number | null;
  juros_recebidos: number | null;
  multas_recebidas: number | null;
  receita_taxa_boleto: number | null;
};

const FINANCIAL_CATEGORY_MAP: Record<string, keyof RevenueData> = {
  juros_recebidos: "juros_recebidos",
  multas_recebidas: "multas_recebidas",
  receita_campanha: "valor_campanhas",
  receita_ordem_pagamento: "valor_pagamento",
  receita_taxa_boleto: "receita_taxa_boleto",
  receitas_mensalidades: "valor_mensalidade",
};
const normalizeCategoryLabel = (v: string) => normalizeHeader(v).replace(/^receitas?_/, "receita_");

const extractPrimaryNumericValue = (row: Record<string, string>) => {
  const direct = toNumber(pick(row, "valor", "valor_total", "total", "mes_atual", "atual"));
  if (direct !== null) return direct;
  const reserved = new Set(["contratante", "empresa", "nome_fantasia", "cnpj", "categoria", "cs", "responsavel", "responsavel_cs"]);
  const keys = Object.keys(row).filter((k) => !reserved.has(k));
  for (let i = keys.length - 1; i >= 0; i--) {
    const p = toNumber(row[keys[i]] || "");
    if (p !== null) return p;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  console.log("[sync-drive-clients] Início (fonte: aba Clientes gid=", CLIENTS_GID, ")");

  const counters = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    matched_revenue: 0,
    matched_status: 0,
    matched_csat: 0,
    matched_health: 0,
  };
  const errors: Array<{ row?: number; razao_social?: string; message: string }> = [];

  // -------- Fetch all sheets in parallel --------
  const [clientsRes, revenueRes, statusRes, csatRes, healthRes] = await Promise.all([
    fetch(csvUrl(CLIENTS_GID), { headers: { "Cache-Control": "no-cache" } }),
    fetch(csvUrl(REVENUE_GID), { headers: { "Cache-Control": "no-cache" } }),
    STATUS_GID ? fetch(csvUrl(STATUS_GID), { headers: { "Cache-Control": "no-cache" } }) : Promise.resolve(null),
    CSAT_GID ? fetch(csvUrl(CSAT_GID), { headers: { "Cache-Control": "no-cache" } }) : Promise.resolve(null),
    HEALTH_GID ? fetch(csvUrl(HEALTH_GID), { headers: { "Cache-Control": "no-cache" } }) : Promise.resolve(null),
  ]);

  if (!clientsRes.ok) {
    return new Response(JSON.stringify({
      success: false,
      error: `Falha ao ler aba Clientes (status ${clientsRes.status}). Verifique permissões da planilha.`,
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const clientsRaw = parseCsv(await clientsRes.text());
  const revenueRaw = revenueRes.ok ? parseCsv(await revenueRes.text()) : [];
  const statusRaw = statusRes?.ok ? parseCsv(await statusRes.text()) : [];
  const csatRaw = csatRes?.ok ? parseCsv(await csatRes.text()) : [];
  const healthRaw = healthRes?.ok ? parseCsv(await healthRes.text()) : [];

  console.log(`[sync-drive-clients] Linhas lidas: clientes=${clientsRaw.length}, receita=${revenueRaw.length}, status=${statusRaw.length}, csat=${csatRaw.length}, saude=${healthRaw.length}`);

  // -------- 1) Parse aba Clientes --------
  const clients: ClientRow[] = [];
  clientsRaw.forEach((r, i) => {
    const razao = pick(r, "razao_social", "razao", "razaosocial");
    const fantasiaRaw = pick(r, "nome_fantasia", "nomefantasia", "fantasia");
    if (!razao && !fantasiaRaw) return;

    // Extrai CNPJ se aparecer no nome fantasia (formato "NOME - 12345678901234")
    const cnpjMatch = fantasiaRaw.match(/\b(\d{14})\b/) || razao.match(/\b(\d{14})\b/);
    const cnpj = cnpjMatch ? cnpjMatch[1] : "";
    // Remove sufixo "- CNPJ" do nome fantasia
    const nome_fantasia = fantasiaRaw.replace(/\s*-\s*\d{14}\s*$/, "").trim();

    clients.push({
      source_row: i + 2,
      cnpj,
      nome_fantasia: nome_fantasia || razao,
      razao_social: razao || nome_fantasia,
      consultor: pick(r, "carteira", "cs", "consultor", "responsavel", "responsavel_cs"),
    });
  });

  if (clients.length === 0) {
    return new Response(JSON.stringify({
      success: false,
      error: "Nenhum cliente encontrado na aba Clientes (verifique colunas RAZAO SOCIAL / NOME FANTASIA / Carteira).",
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // -------- 2) Build revenueByCompany a partir da aba Receita / Contratante --------
  // Lógica: cada vez que encontramos uma linha "cliente" (com nome em Contratante/Empresa
  // e sem categoria financeira), iniciamos um bucket. Linhas seguintes com categoria
  // financeira mapeada alimentam o bucket atual.
  const revenueByCompany = new Map<string, RevenueData>();
  let currentBucket: { name: string; data: RevenueData } | null = null;
  for (const r of revenueRaw) {
    const label = pick(r, "contratante", "empresa", "nome_fantasia", "razao_social", "categoria", "");
    if (!label) continue;
    const isFinancial = Boolean(FINANCIAL_CATEGORY_MAP[normalizeCategoryLabel(label)]);

    if (!isFinancial) {
      // Provável linha-cabeçalho de cliente
      const norm = normalizeCompanyName(label);
      if (!norm) continue;
      currentBucket = {
        name: norm,
        data: {
          valor_mensalidade: toNumber(pick(r, "mensalidade", "valor_mensalidade")),
          valor_campanhas: toNumber(pick(r, "receita_campanha", "valor_campanhas")),
          valor_pagamento: toNumber(pick(r, "receita_pagamento", "valor_pagamento", "receita_ordem_pagamento")),
          juros_recebidos: toNumber(pick(r, "juros_recebidos")),
          multas_recebidas: toNumber(pick(r, "multas_recebidas")),
          receita_taxa_boleto: toNumber(pick(r, "receita_taxa_boleto")),
        },
      };
      revenueByCompany.set(norm, currentBucket.data);
    } else if (currentBucket) {
      const field = FINANCIAL_CATEGORY_MAP[normalizeCategoryLabel(label)];
      currentBucket.data[field] = extractPrimaryNumericValue(r);
    }
  }

  // -------- 3) Build mapas das demais abas (status, csat, saude) --------
  const now = new Date();
  const currentMonth = { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
  const previousMonth = currentMonth.month === 1
    ? { month: 12, year: currentMonth.year - 1 }
    : { month: currentMonth.month - 1, year: currentMonth.year };
  const fmtMonth = (m: { month: number; year: number }) => `${String(m.month).padStart(2, "0")}/${m.year}`;

  const statusByCompany = new Map<string, { current: string; previous: string }>();
  for (const r of statusRaw) {
    const norm = normalizeCompanyName(pick(r, "razao_social", "contratante", "empresa", "nome_fantasia"));
    if (!norm) continue;
    let cur = "", prev = "";
    for (const [key, value] of Object.entries(r)) {
      const p = parseMonthHeader(key);
      if (!p) continue;
      if (p.month === currentMonth.month && p.year === currentMonth.year) cur = value.trim();
      if (p.month === previousMonth.month && p.year === previousMonth.year) prev = value.trim();
    }
    statusByCompany.set(norm, { current: cur, previous: prev });
  }

  const csatByCompany = new Map<string, { current: number | null; previous: number | null }>();
  for (const r of csatRaw) {
    const norm = normalizeCompanyName(pick(r, "razao_social", "contratante", "empresa", "nome_fantasia"));
    if (!norm) continue;
    let cur: number | null = null, prev: number | null = null;
    for (const [key, value] of Object.entries(r)) {
      const p = parseMonthHeader(key);
      if (!p) continue;
      if (p.month === currentMonth.month && p.year === currentMonth.year) cur = toNumber(value);
      if (p.month === previousMonth.month && p.year === previousMonth.year) prev = toNumber(value);
    }
    csatByCompany.set(norm, { current: cur, previous: prev });
  }

  const healthByCompany = new Map<string, { status: string; impact: string }>();
  for (const r of healthRaw) {
    const norm = normalizeCompanyName(pick(r, "contratante", "razao_social", "empresa", "nome_fantasia"));
    const status = pick(r, "status", "saude");
    const impact = pick(r, "impacto", "impact");
    if (!norm || (!status && !impact)) continue;
    healthByCompany.set(norm, { status, impact });
  }

  // -------- 4) Etapa-alvo no painel Sucesso --------
  const { data: successStages, error: stagesErr } = await supabase
    .from("pipeline_stages_config")
    .select("value,label,sort_order")
    .eq("panel_key", "sucesso")
    .order("sort_order", { ascending: true })
    .limit(1);
  if (stagesErr) {
    return new Response(JSON.stringify({ success: false, error: `Erro lendo etapas: ${stagesErr.message}` }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const successStageValue = successStages?.[0]?.value;
  if (!successStageValue) {
    return new Response(JSON.stringify({
      success: false,
      error: "Nenhuma etapa configurada para o painel 'sucesso'. Cadastre ao menos uma etapa em pipeline_stages_config.",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  // -------- 5) Parceiro padrão para origem google_drive --------
  const { data: defaultPartner } = await supabase
    .from("parceiros_comerciais").select("id").eq("ativo", true).limit(1).maybeSingle();
  if (!defaultPartner?.id) {
    return new Response(JSON.stringify({ success: false, error: "Nenhum parceiro ativo disponível" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // -------- 6) Carrega leads existentes (status sucesso) --------
  const { data: existingLeads, error: existingErr } = await supabase
    .from("leads")
    .select("id,cnpj,razao_social,nome_fantasia,consultor,valor_mensalidade,valor_campanhas,valor_pagamento")
    .eq("status", "sucesso");
  if (existingErr) {
    return new Response(JSON.stringify({ success: false, error: existingErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const existingByCnpj = new Map<string, typeof existingLeads[number]>();
  const existingByName = new Map<string, typeof existingLeads[number]>();
  (existingLeads || []).forEach((l) => {
    const c = normalizeCNPJ(l.cnpj || "");
    if (c.length === 14) existingByCnpj.set(c, l);
    const n = normalizeCompanyName(l.razao_social || l.nome_fantasia || "");
    if (n) existingByName.set(n, l);
  });

  // -------- 7) Processa cada cliente --------
  for (const c of clients) {
    counters.processed++;
    try {
      const normName = normalizeCompanyName(c.razao_social || c.nome_fantasia);

      // --- enriquecimento ---
      const revenueHit = lookupBySimilarity(revenueByCompany, normName);
      if (revenueHit) counters.matched_revenue++;
      const statusHit = lookupBySimilarity(statusByCompany, normName);
      if (statusHit) counters.matched_status++;
      const csatHit = lookupBySimilarity(csatByCompany, normName);
      if (csatHit) counters.matched_csat++;
      const healthHit = lookupBySimilarity(healthByCompany, normName);
      if (healthHit) counters.matched_health++;

      const revenue = revenueHit?.value ?? {
        valor_mensalidade: null, valor_campanhas: null, valor_pagamento: null,
        juros_recebidos: null, multas_recebidas: null, receita_taxa_boleto: null,
      };
      const csatVar = csatHit?.value.current != null && csatHit.value.previous != null
        ? csatHit.value.current - csatHit.value.previous : null;

      const payload = {
        nome_fantasia: c.nome_fantasia || c.razao_social,
        razao_social: c.razao_social,
        cnpj: c.cnpj,
        consultor: c.consultor || null,
        nome_responsavel: "Responsável",
        email_responsavel: "drive@monnera.local",
        telefone_responsavel: "",
        cidade: "",
        erp_utilizado: "Não informado",
        quantidade_lojas: 1,
        valor_mensalidade: revenue.valor_mensalidade ?? 0,
        valor_campanhas: revenue.valor_campanhas ?? 0,
        valor_pagamento: revenue.valor_pagamento ?? 0,
        juros_recebidos: revenue.juros_recebidos,
        multas_recebidas: revenue.multas_recebidas,
        receita_taxa_boleto: revenue.receita_taxa_boleto,
        campaign_status_current: statusHit?.value.current || null,
        campaign_status_previous: statusHit?.value.previous || null,
        campaign_status_current_month: statusHit ? fmtMonth(currentMonth) : null,
        campaign_status_previous_month: statusHit ? fmtMonth(previousMonth) : null,
        csat_current: csatHit?.value.current ?? null,
        csat_previous: csatHit?.value.previous ?? null,
        csat_variation: csatVar,
        csat_direction: csatVar == null ? null : csatVar > 0 ? "up" : csatVar < 0 ? "down" : "neutral",
        csat_current_month: csatHit ? fmtMonth(currentMonth) : null,
        csat_previous_month: csatHit ? fmtMonth(previousMonth) : null,
        health_status: healthHit?.value.status || null,
        impact_level: healthHit?.value.impact || null,
      };

      // --- busca lead existente ---
      let existing = (c.cnpj.length === 14 ? existingByCnpj.get(c.cnpj) : undefined)
        || existingByName.get(normName);
      if (!existing && normName) {
        let bestScore = 0;
        let best: typeof existing | undefined;
        for (const [name, lead] of existingByName.entries()) {
          const s = scoreNameSimilarity(normName, name);
          if (s > bestScore) { bestScore = s; best = lead; }
        }
        if (bestScore >= 0.85) existing = best;
      }

      if (!existing) {
        const { error } = await supabase.from("leads").insert({
          ...payload,
          status: "sucesso",
          status_lead: successStageValue,
          origem: "google_drive",
          parceiro_id: defaultPartner.id,
        } as never);
        if (error) throw error;
        counters.created++;
        continue;
      }

      // Update apenas campos que mudaram
      const updateRow: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(payload)) {
        const oldV = (existing as Record<string, unknown>)[k];
        if ((oldV ?? null) !== (v ?? null)) updateRow[k] = v;
      }
      if (Object.keys(updateRow).length > 0) {
        const { error } = await supabase.from("leads").update(updateRow as never).eq("id", existing.id);
        if (error) throw error;
        counters.updated++;
      }
    } catch (err) {
      counters.skipped++;
      errors.push({
        row: c.source_row,
        razao_social: c.razao_social,
        message: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  console.log(`[sync-drive-clients] Resultado: clientes_na_aba=${clients.length}, processados=${counters.processed}, criados=${counters.created}, atualizados=${counters.updated}, ignorados=${counters.skipped}, receita_match=${counters.matched_revenue}, status_match=${counters.matched_status}, csat_match=${counters.matched_csat}, saude_match=${counters.matched_health}, erros=${errors.length}`);

  await supabase.from("sync_job_logs").insert({
    job_name: "sync_drive_clients",
    processed_count: counters.processed,
    created_count: counters.created,
    updated_count: counters.updated,
    error_count: errors.length,
  } as never);

  return new Response(JSON.stringify({
    success: true,
    clients_in_sheet: clients.length,
    ...counters,
    stage_used: successStageValue,
    source: { spreadsheet_id: SPREADSHEET_ID, clients_gid: CLIENTS_GID, revenue_gid: REVENUE_GID },
    errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
