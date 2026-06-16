import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";
import PasswordRequirements from "@/components/PasswordRequirements";
import { validatePassword, isWeakPasswordError, PASSWORD_INVALID_MSG, PASSWORD_WEAK_MSG } from "@/lib/passwordPolicy";

const PrimeiroAcesso = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin/login");
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword(password)) {
      toast.error(PASSWORD_INVALID_MSG);
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      if (user) {
        await supabase
          .from("profiles")
          .update({ primeiro_acesso: false } as any)
          .eq("user_id", user.id);
      }

      toast.success("Senha definida com sucesso!");
      navigate("/admin");
    } catch (error: any) {
      toast.error(isWeakPasswordError(error?.message) ? PASSWORD_WEAK_MSG : "Erro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center space-y-2">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-2xl font-display">Definir Senha</CardTitle>
          <CardDescription>Crie sua senha para acessar o sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nova Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie sua senha" />
              <PasswordRequirements password={password} />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar Senha</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Criar Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrimeiroAcesso;
