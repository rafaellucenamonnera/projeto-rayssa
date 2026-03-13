import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore - pdf-lib works in Deno
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    // Fetch lead with partner
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    if (leadError || !lead) throw new Error("Lead não encontrado");

    const { data: parceiro } = await supabase
      .from("parceiros_comerciais")
      .select("nome, email, cpf, telefone_ddd, telefone_numero")
      .eq("id", lead.parceiro_id)
      .single();

    // Generate PDF contract
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 60;
    let currentY = pageHeight - margin;

    const addPage = () => {
      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
      return page;
    };

    const drawText = (page: any, text: string, x: number, y: number, size = 10, useBold = false) => {
      page.drawText(text, {
        x,
        y,
        size,
        font: useBold ? fontBold : font,
        color: rgb(0.1, 0.1, 0.1),
      });
    };

    const wrapText = (text: string, maxWidth: number, fontSize: number): string[] => {
      const words = text.split(" ");
      const lines: string[] = [];
      let currentLine = "";
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const width = font.widthOfTextAtSize(testLine, fontSize);
        if (width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    // Page 1 - Header
    let page = addPage();
    const today = new Date();
    const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const contractNum = lead.numero_proposta || `MNR-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${lead_id.slice(0, 6).toUpperCase()}`;

    drawText(page, "MONNERA", margin, currentY, 24, true);
    currentY -= 20;
    drawText(page, "Plataforma de Campanhas de Incentivo", margin, currentY, 10);
    currentY -= 40;

    // Line
    page.drawLine({ start: { x: margin, y: currentY }, end: { x: pageWidth - margin, y: currentY }, thickness: 1, color: rgb(0.2, 0.6, 0.4) });
    currentY -= 30;

    drawText(page, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS", margin, currentY, 16, true);
    currentY -= 20;
    drawText(page, `Contrato nº: ${contractNum}`, margin, currentY, 10);
    currentY -= 15;
    drawText(page, `Data: ${dateStr}`, margin, currentY, 10);
    currentY -= 40;

    // Company details
    drawText(page, "DADOS DA CONTRATANTE", margin, currentY, 12, true);
    currentY -= 25;

    const fields = [
      ["Nome Fantasia", lead.nome_fantasia],
      ["Razão Social", lead.razao_social],
      ["CNPJ", lead.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")],
      ["Cidade", lead.cidade],
      ["Quantidade de Lojas", String(lead.quantidade_lojas)],
      ["ERP / Sistema", lead.erp_utilizado],
      ["Responsável", lead.nome_responsavel],
      ["Telefone", lead.telefone_responsavel],
      ["Email", lead.email_responsavel],
    ];

    for (const [label, value] of fields) {
      drawText(page, `${label}:`, margin, currentY, 9, true);
      drawText(page, String(value || "—"), margin + 130, currentY, 9);
      currentY -= 18;
    }

    if (lead.quantidade_funcionarios) {
      drawText(page, "Qtd Funcionários:", margin, currentY, 9, true);
      drawText(page, String(lead.quantidade_funcionarios), margin + 130, currentY, 9);
      currentY -= 18;
    }

    currentY -= 20;

    // Consultant details
    if (parceiro) {
      drawText(page, "CONSULTOR COMERCIAL", margin, currentY, 12, true);
      currentY -= 25;

      const consultorFields = [
        ["Nome", parceiro.nome],
        ["Email", parceiro.email],
        ["CPF", parceiro.cpf],
        ["Telefone", `(${parceiro.telefone_ddd}) ${parceiro.telefone_numero}`],
      ];

      for (const [label, value] of consultorFields) {
        drawText(page, `${label}:`, margin, currentY, 9, true);
        drawText(page, String(value || "—"), margin + 130, currentY, 9);
        currentY -= 18;
      }
      currentY -= 20;
    }

    // Financial
    if (lead.valor_mensalidade) {
      drawText(page, "VALORES", margin, currentY, 12, true);
      currentY -= 25;
      const formatBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
      drawText(page, "Mensalidade:", margin, currentY, 9, true);
      drawText(page, formatBRL(lead.valor_mensalidade), margin + 130, currentY, 9);
      currentY -= 18;
      if (lead.valor_campanhas) {
        drawText(page, "Valor Campanhas:", margin, currentY, 9, true);
        drawText(page, formatBRL(lead.valor_campanhas), margin + 130, currentY, 9);
        currentY -= 18;
      }
      currentY -= 20;
    }

    // Terms
    drawText(page, "TERMOS E CONDIÇÕES", margin, currentY, 12, true);
    currentY -= 25;

    const terms = [
      "1. A CONTRATANTE declara interesse em utilizar a plataforma Monnera para gestão de campanhas de incentivo comercial.",
      "2. Os serviços incluem acesso à plataforma, suporte técnico e consultoria para configuração de campanhas.",
      "3. O prazo do contrato será definido conforme proposta comercial enviada e aceita pela CONTRATANTE.",
      "4. Os valores acordados estão sujeitos a reajuste anual conforme índice IGPM ou equivalente.",
      "5. A CONTRATANTE se compromete a fornecer informações verídicas para a correta operação da plataforma.",
      "6. O presente contrato poderá ser rescindido por qualquer das partes mediante aviso prévio de 30 dias.",
    ];

    for (const term of terms) {
      const lines = wrapText(term, pageWidth - 2 * margin, 9);
      for (const line of lines) {
        if (currentY < margin + 40) {
          page = addPage();
        }
        drawText(page, line, margin, currentY, 9);
        currentY -= 15;
      }
      currentY -= 5;
    }

    // Signature area
    if (currentY < margin + 120) {
      page = addPage();
    }
    currentY -= 40;

    page.drawLine({ start: { x: margin, y: currentY }, end: { x: pageWidth / 2 - 20, y: currentY }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    drawText(page, "CONTRATANTE", margin, currentY - 15, 8);
    drawText(page, lead.nome_responsavel, margin, currentY - 28, 8);

    page.drawLine({ start: { x: pageWidth / 2 + 20, y: currentY }, end: { x: pageWidth - margin, y: currentY }, thickness: 0.5, color: rgb(0.3, 0.3, 0.3) });
    drawText(page, "MONNERA", pageWidth / 2 + 20, currentY - 15, 8);

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    // Upload to storage
    const filePath = `contratos/${lead_id}/${contractNum.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw new Error("Erro ao salvar contrato: " + uploadError.message);

    // Update lead with contrato_url
    await supabase
      .from("leads")
      .update({ contrato_url: filePath, numero_proposta: contractNum } as any)
      .eq("id", lead_id);

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
