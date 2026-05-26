import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { validateEmail } from "@/lib/validators";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle,
  CircleDollarSign,
  Loader2,
  LockKeyhole,
  Network,
  Shield,
  Sparkles,
} from "lucide-react";
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
        console.error("Erro ao verificar embaixador Monnera:", error);
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
    if (form.quantidade_lojas && parseInt(form.quantidade_lojas) < 1) {
      errs.quantidade_lojas = "Informe 1 ou mais lojas";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !parceiroId) return;

    setLoading(true);
    try {
      const quantidadeLojas = form.quantidade_lojas ? parseInt(form.quantidade_lojas) : undefined;
      const { error } = await supabase.rpc("register_lead_public", {
        p_parceiro_id: parceiroId,
        p_nome_responsavel: form.nome_responsavel.trim(),
        p_telefone_responsavel: form.telefone_responsavel.trim(),
        p_email_responsavel: form.email_responsavel.trim().toLowerCase(),
        p_nome_fantasia: form.nome_fantasia.trim(),
        p_quantidade_lojas: quantidadeLojas,
        p_erp_utilizado: form.erp_utilizado.trim() || undefined,
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
      <div className="min-h-screen flex items-center justify-center bg-[#031611] p-4">
        <Card className="w-full max-w-md border-white/10 bg-white text-center">
          <CardContent className="py-12">
            <p className="text-lg font-semibold text-red-700">Link inválido ou embaixador Monnera inativo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (parceiroValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#031611]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6BB0A1]" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#031611] p-4">
        <Card className="w-full max-w-md border-white/10 bg-[#f5faf8] text-center text-[#003729]">
          <CardContent className="py-12 space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#6BB0A1]/20">
              <CheckCircle className="h-8 w-8 text-[#00624b]" />
            </div>
            <h2 className="text-2xl font-bold">Recebemos seu cadastro.</h2>
            <p className="text-sm leading-relaxed text-[#33584f]">
              O time Monnera vai entrar em contato para entender seu contexto e mostrar o caminho mais adequado para
              evoluir sua operação de incentivo de vendas.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const fieldClass = "space-y-1.5";
  const pillars = [
    {
      icon: Network,
      title: "Conexão",
      text: "Dados, pessoas e operação no mesmo fluxo para reduzir improvisos.",
    },
    {
      icon: CircleDollarSign,
      title: "Performance",
      text: "Campanhas de incentivo orientadas por metas, clareza e acompanhamento.",
    },
    {
      icon: Shield,
      title: "Segurança",
      text: "Mais rastreabilidade e governança para mitigar riscos trabalhistas e fiscais.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#031611] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(107,176,161,0.26),transparent_32%),linear-gradient(135deg,#003729_0%,#05231b_48%,#031611_100%)]" />
        <main className="relative mx-auto grid min-h-screen max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
          <section className="space-y-8">
            <div className="flex items-center gap-3">
              <img src={logoMonnera} alt="Monnera" className="h-11 w-11 rounded-lg object-cover" />
              <div>
                <p className="text-sm font-semibold text-[#9fd4c8]">Monnera</p>
                <p className="text-xs text-white/55">Sales Performance & Compliance</p>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#9fd4c8]">
                <Sparkles className="h-3.5 w-3.5" />
                Indicação qualificada
              </div>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl">
                Encurte o caminho entre incentivo de vendas, performance e segurança.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-white/72 sm:text-lg">
                A Monnera ajuda empresas a transformar campanhas comerciais em uma operação mais clara, governada e
                conectada. Preencha o cadastro para iniciar uma conversa objetiva sobre melhoria de performance e
                mitigação de passivo trabalhista.
              </p>
              {parceiroNome && (
                <p className="mt-4 text-sm text-[#9fd4c8]">
                  Você chegou por indicação de <span className="font-semibold text-white">{parceiroNome}</span>.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {pillars.map((pillar) => (
                <div key={pillar.title} className="rounded-lg border border-white/10 bg-white/[0.07] p-4">
                  <pillar.icon className="h-5 w-5 text-[#9fd4c8]" />
                  <h2 className="mt-4 font-semibold">{pillar.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/62">{pillar.text}</p>
                </div>
              ))}
            </div>
          </section>

          <Card className="border-white/10 bg-[#f5faf8] text-[#003729] shadow-2xl shadow-black/25">
            <CardContent className="p-5 sm:p-7">
              <div className="mb-6">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#2b6d5e]">Comece pela conversa certa</p>
                <h2 className="mt-2 text-2xl font-bold">Receba uma apresentação da Monnera</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#4f6d65]">
                  Poucos dados, mais contexto. O time Monnera usa essas informações para direcionar o melhor próximo passo.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className={fieldClass}>
                  <Label>Nome *</Label>
                  <Input value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} placeholder="Seu nome completo" />
                  {errors.nome_responsavel && <p className="text-xs text-red-700">{errors.nome_responsavel}</p>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className={fieldClass}>
                    <Label>Telefone *</Label>
                    <Input value={form.telefone_responsavel} onChange={(e) => setForm({ ...form, telefone_responsavel: e.target.value })} placeholder="(11) 99999-9999" />
                    {errors.telefone_responsavel && <p className="text-xs text-red-700">{errors.telefone_responsavel}</p>}
                  </div>
                  <div className={fieldClass}>
                    <Label>E-mail *</Label>
                    <Input type="email" value={form.email_responsavel} onChange={(e) => setForm({ ...form, email_responsavel: e.target.value })} placeholder="seu@email.com" />
                    {errors.email_responsavel && <p className="text-xs text-red-700">{errors.email_responsavel}</p>}
                  </div>
                </div>
                <div className={fieldClass}>
                  <Label>Nome da empresa *</Label>
                  <Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} placeholder="Nome da empresa" />
                  {errors.nome_fantasia && <p className="text-xs text-red-700">{errors.nome_fantasia}</p>}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className={fieldClass}>
                    <Label>Número de lojas</Label>
                    <Input type="number" min="1" value={form.quantidade_lojas} onChange={(e) => setForm({ ...form, quantidade_lojas: e.target.value })} placeholder="Opcional" />
                    {errors.quantidade_lojas && <p className="text-xs text-red-700">{errors.quantidade_lojas}</p>}
                  </div>
                  <div className={fieldClass}>
                    <Label>Sistema de loja</Label>
                    <Input value={form.erp_utilizado} onChange={(e) => setForm({ ...form, erp_utilizado: e.target.value })} placeholder="Opcional" />
                  </div>
                </div>
                <div className={fieldClass}>
                  <Label>Valor médio pago em campanhas de vendas por mês</Label>
                  <Input type="number" min="0" step="0.01" value={form.valor_campanhas} onChange={(e) => setForm({ ...form, valor_campanhas: e.target.value })} placeholder="R$ (opcional)" />
                </div>

                <Button type="submit" className="w-full bg-[#003729] py-6 text-base font-bold text-white hover:bg-[#064b3a]" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      Quero melhorar minha operação
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-2 text-xs text-[#4f6d65]">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  <p>Seus dados serão usados apenas para contato comercial da Monnera.</p>
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
};

export default CadastroLead;
