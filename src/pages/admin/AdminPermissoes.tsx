import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminPermissoes = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text">Permissões</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão de permissões de acesso por papel de usuário.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A configuração granular de permissões estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPermissoes;
