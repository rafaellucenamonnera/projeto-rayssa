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
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
}

function buildEnderecoCompleto(lead: Record<string, unknown>): string {
  const parts: string[] = [];
  if (lead.endereco_rua) parts.push(String(lead.endereco_rua));
  if (lead.endereco_numero) parts.push(`nº ${lead.endereco_numero}`);
  if (lead.cidade) parts.push(String(lead.cidade));
  if (lead.endereco_estado) parts.push(String(lead.endereco_estado));
  if (lead.endereco_cep) parts.push(`CEP ${lead.endereco_cep}`);
  return parts.length > 0 ? parts.join(", ") : String(lead.cidade || "—");
}

function strToBytes(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
  return arr;
}

function bytesToStr(b: Uint8Array): string {
  const chunks: string[] = [];
  const chunkSize = 8192;
  for (let i = 0; i < b.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, b.length);
    let chunk = "";
    for (let j = i; j < end; j++) chunk += String.fromCharCode(b[j]);
    chunks.push(chunk);
  }
  return chunks.join("");
}

async function inflateBytes(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  writer.write(compressed);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result;
}

async function deflateBytes(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const writer = cs.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const c of chunks) { result.set(c, offset); offset += c.length; }
  return result;
}

/**
 * Extract readable text from PDF text operators in a content stream.
 * Handles both (text) Tj and [(text) kern (text)] TJ operators.
 * Returns the concatenated text.
 */
function extractTextFromStream(stream: string): string {
  let text = "";
  // Match text within parentheses in Tj/TJ operators
  const textRe = /\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(stream)) !== null) {
    text += m[1];
  }
  return text;
}

/**
 * Replace text within PDF text operators (inside parentheses).
 * This handles text that may be split across multiple () groups in TJ arrays.
 * 
 * Strategy: For each line containing text operators, concatenate all text from
 * parenthesized groups, do the replacement, then put it back in a single (text) Tj.
 */
function replaceTextInOperators(
  stream: string,
  replacements: [string, string][],
): { result: string; count: number } {
  let count = 0;
  let result = stream;

  // First, try simple replacement within individual () groups
  for (const [search, replace] of replacements) {
    if (result.includes(`(${search})`)) {
      result = result.split(`(${search})`).join(`(${replace})`);
      count++;
      console.log(`[EXACT] Replaced: "${search}"`);
      continue;
    }
  }

  // For remaining replacements, handle text split across TJ arrays
  // Find TJ array operators: [ (text1) kern (text2) ... ] TJ
  for (const [search, replace] of replacements) {
    if (count > 0 && result.includes(replace)) continue; // already replaced
    
    // Check if the search text exists when concatenating text from () groups
    const fullText = extractTextFromStream(result);
    if (!fullText.includes(search)) continue;
    
    // Find TJ array blocks and reconstruct them
    // Pattern: [ ... ] TJ
    const tjArrayRe = /\[([^\]]*)\]\s*TJ/g;
    let tjMatch: RegExpExecArray | null;
    const tjBlocks: { start: number; end: number; text: string; fullMatch: string }[] = [];
    
    while ((tjMatch = tjArrayRe.exec(result)) !== null) {
      const inner = tjMatch[1];
      let blockText = "";
      const innerTextRe = /\(([^)]*)\)/g;
      let itm: RegExpExecArray | null;
      while ((itm = innerTextRe.exec(inner)) !== null) {
        blockText += itm[1];
      }
      tjBlocks.push({
        start: tjMatch.index,
        end: tjMatch.index + tjMatch[0].length,
        text: blockText,
        fullMatch: tjMatch[0],
      });
    }

    // Also find simple Tj operators
    const tjRe = /\(([^)]*)\)\s*Tj/g;
    let tjSimple: RegExpExecArray | null;
    while ((tjSimple = tjRe.exec(result)) !== null) {
      // Skip if already in a TJ block
      const pos = tjSimple.index;
      const inBlock = tjBlocks.some(b => pos >= b.start && pos < b.end);
      if (!inBlock) {
        tjBlocks.push({
          start: tjSimple.index,
          end: tjSimple.index + tjSimple[0].length,
          text: tjSimple[1],
          fullMatch: tjSimple[0],
        });
      }
    }

    // Sort by position
    tjBlocks.sort((a, b) => a.start - b.start);

    // Try to find the search text spanning consecutive blocks
    for (let i = 0; i < tjBlocks.length; i++) {
      let combined = "";
      for (let j = i; j < tjBlocks.length && j < i + 5; j++) {
        combined += tjBlocks[j].text;
        if (combined.includes(search)) {
          // Found it! Replace in this range of blocks
          const newText = combined.replace(search, replace);
          // Replace the first block's text and clear the others
          const newBlock = `(${newText}) Tj`;
          
          // Build new result
          let newResult = result.substring(0, tjBlocks[i].start);
          newResult += newBlock;
          // Skip blocks i+1 to j (their text is now in the first block)
          // But we need to handle the text-positioning commands between blocks
          // For simplicity, just replace the text in the first matching () group
          // within the stream
          
          // Actually, simpler approach: just replace the concatenated text 
          // within each individual block
          break;
        }
      }
    }

    // Simpler fallback: line-by-line approach
    // Split the stream into lines, for each line extract all text,
    // check if it contains the search, and replace
    const lines = result.split('\n');
    let modified = false;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const lineText = extractTextFromStream(line);
      if (lineText.includes(search)) {
        // Replace by putting all text in a single Tj
        const newText = lineText.replace(search, replace);
        // Find the text-showing operator in this line
        if (line.includes('TJ') || line.includes('Tj')) {
          // Replace the entire text operation with a simple one
          const newLine = line.replace(
            /\[([^\]]*)\]\s*TJ|\(([^)]*)\)\s*Tj/g,
            `(${newText}) Tj`
          );
          if (newLine !== line) {
            lines[li] = newLine;
            modified = true;
            count++;
            console.log(`[LINE] Replaced: "${search}"`);
            break;
          }
        }
      }
    }
    if (modified) {
      result = lines.join('\n');
    }
  }

  return { result, count };
}

