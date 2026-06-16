import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logoMonnera from "@/assets/logo-monnera.jpg";
import PasswordRequirements from "@/components/PasswordRequirements";
import { validatePassword, isWeakPasswordError, PASSWORD_INVALID_MSG, PASSWORD_WEAK_MSG } from "@/lib/passwordPolicy";

const ResetarSenha = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    // Check if we already have a session (recovery may have completed before mount)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true);
      } else {
        // Check URL hash for recovery token indicator
        const hash = window.location.hash;
        if (hash && hash.includes("type=recovery")) {
          // Token is in URL but session not yet established — wait a bit more
          timeoutId = setTimeout(() => {
            supabase.auth.getSession().then(({ data: { session: s } }) => {
              if (s) setReady(true);
              else setExpired(true);
            });
          }, 5000);
        } else if (!hash || !hash.includes("access_token")) {
          // No token in URL at all — link is invalid or already used
          setExpired(true);
        }
      }
    });

    // Global timeout fallback
    const globalTimeout = setTimeout(() => {
      setReady((prev) => {
        if (!prev) setExpired(true);
        return prev;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeoutId);
      clearTimeout(globalTimeout);
    };
  }, []);

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

      toast.success("Senha redefinida com sucesso!");
      await supabase.auth.signOut();
      navigate("/login");
    } catch (error: any) {
      toast.error(isWeakPasswordError(error?.message) ? PASSWORD_WEAK_MSG : "Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (expired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border text-center">
          <CardContent className="py-12 space-y-4">
            <p className="text-destructive font-semibold">Link expirado ou inválido</p>
            <p className="text-muted-foreground text-sm">
              O link de redefinição já foi utilizado ou expirou. Solicite um novo.
            </p>
            <Button variant="outline" onClick={() => navigate("/esqueci-senha")}>
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border text-center">
          <CardContent className="py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Validando link de redefinição...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm border-border">
        <CardHeader className="text-center space-y-2">
          <img src={logoMonnera} alt="Monnera" className="w-12 h-12 rounded-xl mx-auto mb-2" />
          <CardTitle className="text-2xl font-display">Redefinir Senha</CardTitle>
          <CardDescription>Defina sua nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">Nova Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Crie sua nova senha" />
              <PasswordRequirements password={password} />
            </div>
            <div>
              <Label htmlFor="confirm">Confirmar Senha</Label>
              <Input id="confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Redefinir Senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetarSenha;
