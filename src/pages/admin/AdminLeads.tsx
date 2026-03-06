import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const AdminLeads = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [parceiros, setParceiros] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const [leadsRes, parceirosRes] = await Promise.all([
        supabase.from("leads").select("*").order("data_cadastro", { ascending: false }),
        supabase.from("parceiros_comerciais").select("id, nome"),
      ]);
      setLeads(leadsRes.data || []);
      const map: Record<string, string> = {};
      (parceirosRes.data || []).forEach((p) => { map[p.id] = p.nome; });
      setParceiros(map);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Leads Recebidos</h1>
      <Card className="border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Empresa</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">CNPJ</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Cidade</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Responsável</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Telefone</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Email</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">ERP</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Lojas</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Parceiro</th>
                  <th className="text-left py-3 px-4 text-muted-foreground font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <td className="py-3 px-4">{l.nome_fantasia}</td>
                    <td className="py-3 px-4 font-mono text-xs">{l.cnpj}</td>
                    <td className="py-3 px-4">{l.cidade}</td>
                    <td className="py-3 px-4">{l.nome_responsavel}</td>
                    <td className="py-3 px-4">{l.telefone_responsavel}</td>
                    <td className="py-3 px-4">{l.email_responsavel}</td>
                    <td className="py-3 px-4">{l.erp_utilizado}</td>
                    <td className="py-3 px-4">{l.quantidade_lojas}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs">{parceiros[l.parceiro_id] || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{new Date(l.data_cadastro).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {leads.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Nenhum lead cadastrado.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLeads;
