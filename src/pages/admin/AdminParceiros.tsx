import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const AdminParceiros = () => {
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [leadsCount, setLeadsCount] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase
        .from("parceiros_comerciais")
        .select("*")
        .order("data_cadastro", { ascending: false });
      setParceiros(p || []);

      // Get leads count per partner
      const { data: leads } = await supabase.from("leads").select("parceiro_id");
      const counts: Record<string, number> = {};
      (leads || []).forEach((l) => {
        counts[l.parceiro_id] = (counts[l.parceiro_id] || 0) + 1;
      });
      setLeadsCount(counts);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Parceiros Comerciais</h1>
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">CPF</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Telefone</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Código</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Leads</th>
                </tr>
              </thead>
              <tbody>
                {parceiros.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <td className="py-3 px-4">{p.nome}</td>
                    <td className="py-3 px-4 font-mono text-xs">{p.cpf}</td>
                    <td className="py-3 px-4">{p.email}</td>
                    <td className="py-3 px-4">({p.telefone_ddd}) {p.telefone_numero}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono">{p.codigo_parceiro}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(p.data_cadastro).toLocaleDateString("pt-BR")}</td>
                    <td className="py-3 px-4 font-semibold">{leadsCount[p.id] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parceiros.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum parceiro cadastrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminParceiros;
