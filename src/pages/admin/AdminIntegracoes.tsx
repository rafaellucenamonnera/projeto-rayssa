import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminIntegracoes = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text text-[#32b89b] shadow-none">Integrações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gestão de integrações (em evolução)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure integrações externas com governança centralizada.
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIntegracoes;
