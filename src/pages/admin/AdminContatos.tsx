import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminContatos = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-display font-bold glow-text">Contatos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Gestão de contatos (em evolução)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Cadastre pessoas e empresas, vincule a leads e filtre por nome, email, empresa ou telefone.
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminContatos;
