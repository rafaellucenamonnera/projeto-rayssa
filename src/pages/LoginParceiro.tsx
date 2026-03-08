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

      localStorage.setItem("monnera_parceiro", JSON.stringify(parceiro));
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
