import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminPermissoes = () => {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text">Permissões</h1>
      <Card>
        <CardHeader>
          <CardTitle>RBAC por módulo (em evolução)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure acessos por painel e ações específicas por perfil.
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPermissoes;
