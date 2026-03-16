import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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
  const meses = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

function buildEnderecoCompleto(lead: Record<string, unknown>): string {
  const parts: string[] = [];
  if (lead.endereco_rua) parts.push(String(lead.endereco_rua));
  if (lead.endereco_numero) parts.push(`n\u00BA ${lead.endereco_numero}`);
  if (lead.cidade) parts.push(String(lead.cidade));
  if (lead.endereco_estado) parts.push(String(lead.endereco_estado));
  if (lead.endereco_cep) parts.push(`CEP ${lead.endereco_cep}`);
  return parts.length > 0 ? parts.join(", ") : String(lead.cidade || "\u2014");
}

// Placeholder positions in the template PDF (page 1)
// These are calibrated for the official Monnera contract template
// The template is A4 (595.28 x 841.89 points)
// Placeholders are in the second paragraph of page 1:
// "(razao social) pessoa juridica... inscrita no CNPJ sob o nº (Numero cnpj) com sede/filial (endereco completo)"
// And on page 7: "Proposta Comercial Monnera nº (proposta monnera)"
const OVERLAYS = {
  // Page 1 - Company identification paragraph
  razao_social: { page: 0, x: 85, y: 621, width: 100, height: 12, fontSize: 9 },
  cnpj: { page: 0, x: 406, y: 609, width: 110, height: 12, fontSize: 9 },
  endereco: { page: 0, x: 112, y: 597, width: 250, height: 12, fontSize: 8 },
  // Page 7 - Proposta number  
  proposta: { page: 6, x: 368, y: 546, width: 120, height: 12, fontSize: 9 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("generate-contract: starting...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
    const { lead_id, debug } = body;
    if (!lead_id) throw new Error("lead_id e obrigatorio");

    const { data: lead, error: leadError } = await supabase
      .from("leads").select("*").eq("id", lead_id).single();
    if (leadError || !lead) throw new Error("Lead nao encontrado");

    console.log("Lead found:", lead.razao_social);

    const { data: templateData, error: templateError } = await supabase.storage
      .from("propostas").download("templates/contrato-padrao.pdf");
    if (templateError || !templateData) {
      throw new Error("Template nao encontrado: " + (templateError?.message || ""));
    }

    const templateBytes = new Uint8Array(await templateData.arrayBuffer());
    console.log("Template loaded:", templateBytes.length, "bytes");

    // Load PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    console.log("PDF pages:", pages.length);
    console.log("Page 1 size:", pages[0].getWidth(), "x", pages[0].getHeight());

    const razaoSocial = lead.razao_social || "\u2014";
    const cnpjFormatted = formatCNPJ(lead.cnpj || "");
    const enderecoCompleto = buildEnderecoCompleto(lead as Record<string, unknown>);
    const dataContrato = formatDateBR(new Date());
    const numeroProposta = lead.numero_proposta || "\u2014";

    console.log("Values:", JSON.stringify({ razaoSocial, cnpjFormatted, enderecoCompleto, numeroProposta }));

    // If debug mode, return page dimensions and overlay positions for calibration
    if (debug === true) {
      const pageInfo = pages.map((p, i) => ({
        page: i + 1,
        width: p.getWidth(),
        height: p.getHeight(),
      }));
      return new Response(
        JSON.stringify({ pages: pageInfo, overlays: OVERLAYS, values: { razaoSocial, cnpjFormatted, enderecoCompleto, numeroProposta } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Draw white rectangles over placeholder text, then write new text
    const white = rgb(1, 1, 1);
    const black = rgb(0, 0, 0);

    // Razao Social overlay
    if (pages.length > OVERLAYS.razao_social.page) {
      const p = pages[OVERLAYS.razao_social.page];
      const o = OVERLAYS.razao_social;
      const textWidth = fontBold.widthOfTextAtSize(razaoSocial, o.fontSize);
      p.drawRectangle({ x: o.x, y: o.y - 2, width: Math.max(o.width, textWidth + 4), height: o.height, color: white });
      p.drawText(razaoSocial, { x: o.x, y: o.y, size: o.fontSize, font: fontBold, color: black });
    }

    // CNPJ overlay
    if (pages.length > OVERLAYS.cnpj.page) {
      const p = pages[OVERLAYS.cnpj.page];
      const o = OVERLAYS.cnpj;
      const textWidth = font.widthOfTextAtSize(cnpjFormatted, o.fontSize);
      p.drawRectangle({ x: o.x, y: o.y - 2, width: Math.max(o.width, textWidth + 4), height: o.height, color: white });
      p.drawText(cnpjFormatted, { x: o.x, y: o.y, size: o.fontSize, font, color: black });
    }

    // Endereco overlay
    if (pages.length > OVERLAYS.endereco.page) {
      const p = pages[OVERLAYS.endereco.page];
      const o = OVERLAYS.endereco;
      const textWidth = font.widthOfTextAtSize(enderecoCompleto, o.fontSize);
      p.drawRectangle({ x: o.x, y: o.y - 2, width: Math.max(o.width, textWidth + 4), height: o.height, color: white });
      p.drawText(enderecoCompleto, { x: o.x, y: o.y, size: o.fontSize, font, color: black });
    }

    // Proposta overlay on page 7
    if (pages.length > OVERLAYS.proposta.page) {
      const p = pages[OVERLAYS.proposta.page];
      const o = OVERLAYS.proposta;
      const textWidth = font.widthOfTextAtSize(numeroProposta, o.fontSize);
      p.drawRectangle({ x: o.x, y: o.y - 2, width: Math.max(o.width, textWidth + 4), height: o.height, color: white });
      p.drawText(numeroProposta, { x: o.x, y: o.y, size: o.fontSize, font, color: black });
    }

    const modifiedBytes = await pdfDoc.save();
    console.log("Modified PDF size:", modifiedBytes.length);

    const contractNum = lead.numero_proposta ||
      `MNR-${new Date().getFullYear()}-${lead_id.slice(0, 8).toUpperCase()}`;
    const filePath = `contratos/${lead_id}/${contractNum.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, modifiedBytes, { contentType: "application/pdf", upsert: true });
    if (uploadError) throw new Error("Erro ao salvar: " + uploadError.message);

    await supabase.from("leads")
      .update({ contrato_url: filePath, numero_proposta: contractNum } as any)
      .eq("id", lead_id);

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

    console.log("Contract generated:", filePath);

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
