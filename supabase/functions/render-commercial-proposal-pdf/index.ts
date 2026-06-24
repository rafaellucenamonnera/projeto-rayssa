// Edge function: render-commercial-proposal-pdf
// Renderiza a rota publica da proposta como PDF via PDFShift e salva no
// bucket `propostas`. Atualiza pdf_path / pdf_generated_at / pdf_status na
// linha de commercial_proposals. Nunca bloqueia o chamador: falhas viram
// pdf_status='failed' com pdf_error.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFSHIFT_API_KEY = Deno.env.get("PDFSHIFT_API_KEY") || "";
const PUBLIC_APP_URL =
  Deno.env.get("PUBLIC_APP_URL") || "https://parceiros.monnera.com.br";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function markFailed(
  admin: ReturnType<typeof createClient>,
  proposalId: string,
  err: string,
) {
  await admin
    .from("commercial_proposals")
    .update({
      pdf_status: "failed",
      pdf_error: err.slice(0, 1000),
    })
    .eq("id", proposalId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const proposalId: string | undefined = body?.proposal_id;
  if (!proposalId || typeof proposalId !== "string") {
    return json({ error: "proposal_id is required" }, 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: proposal, error: pErr } = await admin
    .from("commercial_proposals")
    .select("id, lead_id, token, version")
    .eq("id", proposalId)
    .maybeSingle();
  if (pErr || !proposal) {
    return json({ error: "Proposal not found" }, 404);
  }

  if (!PDFSHIFT_API_KEY) {
    await markFailed(admin, proposal.id, "PDFSHIFT_API_KEY not configured");
    return json({ error: "PDFSHIFT_API_KEY not configured" }, 500);
  }

  await admin
    .from("commercial_proposals")
    .update({ pdf_status: "pending", pdf_error: null })
    .eq("id", proposal.id);

  const sourceUrl = `${PUBLIC_APP_URL.replace(/\/+$/, "")}/proposta/${proposal.token}?print=1`;

  let pdfBytes: Uint8Array;
  try {
    const auth = btoa(`api:${PDFSHIFT_API_KEY}`);
    const res = await fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: sourceUrl,
        landscape: false,
        use_print: true,
        format: "A4",
        margin: "0",
        delay: 2500,
        timeout: 60,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`PDFShift ${res.status}: ${t.slice(0, 500)}`);
    }
    pdfBytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    const msg = (err as Error).message || String(err);
    await markFailed(admin, proposal.id, msg);
    return json({ error: msg }, 502);
  }

  const path = `${proposal.lead_id}/proposta-v${proposal.version}-${proposal.token}.pdf`;
  const { error: upErr } = await admin.storage
    .from("propostas")
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (upErr) {
    await markFailed(admin, proposal.id, `upload: ${upErr.message}`);
    return json({ error: upErr.message }, 500);
  }

  const { error: updErr } = await admin
    .from("commercial_proposals")
    .update({
      pdf_path: path,
      pdf_generated_at: new Date().toISOString(),
      pdf_status: "ready",
      pdf_error: null,
    })
    .eq("id", proposal.id);
  if (updErr) {
    return json({ error: updErr.message }, 500);
  }

  return json({ ok: true, pdf_path: path });
});
