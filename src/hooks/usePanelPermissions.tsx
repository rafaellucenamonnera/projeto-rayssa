import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PanelKey = "comercial" | "onboarding" | "sucesso" | "campanhas";

const MODULE_BY_PANEL: Record<PanelKey, string> = {
  comercial: "painel_comercial",
  onboarding: "painel_onboarding",
  sucesso: "painel_sucesso",
  campanhas: "painel_campanhas",
};

export function usePanelPermissions() {
  const { user, isAdmin } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        setPermissions({});
        setLoaded(true);
        return;
      }
      const { data } = await (supabase as any)
        .from("module_permissions")
        .select("modulo, acao, permitido")
        .eq("user_id", user.id)
        .eq("acao", "acessar");
      if (cancelled) return;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.modulo] = !!row.permitido;
      });
      setPermissions(map);
      setLoaded(true);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const canAccessPanel = (panel: PanelKey): boolean => {
    if (isAdmin) return true;
    if (!loaded) return true; // avoid flicker hiding before load
    const modulo = MODULE_BY_PANEL[panel];
    // Default-allow when no explicit record exists; deny only when explicitly false.
    return permissions[modulo] !== false;
  };

  return { canAccessPanel, loaded };
}
