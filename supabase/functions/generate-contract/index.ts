import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function buildEnderecoCompleto(lead: any): string {
  const parts: string[] = [];
  if (lead.endereco_rua) parts.push(lead.endereco_rua);
  if (lead.endereco_numero) parts.push(lead.endereco_numero);
  if (lead.cidade) parts.push(lead.cidade);
  if (lead.endereco_estado) parts.push(lead.endereco_estado);
  if (lead.endereco_cep) parts.push(`CEP ${lead.endereco_cep}`);
  return parts.length > 0 ? parts.join(", ") : lead.cidade || "—";
}

/**
 * Replace text in PDF content streams by manipulating raw bytes.
 * Works for Latin-1 encoded text strings in PDF.
 */
function replacePdfText(pdfBytes: Uint8Array, replacements: [string, string][]): Uint8Array {
  // Convert to latin1 string for text manipulation
  let pdfString = "";
  for (let i = 0; i < pdfBytes.length; i++) {
    pdfString += String.fromCharCode(pdfBytes[i]);
  }

  for (const [search, replace] of replacements) {
    // PDF text can be encoded in parentheses like (text) Tj
    // We need to handle potential encoding issues
    // Try direct replacement first
    pdfString = pdfString.split(search).join(replace);
  }

  // Convert back to bytes
  const result = new Uint8Array(pdfString.length);
  for (let i = 0; i < pdfString.length; i++) {
    result[i] = pdfString.charCodeAt(i) & 0xFF;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Não autorizado");

    // Check role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("gestor_conta")) {
      throw new Error("Acesso negado");
    }

    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("lead_id é obrigatório");

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    if (leadError || !lead) throw new Error("Lead não encontrado");

    // Download template PDF from storage
    const { data: templateData, error: templateError } = await supabase.storage
      .from("propostas")
      .download("templates/contrato-padrao.pdf");
    if (templateError || !templateData) {
      throw new Error("Template do contrato não encontrado: " + (templateError?.message || ""));
    }

    const templateBytes = new Uint8Array(await templateData.arrayBuffer());

    // Build replacement values
    const razaoSocial = lead.razao_social || "—";
    const cnpjFormatted = formatCNPJ(lead.cnpj || "");
    const enderecoCompleto = buildEnderecoCompleto(lead);
    const dataContrato = formatDate(new Date());
    const numeroProposta = lead.numero_proposta || "—";

    // Apply replacements on the PDF template
    const replacements: [string, string][] = [
      ["(razao social)", razaoSocial],
      ["(Numero cnpj)", cnpjFormatted],
      ["(endereco completo)", enderecoCompleto],
      ["(data do dia que o contrato foi gerado)", dataContrato],
      ["(numero da proposta comercial)", numeroProposta],
      ["(proposta monnera)", numeroProposta],
    ];

    const modifiedPdfBytes = replacePdfText(templateBytes, replacements);

    // Generate contract filename
    const contractNum = lead.numero_proposta || `MNR-${new Date().getFullYear()}-${lead_id.slice(0, 8).toUpperCase()}`;
    const filePath = `contratos/${lead_id}/${contractNum.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, modifiedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new Error("Erro ao salvar contrato: " + uploadError.message);

    // Update lead with contrato_url
    await supabase
      .from("leads")
      .update({ contrato_url: filePath, numero_proposta: contractNum } as any)
      .eq("id", lead_id);

    // Also create/update contracts table record
    const { data: existingContract } = await supabase
      .from("contracts")
      .select("id")
      .eq("lead_id", lead_id)
      .maybeSingle();

    if (existingContract) {
      await supabase
        .from("contracts")
        .update({
          numero_proposta: numeroProposta,
          contrato_pdf_url: filePath,
          arquivo_proposta_url: lead.proposta_url || null,
          data_geracao: new Date().toISOString(),
        } as any)
        .eq("id", existingContract.id);
    } else {
      await supabase
        .from("contracts")
        .insert({
          lead_id: lead_id,
          numero_proposta: numeroProposta,
          contrato_pdf_url: filePath,
          arquivo_proposta_url: lead.proposta_url || null,
        } as any);
    }

    return new Response(
      JSON.stringify({ contrato_url: filePath, numero_proposta: contractNum }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
