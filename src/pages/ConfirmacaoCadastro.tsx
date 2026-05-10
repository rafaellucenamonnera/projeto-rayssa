import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";

const ConfirmacaoCadastro = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const parceiro = location.state?.parceiro;

  if (!parceiro) {
    navigate("/cadastro");
    return null;
  }


  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border text-center">
        <CardHeader className="space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Cadastro realizado com sucesso!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 text-muted-foreground">
            <p>Seu cadastro foi recebido com sucesso!</p>
            <p>Um administrador irá analisar e aprovar seu cadastro em breve.</p>
            <p>Após a aprovação, você poderá acessar o painel e utilizar seu link exclusivo de indicação.</p>
          </div>

          <div className="bg-secondary rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Código do embaixador Monnera:</p>
            <p className="text-sm font-mono text-primary">{parceiro.codigo_parceiro}</p>
          </div>

          <Button onClick={() => navigate("/login")} className="w-full">
            Ir para Login <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmacaoCadastro;
