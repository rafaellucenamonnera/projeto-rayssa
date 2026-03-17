import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { validateCNPJ, formatCNPJ } from "@/lib/validators";
import { toast } from "sonner";
import { Loader2, CheckCircle, Store, AlertCircle } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

interface LojaForm {
  cnpj: string;
  razao_social: string;
  nome_interno: string;
}

const FormularioConversao = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lead, setLead] = useState<any>(null);
  const [invalid, setInvalid] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    nome_fantasia: "",
    razao_social: "",
    endereco_rua: "",
    endereco_numero: "",
    cidade: "",
    endereco_estado: "",
    endereco_cep: "",
    quantidade_lojas: 1,
    nome_responsavel: "",
    telefone_responsavel: "",
    email_responsavel: "",
    // Implantação
    responsavel_tecnico_nome: "",
    responsavel_tecnico_telefone: "",
    responsavel_tecnico_email: "",
    responsavel_comercial_nome: "",
    responsavel_comercial_telefone: "",
    responsavel_comercial_email: "",
    responsavel_rh_nome: "",
    responsavel_rh_telefone: "",
    responsavel_rh_email: "",
  });

  const [lojas, setLojas] = useState<LojaForm[]>([]);

  useEffect(() => {
    const loadLead = async () => {
      if (!token) { setInvalid(true); setLoading(false); return; }

      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("completion_token", token)
        .eq("dados_completos", false)
        .maybeSingle();

      if (error || !data) {
        setInvalid(true);
        setLoading(false);
        return;
      }

      setLead(data);
      setForm({
        nome_fantasia: data.nome_fantasia || "",
        razao_social: data.razao_social || "",
        endereco_rua: data.endereco_rua || "",
        endereco_numero: data.endereco_numero || "",
        cidade: data.cidade || "",
        endereco_estado: data.endereco_estado || "",
        endereco_cep: data.endereco_cep || "",
        quantidade_lojas: data.quantidade_lojas || 1,
        nome_responsavel: data.nome_responsavel || "",
        telefone_responsavel: data.telefone_responsavel || "",
        email_responsavel: data.email_responsavel || "",
        responsavel_tecnico_nome: data.responsavel_tecnico_nome || "",
        responsavel_tecnico_telefone: data.responsavel_tecnico_telefone || "",
        responsavel_tecnico_email: data.responsavel_tecnico_email || "",
        responsavel_comercial_nome: data.responsavel_comercial_nome || "",
        responsavel_comercial_telefone: data.responsavel_comercial_telefone || "",
        responsavel_comercial_email: data.responsavel_comercial_email || "",
        responsavel_rh_nome: data.responsavel_rh_nome || "",
        responsavel_rh_telefone: data.responsavel_rh_telefone || "",
        responsavel_rh_email: data.responsavel_rh_email || "",
      });

      // Initialize lojas array if multi-store
      if (data.quantidade_lojas > 1) {
        setLojas(
          Array.from({ length: data.quantidade_lojas }, () => ({
            cnpj: "", razao_social: "", nome_interno: "",
          }))
        );
      }

      setLoading(false);
    };
    loadLead();
  }, [token]);

  const handleQtdLojasChange = (val: number) => {
    const qty = Math.max(1, val);
    setForm({ ...form, quantidade_lojas: qty });
    if (qty > 1) {
      setLojas(
        Array.from({ length: qty }, (_, i) => lojas[i] || { cnpj: "", razao_social: "", nome_interno: "" })
      );
    } else {
      setLojas([]);
    }
  };

  const updateLoja = (index: number, field: keyof LojaForm, value: string) => {
    const updated = [...lojas];
    if (field === "cnpj") {
      updated[index] = { ...updated[index], cnpj: formatCNPJ(value) };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setLojas(updated);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.nome_fantasia.trim()) errs.nome_fantasia = "Obrigatório";
    if (!form.razao_social.trim()) errs.razao_social = "Obrigatório";
    if (!form.endereco_rua.trim()) errs.endereco_rua = "Obrigatório";
    if (!form.endereco_numero.trim()) errs.endereco_numero = "Obrigatório";
    if (!form.cidade.trim()) errs.cidade = "Obrigatório";
    if (!form.endereco_estado.trim()) errs.endereco_estado = "Obrigatório";
    if (!form.endereco_cep.trim()) errs.endereco_cep = "Obrigatório";
    if (!form.nome_responsavel.trim()) errs.nome_responsavel = "Obrigatório";
    if (!form.telefone_responsavel.trim()) errs.telefone_responsavel = "Obrigatório";
    if (!form.email_responsavel.trim()) errs.email_responsavel = "Obrigatório";

    // Implantação validations
    if (!form.responsavel_tecnico_nome.trim()) errs.responsavel_tecnico_nome = "Obrigatório";
    if (!form.responsavel_tecnico_telefone.trim()) errs.responsavel_tecnico_telefone = "Obrigatório";
    if (!form.responsavel_tecnico_email.trim()) errs.responsavel_tecnico_email = "Obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.responsavel_tecnico_email)) errs.responsavel_tecnico_email = "Email inválido";

    if (!form.responsavel_comercial_nome.trim()) errs.responsavel_comercial_nome = "Obrigatório";
    if (!form.responsavel_comercial_telefone.trim()) errs.responsavel_comercial_telefone = "Obrigatório";
    if (!form.responsavel_comercial_email.trim()) errs.responsavel_comercial_email = "Obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.responsavel_comercial_email)) errs.responsavel_comercial_email = "Email inválido";

    if (!form.responsavel_rh_nome.trim()) errs.responsavel_rh_nome = "Obrigatório";
    if (!form.responsavel_rh_telefone.trim()) errs.responsavel_rh_telefone = "Obrigatório";
    if (!form.responsavel_rh_email.trim()) errs.responsavel_rh_email = "Obrigatório";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.responsavel_rh_email)) errs.responsavel_rh_email = "Email inválido";

    // Validate lojas if multi-store
    if (form.quantidade_lojas > 1) {
      const cnpjs: string[] = [];
      lojas.forEach((loja, i) => {
        if (!validateCNPJ(loja.cnpj)) errs[`loja_${i}_cnpj`] = "CNPJ inválido";
        if (!loja.razao_social.trim()) errs[`loja_${i}_razao`] = "Obrigatório";
        if (!loja.nome_interno.trim()) errs[`loja_${i}_nome`] = "Obrigatório";

        const cleanCnpj = loja.cnpj.replace(/\D/g, "");
        if (cleanCnpj && cnpjs.includes(cleanCnpj)) {
          errs[`loja_${i}_cnpj`] = "CNPJ repetido";
        }
        if (cleanCnpj) cnpjs.push(cleanCnpj);
      });
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !lead) return;

    setSubmitting(true);
    try {
      // Update lead with complete data
      const { error: updateError } = await supabase
        .from("leads")
        .update({
          nome_fantasia: form.nome_fantasia.trim(),
          razao_social: form.razao_social.trim(),
          cidade: form.cidade.trim(),
          endereco_rua: form.endereco_rua.trim(),
          endereco_numero: form.endereco_numero.trim(),
          endereco_estado: form.endereco_estado.trim().toUpperCase(),
          endereco_cep: form.endereco_cep.trim(),
          quantidade_lojas: form.quantidade_lojas,
          nome_responsavel: form.nome_responsavel.trim(),
          telefone_responsavel: form.telefone_responsavel.trim(),
          email_responsavel: form.email_responsavel.trim().toLowerCase(),
          dados_completos: true,
        } as any)
        .eq("id", lead.id);

      if (updateError) throw updateError;

      // Insert lojas if multi-store
      if (form.quantidade_lojas > 1 && lojas.length > 0) {
        const lojasData = lojas.map((l) => ({
          lead_id: lead.id,
          cnpj: l.cnpj.replace(/\D/g, ""),
          razao_social: l.razao_social.trim(),
          nome_interno: l.nome_interno.trim(),
        }));

        const { error: lojasError } = await supabase.from("lojas").insert(lojasData as any);
        if (lojasError) throw lojasError;
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast.error("Erro ao enviar dados. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardContent className="py-12 space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-lg font-medium">Link inválido ou já utilizado.</p>
            <p className="text-sm text-muted-foreground">Este formulário não está mais disponível.</p>
          </CardContent>
        </Card>
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
            <h2 className="text-xl font-display font-bold">Dados enviados com sucesso!</h2>
            <p className="text-muted-foreground">Obrigado! Agora nossa equipe vai preparar seu contrato.</p>
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
          <CardTitle className="text-xl sm:text-2xl font-display">Complete seus dados</CardTitle>
          <CardDescription className="text-sm">
            Seja bem-vindo ao Monnera, {lead?.nome_responsavel}! Preencha os dados abaixo para gerarmos seu contrato.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Dados da Empresa */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <Label>Nome fantasia *</Label>
                  <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                  {errors.nome_fantasia && <p className="text-destructive text-xs">{errors.nome_fantasia}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>Razão social matriz *</Label>
                  <Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                  {errors.razao_social && <p className="text-destructive text-xs">{errors.razao_social}</p>}
                </div>
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <Label>Rua / Avenida *</Label>
                  <Input value={form.endereco_rua} onChange={(e) => setForm({ ...form, endereco_rua: e.target.value })} placeholder="Ex: Av. Brasil" />
                  {errors.endereco_rua && <p className="text-destructive text-xs">{errors.endereco_rua}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>Número *</Label>
                  <Input value={form.endereco_numero} onChange={(e) => setForm({ ...form, endereco_numero: e.target.value })} placeholder="Ex: 1500" />
                  {errors.endereco_numero && <p className="text-destructive text-xs">{errors.endereco_numero}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>Cidade *</Label>
                  <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                  {errors.cidade && <p className="text-destructive text-xs">{errors.cidade}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>Estado *</Label>
                  <Input value={form.endereco_estado} onChange={(e) => setForm({ ...form, endereco_estado: e.target.value })} placeholder="Ex: SP" maxLength={2} />
                  {errors.endereco_estado && <p className="text-destructive text-xs">{errors.endereco_estado}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>CEP *</Label>
                  <Input value={form.endereco_cep} onChange={(e) => setForm({ ...form, endereco_cep: e.target.value })} placeholder="00000-000" maxLength={9} />
                  {errors.endereco_cep && <p className="text-destructive text-xs">{errors.endereco_cep}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>Quantidade de lojas *</Label>
                  <Input type="number" min="1" value={form.quantidade_lojas} onChange={(e) => handleQtdLojasChange(parseInt(e.target.value) || 1)} />
                </div>
              </div>
            </div>

            {/* Responsável pela assinatura */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Responsável pela Assinatura</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className={fieldClass}>
                  <Label>Nome completo *</Label>
                  <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} />
                  {errors.nome_responsavel && <p className="text-destructive text-xs">{errors.nome_responsavel}</p>}
                </div>
                <div className={fieldClass}>
                  <Label>Telefone *</Label>
                  <Input value={form.telefone_responsavel} onChange={(e) => setForm({ ...form, telefone_responsavel: e.target.value })} placeholder="(11) 99999-9999" />
                  {errors.telefone_responsavel && <p className="text-destructive text-xs">{errors.telefone_responsavel}</p>}
                </div>
                <div className={fieldClass + " sm:col-span-2"}>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email_responsavel} onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })} />
                  {errors.email_responsavel && <p className="text-destructive text-xs">{errors.email_responsavel}</p>}
                </div>
              </div>
            </div>

            {/* Lojas (multi-store) */}
            {form.quantidade_lojas > 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Dados das Lojas ({form.quantidade_lojas} lojas)
                </h3>
                {lojas.map((loja, i) => (
                  <Card key={i} className="border-border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Store className="h-4 w-4 text-primary" />
                        Loja {i + 1}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className={fieldClass}>
                          <Label className="text-xs">CNPJ *</Label>
                          <Input
                            value={loja.cnpj}
                            onChange={(e) => updateLoja(i, "cnpj", e.target.value)}
                            placeholder="00.000.000/0000-00"
                            maxLength={18}
                          />
                          {errors[`loja_${i}_cnpj`] && (
                            <p className="text-destructive text-xs">{errors[`loja_${i}_cnpj`]}</p>
                          )}
                        </div>
                        <div className={fieldClass}>
                          <Label className="text-xs">Razão Social *</Label>
                          <Input
                            value={loja.razao_social}
                            onChange={(e) => updateLoja(i, "razao_social", e.target.value)}
                          />
                          {errors[`loja_${i}_razao`] && (
                            <p className="text-destructive text-xs">{errors[`loja_${i}_razao`]}</p>
                          )}
                        </div>
                        <div className={fieldClass}>
                          <Label className="text-xs">Nome interno *</Label>
                          <Input
                            value={loja.nome_interno}
                            onChange={(e) => updateLoja(i, "nome_interno", e.target.value)}
                            placeholder="Ex: Loja Centro"
                          />
                          {errors[`loja_${i}_nome`] && (
                            <p className="text-destructive text-xs">{errors[`loja_${i}_nome`]}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <Button type="submit" className="w-full text-base py-6" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : "Enviar dados"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FormularioConversao;
