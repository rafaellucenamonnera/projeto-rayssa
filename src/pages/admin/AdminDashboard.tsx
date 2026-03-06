import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText } from "lucide-react";

const AdminDashboard = () => {
  const [totalParceiros, setTotalParceiros] = useState(0);
  const [totalLeads, setTotalLeads] = useState(0);

  useEffect(() => {
    const load = async () => {
      const [parceiros, leads] = await Promise.all([
        supabase.from("parceiros_comerciais").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("id", { count: "exact", head: true }),
      ]);
      setTotalParceiros(parceiros.count || 0);
      setTotalLeads(leads.count || 0);
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-display font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Consultores Comerciais</p>
              <p className="text-3xl font-display font-bold">{totalParceiros}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-info/10 flex items-center justify-center">
              <FileText className="w-7 h-7 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leads Captados</p>
              <p className="text-3xl font-display font-bold">{totalLeads}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
