import { createClient } from "npm:@supabase/supabase-js@2";

type DriveClientRow = {
  cnpj: string;
  nome_fantasia: string;
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
};
const cleanCnpj = (value: string) => (value || "").replace(/\D/g, "").slice(0, 14);
const toNumber = (value: string) => {
  if (!value?.trim()) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};
const normalizeHeader = (header: string) => header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
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
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const sheetCsvUrl = Deno.env.get("GOOGLE_SHEETS_CSV_URL");
  if (!sheetCsvUrl) return new Response(JSON.stringify({ ok: false, error: "Missing GOOGLE_SHEETS_CSV_URL" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const counters = { processed: 0, created: 0, updated: 0, errors: 0 };
  const csvResponse = await fetch(sheetCsvUrl, { headers: { "Cache-Control": "no-cache" } });
  if (!csvResponse.ok) return new Response(JSON.stringify({ ok: false, error: `Erro ao ler planilha: ${csvResponse.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const rows = parseCsv(await csvResponse.text());
  const parsedRows: DriveClientRow[] = rows.map((r) => ({
    cnpj: cleanCnpj(r.cnpj || r.documento || ""), nome_fantasia: r.nome_fantasia || r.empresa || "Cliente sem nome", nome_responsavel: r.nome_responsavel || r.responsavel || "Responsável",
    email_responsavel: r.email_responsavel || r.email || "drive@monnera.local", telefone_responsavel: r.telefone_responsavel || r.telefone || "", cidade: r.cidade || "", erp_utilizado: r.erp_utilizado || r.erp || "Não informado",
    quantidade_lojas: Number(r.quantidade_lojas || r.lojas || 1) || 1, quantidade_funcionarios: toNumber(r.quantidade_funcionarios || r.funcionarios || ""), valor_mensalidade: toNumber(r.mensalidade || r.valor_mensalidade || ""),
    valor_campanhas: toNumber(r.receita_campanha || r.valor_campanhas || ""),
    valor_pagamento: toNumber(r.receita_pagamento || r.valor_pagamento || ""),
  })).filter((r) => r.cnpj.length === 14);
  const { data: defaultPartner } = await supabase.from("parceiros_comerciais").select("id").eq("ativo", true).limit(1).maybeSingle();
  if (!defaultPartner?.id) return new Response(JSON.stringify({ ok: false, error: "Nenhum parceiro ativo disponível" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const cnpjs = [...new Set(parsedRows.map((r) => r.cnpj))];
  const { data: existingLeads, error: existingError } = await supabase.from("leads").select("id,cnpj,nome_fantasia,nome_responsavel,email_responsavel,telefone_responsavel,cidade,erp_utilizado,quantidade_lojas,quantidade_funcionarios,valor_mensalidade,valor_campanhas,valor_pagamento,revenue_total").in("cnpj", cnpjs).eq("status", "sucesso");
  if (existingError) return new Response(JSON.stringify({ ok: false, error: existingError.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const existingByCnpj = new Map((existingLeads || []).map((lead) => [cleanCnpj(lead.cnpj || ""), lead]));
  for (const row of parsedRows) {
    counters.processed++;
    try {
      const existing = existingByCnpj.get(row.cnpj);
      if (!existing) {
        const { error } = await supabase.from("leads").insert({ ...row, status: "sucesso", status_lead: "novo_lead", origem: "google_drive", parceiro_id: defaultPartner.id } as never);
        if (error) throw error; counters.created++; continue;
      }
      const updatePayload: Record<string, string | number | null> = {};
      ([
        ["nome_fantasia", existing.nome_fantasia, row.nome_fantasia], ["nome_responsavel", existing.nome_responsavel, row.nome_responsavel], ["email_responsavel", existing.email_responsavel, row.email_responsavel],
        ["telefone_responsavel", existing.telefone_responsavel, row.telefone_responsavel], ["cidade", existing.cidade, row.cidade], ["erp_utilizado", existing.erp_utilizado, row.erp_utilizado],
        ["quantidade_lojas", existing.quantidade_lojas, row.quantidade_lojas], ["quantidade_funcionarios", existing.quantidade_funcionarios, row.quantidade_funcionarios], ["valor_mensalidade", existing.valor_mensalidade, row.valor_mensalidade], ["valor_campanhas", existing.valor_campanhas, row.valor_campanhas], ["valor_pagamento", (existing as { valor_pagamento?: number | null }).valor_pagamento, row.valor_pagamento],
      ] as Array<[string, string | number | null, string | number | null]>).forEach(([key, oldValue, newValue]) => { if ((oldValue ?? null) !== (newValue ?? null)) updatePayload[key] = newValue; });
      if (Object.keys(updatePayload).length > 0) { const { error } = await supabase.from("leads").update(updatePayload as never).eq("id", existing.id); if (error) throw error; counters.updated++; }
    } catch { counters.errors++; }
  }
  await supabase.from("sync_job_logs").insert({ job_name: "sync_drive_clients", processed_count: counters.processed, created_count: counters.created, updated_count: counters.updated, error_count: counters.errors } as never);
  return new Response(JSON.stringify({ ok: true, ...counters }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
