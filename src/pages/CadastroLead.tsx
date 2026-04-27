import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail } from "@/lib/validators";
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
    nome_responsavel: "",
    telefone_responsavel: "",
    email_responsavel: "",
    nome_fantasia: "",
    quantidade_lojas: "",
    erp_utilizado: "",
    valor_campanhas: "",
  });

  useEffect(() => {
    const checkParceiro = async () => {
      try {
        let data: any = null;
        if (slugConsultor) {
          const res = await supabase.rpc("lookup_parceiro_by_slug", { slug: slugConsultor });
          if (res.error) throw res.error;
          data = res.data?.[0] || null;
        } else if (codigoParceiro) {
          const res = await supabase.rpc("lookup_parceiro_by_code", { code: codigoParceiro });
          if (res.error) throw res.error;
          data = res.data?.[0] || null;
        } else {
          setParceiroValid(false);
          return;
        }
        if (data) {
          setParceiroId(data.id);
          setParceiroNome(data.nome);
          setParceiroValid(true);
        } else {
          setParceiroValid(false);
        }
      } catch (error) {
        console.error("Erro ao verificar consultor:", error);
        setParceiroValid(false);
      }
    };
    checkParceiro();
  }, [codigoParceiro, slugConsultor]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome_responsavel.trim()) errs.nome_responsavel = "Obrigatório";
    if (!form.telefone_responsavel.trim()) errs.telefone_responsavel = "Obrigatório";
    if (!validateEmail(form.email_responsavel)) errs.email_responsavel = "Email inválido";
    if (!form.nome_fantasia.trim()) errs.nome_fantasia = "Obrigatório";
    if (!form.quantidade_lojas || parseInt(form.quantidade_lojas) < 1) errs.quantidade_lojas = "Obrigatório";
    if (!form.erp_utilizado.trim()) errs.erp_utilizado = "Obrigatório";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !parceiroId) return;

    setLoading(true);
    try {
      const { error } = await supabase.rpc("register_lead_public", {
        p_parceiro_id: parceiroId,
        p_nome_responsavel: form.nome_responsavel.trim(),
        p_telefone_responsavel: form.telefone_responsavel.trim(),
        p_email_responsavel: form.email_responsavel.trim().toLowerCase(),
        p_nome_fantasia: form.nome_fantasia.trim(),
        p_quantidade_lojas: parseInt(form.quantidade_lojas),
        p_erp_utilizado: form.erp_utilizado.trim(),
        p_valor_campanhas: form.valor_campanhas ? parseFloat(form.valor_campanhas) : null,
        p_origem: "link_indicacao",
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
      <Card className="w-full max-w-lg border-border">
        <CardHeader className="text-center space-y-2 px-4 sm:px-6">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-xl sm:text-2xl font-display">Conheça o Monnera</CardTitle>
          <CardDescription className="text-sm">
            {parceiroNome
              ? `Indicação do consultor ${parceiroNome}. Preencha os dados abaixo para receber uma apresentação.`
              : "Preencha os dados abaixo para receber uma apresentação."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={fieldClass}>
              <Label>Nome *</Label>
              <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} placeholder="Seu nome completo" />
              {errors.nome_responsavel && <p className="text-destructive text-xs">{errors.nome_responsavel}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={fieldClass}>
                <Label>Telefone *</Label>
                <Input value={form.telefone_responsavel} onChange={(e) => setForm({ ...form, telefone_responsavel: e.target.value })} placeholder="(11) 99999-9999" />
                {errors.telefone_responsavel && <p className="text-destructive text-xs">{errors.telefone_responsavel}</p>}
              </div>
              <div className={fieldClass}>
                <Label>E-mail *</Label>
                <Input type="email" value={form.email_responsavel} onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })} placeholder="seu@email.com" />
                {errors.email_responsavel && <p className="text-destructive text-xs">{errors.email_responsavel}</p>}
              </div>
            </div>
            <div className={fieldClass}>
              <Label>Nome da farmácia *</Label>
              <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Nome da sua farmácia" />
              {errors.nome_fantasia && <p className="text-destructive text-xs">{errors.nome_fantasia}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={fieldClass}>
                <Label>Número de lojas *</Label>
                <Input type="number" min="1" value={form.quantidade_lojas} onChange={(e) => setForm({ ...form, quantidade_lojas: e.target.value })} placeholder="1" />
                {errors.quantidade_lojas && <p className="text-destructive text-xs">{errors.quantidade_lojas}</p>}
              </div>
              <div className={fieldClass}>
                <Label>Sistema de loja *</Label>
                <Input value={form.erp_utilizado} onChange={(e) => setForm({ ...form, erp_utilizado: e.target.value })} placeholder="Ex: Trier, Linx, etc." />
                {errors.erp_utilizado && <p className="text-destructive text-xs">{errors.erp_utilizado}</p>}
              </div>
            </div>
            <div className={fieldClass}>
              <Label>Valor médio pago em campanhas de vendas por mês</Label>
              <Input type="number" min="0" step="0.01" value={form.valor_campanhas} onChange={(e) => setForm({ ...form, valor_campanhas: e.target.value })} placeholder="R$ (opcional)" />
            </div>

            <Button type="submit" className="w-full text-base py-6" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Quero conhecer o Monnera"}
            </Button>

            <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5" />
              <p>Seus dados serão utilizados apenas para contato comercial.</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CadastroLead;