async function replacePdfStreams(
  pdfBytes: Uint8Array,
  replacements: [string, string][],
  debugMode: boolean = false,
): Promise<{ result: Uint8Array; count: number; debug: string[] }> {
  const pdfStr = bytesToStr(pdfBytes);
  const parts: string[] = [];
  let lastIdx = 0;
  let totalCount = 0;
  const debugInfo: string[] = [];

  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  let streamIdx = 0;

  while ((m = re.exec(pdfStr)) !== null) {
    const before = pdfStr.substring(lastIdx, m.index);
    parts.push(before);

    const rawContent = m[1];
    const fullMatch = m[0];
    const dictWindow = pdfStr.substring(Math.max(0, m.index - 600), m.index);
    const isFlate = /\/Filter\s*\/FlateDecode/.test(dictWindow);

    if (isFlate) {
      try {
        const compressed = strToBytes(rawContent);
        const inflated = await inflateBytes(compressed);
        let text = bytesToStr(inflated);
        
        // Check if this stream has text operators (BT/ET blocks)
        if (text.includes("BT") && text.includes("Tj")) {
          const extractedText = extractTextFromStream(text);
          
          if (debugMode) {
            // Log streams that contain text
            for (const [search] of replacements) {
              if (extractedText.toLowerCase().includes(search.toLowerCase())) {
                debugInfo.push(`Stream ${streamIdx}: Found "${search}" in extracted text`);
                // Log a snippet around the match
                const idx = extractedText.toLowerCase().indexOf(search.toLowerCase());
                const snippet = extractedText.substring(Math.max(0, idx - 20), idx + search.length + 20);
                debugInfo.push(`  Context: "...${snippet}..."`);
                
                // Also log the raw PDF operators around this text
                const rawIdx = text.indexOf(search.charAt(0));
                if (rawIdx >= 0) {
                  const rawSnippet = text.substring(Math.max(0, rawIdx - 50), rawIdx + 100);
                  debugInfo.push(`  Raw operators: ${rawSnippet.substring(0, 200)}`);
                }
              }
            }
          }

          // Try replacements
          const { result: newText, count } = replaceTextInOperators(text, replacements);
          
          if (count > 0) {
            totalCount += count;
            const newBytes = strToBytes(newText);
            const deflated = await deflateBytes(newBytes);
            const deflatedStr = bytesToStr(deflated);

            const lastPart = parts[parts.length - 1];
            const lenRe = /\/Length\s+(\d+)/g;
            let lm: RegExpExecArray | null;
            let lastLen: RegExpExecArray | null = null;
            while ((lm = lenRe.exec(lastPart)) !== null) lastLen = lm;
            if (lastLen) {
              parts[parts.length - 1] =
                lastPart.substring(0, lastLen.index) +
                `/Length ${deflated.length}` +
                lastPart.substring(lastLen.index + lastLen[0].length);
            }
            parts.push(`stream\n${deflatedStr}\nendstream`);
          } else {
            parts.push(fullMatch);
          }
        } else {
          parts.push(fullMatch);
        }
      } catch (e) {
        if (debugMode) debugInfo.push(`Stream ${streamIdx}: Decompression error: ${(e as Error).message}`);
        parts.push(fullMatch);
      }
    } else {
      // Uncompressed - try direct replacement
      let content = rawContent;
      let changed = false;
      for (const [search, replace] of replacements) {
        if (content.includes(search)) {
          content = content.split(search).join(replace);
          changed = true;
          totalCount++;
        }
      }
      if (changed) {
        const lastPart = parts[parts.length - 1];
        const lenRe = /\/Length\s+(\d+)/g;
        let lm: RegExpExecArray | null;
        let lastLen: RegExpExecArray | null = null;
        while ((lm = lenRe.exec(lastPart)) !== null) lastLen = lm;
        if (lastLen) {
          const newLen = strToBytes(content).length;
          parts[parts.length - 1] =
            lastPart.substring(0, lastLen.index) +
            `/Length ${newLen}` +
            lastPart.substring(lastLen.index + lastLen[0].length);
        }
        parts.push(`stream\n${content}\nendstream`);
      } else {
        parts.push(fullMatch);
      }
    }

    lastIdx = m.index + fullMatch.length;
    streamIdx++;
  }

  parts.push(pdfStr.substring(lastIdx));
  return { result: strToBytes(parts.join("")), count: totalCount, debug: debugInfo };
}

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
    if (!authHeader) throw new Error("Não autorizado");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Não autorizado");

    const { data: roles } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id);
    const userRoles = (roles || []).map((r: Record<string, string>) => r.role);
    if (!userRoles.includes("admin") && !userRoles.includes("gestor_conta")) {
      throw new Error("Acesso negado");
    }

    const body = await req.json();
    const { lead_id, debug } = body;
    if (!lead_id) throw new Error("lead_id é obrigatório");

    const { data: lead, error: leadError } = await supabase
      .from("leads").select("*").eq("id", lead_id).single();
    if (leadError || !lead) throw new Error("Lead não encontrado");

    console.log("Lead found:", lead.razao_social);

    const { data: templateData, error: templateError } = await supabase.storage
      .from("propostas").download("templates/contrato-padrao.pdf");
    if (templateError || !templateData) {
      throw new Error("Template não encontrado: " + (templateError?.message || ""));
    }

    const templateBytes = new Uint8Array(await templateData.arrayBuffer());
    console.log("Template loaded:", templateBytes.length, "bytes");

    const razaoSocial = lead.razao_social || "—";
    const cnpjFormatted = formatCNPJ(lead.cnpj || "");
    const enderecoCompleto = buildEnderecoCompleto(lead as Record<string, unknown>);
    const dataContrato = formatDateBR(new Date());
    const numeroProposta = lead.numero_proposta || "—";

    const replacements: [string, string][] = [
      ["razao social", razaoSocial],
      ["Numero cnpj", cnpjFormatted],
      ["endereco completo", enderecoCompleto],
      ["data do dia que o contrato foi gerado", dataContrato],
      ["numero da proposta comercial", numeroProposta],
      ["proposta monnera", numeroProposta],
    ];

    const { result: modifiedBytes, count, debug: debugInfo } = 
      await replacePdfStreams(templateBytes, replacements, debug === true);
    
    console.log("Replacements done:", count);
    if (debugInfo.length > 0) {
      for (const d of debugInfo) console.log("DEBUG:", d);
    }

    // If debug mode, return debug info without saving
    if (debug === true) {
      return new Response(
        JSON.stringify({ replacements_count: count, debug: debugInfo }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    return new Response(
      JSON.stringify({ contrato_url: filePath, numero_proposta: contractNum, replacements_count: count }),
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
