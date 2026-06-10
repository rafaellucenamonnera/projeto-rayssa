import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { formatCNPJ, formatDocumento, validateCNPJ, validateDocumento, validateEmail } from "@/lib/validators";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Loader2, Network, ShieldCheck, Sparkles } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type ClienteMonnera = "sim" | "nao" | "";

const CadastroParceiro = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const perfil = searchParams.get("perfil");
  const initialClienteMonnera: ClienteMonnera =
    perfil === "cliente-embaixador" ? "sim" : perfil === "embaixador-comercial" ? "nao" : "";
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone_ddd: "",
    telefone_numero: "",
    email: "",
    senha: "",
    confirmar_senha: "",
    cliente_monnera: initialClienteMonnera,
    cliente_monnera_cnpj: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = "Nome é obrigatório";
    if (!validateDocumento(form.cpf)) errs.cpf = "Documento inválido. Informe um CPF ou CNPJ válido.";
    if (!/^\d{2}$/.test(form.telefone_ddd)) errs.telefone_ddd = "DDD inválido";
    if (!/^\d{9}$/.test(form.telefone_numero)) errs.telefone_numero = "Número inválido";
    if (!validateEmail(form.email)) errs.email = "Email inválido";
    if (!form.senha || form.senha.length < 6) errs.senha = "Mínimo 6 caracteres";
    if (form.senha !== form.confirmar_senha) errs.confirmar_senha = "Senhas não coincidem";
    if (!form.cliente_monnera) errs.cliente_monnera = "Selecione uma opção";
    if (form.cliente_monnera === "sim" && !validateCNPJ(form.cliente_monnera_cnpj)) {
      errs.cliente_monnera_cnpj = "Informe um CNPJ válido";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Preencha todos os campos obrigatórios antes de continuar.");
      return;
    }

    setLoading(true);
    try {
      let userId: string;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.senha,
      });

      if (authError) {
        const msg = authError.message || "";
        const code = (authError as any).code || "";
        if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("user already")) {
          setErrors({ email: "Este e-mail já possui cadastro." });
          toast.error("Este e-mail já possui cadastro. Acesse seu painel ou recupere sua senha.");
          return;
        }
        if (code === "weak_password" || msg.toLowerCase().includes("weak")) {
          setErrors({ senha: "Senha muito fraca. Escolha uma senha mais segura." });
          toast.error("Senha muito fraca. Escolha uma senha mais segura.");
          return;
        }
        console.error("signUp error:", authError);
        toast.error("Não foi possível concluir seu cadastro agora. Tente novamente ou contate o suporte.");
        return;
      }

      if (!authData.user) {
        toast.error("Não foi possível concluir seu cadastro agora. Tente novamente ou contate o suporte.");
        return;
      }
      userId = authData.user.id;

      const { data: codeData, error: codeError } = await supabase.rpc("generate_partner_code");
      if (codeError) {
        console.error("generate_partner_code error:", codeError);
        toast.error("Não foi possível concluir seu cadastro agora. Tente novamente ou contate o suporte.");
        return;
      }

      const codigo_parceiro = codeData as string;
      const cpfClean = form.cpf.replace(/\D/g, "");
      const clienteCnpjClean = form.cliente_monnera === "sim" ? form.cliente_monnera_cnpj.replace(/\D/g, "") : null;
      const slug = generateSlug(form.nome.trim());

      const { data: parceiroData, error: insertError } = await supabase.rpc("register_parceiro", {
        p_user_id: userId,
        p_codigo_parceiro: codigo_parceiro,
        p_nome: form.nome.trim(),
        p_cpf: cpfClean,
        p_email: form.email.trim().toLowerCase(),
        p_telefone_ddd: form.telefone_ddd,
        p_telefone_numero: form.telefone_numero,
        p_slug_consultor: slug,
        p_cliente_monnera: form.cliente_monnera === "sim",
        p_cliente_monnera_cnpj: clienteCnpjClean,
      });

      if (insertError) {
        try {
          await supabase.functions.invoke("delete-orphan-user", {
            body: { user_id: userId },
          });
        } catch (cleanupErr) {
          console.error("Failed to cleanup orphan user:", cleanupErr);
        }
        await supabase.auth.signOut();

        const msg = insertError.message || "";
        if (msg.includes("parceiros_comerciais_cpf_key") || msg.toLowerCase().includes("\"cpf\"")) {
          setErrors({ cpf: "Este CPF ou CNPJ já está vinculado a um cadastro existente." });
          toast.error("Este CPF ou CNPJ já está vinculado a um cadastro existente.");
          return;
        }
        if (msg.includes("parceiros_comerciais_email_key") || msg.toLowerCase().includes("\"email\"")) {
          setErrors({ email: "Este e-mail já possui cadastro." });
          toast.error("Este e-mail já possui cadastro. Acesse seu painel ou recupere sua senha.");
          return;
        }
        console.error("register_parceiro error:", insertError);
        toast.error("Não foi possível concluir seu cadastro agora. Tente novamente ou contate o suporte.");
        return;
      }

      const parceiro = parceiroData as any;
      toast.success("Cadastro enviado com sucesso. Agora aguarde a aprovação para acessar o painel.");
      navigate("/confirmacao", { state: { parceiro } });
    } catch (error: any) {
      console.error("Cadastro embaixador — erro inesperado:", error);
      toast.error("Não foi possível concluir seu cadastro agora. Tente novamente ou contate o suporte.");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    "Indique empresas com dores reais de incentivo, vendas e operação.",
    "Conte com materiais e apoio da Monnera para qualificar a conversa.",
    "Acompanhe oportunidades com clareza no painel do embaixador.",
  ];

  return (
    <div className="monnera-page">
      <main className="mx-auto grid min-h-screen max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
        <section className="space-y-7">
          <div className="flex items-center gap-3">
            <img src={logoMonnera} alt="Monnera" className="h-11 w-11 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-semibold text-[#003729]">Monnera</p>
              <p className="text-xs text-[#4f6d65]">Programa de embaixadores</p>
            </div>
          </div>
          <div>
            <div className="monnera-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              Parceria com propósito
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-[#003729] sm:text-5xl">
              Seja a ponte entre empresas e uma operação comercial mais segura.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#33584f]">
              Como embaixador Monnera, você abre conversas qualificadas com empresas que precisam evoluir campanhas de
              incentivo, melhorar performance e reduzir riscos operacionais.
            </p>
          </div>
          <div className="space-y-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="monnera-hero-panel flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#00624b]" />
                <p className="text-sm leading-relaxed text-[#33584f]">{benefit}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="monnera-hero-panel">
              <Network className="h-5 w-5 text-[#00624b]" />
              <p className="mt-3 font-semibold text-[#003729]">Conexão com inteligência</p>
              <p className="mt-1 text-sm text-[#4f6d65]">Estratégia, dados e pessoas no mesmo ecossistema.</p>
            </div>
            <div className="monnera-hero-panel">
              <ShieldCheck className="h-5 w-5 text-[#00624b]" />
              <p className="mt-3 font-semibold text-[#003729]">Governança comercial</p>
              <p className="mt-1 text-sm text-[#4f6d65]">Clareza para indicar com confiança e responsabilidade.</p>
            </div>
          </div>
        </section>

        <Card className="monnera-card-elevated">
          <CardContent className="p-5 sm:p-7">
            <div className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2b6d5e]">Cadastro de embaixador</p>
              <h2 className="mt-2 text-2xl font-bold">Quero ser um Embaixador Monnera</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#4f6d65]">
                Preencha seus dados para criar seu acesso. A aprovação protege a qualidade do ecossistema.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome completo" />
                {errors.nome && <p className="mt-1 text-sm text-red-700">{errors.nome}</p>}
              </div>
              <div>
                <Label htmlFor="cpf">CPF ou CNPJ</Label>
                <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatDocumento(e.target.value) })} placeholder="000.000.000-00" maxLength={18} />
                {errors.cpf && <p className="mt-1 text-sm text-red-700">{errors.cpf}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ddd">DDD</Label>
                  <Input id="ddd" value={form.telefone_ddd} onChange={(e) => setForm({ ...form, telefone_ddd: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="11" maxLength={2} />
                  {errors.telefone_ddd && <p className="mt-1 text-sm text-red-700">{errors.telefone_ddd}</p>}
                </div>
                <div className="col-span-2">
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input id="telefone" value={form.telefone_numero} onChange={(e) => setForm({ ...form, telefone_numero: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="999999999" maxLength={9} />
                  {errors.telefone_numero && <p className="mt-1 text-sm text-red-700">{errors.telefone_numero}</p>}
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
                {errors.email && <p className="mt-1 text-sm text-red-700">{errors.email}</p>}
              </div>

              <div>
                <Label>Você já é cliente Monnera? *</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(["sim", "nao"] as ClienteMonnera[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setForm({ ...form, cliente_monnera: option, cliente_monnera_cnpj: option === "nao" ? "" : form.cliente_monnera_cnpj })}
                      className={`rounded-lg border px-4 py-3 text-left text-sm font-semibold transition ${
                        form.cliente_monnera === option
                          ? "border-[#003729] bg-[#003729] text-white"
                          : "border-[#b9d8d0] bg-white text-[#003729] hover:border-[#6BB0A1]"
                      }`}
                    >
                      {option === "sim" ? "Sim" : "Não"}
                    </button>
                  ))}
                </div>
                {errors.cliente_monnera && <p className="mt-1 text-sm text-red-700">{errors.cliente_monnera}</p>}
              </div>

              {form.cliente_monnera === "sim" && (
                <div>
                  <Label htmlFor="cliente_monnera_cnpj">CNPJ do cliente Monnera *</Label>
                  <Input
                    id="cliente_monnera_cnpj"
                    value={form.cliente_monnera_cnpj}
                    onChange={(e) => setForm({ ...form, cliente_monnera_cnpj: formatCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                  {errors.cliente_monnera_cnpj && <p className="mt-1 text-sm text-red-700">{errors.cliente_monnera_cnpj}</p>}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="senha">Senha</Label>
                  <Input id="senha" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
                  {errors.senha && <p className="mt-1 text-sm text-red-700">{errors.senha}</p>}
                </div>
                <div>
                  <Label htmlFor="confirmar_senha">Confirmar senha</Label>
                  <Input id="confirmar_senha" type="password" value={form.confirmar_senha} onChange={(e) => setForm({ ...form, confirmar_senha: e.target.value })} placeholder="Repita a senha" />
                  {errors.confirmar_senha && <p className="mt-1 text-sm text-red-700">{errors.confirmar_senha}</p>}
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#003729] py-6 font-bold text-white hover:bg-[#064b3a]" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cadastrando...
                  </>
                ) : (
                  <>
                    Quero ser um Embaixador Monnera
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-[#4f6d65]">
                Já é embaixador?{" "}
                <Link to="/login" className="font-semibold text-[#003729] underline-offset-4 hover:underline">
                  Acesse seu painel
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CadastroParceiro;
