// Edge function: render-commercial-proposal-pdf
// Idempotente. Entrada: { proposal_id: string, force?: boolean }
// - pdf_status='ready' e !force        -> retorna { ok:true, already_ready:true }
// - pdf_status='pending' e
//     pdf_processing_started_at < 5min  -> retorna { ok:true, already_processing:true }
// - pdf_status='failed' e !force        -> retorna { ok:false, pdf_status:'failed' } (sem nova tentativa)
// - força nova tentativa apenas com force:true ou stale pending
// Falhas NUNCA quebram a proposta/link público — gravam pdf_status='failed'.

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

const PENDING_WINDOW_MS = 5 * 60 * 1000;

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

  // AuthZ: somente service role ou admin/gestor podem disparar geração de PDF
  const authHeader = req.headers.get("Authorization") || "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
  let authorized = bearer && bearer === SERVICE_ROLE;
  if (!authorized && bearer) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false },
    });
    const { data: claims } = await userClient.auth.getClaims(bearer);
    const uid = claims?.claims?.sub;
    if (uid) {
      const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", uid);
      authorized = !!roles?.some((r: any) => r.role === "admin" || r.role === "gestor_conta");
    }
  }
  if (!authorized) return json({ error: "Unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const proposalId: string | undefined = body?.proposal_id;
  const force: boolean = body?.force === true;
  if (!proposalId || typeof proposalId !== "string") {
    return json({ error: "proposal_id is required" }, 400);
  }


  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: proposal, error: pErr } = await admin
    .from("commercial_proposals")
    .select(
      "id, lead_id, token, version, pdf_status, pdf_processing_started_at, pdf_attempts",
    )
    .eq("id", proposalId)
    .maybeSingle();
  if (pErr || !proposal) {
    return json({ error: "Proposal not found" }, 404);
  }

  // Idempotência
  if (proposal.pdf_status === "ready" && !force) {
    return json({ ok: true, already_ready: true });
  }
  if (proposal.pdf_status === "pending" && !force) {
    const started = proposal.pdf_processing_started_at
      ? new Date(proposal.pdf_processing_started_at as string).getTime()
      : 0;
    if (started && Date.now() - started < PENDING_WINDOW_MS) {
      return json({ ok: true, already_processing: true });
    }
  }
  if (proposal.pdf_status === "failed" && !force) {
    return json({ ok: false, pdf_status: "failed", skipped: true });
  }

  if (!PDFSHIFT_API_KEY) {
    await markFailed(admin, proposal.id, "PDFSHIFT_API_KEY not configured");
    return json({ ok: false, pdf_status: "failed", error: "PDFSHIFT_API_KEY not configured" }, 200);
  }

  // Marca início da tentativa
  await admin
    .from("commercial_proposals")
    .update({
      pdf_status: "pending",
      pdf_error: null,
      pdf_processing_started_at: new Date().toISOString(),
      pdf_attempts: (Number(proposal.pdf_attempts) || 0) + 1,
    })
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
    return json({ ok: false, pdf_status: "failed", error: msg }, 200);
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
    return json({ ok: false, pdf_status: "failed", error: upErr.message }, 200);
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
    return json({ ok: false, pdf_status: "failed", error: updErr.message }, 200);
  }

  return json({ ok: true, pdf_path: path });
});
