import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  "https://monneracomercial.lovable.app",
  "https://monneraparceiros.lovable.app",
  "https://parceiros.monnera.com.br",
];

function isAllowedOrigin(origin: string) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.endsWith(".lovable.app")) return true;
  if (origin.startsWith("http://localhost:")) return true;
  if (origin.startsWith("http://127.0.0.1:")) return true;
  return false;
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function genCode() {
  const r = Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X");
  return `MNR${r}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      nome,
      cpf,
      email,
      senha,
      telefone_ddd,
      telefone_numero,
      slug_consultor,
      cliente_monnera,
      cliente_monnera_cnpj,
    } = body || {};

    const emailNorm = String(email || "").trim().toLowerCase();
    const cpfClean = String(cpf || "").replace(/\D/g, "");

    if (!nome || !cpfClean || !emailNorm || !senha || !telefone_ddd || !telefone_numero || !slug_consultor) {
      return json({ error: "missing_fields", message: "Dados obrigatórios ausentes." }, 400, corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Check existing parceiro by email or cpf
    const { data: existingParceiro, error: existErr } = await admin
      .from("parceiros_comerciais")
      .select("id, email, cpf, aprovado, user_id, codigo_parceiro")
      .or(`email.eq.${emailNorm},cpf.eq.${cpfClean}`)
      .maybeSingle();

    if (existErr && existErr.code !== "PGRST116") {
      console.error("lookup parceiro error", existErr);
    }

    if (existingParceiro?.aprovado) {
      return json(
        {
          error: "already_approved",
          message: "Já existe um cadastro de Embaixador aprovado para este e-mail/CPF. Faça login ou redefina sua senha.",
        },
        409,
        corsHeaders,
      );
    }

    // 2) Find or create auth user
    let userId: string | null = null;

    // Try sign-up first
    const { data: created, error: signUpErr } = await admin.auth.admin.createUser({
      email: emailNorm,
      password: senha,
      email_confirm: true,
    });

    if (created?.user) {
      userId = created.user.id;
    } else if (signUpErr) {
      const msg = (signUpErr.message || "").toLowerCase();
      const isExisting =
        msg.includes("already") || msg.includes("registered") || msg.includes("exists") ||
        (signUpErr as any).status === 422 || (signUpErr as any).code === "email_exists";

      if (!isExisting) {
        if (msg.includes("weak") || msg.includes("password")) {
          return json({ error: "weak_password", message: "Senha muito fraca. Escolha uma senha mais segura." }, 400, corsHeaders);
        }
        console.error("createUser error", signUpErr);
        return json({ error: "auth_create_failed", message: signUpErr.message }, 500, corsHeaders);
      }

      // Lookup existing auth user by email (pagination)
      let page = 1;
      const perPage = 200;
      while (!userId) {
        const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
        if (listErr) {
          console.error("listUsers error", listErr);
          return json({ error: "auth_lookup_failed", message: listErr.message }, 500, corsHeaders);
        }
        const found = list.users.find((u) => (u.email || "").toLowerCase() === emailNorm);
        if (found) {
          userId = found.id;
          break;
        }
        if (list.users.length < perPage) break;
        page += 1;
        if (page > 50) break;
      }

      if (!userId) {
        return json(
          { error: "auth_user_not_found", message: "Não foi possível localizar o usuário existente. Tente novamente ou redefina sua senha." },
          500,
          corsHeaders,
        );
      }
    } else {
      return json({ error: "auth_create_failed", message: "Falha ao criar usuário." }, 500, corsHeaders);
    }

    // 3) Upsert parceiros_comerciais
    let parceiro;
    if (existingParceiro) {
      const { data: updated, error: updErr } = await admin
        .from("parceiros_comerciais")
        .update({
          user_id: userId,
          nome,
          cpf: cpfClean,
          email: emailNorm,
          telefone_ddd,
          telefone_numero,
          slug_consultor,
          cliente_monnera: !!cliente_monnera,
          cliente_monnera_cnpj: cliente_monnera ? (cliente_monnera_cnpj || null) : null,
          ativo: true,
        })
        .eq("id", existingParceiro.id)
        .select("id, nome, codigo_parceiro, slug_consultor")
        .single();
      if (updErr) {
        console.error("update parceiro error", updErr);
        return json({ error: "parceiro_update_failed", message: updErr.message }, 500, corsHeaders);
      }
      parceiro = updated;
    } else {
      // Generate unique code
      let codigo_parceiro = "";
      for (let i = 0; i < 8; i++) {
        const c = genCode();
        const { data: exists } = await admin
          .from("parceiros_comerciais")
          .select("id")
          .eq("codigo_parceiro", c)
          .maybeSingle();
        if (!exists) {
          codigo_parceiro = c;
          break;
        }
      }
      if (!codigo_parceiro) {
        return json({ error: "code_generation_failed", message: "Falha gerando código." }, 500, corsHeaders);
      }

      const { data: inserted, error: insErr } = await admin
        .from("parceiros_comerciais")
        .insert({
          user_id: userId,
          codigo_parceiro,
          nome,
          cpf: cpfClean,
          email: emailNorm,
          telefone_ddd,
          telefone_numero,
          slug_consultor,
          cliente_monnera: !!cliente_monnera,
          cliente_monnera_cnpj: cliente_monnera ? (cliente_monnera_cnpj || null) : null,
          ativo: true,
          aprovado: false,
        })
        .select("id, nome, codigo_parceiro, slug_consultor")
        .single();

      if (insErr) {
        console.error("insert parceiro error", insErr);
        const m = (insErr.message || "").toLowerCase();
        if (m.includes("cpf")) return json({ error: "cpf_taken", message: "Este CPF ou CNPJ já está vinculado a um cadastro existente." }, 409, corsHeaders);
        if (m.includes("email")) return json({ error: "email_taken", message: "Este e-mail já possui cadastro." }, 409, corsHeaders);
        return json({ error: "parceiro_insert_failed", message: insErr.message }, 500, corsHeaders);
      }
      parceiro = inserted;
    }

    return json({ success: true, parceiro }, 200, corsHeaders);
  } catch (err) {
    console.error("register-partner error", err);
    return json({ error: "internal_error", message: "Erro interno." }, 500, corsHeaders);
  }
});
