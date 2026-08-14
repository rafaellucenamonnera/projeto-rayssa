import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

const oauth = () => (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Requisição inválida: authorization_id ausente.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/admin/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const { data, error: decisionError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um destino de redirecionamento.");
      return;
    }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? "o aplicativo";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4faf7] p-4">
      <div className="absolute inset-x-0 top-0 h-40 bg-[#003729]" />
      <Card className="relative w-full max-w-md border-[#d6ebe5] bg-white shadow-xl">
        <CardHeader className="text-center space-y-2">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-xl font-display text-[#003729]">
            {error ? "Não foi possível autorizar" : details ? `Conectar ${clientName}` : "Carregando autorização…"}
          </CardTitle>
          <CardDescription>
            {error
              ? error
              : details
                ? `${clientName} poderá acessar e alterar dados do CRM Monnera em seu nome, respeitando suas permissões.`
                : "Verificando a solicitação de acesso."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!error && !details && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-[#003729]" />
            </div>
          )}
          {details && !error && (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                Recusar
              </Button>
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Autorizar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OAuthConsent;
