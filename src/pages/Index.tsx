import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  Handshake,
  LineChart,
  LockKeyhole,
  Network,
  Shield,
  Sparkles,
  Store,
  Target,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

const opportunityCards = [
  {
    icon: Store,
    title: "Dor clara no mercado",
    text: "Redes, indústrias e distribuidores precisam incentivar sell-out com mais controle, menos planilha e mais visibilidade.",
  },
  {
    icon: Shield,
    title: "Argumento forte de valor",
    text: "A conversa combina performance, governança, rastreabilidade e engajamento do time comercial.",
  },
  {
    icon: Handshake,
    title: "Venda consultiva",
    text: "Você abre portas qualificadas e a Monnera apoia com narrativa, materiais e evolução da oportunidade.",
  },
];

const pillars = [
  {
    icon: Network,
    title: "Conexão",
    text: "Integra sistemas, dados, pessoas, comunicação e inteligência para facilitar a operação.",
  },
  {
    icon: Workflow,
    title: "Centralização",
    text: "Campanhas, metas, comunicação, apuração e pagamento em um ambiente único.",
  },
  {
    icon: LockKeyhole,
    title: "Segurança",
    text: "Formalização, rastreabilidade, relatórios e apoio à conformidade da premiação.",
  },
  {
    icon: BarChart3,
    title: "Inteligência de dados",
    text: "Integração D-1 com ERP para dar visibilidade rápida ao que foi vendido e conquistado.",
  },
];

const audiences = [
  "Redes de farmácias",
  "Varejistas com muitas lojas",
  "Distribuidores",
  "Indústrias que incentivam sell-out",
  "Empresas com metas por loja, CPF, produto ou fabricante",
  "Operações que ainda controlam incentivo por planilhas",
];

const salesArguments = [
  {
    icon: FileCheck2,
    title: "O fim da planilha de comissão",
    text: "Menos erro humano, menos retrabalho e mais controle para RH, financeiro e gestão comercial.",
  },
  {
    icon: Zap,
    title: "O poder do D-1",
    text: "O vendedor vê hoje o que conquistou ontem, fortalecendo clareza, motivação e repetição de comportamento.",
  },
  {
    icon: Target,
    title: "Meritocracia por CPF",
    text: "Reconhecimento individual mesmo em operações com várias lojas, metas e campanhas simultâneas.",
  },
  {
    icon: BadgeCheck,
    title: "Premiação com governança",
    text: "Termo de aceite, regras claras, rastreabilidade e uma operação mais segura do planejamento ao pagamento.",
  },
  {
    icon: CircleDollarSign,
    title: "Modelo ganha-ganha",
    text: "Setup, implantação e crescimento alinhados à performance e à maturidade comercial do cliente.",
  },
];

const steps = [
  "Cadastre-se como Embaixador",
  "Receba orientação e materiais comerciais",
  "Indique empresas com fit para a Monnera",
  "Acompanhe oportunidades com apoio do time Monnera",
];

const profileItems = [
  "Você tem relacionamento com varejo, indústria, distribuidores ou redes comerciais.",
  "Você entende dores de vendas, trade, RH, financeiro ou gestão.",
  "Você gosta de abrir portas com uma proposta consultiva.",
  "Você quer representar uma solução com valor real e narrativa forte.",
  "Você busca uma oportunidade comercial com suporte e posicionamento claro.",
];

