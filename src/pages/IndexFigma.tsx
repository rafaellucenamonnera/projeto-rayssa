import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ExternalLink, Shield, Users } from "lucide-react";

const FIGMA_EMBED_URL =
  "https://embed.figma.com/proto/cUG2qr3iNAVehIJkTtA8f5/Ambiente-Parceiros?node-id=102-854&p=f&scaling=min-zoom&content-scaling=fixed&page-id=102%3A153&starting-point-node-id=102%3A854&embed-host=share";

const FIGMA_FILE_URL =
  "https://www.figma.com/design/cUG2qr3iNAVehIJkTtA8f5/Ambiente-Parceiros?node-id=102-854&p=f";

const IndexFigma = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen bg-[#07110f] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07110f]/92 px-4 py-3 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6BB0A1]">Monnera Comercial</p>
            <h1 className="text-xl font-bold leading-tight sm:text-2xl">Programa de Embaixadores</h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="bg-[#6BB0A1] font-bold text-[#07110f] hover:bg-[#8ad0c1]" onClick={() => navigate("/cadastro")}>
              <Users className="mr-2 h-4 w-4" />
              Quero ser Embaixador
            </Button>
            <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => navigate("/login")}>
              Já sou Embaixador <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-5 md:px-8 md:py-8">
        <div className="overflow-hidden rounded-[28px] border border-white/12 bg-[#0b1815] shadow-2xl">
          <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 md:flex-row md:items-center md:justify-between md:px-5">
            <span>Landing page criada no Figma, incorporada ao ambiente de embaixadores.</span>
            <a
              href={FIGMA_FILE_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-[#6BB0A1] hover:text-[#8ad0c1]"
            >
              Abrir no Figma <ExternalLink className="h-4 w-4" />
            </a>
          </div>

          <div className="relative h-[calc(100vh-190px)] min-h-[620px] w-full bg-[#111820]">
            <iframe
              title="Landing Page Embaixadores Monnera"
              src={FIGMA_EMBED_URL}
              allowFullScreen
              className="h-full w-full border-0"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-center sm:flex-row sm:text-left">
          <p className="text-sm leading-6 text-white/72">
            Se o visitante decidir avançar, os botões desta página levam para os fluxos reais de cadastro e login do sistema.
          </p>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin/login")} className="text-white/60 hover:bg-white/10 hover:text-white">
            <Shield className="mr-2 h-4 w-4" />
            Retaguarda Monnera
          </Button>
        </div>
      </section>
    </main>
  );
};

export default IndexFigma;
