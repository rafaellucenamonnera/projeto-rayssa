import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail, validateCNPJ, formatCNPJ } from "@/lib/validators";
import { toast } from "sonner";
import { Loader2, CheckCircle, Shield } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

const CadastroLead = () => {
  const { codigoParceiro, slugConsultor } = useParams();
  const [loading, setLoading] = useState(false);
  const [parceiroId, setParceiroId] = useState<string | null>(null);
  const [parceiroNome, setParceiroNome] = useState<string>("");
  const [parceiroValid, setParceiroValid] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    nome_fantasia: "",
    razao_social: "",
    cnpj: "",
    cidade: "",
    quantidade_lojas: "",
    nome_responsavel: "",
    telefone_responsavel: "",
    email_responsavel: "",
    erp_utilizado: "",
    quantidade_funcionarios: "",
    valor_campanhas: "",
    descricao_necessidade: "",
  });

  useEffect(() => {
    const checkParceiro = async () => {
      let query: any = supabase
        .from("parceiros_comerciais")
        .select("id, nome")
        .eq("ativo", true);

      if (slugConsultor) {
        query = query.eq("slug_consultor", slugConsultor);
      } else if (codigoParceiro) {
        query = query.eq("codigo_parceiro", codigoParceiro);
      } else {
        setParceiroValid(false);
        return;
      }

      const { data } = await query.single();
      if (data) {
        setParceiroId(data.id);
        setParceiroNome(data.nome);
        setParceiroValid(true);
      } else {
        setParceiroValid(false);
      }
    };
    checkParceiro();
  }, [codigoParceiro, slugConsultor]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome_fantasia.trim()) errs.nome_fantasia = "Obrigatório";
    if (!form.razao_social.trim()) errs.razao_social = "Obrigatório";
    if (!validateCNPJ(form.cnpj)) errs.cnpj = "CNPJ inválido (14 dígitos)";
    if (!form.cidade.trim()) errs.cidade = "Obrigatório";
    if (!form.quantidade_lojas || parseInt(form.quantidade_lojas) < 1) errs.quantidade_lojas = "Obrigatório";
    if (!form.nome_responsavel.trim()) errs.nome_responsavel = "Obrigatório";
    if (!form.telefone_responsavel.trim()) errs.telefone_responsavel = "Obrigatório";
    if (!validateEmail(form.email_responsavel)) errs.email_responsavel = "Email inválido";
    if (!form.erp_utilizado.trim()) errs.erp_utilizado = "Obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !parceiroId) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("leads").insert({
        parceiro_id: parceiroId,
        nome_fantasia: form.nome_fantasia.trim(),
        razao_social: form.razao_social.trim(),
        cnpj: form.cnpj.replace(/\D/g, ''),
        cidade: form.cidade.trim(),
        quantidade_lojas: parseInt(form.quantidade_lojas),
        nome_responsavel: form.nome_responsavel.trim(),
        telefone_responsavel: form.telefone_responsavel.trim(),
        email_responsavel: form.email_responsavel.trim().toLowerCase(),
        erp_utilizado: form.erp_utilizado.trim(),
        quantidade_funcionarios: form.quantidade_funcionarios ? parseInt(form.quantidade_funcionarios) : null,
        valor_campanhas: form.valor_campanhas ? parseFloat(form.valor_campanhas) : null,
        descricao_necessidade: form.descricao_necessidade.trim() || null,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (error: any) {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (parceiroValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardContent className="py-12">
            <p className="text-destructive text-lg">Link inválido ou consultor inativo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (parceiroValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold">Cadastro enviado com sucesso!</h2>
            <p className="text-muted-foreground">Entraremos em contato em breve. Obrigado pelo interesse no Monnera!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fieldClass = "space-y-1.5";

  return (
    <div className="min-h-screen flex items-center justify-center px-3 py-6 sm:p-4 sm:py-8">
      <Card className="w-full max-w-2xl border-border">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-xl sm:text-2xl font-display">
            Conheça o Monnera
          </CardTitle>
          <CardDescription className="text-sm">
            {parceiroNome
              ? `Indicação do consultor ${parceiroNome}. Preencha os dados da sua empresa para receber uma apresentação.`
              : "Preencha os dados da sua empresa para receber uma apresentação."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={fieldClass}>
                <Label>Nome Fantasia *</Label>
                <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                {errors.nome_fantasia && <p className="text-destructive text-xs">{errors.nome_fantasia}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Razão Social Matriz *</Label>
                <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                {errors.razao_social && <p className="text-destructive text-xs">{errors.razao_social}</p>}
              </div>
              <div className={fieldClass}>
                <Label>CNPJ Matriz *</Label>
                <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })} placeholder="00.000.000/0000-00" maxLength={18} />
                {errors.cnpj && <p className="text-destructive text-xs">{errors.cnpj}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Cidade Matriz *</Label>
                <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                {errors.cidade && <p className="text-destructive text-xs">{errors.cidade}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Quantidade de Lojas *</Label>
                <Input type="number" min="1" value={form.quantidade_lojas} onChange={(e) => setForm({ ...form, quantidade_lojas: e.target.value })} />
                {errors.quantidade_lojas && <p className="text-destructive text-xs">{errors.quantidade_lojas}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Nome do Responsável *</Label>
                <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} />
                {errors.nome_responsavel && <p className="text-destructive text-xs">{errors.nome_responsavel}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Telefone do Responsável *</Label>
                <Input value={form.telefone_responsavel} onChange={(e) => setForm({ ...form, telefone_responsavel: e.target.value })} placeholder="(11) 99999-9999" />
                {errors.telefone_responsavel && <p className="text-destructive text-xs">{errors.telefone_responsavel}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Email Responsável *</Label>
                <Input type="email" value={form.email_responsavel} onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })} />
                {errors.email_responsavel && <p className="text-destructive text-xs">{errors.email_responsavel}</p>}
              </div>
              <div className={fieldClass}>
                <Label>ERP Utilizado *</Label>
                <Input value={form.erp_utilizado} onChange={(e) => setForm({ ...form, erp_utilizado: e.target.value })} />
                {errors.erp_utilizado && <p className="text-destructive text-xs">{errors.erp_utilizado}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Quantidade de Funcionários</Label>
                <Input type="number" min="0" value={form.quantidade_funcionarios} onChange={(e) => setForm({ ...form, quantidade_funcionarios: e.target.value })} />
              </div>
              <div className={fieldClass}>
                <Label>Valores pagos em campanhas (R$)</Label>
                <Input type="number" min="0" step="0.01" value={form.valor_campanhas} onChange={(e) => setForm({ ...form, valor_campanhas: e.target.value })} />
              </div>
            </div>

            <div className={fieldClass}>
              <Label>Como podemos te ajudar? (máx. 150 caracteres)</Label>
              <Textarea value={form.descricao_necessidade} onChange={(e) => setForm({ ...form, descricao_necessidade: e.target.value.slice(0, 150) })} maxLength={150} rows={3} />
              <p className="text-xs text-muted-foreground text-right">{form.descricao_necessidade.length}/150</p>
            </div>

            <Button type="submit" className="w-full text-base py-6" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Quero receber uma apresentação do Monnera"}
            </Button>

            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <p>Seus dados serão utilizados apenas para contato comercial e apresentação da plataforma Monnera.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CadastroLead;
