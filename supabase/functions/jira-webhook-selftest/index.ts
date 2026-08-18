import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Teste de entrega do webhook Jira: dispara um ping válido e um ping com segredo
// inválido, sem expor o segredo e sem tocar em nenhum card.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const secret = Deno.env.get("JIRA_WEBHOOK_SECRET") ?? "";
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/jira-code-webhook`;
  const body = JSON.stringify({ ping: true });

  const call = async (value: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-jira-webhook-secret": value },
      body,
    });
    return { status: res.status, body: await res.text() };
  };

  const valido = secret ? await call(secret) : { status: 0, body: "JIRA_WEBHOOK_SECRET ausente" };
  const invalido = await call("segredo-incorreto-para-teste");

  return new Response(JSON.stringify({ valido, invalido }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
