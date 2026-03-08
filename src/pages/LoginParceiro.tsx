import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";
import { lovable } from "@/integrations/lovable/index";
import { Separator } from "@/components/ui/separator";

const LoginParceiro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha email e senha");
      return;
    }

    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (authError) {
        toast.error("Email ou senha incorretos");
        return;
      }

      if (!authData.user) throw new Error("Erro ao autenticar");

      // Look up parceiro by user_id
      let { data: parceiro } = await supabase
        .from("parceiros_comerciais")
        .select("*")
        .eq("user_id", authData.user.id)
        .eq("ativo", true)
        .maybeSingle();

      // Fallback: try by email for legacy parceiros without user_id
      if (!parceiro) {
        const { data: parceiroByEmail } = await supabase
          .from("parceiros_comerciais")
          .select("*")
          .eq("email", authData.user.email!)
          .eq("ativo", true)
          .maybeSingle();

        if (parceiroByEmail) {
          parceiro = parceiroByEmail;
        }
      }

      if (!parceiro) {
        await supabase.auth.signOut();
        toast.error("Consultor não encontrado ou inativo");
        return;
      }

      localStorage.setItem("monnera_parceiro", JSON.stringify({
        id: parceiro.id,
        nome: parceiro.nome,
        codigo_parceiro: parceiro.codigo_parceiro,
        slug_consultor: parceiro.slug_consultor,
      }));
      navigate("/parceiro");
    } catch (error: any) {
      toast.error("Erro ao acessar. Verifique seus dados e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center space-y-2">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-2xl font-display">Acesso do Consultor</CardTitle>
          <CardDescription>Informe seu email e senha para acessar o painel</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Acessar
            </Button>
            <div className="relative my-2">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">ou</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) toast.error("Erro ao entrar com Google");
                setLoading(false);
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Entrar com Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const { error } = await lovable.auth.signInWithOAuth("apple", {
                  redirect_uri: window.location.origin,
                });
                if (error) toast.error("Erro ao entrar com Apple");
                setLoading(false);
              }}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              Entrar com Apple
            </Button>
            <div className="text-center text-sm space-y-1">
              <p>
                <Link to="/esqueci-senha" className="text-primary hover:underline">Esqueci minha senha</Link>
              </p>
              <p className="text-muted-foreground">
                Não é consultor ainda?{" "}
                <Link to="/cadastro" className="text-primary hover:underline">Cadastre-se</Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginParceiro;