const faqs = [
  {
    question: "Preciso ser vendedor profissional para ser Embaixador?",
    answer:
      "Não necessariamente. O mais importante é ter acesso a empresas com dores de incentivo, vendas, varejo ou operação comercial e conseguir abrir uma conversa qualificada.",
  },
  {
    question: "A Monnera é uma carteira digital?",
    answer:
      "Não. A Monnera é uma solução de Governance & Performance para gestão de incentivo de vendas. Pagamento é apenas uma etapa da operação.",
  },
  {
    question: "Que tipo de empresa tem fit?",
    answer:
      "Redes varejistas, indústrias, distribuidores e empresas com campanhas comerciais, times de vendas, metas por loja, CPF, produto ou fabricante.",
  },
  {
    question: "A Monnera ajuda no processo comercial?",
    answer:
      "Sim. O embaixador abre a oportunidade e a Monnera apoia com narrativa, materiais, conhecimento técnico e evolução da conversa.",
  },
  {
    question: "Como funciona a segurança jurídica?",
    answer:
      "A Monnera trabalha com formalização, rastreabilidade e governança da premiação. Pontos jurídicos e tributários devem ser avaliados conforme o contexto da empresa.",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen overflow-hidden bg-[#07110f] text-white">
      <section className="relative min-h-screen px-5 py-6 sm:px-8 lg:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(107,176,161,0.28),transparent_34%),radial-gradient(circle_at_18%_25%,rgba(255,255,255,0.10),transparent_26%),linear-gradient(135deg,#07110f_0%,#0b1815_44%,#003729_130%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(120deg,transparent_0%,transparent_48%,rgba(107,176,161,0.45)_49%,transparent_50%,transparent_100%)] [background-size:80px_80px]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
          <header className="flex items-center justify-between gap-4 py-2">
            <button onClick={() => navigate("/")} className="flex items-center gap-3 text-left" aria-label="Monnera Comercial">
              <img src={logoMonnera} alt="Monnera" className="h-12 w-12 rounded-xl object-cover" fetchPriority="high" loading="eager" decoding="async" />
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-[#6BB0A1]">Monnera</p>
                <p className="text-lg font-semibold leading-none">Comercial</p>
              </div>
            </button>
            <div className="hidden items-center gap-3 md:flex">
              <Button variant="ghost" className="text-white/80 hover:text-white" onClick={() => navigate("/login")}>
                Já sou Embaixador
              </Button>
              <Button className="bg-[#6BB0A1] text-[#07110f] hover:bg-[#8ad0c1]" onClick={() => navigate("/cadastro")}>
                Quero ser Embaixador
              </Button>
            </div>
          </header>

          <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
            <div className="max-w-3xl">
              <div className="mb-7 flex flex-wrap gap-2">
                {["Sales Performance & Compliance", "Gestão de incentivo de vendas", "Do planejamento ao pagamento"].map((item) => (
                  <span key={item} className="rounded-full border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b9ede2]">
                    {item}
                  </span>
                ))}
              </div>
              <h1 className="max-w-4xl text-4xl font-bold leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl">
                Seja um Embaixador Monnera e leve performance para o varejo.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-white/72 sm:text-xl">
                Indique uma solução que transforma dados de vendas em campanhas de incentivo mais claras, seguras e eficientes. A Monnera conecta estratégia, operação e pessoas para que o desempenho extraordinário vire rotina.
              </p>
              <div className="mt-9 flex flex-col gap-4 sm:flex-row">
                <Button size="lg" className="h-14 bg-[#6BB0A1] px-7 text-base font-bold text-[#07110f] hover:bg-[#8ad0c1]" onClick={() => navigate("/cadastro")}>
                  <Users className="mr-2 h-5 w-5" />
                  Quero ser Embaixador
                </Button>
                <Button size="lg" variant="outline" className="h-14 border-white/25 bg-white/5 px-7 text-base font-bold text-white hover:bg-white/12 hover:text-white" onClick={() => document.getElementById("oportunidade")?.scrollIntoView({ behavior: "smooth" })}>
                  Entender a oportunidade <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="rounded-[2rem] border border-white/12 bg-white/10 p-5 shadow-2xl backdrop-blur-xl">
                <div className="rounded-[1.5rem] bg-[#f4fbf8] p-5 text-[#06221a] shadow-2xl">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#3d7c70]">Fluxo de valor</p>
                      <h2 className="text-2xl font-bold">Indicação que vira operação</h2>
                    </div>
                    <LineChart className="h-9 w-9 text-[#003729]" />
                  </div>
                  <div className="space-y-3">
                    {["Rede varejista", "ERP integrado", "Campanha Monnera", "Vendedor premiado"].map((item, index) => (
                      <div key={item} className="flex items-center gap-3 rounded-2xl border border-[#d6ebe5] bg-white p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#003729] text-sm font-bold text-white">{index + 1}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{item}</p>
                          <div className="mt-2 h-2 rounded-full bg-[#e3f2ee]">
                            <div className="h-2 rounded-full bg-[#6BB0A1]" style={{ width: `${46 + index * 14}%` }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl bg-[#003729] p-4 text-white">
                    <p className="text-sm text-white/70">Mensagem para o cliente</p>
                    <p className="mt-1 text-lg font-bold">Transformando dados em desempenho extraordinário.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="oportunidade" className="bg-[#f6fbf8] px-5 py-20 text-[#08231c] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#2f7e70]">Oportunidade comercial</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Por que vender Monnera?</h2>
            <p className="mt-5 text-lg leading-8 text-[#36534c]">
              Toda rede que vende com times distribuídos enfrenta o mesmo desafio: transformar metas, campanhas e dados em ação clara na ponta. A Monnera resolve essa operação com tecnologia, inteligência e segurança.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {opportunityCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-3xl border border-[#d6ebe5] bg-white p-7 shadow-sm">
                  <Icon className="h-9 w-9 text-[#003729]" />
                  <h3 className="mt-5 text-xl font-bold">{card.title}</h3>
                  <p className="mt-3 leading-7 text-[#4b625c]">{card.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 text-[#08231c] sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#2f7e70]">O que você representa</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Uma solução completa para campanhas de incentivo</h2>
            <p className="mt-5 text-lg leading-8 text-[#4b625c]">
              A Monnera não é apenas meio de pagamento. É uma plataforma de Governance & Performance para transformar premiação comercial em gestão.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <article key={pillar.title} className="rounded-3xl bg-[#f3faf7] p-6">
                  <Icon className="h-8 w-8 text-[#003729]" />
                  <h3 className="mt-4 text-xl font-bold">{pillar.title}</h3>
                  <p className="mt-3 leading-7 text-[#4b625c]">{pillar.text}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#0b1815] px-5 py-20 text-white sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#6BB0A1]">Fit comercial</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Quem precisa ouvir sobre a Monnera?</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {audiences.map((audience) => (
                <div key={audience} className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/7 p-4">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#6BB0A1]" />
                  <span className="font-semibold text-white/88">{audience}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6fbf8] px-5 py-20 text-[#08231c] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#2f7e70]">Argumentos de venda</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Você leva uma conversa que já nasce estratégica</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {salesArguments.map((argument) => {
              const Icon = argument.icon;
              return (
                <article key={argument.title} className="rounded-3xl border border-[#d6ebe5] bg-white p-6 shadow-sm">
                  <Icon className="h-8 w-8 text-[#003729]" />
                  <h3 className="mt-4 text-lg font-bold">{argument.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#4b625c]">{argument.text}</p>
                </article>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-[#61766f]">Alegações jurídicas e tributárias devem ser validadas conforme o contexto de cada empresa.</p>
        </div>
      </section>

      <section className="bg-white px-5 py-20 text-[#08231c] sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#2f7e70]">Como funciona</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Do interesse ao fechamento, você não caminha sozinho</h2>
            <div className="mt-8 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4 rounded-3xl bg-[#f3faf7] p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003729] font-bold text-white">{index + 1}</div>
                  <p className="self-center text-lg font-semibold">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[2rem] bg-[#003729] p-8 text-white">
            <Sparkles className="h-10 w-10 text-[#6BB0A1]" />
            <h3 className="mt-5 text-3xl font-bold">Esse programa é para você se...</h3>
            <div className="mt-7 space-y-4">
              {profileItems.map((item) => (
                <div key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#6BB0A1]" />
                  <p className="leading-7 text-white/82">{item}</p>
                </div>
              ))}
            </div>
            <Button className="mt-8 h-12 bg-[#6BB0A1] px-6 font-bold text-[#07110f] hover:bg-[#8ad0c1]" onClick={() => navigate("/cadastro")}>
              Começar agora <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-[#f6fbf8] px-5 py-20 text-[#08231c] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] bg-white p-8 shadow-sm md:p-12">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#2f7e70]">Prova de valor</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">A Monnera conecta estratégia e ponta</h2>
                <p className="mt-5 text-lg leading-8 text-[#4b625c]">
                  Campanhas de incentivo só geram resultado quando a regra é clara, o dado chega rápido, a operação é centralizada e o participante entende seu progresso.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Planejamento", "ERP D-1", "Campanha", "Acompanhamento", "Apuração", "Premiação"].map((item) => (
                  <div key={item} className="rounded-2xl bg-[#f3faf7] p-4 text-center font-bold text-[#003729]">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 text-[#08231c] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-bold uppercase tracking-[0.25em] text-[#2f7e70]">FAQ</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Perguntas de quem está avaliando a oportunidade</h2>
          <div className="mt-10 space-y-4">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-3xl border border-[#d6ebe5] bg-[#f6fbf8] p-6">
                <h3 className="text-xl font-bold">{faq.question}</h3>
                <p className="mt-3 leading-7 text-[#4b625c]">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#003729] px-5 py-20 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <BriefcaseBusiness className="h-12 w-12 text-[#6BB0A1]" />
          <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">Pronto para levar a Monnera para novas redes?</h2>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/78">
            Se você conhece empresas que precisam transformar dados de vendas em incentivo, clareza e performance, existe uma oportunidade esperando por você.
          </p>
          <div className="mt-9 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
            <Button size="lg" className="h-14 bg-[#6BB0A1] px-7 text-base font-bold text-[#07110f] hover:bg-[#8ad0c1]" onClick={() => navigate("/cadastro")}>
              Quero ser Embaixador Monnera
            </Button>
            <Button size="lg" variant="outline" className="h-14 border-white/30 bg-transparent px-7 text-base font-bold text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/login")}>
              Já sou Embaixador <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/login")} className="mt-8 text-white/55 hover:bg-white/10 hover:text-white">
            <Shield className="mr-2 h-4 w-4" />
            Retaguarda Monnera
          </Button>
        </div>
      </section>
    </main>
  );
};

export default Index;
