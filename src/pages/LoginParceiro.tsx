import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import { Link } from "react-router-dom";

const LoginParceiro = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [cpf, setCpf] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cpfClean = cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      toast.error("CPF inválido");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("parceiros_comerciais")
        .select("*")
        .eq("cpf", cpfClean)
        .eq("ativo", true)
        .single();

      if (error || !data) {
        toast.error("CPF não encontrado ou parceiro inativo");
        return;
      }

      localStorage.setItem("monnera_parceiro", JSON.stringify(data));
      navigate("/parceiro");
    } catch {
      toast.error("Erro ao acessar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
            <LogIn className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Acesso do Parceiro</CardTitle>
          <CardDescription>Informe seu CPF para acessar o painel</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="00000000000" maxLength={11} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Acessar
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Não tem cadastro?{" "}
              <Link to="/cadastro" className="text-primary hover:underline">Cadastre-se</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginParceiro;
