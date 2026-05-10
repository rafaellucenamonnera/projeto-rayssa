import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Users, Shield } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

const Index = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-2xl text-center space-y-8">
          <img src={logoMonnera} alt="Monnera" className="w-20 h-20 rounded-xl mx-auto" fetchPriority="high" loading="eager" decoding="async" />
          <h1 className="text-4xl md:text-5xl font-display font-bold leading-tight">
            <span className="glow-text text-[#32b89b] shadow-none">Monnera</span> Comercial
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Plataforma de geração de novos negócios através de embaixadores Monnera. 
            Cadastre-se, gere links exclusivos e acompanhe seus leads.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/cadastro")}>
              <Users className="mr-2 h-5 w-5" />
              Quero ser Embaixador Monnera
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
              Já sou Embaixador Monnera <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="pt-8">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/login")} className="text-muted-foreground">
              <Shield className="mr-2 h-4 w-4" />
              Retaguarda Monnera
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
