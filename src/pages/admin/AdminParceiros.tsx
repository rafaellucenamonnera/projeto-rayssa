import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const AdminParceiros = () => {
  const { isAdmin } = useAuth();
  const [parceiros, setParceiros] = useState<any[]>([]);
  const [leadsCount, setLeadsCount] = useState<Record<string, number>>({});

  const load = async () => {
    const { data: p } = await supabase
      .from("parceiros_comerciais")
      .select("*")
      .order("data_cadastro", { ascending: false });
    setParceiros(p || []);

    const { data: leads } = await supabase.from("leads").select("parceiro_id");
    const counts: Record<string, number> = {};
    (leads || []).forEach((l) => {
      counts[l.parceiro_id] = (counts[l.parceiro_id] || 0) + 1;
    });
    setLeadsCount(counts);
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Excluir o consultor ${nome}? Todos os leads vinculados também serão afetados.`)) return;
    const { error } = await supabase.from("parceiros_comerciais").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir consultor: " + error.message);
      return;
    }
    toast.success("Consultor excluído");
    load();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-display font-bold">Consultores Comerciais</h1>

      {/* Mobile card view */}
      <div className="space-y-3 lg:hidden">
        {parceiros.map((p) => (
          <Card key={p.id} className="border-border">
            <CardContent className="p-3 sm:p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">
                    {p.codigo_parceiro}
                  </span>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.nome)} className="text-destructive hover:text-destructive h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>
                  <span className="text-muted-foreground">CPF: </span>
                  <span className="font-mono">{p.cpf}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tel: </span>
                  <span>({p.telefone_ddd}) {p.telefone_numero}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data: </span>
                  <span>{new Date(p.data_cadastro).toLocaleDateString("pt-BR")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Leads: </span>
                  <span className="font-semibold">{leadsCount[p.id] || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {parceiros.length === 0 && (
          <p className="text-center py-8 text-muted-foreground text-sm">Nenhum consultor cadastrado.</p>
        )}
      </div>

      {/* Desktop table */}
      <Card className="border-border hidden lg:block">
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
                  {isAdmin && <th className="text-left py-3 px-4 text-muted-foreground font-medium"></th>}
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
                    {isAdmin && (
                      <td className="py-3 px-4">
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.nome)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {parceiros.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum consultor cadastrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminParceiros;
