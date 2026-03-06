import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Copy, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const ConfirmacaoCadastro = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const parceiro = location.state?.parceiro;

  if (!parceiro) {
    navigate("/cadastro");
    return null;
  }

  const linkIndicacao = `${window.location.origin}/lead/${parceiro.codigo_parceiro}`;

  const copyLink = () => {
    navigator.clipboard.writeText(linkIndicacao);
    toast.success("Link copiado!");
  };

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
            <p>Seu link exclusivo de captação de leads foi criado.</p>
            <p>Utilize este link para indicar empresas interessadas no Monnera.</p>
            <p>Todos os leads cadastrados através dele serão vinculados ao seu perfil de consultor.</p>
          </div>

          <div className="bg-secondary rounded-lg p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Seu link exclusivo:</p>
            <p className="text-sm font-mono text-primary break-all">{linkIndicacao}</p>
            <Button onClick={copyLink} variant="outline" className="w-full">
              <Copy className="mr-2 h-4 w-4" /> Copiar Link
            </Button>
          </div>

          <Button onClick={() => navigate("/parceiro")} className="w-full">
            Acessar Painel <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmacaoCadastro;
