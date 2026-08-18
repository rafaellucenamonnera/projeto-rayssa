import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Download, Send } from "lucide-react";
import { toast } from "sonner";
import { ONBOARDING_EMAIL_SUBJECT, renderOnboardingEmail } from "@/lib/onboardingEmailTemplate";

// Card de QA autorizado (allowlist de frontend; backend mantem a propria allowlist).
export const QA_CARD = {
  cardId: "32d1e94e-ab53-42b3-9118-ab3ad2d07c77",
  nome: "TESTE FASE A QA",
  codigo: "QATEST01",
  link: "https://www.canva.com/d/c4zxi4vpjmbpv7V",
  destinatario: "rafael.lucena@monnera.com.br",
};

interface Props {
  cardId: string;
}

export default function OnboardingEmailQaSection({ cardId }: Props) {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  if (cardId !== QA_CARD.cardId) return null;

  const handleLoad = () => {
    setLoaded(true);
    setPreview(null);
    toast.success("Dados do card carregados.");
  };

  const handlePreview = () => {
    const { html, errors } = renderOnboardingEmail({
      nomeParceiro: QA_CARD.nome,
      codigoParceiro: QA_CARD.codigo,
      linkMaterial: QA_CARD.link,
    });
    if (errors.length) {
      errors.forEach((e) => toast.error(e));
      return;
    }
    setLoaded(true);
    setPreview(html);
  };

  const handleSend = () => {
    if (!preview) {
      toast.error("Gere o preview antes de abrir o envio.");
      return;
    }
    navigate("/admin/email-onboarding?qa=1");
  };

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">E-mail de Onboarding</CardTitle>
        <CardDescription>
          Disponível apenas para o card de teste {QA_CARD.nome}. Preview obrigatório; o envio ocorre na tela de
          onboarding com confirmação explícita.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleLoad}>
            <Download className="mr-2 h-4 w-4" /> Carregar dados do card
          </Button>
          <Button onClick={handlePreview}>
            <Eye className="mr-2 h-4 w-4" /> Gerar preview
          </Button>
          <Button variant="secondary" disabled={!preview} onClick={handleSend}>
            <Send className="mr-2 h-4 w-4" /> Enviar e-mail de QA
          </Button>
          <Button variant="ghost" onClick={() => navigate("/admin/email-onboarding?qa=1")}>
            Abrir E-mail de Onboarding
          </Button>
        </div>

        {loaded && (
          <div className="rounded-md border border-border p-3 text-xs text-muted-foreground space-y-1">
            <p><strong>Nome:</strong> {QA_CARD.nome}</p>
            <p><strong>Código:</strong> {QA_CARD.codigo}</p>
            <p className="break-all"><strong>Link Canva:</strong> {QA_CARD.link}</p>
            <p><strong>Destinatário:</strong> {QA_CARD.destinatario}</p>
            <p><strong>Assunto:</strong> {ONBOARDING_EMAIL_SUBJECT}</p>
          </div>
        )}

        {preview && (
          <iframe
            title="Preview do e-mail de onboarding (QA)"
            srcDoc={preview}
            sandbox=""
            className="w-full h-[520px] rounded-md border border-border bg-white"
          />
        )}
      </CardContent>
    </Card>
  );
}
