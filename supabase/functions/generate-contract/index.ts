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

function buildEnderecoCompleto(lead: any): string {
  const parts: string[] = [];
  if (lead.endereco_rua) parts.push(lead.endereco_rua);
  if (lead.endereco_numero) parts.push(`nº ${lead.endereco_numero}`);
  if (lead.cidade) parts.push(lead.cidade);
  if (lead.endereco_estado) parts.push(lead.endereco_estado);
  if (lead.endereco_cep) parts.push(`CEP ${lead.endereco_cep}`);
  return parts.length > 0 ? parts.join(", ") : lead.cidade || "—";
}

/**
 * Extract all text from a PDF page's content stream to find placeholder positions.
 * Since pdf-lib cannot do text search/replace on existing PDFs, we use a different
 * approach: we create a NEW PDF that overlays white rectangles over the placeholder
 * areas and writes the replacement text on top.
 * 
 * However, this approach requires knowing the exact coordinates of placeholders,
 * which is template-specific. Instead, we'll use a form-fill approach:
 * We'll overlay the dynamic data at known positions in the template.
 */

// Template field positions - these are the coordinates where placeholders appear
// in the official Monnera contract template PDF.
// Format: { page, x, y, width, fontSize }
const TEMPLATE_FIELDS = {
  // Page 1 - Contract header area
  razao_social_1: { page: 0, x: 72, y: 687, maxWidth: 450, fontSize: 11 },
  cnpj: { page: 0, x: 72, y: 670, maxWidth: 300, fontSize: 11 },
  endereco: { page: 0, x: 72, y: 653, maxWidth: 450, fontSize: 11 },
  // These will be calibrated after first test
};

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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
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

    console.log("Lead data:", JSON.stringify({
      razao_social: lead.razao_social,
      cnpj: lead.cnpj,
      cidade: lead.cidade,
      endereco_rua: lead.endereco_rua,
      endereco_numero: lead.endereco_numero,
      endereco_estado: lead.endereco_estado,
      endereco_cep: lead.endereco_cep,
      numero_proposta: lead.numero_proposta,
    }));

    // Download template PDF from storage
    const { data: templateData, error: templateError } = await supabase.storage
      .from("propostas")
      .download("templates/contrato-padrao.pdf");
    if (templateError || !templateData) {
      throw new Error(
        "Template do contrato não encontrado: " +
          (templateError?.message || ""),
      );
    }

    const templateBytes = new Uint8Array(await templateData.arrayBuffer());
    console.log("Template PDF loaded, size:", templateBytes.length);

    // Load the template PDF
    const pdfDoc = await PDFDocument.load(templateBytes, { 
      ignoreEncryption: true,
      updateMetadata: false,
    });

    // Build replacement values
    const razaoSocial = lead.razao_social || "—";
    const cnpjFormatted = formatCNPJ(lead.cnpj || "");
    const enderecoCompleto = buildEnderecoCompleto(lead);
    const dataContrato = formatDateBR(new Date());
    const numeroProposta = lead.numero_proposta || "—";

    console.log("Replacement values:", JSON.stringify({
      razaoSocial,
      cnpjFormatted,
      enderecoCompleto,
      dataContrato,
      numeroProposta,
    }));

    // Strategy: Modify the PDF content streams directly to replace placeholder text
    // pdf-lib doesn't support text replacement natively, so we need to work with
    // the raw page content
    const pages = pdfDoc.getPages();
    
    // We need to iterate through each page's content and replace text
    // Since pdf-lib can't do find/replace, we'll use the raw PDF manipulation approach
    // but properly handle the PDF text encoding
    
    const replacements: [string, string][] = [
      ["razao social", razaoSocial],
      ["Numero cnpj", cnpjFormatted],
      ["endereco completo", enderecoCompleto],
      ["data do dia que o contrato foi gerado", dataContrato],
      ["numero da proposta comercial", numeroProposta],
      ["proposta monnera", numeroProposta],
    ];

    // Access the internal PDF structure to modify content streams
    const pdfRef = pdfDoc as any;
    const context = pdfRef.context;
    
    let totalReplacements = 0;
    
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const pageRef = page as any;
      const pageNode = pageRef.node;
      
      // Get the content stream(s) for this page
      const contentsRef = pageNode.get(context.obj("Contents") as any);
      if (!contentsRef) continue;
      
      // Handle both single stream and array of streams
      const contentRefs: any[] = [];
      if (contentsRef.constructor.name === "PDFArray") {
        for (let i = 0; i < contentsRef.size(); i++) {
          contentRefs.push(contentsRef.get(i));
        }
      } else {
        contentRefs.push(contentsRef);
      }
      
      for (const ref of contentRefs) {
        const stream = context.lookup(ref);
        if (!stream) continue;
        
        try {
          // Get the decoded content
          let contentBytes: Uint8Array;
          if (stream.constructor.name === "PDFRawStream") {
            contentBytes = stream.getContents();
          } else if (stream.constructor.name === "PDFFlateStream" || stream.decode) {
            contentBytes = stream.decode ? stream.decode() : stream.getContents();
          } else {
            contentBytes = stream.getContents();
          }
          
          // Convert to string
          let contentStr = new TextDecoder("latin1").decode(contentBytes);
          let modified = false;
          
          // Replace placeholder text in PDF content stream
          // PDF text appears in () within Tj/TJ operators
          for (const [search, replace] of replacements) {
            if (contentStr.includes(search)) {
              contentStr = contentStr.split(search).join(replace);
              modified = true;
              totalReplacements++;
              console.log(`Page ${pageIdx + 1}: Replaced "${search}" with "${replace}"`);
            }
          }
          
          if (modified) {
            // Create new content with the replacements
            const newContentBytes = new TextEncoder().encode(contentStr);
            
            // We need to create a new uncompressed stream
            // Remove any existing filter (FlateDecode) to avoid double-encoding issues
            const { PDFRawStream, PDFName, PDFNumber } = await import("https://esm.sh/pdf-lib@1.17.1");
            
            const newStream = PDFRawStream.of(
              new Map([
                [PDFName.of("Length"), PDFNumber.of(newContentBytes.length)],
              ]),
              newContentBytes
            );
            
            // Replace the stream in the context
            if (ref.constructor.name === "PDFRef") {
              context.assign(ref, newStream);
            }
          }
        } catch (streamError) {
          console.error(`Error processing stream on page ${pageIdx + 1}:`, streamError.message);
        }
      }
    }

    console.log(`Total replacements made: ${totalReplacements}`);

    // If no replacements were made with the direct approach, 
    // try an alternative: work with the raw PDF bytes
    if (totalReplacements === 0) {
      console.log("No replacements via pdf-lib internals, trying raw byte approach...");
      
      // Reload and try raw manipulation
      const rawPdf = new TextDecoder("latin1").decode(templateBytes);
      let modifiedPdf = rawPdf;
      let rawReplacements = 0;
      
      for (const [search, replace] of replacements) {
        if (modifiedPdf.includes(search)) {
          modifiedPdf = modifiedPdf.split(search).join(replace);
          rawReplacements++;
          console.log(`Raw: Replaced "${search}" with "${replace}"`);
        }
      }
      
      if (rawReplacements > 0) {
        console.log(`Raw replacements made: ${rawReplacements}`);
        const modifiedBytes = new TextEncoder().encode(modifiedPdf);
        
        // Upload this version instead
        const contractNum =
          lead.numero_proposta ||
          `MNR-${new Date().getFullYear()}-${lead_id.slice(0, 8).toUpperCase()}`;
        const filePath = `contratos/${lead_id}/${contractNum.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

        const { error: uploadError } = await supabase.storage
          .from("propostas")
          .upload(filePath, modifiedBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

        if (uploadError)
          throw new Error("Erro ao salvar contrato: " + uploadError.message);

        await supabase
          .from("leads")
          .update({
            contrato_url: filePath,
            numero_proposta: contractNum,
          } as any)
          .eq("id", lead_id);

        // Update contracts table
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
          JSON.stringify({
            contrato_url: filePath,
            numero_proposta: contractNum,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    console.log("Modified PDF size:", modifiedPdfBytes.length);

    // Generate contract filename
    const contractNum =
      lead.numero_proposta ||
      `MNR-${new Date().getFullYear()}-${lead_id.slice(0, 8).toUpperCase()}`;
    const filePath = `contratos/${lead_id}/${contractNum.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, modifiedPdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError)
      throw new Error("Erro ao salvar contrato: " + uploadError.message);

    // Update lead with contrato_url
    await supabase
      .from("leads")
      .update({
        contrato_url: filePath,
        numero_proposta: contractNum,
      } as any)
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
      JSON.stringify({
        contrato_url: filePath,
        numero_proposta: contractNum,
        replacements_made: totalReplacements,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("generate-contract error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
