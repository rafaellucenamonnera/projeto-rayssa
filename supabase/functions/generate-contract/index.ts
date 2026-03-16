import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import pako from "https://esm.sh/pako@2.1.0";

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

/** Encode JS string as latin-1 bytes */
function strToBytes(s: string): Uint8Array {
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i) & 0xff;
  return arr;
}

/** Decode latin-1 bytes to JS string */
function bytesToStr(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/**
 * Walk through the raw PDF, find every stream...endstream block,
 * decompress if FlateDecode, do text replacements, recompress, reassemble.
 */
function replacePdfStreams(
  pdfBytes: Uint8Array,
  replacements: [string, string][],
): Uint8Array {
  const pdfStr = bytesToStr(pdfBytes);
  const parts: string[] = [];
  let lastIdx = 0;
  let totalReplacements = 0;

  // Match stream blocks
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(pdfStr)) !== null) {
    const before = pdfStr.substring(lastIdx, m.index);
    parts.push(before);

    const rawContent = m[1];
    const fullMatch = m[0];

    // Check if FlateDecode in the dictionary before this stream
    const dictWindow = pdfStr.substring(Math.max(0, m.index - 600), m.index);
    const isFlate = /\/Filter\s*\/FlateDecode/.test(dictWindow);

    if (isFlate) {
      try {
        const compressed = strToBytes(rawContent);
        const inflated = pako.inflate(compressed);
        let text = bytesToStr(inflated);
        let changed = false;

        for (const [search, replace] of replacements) {
          if (text.includes(search)) {
            text = text.split(search).join(replace);
            changed = true;
            totalReplacements++;
            console.log(`Replaced placeholder: "${search}"`);
          }
        }

        if (changed) {
          const newBytes = strToBytes(text);
          const deflated = pako.deflate(newBytes);
          const deflatedStr = bytesToStr(deflated);

          // Update /Length in the preceding dictionary
          const lastPart = parts[parts.length - 1];
          const lenRe = /\/Length\s+(\d+)/g;
          let lm: RegExpExecArray | null;
          let lastLen: RegExpExecArray | null = null;
          while ((lm = lenRe.exec(lastPart)) !== null) lastLen = lm;

          if (lastLen) {
            const pre = lastPart.substring(0, lastLen.index);
            const post = lastPart.substring(lastLen.index + lastLen[0].length);
            parts[parts.length - 1] = pre + `/Length ${deflated.length}` + post;
          }

          parts.push(`stream\n${deflatedStr}\nendstream`);
        } else {
          parts.push(fullMatch);
        }
      } catch (e) {
        console.log(`Could not decompress stream: ${(e as Error).message}`);
        parts.push(fullMatch);
      }
    } else {
      // Uncompressed stream
      let content = rawContent;
      let changed = false;
      for (const [search, replace] of replacements) {
        if (content.includes(search)) {
          content = content.split(search).join(replace);
          changed = true;
          totalReplacements++;
          console.log(`Replaced (uncompressed): "${search}"`);
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
          const pre = lastPart.substring(0, lastLen.index);
          const post = lastPart.substring(lastLen.index + lastLen[0].length);
          parts[parts.length - 1] = pre + `/Length ${newLen}` + post;
        }
        parts.push(`stream\n${content}\nendstream`);
      } else {
        parts.push(fullMatch);
      }
    }

    lastIdx = m.index + fullMatch.length;
  }

  parts.push(pdfStr.substring(lastIdx));
  console.log(`Total stream replacements: ${totalReplacements}`);

  return strToBytes(parts.join(""));
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

    console.log("Lead:", lead.razao_social, lead.cnpj);

    // Download template PDF
    const { data: templateData, error: templateError } = await supabase.storage
      .from("propostas")
      .download("templates/contrato-padrao.pdf");
    if (templateError || !templateData) {
      throw new Error("Template não encontrado: " + (templateError?.message || ""));
    }

    const templateBytes = new Uint8Array(await templateData.arrayBuffer());
    console.log("Template size:", templateBytes.length);

    // Build replacements
    const razaoSocial = lead.razao_social || "—";
    const cnpjFormatted = formatCNPJ(lead.cnpj || "");
    const enderecoCompleto = buildEnderecoCompleto(lead);
    const dataContrato = formatDateBR(new Date());
    const numeroProposta = lead.numero_proposta || "—";

    console.log("Values:", JSON.stringify({ razaoSocial, cnpjFormatted, enderecoCompleto, dataContrato, numeroProposta }));

    // These placeholders match exactly what's in the template PDF
    const replacements: [string, string][] = [
      ["razao social", razaoSocial],
      ["Numero cnpj", cnpjFormatted],
      ["endereco completo", enderecoCompleto],
      ["data do dia que o contrato foi gerado", dataContrato],
      ["numero da proposta comercial", numeroProposta],
      ["proposta monnera", numeroProposta],
    ];

    const modifiedBytes = replacePdfStreams(templateBytes, replacements);
    console.log("Modified PDF size:", modifiedBytes.length);

    // Generate filename
    const contractNum = lead.numero_proposta ||
      `MNR-${new Date().getFullYear()}-${lead_id.slice(0, 8).toUpperCase()}`;
    const filePath = `contratos/${lead_id}/${contractNum.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;

    // Upload
    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, modifiedBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadError) throw new Error("Erro ao salvar: " + uploadError.message);

    // Update lead
    await supabase
      .from("leads")
      .update({ contrato_url: filePath, numero_proposta: contractNum } as any)
      .eq("id", lead_id);

    // Update contracts table
    const { data: existing } = await supabase
      .from("contracts")
      .select("id")
      .eq("lead_id", lead_id)
      .maybeSingle();

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
      JSON.stringify({ contrato_url: filePath, numero_proposta: contractNum }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("generate-contract error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
