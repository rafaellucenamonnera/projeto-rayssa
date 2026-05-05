import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://monneracomercial.lovable.app',
  'https://monneraparceiros.lovable.app',
  'https://parceiros.monnera.com.br',
];

function isAllowedOrigin(origin: string) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith('.lovable.app')) return true;
  if (origin.startsWith('http://localhost:')) return true;
  if (origin.startsWith('http://127.0.0.1:')) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Vary': 'Origin',
  };
}

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

function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Auth check
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

    const { lead_id } = await req.json();
    if (!lead_id) throw new Error("lead_id é obrigatório");

    // Fetch lead
    const { data: lead, error: leadError } = await supabase
      .from("leads").select("*").eq("id", lead_id).single();
    if (leadError || !lead) throw new Error("Lead não encontrado");

    // Fetch lojas
    const { data: lojas } = await supabase
      .from("lojas").select("cnpj, razao_social, nome_interno").eq("lead_id", lead_id);

    // Fetch parceiro (consultor)
    const { data: parceiro } = await supabase
      .from("parceiros_comerciais").select("nome, email, telefone_ddd, telefone_numero")
      .eq("id", lead.parceiro_id).maybeSingle();

    // Build DOCX-like text content as a simple structured text file
    const dataAssinatura = lead.data_contrato_assinado
      ? formatDateBR(new Date(lead.data_contrato_assinado))
      : formatDateBR(new Date());

    // Build CNPJs
    let cnpjList = "—";
    if (lojas && lojas.length > 0) {
      cnpjList = lojas.map((l: any) => `${formatCNPJ(l.cnpj)} - ${l.razao_social} (${l.nome_interno})`).join("\n");
    } else if (lead.cnpj) {
      cnpjList = formatCNPJ(lead.cnpj);
    }

    const consultorNome = parceiro?.nome || "—";
    const consultorTel = parceiro ? `(${parceiro.telefone_ddd}) ${parceiro.telefone_numero}` : "—";
    const consultorEmail = parceiro?.email || "—";

    // Generate dossiê content
    const content = `
=====================================
   DOSSIÊ COMERCIAL MONNERA
=====================================

Gerado em: ${formatDateBR(new Date())}

-------------------------------------
DADOS DO CLIENTE
-------------------------------------
Nome Fantasia: ${lead.nome_fantasia || "—"}
Razão Social: ${lead.razao_social || "—"}
CNPJ: ${lead.cnpj ? formatCNPJ(lead.cnpj) : "—"}

Endereço: ${lead.endereco_rua || "—"}, ${lead.endereco_numero || "S/N"}
Cidade: ${lead.cidade || "—"} - ${lead.endereco_estado || "—"}
CEP: ${lead.endereco_cep || "—"}

-------------------------------------
RESPONSÁVEL PELA ASSINATURA
-------------------------------------
Nome: ${lead.nome_responsavel || "—"}
Telefone: ${formatPhone(lead.telefone_responsavel || "")}
E-mail: ${lead.email_responsavel || "—"}

-------------------------------------
CONSULTOR RESPONSÁVEL
-------------------------------------
Nome: ${consultorNome}
Telefone: ${consultorTel}
E-mail: ${consultorEmail}

-------------------------------------
INFORMAÇÕES DE IMPLANTAÇÃO
-------------------------------------
Sistema de loja: ${lead.erp_utilizado || "—"}
Número de lojas: ${lead.quantidade_lojas || 1}
Data da assinatura do contrato: ${dataAssinatura}

Responsável técnico pela instalação
  Nome: ${lead.responsavel_tecnico_nome || "—"}
  Telefone: ${formatPhone(lead.responsavel_tecnico_telefone || "")}
  E-mail: ${lead.responsavel_tecnico_email || "—"}

Responsável comercial pelas campanhas
  Nome: ${lead.responsavel_comercial_nome || "—"}
  Telefone: ${formatPhone(lead.responsavel_comercial_telefone || "")}
  E-mail: ${lead.responsavel_comercial_email || "—"}

Responsável pelo RH
  Nome: ${lead.responsavel_rh_nome || "—"}
  Telefone: ${formatPhone(lead.responsavel_rh_telefone || "")}
  E-mail: ${lead.responsavel_rh_email || "—"}

-------------------------------------
ESTRUTURA DE LOJAS
-------------------------------------
${lojas && lojas.length > 0
  ? lojas.map((l: any, i: number) => `Loja ${i + 1}:\n  CNPJ: ${formatCNPJ(l.cnpj)}\n  Razão Social: ${l.razao_social}\n  Nome Interno: ${l.nome_interno}`).join("\n\n")
  : "Loja única (dados no cadastro principal)"}

-------------------------------------
NÚMERO DA PROPOSTA
-------------------------------------
${lead.numero_proposta || "—"}

=====================================
    FIM DO DOSSIÊ COMERCIAL
=====================================
`.trim();

    // Upload as text file
    const safeName = (lead.nome_fantasia || "lead").replace(/[^a-zA-Z0-9-]/g, "_");
    const filePath = `dossies/${lead_id}/dossie-${safeName}.txt`;

    const encoder = new TextEncoder();
    const fileBytes = encoder.encode(content);

    const { error: uploadError } = await supabase.storage
      .from("propostas")
      .upload(filePath, fileBytes, {
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      });
    if (uploadError) throw new Error("Erro ao salvar dossiê: " + uploadError.message);

    // Update lead with data_contrato_assinado if not set
    if (!lead.data_contrato_assinado) {
      await supabase.from("leads")
        .update({ data_contrato_assinado: new Date().toISOString() } as any)
        .eq("id", lead_id);
    }

    console.log("Dossiê gerado:", filePath);

    return new Response(
      JSON.stringify({ dossie_url: filePath }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("generate-dossie error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
