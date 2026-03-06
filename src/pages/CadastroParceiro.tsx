import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF, validateEmail, formatCPF } from "@/lib/validators";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

const CadastroParceiro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    telefone_ddd: "",
    telefone_numero: "",
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome.trim()) errs.nome = "Nome é obrigatório";
    if (!validateCPF(form.cpf)) errs.cpf = "CPF inválido";
    if (!/^\d{2}$/.test(form.telefone_ddd)) errs.telefone_ddd = "DDD inválido (2 dígitos)";
    if (!/^\d{9}$/.test(form.telefone_numero)) errs.telefone_numero = "Número inválido (9 dígitos)";
    if (!validateEmail(form.email)) errs.email = "Email inválido";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Generate partner code
      const { data: codeData, error: codeError } = await supabase.rpc("generate_partner_code");
      if (codeError) throw codeError;

      const codigo_parceiro = codeData as string;
      const cpfClean = form.cpf.replace(/\D/g, '');

      // Insert partner
      const { data: parceiro, error: insertError } = await supabase
        .from("parceiros_comerciais")
        .insert({
          codigo_parceiro,
          nome: form.nome.trim(),
          cpf: cpfClean,
          email: form.email.trim().toLowerCase(),
          telefone_ddd: form.telefone_ddd,
          telefone_numero: form.telefone_numero,
        })
        .select()
        .single();

      if (insertError) {
        if (insertError.message.includes("parceiros_comerciais_cpf_key")) {
          setErrors({ cpf: "CPF já cadastrado" });
        } else if (insertError.message.includes("parceiros_comerciais_email_key")) {
          setErrors({ email: "Email já cadastrado" });
        } else {
          throw insertError;
        }
        return;
      }

      // Create default link
      const baseUrl = window.location.origin;
      await supabase.from("links_parceiros").insert({
        parceiro_id: parceiro.id,
        codigo_link: codigo_parceiro,
        url_link: `${baseUrl}/lead/${codigo_parceiro}`,
      });

      // Store partner in localStorage for session
      localStorage.setItem("monnera_parceiro", JSON.stringify(parceiro));

      navigate("/confirmacao", { state: { parceiro } });
    } catch (error: any) {
      toast.error("Erro ao cadastrar: " + error.message);
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
                <Input id="ddd" value={form.telefone_ddd} onChange={(e) => setForm({ ...form, telefone_ddd: e.target.value.replace(/\D/g, '').slice(0, 2) })} placeholder="11" maxLength={2} />
                {errors.telefone_ddd && <p className="text-destructive text-sm mt-1">{errors.telefone_ddd}</p>}
              </div>
              <div className="col-span-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={form.telefone_numero} onChange={(e) => setForm({ ...form, telefone_numero: e.target.value.replace(/\D/g, '').slice(0, 9) })} placeholder="999999999" maxLength={9} />
                {errors.telefone_numero && <p className="text-destructive text-sm mt-1">{errors.telefone_numero}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="seu@email.com" />
              {errors.email && <p className="text-destructive text-sm mt-1">{errors.email}</p>}
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
