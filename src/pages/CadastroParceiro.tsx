import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, validateEmail, formatCPF } from "@/lib/validators";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

const CadastroParceiro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone_ddd: "",
    telefone_numero: "",
    email: "",
    senha: "",
    confirmar_senha: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = "Nome é obrigatório";
    if (!validateCPF(form.cpf)) errs.cpf = "CPF inválido";
    if (!/^\d{2}$/.test(form.telefone_ddd)) errs.telefone_ddd = "DDD inválido (2 dígitos)";
    if (!/^\d{9}$/.test(form.telefone_numero)) errs.telefone_numero = "Número inválido (9 dígitos)";
    if (!validateEmail(form.email)) errs.email = "Email inválido";
    if (!form.senha || form.senha.length < 6) errs.senha = "Mínimo 6 caracteres";
    if (form.senha !== form.confirmar_senha) errs.confirmar_senha = "Senhas não coincidem";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      let userId: string;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.senha,
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          // User exists in Auth — try signing in with provided password
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            email: form.email.trim().toLowerCase(),
            password: form.senha,
          });
          if (loginError) {
            setErrors({ email: "Email já registrado. Verifique a senha informada." });
            return;
          }
          if (!loginData.user) throw new Error("Erro ao autenticar");

          // Check if already registered as parceiro
          const { data: existing } = await supabase
            .from("parceiros_comerciais")
            .select("id")
            .eq("user_id", loginData.user.id)
            .maybeSingle();
          if (existing) {
            setErrors({ email: "Você já está cadastrado como consultor." });
            return;
          }
          userId = loginData.user.id;
        } else if (authError.message.includes("weak_password") || authError.message.includes("weak") || (authError as any).code === "weak_password") {
          setErrors({ senha: "Senha muito fraca. Escolha uma senha mais segura e diferente de senhas comuns." });
          return;
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error("Erro ao criar conta");
        userId = authData.user.id;
      }

      const { data: codeData, error: codeError } = await supabase.rpc("generate_partner_code");
      if (codeError) throw codeError;

      const codigo_parceiro = codeData as string;
      const cpfClean = form.cpf.replace(/\D/g, "");
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
      });

      if (insertError) {
        // Cleanup orphan auth user
        try {
          await supabase.functions.invoke("delete-orphan-user", {
            body: { user_id: userId },
          });
        } catch (cleanupErr) {
          console.error("Failed to cleanup orphan user:", cleanupErr);
        }
        await supabase.auth.signOut();

        if (insertError.message.includes("parceiros_comerciais_cpf_key")) {
          setErrors({ cpf: "CPF já cadastrado" });
        } else if (insertError.message.includes("parceiros_comerciais_email_key")) {
          setErrors({ email: "Email já cadastrado" });
        } else {
          throw insertError;
        }
        return;
      }

      const parceiro = parceiroData as any;

      // Link is constructed dynamically in PainelParceiro from slug/codigo_parceiro

      localStorage.setItem("monnera_parceiro", JSON.stringify({
        id: parceiro.id,
        nome: parceiro.nome,
        codigo_parceiro: parceiro.codigo_parceiro,
        slug_consultor: parceiro.slug_consultor,
      }));
      navigate("/confirmacao", { state: { parceiro } });
    } catch (error: any) {
      toast.error("Erro ao cadastrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-3 py-6 sm:p-4">
      <Card className="w-full max-w-lg border-border">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-xl sm:text-2xl font-display">Cadastro de Consultor Comercial</CardTitle>
          <CardDescription className="text-sm">Preencha seus dados para se tornar um consultor Monnera</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Seu nome completo" />
              {errors.nome && <p className="text-destructive text-sm mt-1">{errors.nome}</p>}
            </div>
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" maxLength={14} />
              {errors.cpf && <p className="text-destructive text-sm mt-1">{errors.cpf}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="ddd">DDD</Label>
                <Input id="ddd" value={form.telefone_ddd} onChange={(e) => setForm({ ...form, telefone_ddd: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="11" maxLength={2} />
                {errors.telefone_ddd && <p className="text-destructive text-sm mt-1">{errors.telefone_ddd}</p>}
              </div>
              <div className="col-span-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={form.telefone_numero} onChange={(e) => setForm({ ...form, telefone_numero: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="999999999" maxLength={9} />
                {errors.telefone_numero && <p className="text-destructive text-sm mt-1">{errors.telefone_numero}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
            </div>
            <div>
              <Label htmlFor="senha">Senha</Label>
              <Input id="senha" type="password" value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} placeholder="Mínimo 6 caracteres" />
              {errors.senha && <p className="text-destructive text-sm mt-1">{errors.senha}</p>}
            </div>
            <div>
              <Label htmlFor="confirmar_senha">Confirmar Senha</Label>
              <Input id="confirmar_senha" type="password" value={form.confirmar_senha} onChange={(e) => setForm({ ...form, confirmar_senha: e.target.value })} placeholder="Repita a senha" />
              {errors.confirmar_senha && <p className="text-destructive text-sm mt-1">{errors.confirmar_senha}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cadastrando...</> : "Cadastrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CadastroParceiro;
