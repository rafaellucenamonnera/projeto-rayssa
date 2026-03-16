import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import PizZip from "https://esm.sh/pizzip@3.1.7";
import Docxtemplater from "https://esm.sh/docxtemplater@3.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatCNPJ(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function buildEnderecoCompleto(lead: Record<string, unknown>): string {
  const parts: string[] = [];
  if (lead.endereco_rua) parts.push(String(lead.endereco_rua));
  if (lead.endereco_numero) parts.push(String(lead.endereco_numero));
  if (lead.cidade) parts.push(String(lead.cidade));
  if (lead.endereco_estado) parts.push(String(lead.endereco_estado));
  if (lead.endereco_cep) parts.push(String(lead.endereco_cep));
  return parts.length > 0 ? parts.join(" - ") : "—";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-contract: starting (DOCX mode)...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Nao autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Nao autorizado");

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: Record<string, string>) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("gestor_conta")) {
      throw new Error("Acesso negado");
    }

    const body = await req.json();
    const { lead_id } = body;
    if (!lead_id) throw new Error("lead_id e obrigatorio");

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from("leads").select("*").eq("id", lead_id).single();
    if (leadError || !lead) throw new Error("Lead nao encontrado");

    console.log("Lead found:", lead.razao_social || lead.nome_fantasia);

    // Validate required fields
    const missing: string[] = [];
    if (!lead.razao_social) missing.push("Razão Social");
    if (!lead.nome_responsavel) missing.push("Responsável");
    if (!lead.email_responsavel) missing.push("Email");
    if (!lead.telefone_responsavel) missing.push("Telefone");
    if (missing.length > 0) {
      throw new Error(`Campos obrigatórios faltando: ${missing.join(", ")}. O cliente precisa preencher o formulário de conversão primeiro.`);
    }

    // Fetch lojas for multi-CNPJ support
    const { data: lojas } = await supabase
      .from("lojas").select("cnpj, razao_social, nome_interno").eq("lead_id", lead_id);

    // Build CNPJ string: if lojas exist, join all CNPJs; otherwise use lead CNPJ
    let cnpjFormatted: string;
    if (lojas && lojas.length > 0) {
      cnpjFormatted = lojas.map((l: any) => formatCNPJ(l.cnpj)).join(", ");
    } else if (lead.cnpj) {
      cnpjFormatted = formatCNPJ(lead.cnpj);
    } else {
      cnpjFormatted = "—";
    }

    // Download DOCX template
    const { data: templateData, error: templateError } = await supabase.storage
      .from("propostas")
      .download("templates/contrato-padrao.docx");
    if (templateError || !templateData) {
      throw new Error("Template DOCX nao encontrado no storage (propostas/templates/contrato-padrao.docx). Faça upload do template primeiro.");
    }

    const templateBytes = await templateData.arrayBuffer();
    console.log("Template DOCX loaded:", templateBytes.byteLength, "bytes");

    // Prepare data for placeholders
    const razaoSocial = lead.razao_social || lead.nome_fantasia || "—";
    const enderecoCompleto = buildEnderecoCompleto(lead as Record<string, unknown>);
    const numeroProposta = lead.numero_proposta || "—";
    const dataGeracao = formatDateBR(new Date());

    console.log("Values:", JSON.stringify({ razaoSocial, cnpjFormatted, enderecoCompleto, numeroProposta, dataGeracao }));

    // Process DOCX with docxtemplater
    const zip = new PizZip(templateBytes);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: "{", end: "}" },
    });

    doc.render({
      "Razão Social": razaoSocial,
      "CNPJ": cnpjFormatted,
      "ENDERECO COMPLETO": enderecoCompleto,
      "Número da Proposta": numeroProposta,
      "DATA DE GERAÇÃO DO CONTRATO": dataGeracao,
      "RAZAO SOCIAL": razaoSocial,
      "DATA DE GERACAO DO CONTRATO": dataGeracao,
      "Razao Social": razaoSocial,
      "Numero da Proposta": numeroProposta,
    });

    const outputBuffer = doc.getZip().generate({ type: "uint8array" });
    console.log("Generated DOCX size:", outputBuffer.length);

    // Save to storage
    const contractNum = lead.numero_proposta ||
      `MNR-${new Date().getFullYear()}-${lead_id.slice(0, 8).toUpperCase()}`;
    const safeNum = contractNum.replace(/[^a-zA-Z0-9-]/g, "_");
    const filePath = `contratos/${lead_id}/${safeNum}.docx`;

    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, outputBuffer, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (uploadError) throw new Error("Erro ao salvar: " + uploadError.message);

    // Update lead record
    await supabase.from("leads")
      .update({ contrato_url: filePath, numero_proposta: contractNum } as any)
      .eq("id", lead_id);

    // Upsert contracts table
    const { data: existing } = await supabase
      .from("contracts").select("id").eq("lead_id", lead_id).maybeSingle();

    const contractData = {
      numero_proposta: numeroProposta,
      contrato_pdf_url: filePath,
      arquivo_proposta_url: lead.proposta_url || null,
      data_geracao: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from("contracts").update(contractData as any).eq("id", existing.id);
    } else {
      await supabase.from("contracts").insert({ lead_id, ...contractData } as any);
    }

    console.log("Contract DOCX generated:", filePath);

    return new Response(
      JSON.stringify({ contrato_url: filePath, numero_proposta: contractNum }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("generate-contract error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
