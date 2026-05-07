import { createClient } from "npm:@supabase/supabase-js@2";

type DriveClientRow = {
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
};
const cleanCnpj = (value: string) => (value || "").replace(/\D/g, "").slice(0, 14);
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
  const sheetCsvUrl = Deno.env.get("GOOGLE_SHEETS_CSV_URL");
  if (!sheetCsvUrl) return new Response(JSON.stringify({ ok: false, error: "Missing GOOGLE_SHEETS_CSV_URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const counters = { processed: 0, created: 0, updated: 0, skipped: 0 };
  const errors: Array<{ row?: number; cnpj?: string; message: string }> = [];
  console.log("[sync-drive-clients] Início da sincronização");
  const csvResponse = await fetch(sheetCsvUrl, { headers: { "Cache-Control": "no-cache" } });
  if (!csvResponse.ok) return new Response(JSON.stringify({ ok: false, error: `Erro ao ler planilha: ${csvResponse.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const rows = parseCsv(await csvResponse.text());
  console.log(`[sync-drive-clients] Total lido da planilha: ${rows.length}`);
  const parsedRows: DriveClientRow[] = rows.map((r) => ({
    cnpj: cleanCnpj(pick(r, "cnpj", "documento")),
    nome_fantasia: pick(r, "nome_fantasia", "empresa", "contratante") || "Cliente sem nome",
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
  }));
  const validRows = parsedRows.filter((r, index) => {
    if (r.cnpj.length === 14) return true;
    counters.skipped++;
    errors.push({ row: index + 2, cnpj: r.cnpj, message: "CNPJ inválido ou vazio" });
    return false;
  });
  const { data: defaultPartner } = await supabase.from("parceiros_comerciais").select("id").eq("ativo", true).limit(1).maybeSingle();
  if (!defaultPartner?.id) return new Response(JSON.stringify({ ok: false, error: "Nenhum parceiro ativo disponível" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const cnpjs = [...new Set(validRows.map((r) => r.cnpj))];
  const { data: existingLeads, error: existingError } = await supabase.from("leads").select("id,cnpj,nome_fantasia,nome_responsavel,email_responsavel,telefone_responsavel,cidade,erp_utilizado,quantidade_lojas,quantidade_funcionarios,valor_mensalidade,valor_campanhas,valor_pagamento,consultor,impacto,risco,csat,revenue_total").in("cnpj", cnpjs).eq("status", "sucesso");
  if (existingError) return new Response(JSON.stringify({ ok: false, error: existingError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const existingByCnpj = new Map((existingLeads || []).map((lead) => [cleanCnpj(lead.cnpj || ""), lead]));
  const { data: sucessoStage } = await supabase
    .from("pipeline_stages_config")
    .select("value")
    .eq("panel_key", "sucesso")
    .eq("label", "Onboarding Sucesso")
    .maybeSingle();
  const successStageValue = sucessoStage?.value || "novo_lead";

  for (const [index, row] of validRows.entries()) {
    counters.processed++;
    try {
      const existing = existingByCnpj.get(row.cnpj);
      if (!existing) {
        const { error } = await supabase.from("leads").insert({ ...row, status: "sucesso", status_lead: successStageValue, origem: "google_drive", parceiro_id: defaultPartner.id } as never);
        if (error) throw error; counters.created++; continue;
      }
      const updatePayload: Record<string, string | number | null> = {};
      ([
        ["nome_fantasia", existing.nome_fantasia, row.nome_fantasia], ["nome_responsavel", existing.nome_responsavel, row.nome_responsavel], ["email_responsavel", existing.email_responsavel, row.email_responsavel],
        ["telefone_responsavel", existing.telefone_responsavel, row.telefone_responsavel], ["cidade", existing.cidade, row.cidade], ["erp_utilizado", existing.erp_utilizado, row.erp_utilizado],
        ["quantidade_lojas", existing.quantidade_lojas, row.quantidade_lojas], ["quantidade_funcionarios", existing.quantidade_funcionarios, row.quantidade_funcionarios], ["valor_mensalidade", existing.valor_mensalidade, row.valor_mensalidade], ["valor_campanhas", existing.valor_campanhas, row.valor_campanhas], ["valor_pagamento", (existing as { valor_pagamento?: number | null }).valor_pagamento, row.valor_pagamento], ["consultor", (existing as { consultor?: string | null }).consultor ?? null, row.consultor || null], ["impacto", (existing as { impacto?: string | null }).impacto ?? null, row.impacto || null], ["risco", (existing as { risco?: string | null }).risco ?? null, row.risco || null], ["csat", (existing as { csat?: number | null }).csat ?? null, row.csat],
      ] as Array<[string, string | number | null, string | number | null]>).forEach(([key, oldValue, newValue]) => { if ((oldValue ?? null) !== (newValue ?? null)) updatePayload[key] = newValue; });
      if (Object.keys(updatePayload).length > 0) { const { error } = await supabase.from("leads").update(updatePayload as never).eq("id", existing.id); if (error) throw error; counters.updated++; }
    } catch (error) {
      counters.skipped++;
      errors.push({ row: index + 2, cnpj: row.cnpj, message: error instanceof Error ? error.message : "Erro desconhecido" });
    }
  }
  console.log(`[sync-drive-clients] Resultado: processados=${counters.processed}, criados=${counters.created}, atualizados=${counters.updated}, ignorados=${counters.skipped}, erros=${errors.length}`);
  await supabase.from("sync_job_logs").insert({ job_name: "sync_drive_clients", processed_count: counters.processed, created_count: counters.created, updated_count: counters.updated, error_count: errors.length } as never);
  return new Response(JSON.stringify({ success: true, ...counters, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
