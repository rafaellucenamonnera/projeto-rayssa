import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  const dd = date.getDate();
  const mm = meses[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd} de ${mm} de ${yyyy}`;
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
 * Encode a JS string as latin-1 bytes.
 */
function stringToBytes(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) {
    arr[i] = s.charCodeAt(i) & 0xff;
  }
  return arr;
}

/**
 * Decode latin-1 bytes to a JS string.
 */
function bytesToString(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) {
    s += String.fromCharCode(b[i]);
  }
  return s;
}

/**
 * Replace text inside PDF content streams, handling FlateDecode compression.
 * This decompresses each stream, performs text replacement, and recompresses.
 */
async function replacePdfText(
  pdfBytes: Uint8Array,
  replacements: [string, string][],
): Promise<Uint8Array> {
  let pdfStr = bytesToString(pdfBytes);

  // Find all stream blocks (potentially compressed with FlateDecode)
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;

  // Track which streams use FlateDecode by looking at the preceding dictionary
  const result: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(pdfStr)) !== null) {
    const streamStart = match.index;
    const streamContent = match[1];
    const fullMatch = match[0];

    // Append everything before this stream
    result.push(pdfStr.substring(lastIndex, streamStart));

    // Look back to find if this stream uses FlateDecode
    const beforeStream = pdfStr.substring(Math.max(0, streamStart - 500), streamStart);
    const isFlateEncoded = /\/Filter\s*\/FlateDecode/.test(beforeStream);

    if (isFlateEncoded) {
      try {
        // Decompress
        const compressedBytes = stringToBytes(streamContent);
        const decompressed = new Blob([compressedBytes]);
        const ds = new DecompressionStream("deflate");
        const decompressedStream = decompressed.stream().pipeThrough(ds);
        const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
        let decompressedStr = bytesToString(new Uint8Array(decompressedBuffer));

        // Apply replacements on the decompressed text
        let modified = false;
        for (const [search, replace] of replacements) {
          if (decompressedStr.includes(search)) {
            decompressedStr = decompressedStr.split(search).join(replace);
            modified = true;
          }
        }

        if (modified) {
          // Recompress
          const uncompressedBytes = stringToBytes(decompressedStr);
          const blob = new Blob([uncompressedBytes]);
          const cs = new CompressionStream("deflate");
          const compressedStream = blob.stream().pipeThrough(cs);
          const recompressedBuffer = await new Response(compressedStream).arrayBuffer();
          const recompressedBytes = new Uint8Array(recompressedBuffer);
          const recompressedStr = bytesToString(recompressedBytes);

          // Update the /Length in the object dictionary before the stream
          const lastChunk = result[result.length - 1];
          const lengthRegex = /\/Length\s+(\d+)/g;
          let lengthMatch: RegExpExecArray | null;
          let lastLengthMatch: RegExpExecArray | null = null;
          while ((lengthMatch = lengthRegex.exec(lastChunk)) !== null) {
            lastLengthMatch = lengthMatch;
          }
          if (lastLengthMatch) {
            const newLength = recompressedBytes.length;
            const before = lastChunk.substring(0, lastLengthMatch.index);
            const after = lastChunk.substring(lastLengthMatch.index + lastLengthMatch[0].length);
            result[result.length - 1] = before + `/Length ${newLength}` + after;
          }

          result.push(`stream\n${recompressedStr}\nendstream`);
        } else {
          // No changes, keep original
          result.push(fullMatch);
        }
      } catch (_e) {
        // If decompression fails, keep original stream
        result.push(fullMatch);
      }
    } else {
      // Uncompressed stream - do direct replacement
      let newContent = streamContent;
      for (const [search, replace] of replacements) {
        newContent = newContent.split(search).join(replace);
      }
      if (newContent !== streamContent) {
        // Update length
        const lastChunk = result[result.length - 1];
        const lengthRegex = /\/Length\s+(\d+)/g;
        let lengthMatch: RegExpExecArray | null;
        let lastLengthMatch: RegExpExecArray | null = null;
        while ((lengthMatch = lengthRegex.exec(lastChunk)) !== null) {
          lastLengthMatch = lengthMatch;
        }
        if (lastLengthMatch) {
          const newLength = stringToBytes(newContent).length;
          const before = lastChunk.substring(0, lastLengthMatch.index);
          const after = lastChunk.substring(lastLengthMatch.index + lastLengthMatch[0].length);
          result[result.length - 1] = before + `/Length ${newLength}` + after;
        }
        result.push(`stream\n${newContent}\nendstream`);
      } else {
        result.push(fullMatch);
      }
    }

    lastIndex = streamStart + fullMatch.length;
  }

  // Append remaining content after last stream
  result.push(pdfStr.substring(lastIndex));

  const finalStr = result.join("");

  // Also do a final pass for any uncompressed text outside streams
  let finalResult = finalStr;
  for (const [search, replace] of replacements) {
    finalResult = finalResult.split(search).join(replace);
  }

  return stringToBytes(finalResult);
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

    // Build replacement values
    const razaoSocial = lead.razao_social || "—";
    const cnpjFormatted = formatCNPJ(lead.cnpj || "");
    const enderecoCompleto = buildEnderecoCompleto(lead);
    const dataContrato = formatDateBR(new Date());
    const numeroProposta = lead.numero_proposta || "—";

    // Apply replacements on the PDF template
    // These match exactly the placeholders in the official template
    const replacements: [string, string][] = [
      ["(razao social)", razaoSocial],
      ["(Numero cnpj)", cnpjFormatted],
      ["(endereco completo)", enderecoCompleto],
      ["(data do dia que o contrato foi gerado)", dataContrato],
      ["(numero da proposta comercial)", numeroProposta],
      ["(proposta monnera)", numeroProposta],
    ];

    const modifiedPdfBytes = await replacePdfText(templateBytes, replacements);

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
