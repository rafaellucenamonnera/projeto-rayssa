import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminIntegracoes = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie integrações com sistemas externos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Em construção</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As integrações disponíveis serão listadas aqui em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIntegracoes;
