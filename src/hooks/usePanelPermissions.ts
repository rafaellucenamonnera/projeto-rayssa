import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePanelPermissions() {
  const { user, isAdmin } = useAuth();
  const [allowedPanelIds, setAllowedPanelIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setAllowedPanelIds([]);
        setLoading(false);
        return;
      }

      if (isAdmin) {
        const { data } = await (supabase as any).from("pipeline_panels").select("id");
        setAllowedPanelIds((data || []).map((p: any) => p.id));
        setLoading(false);
        return;
      }

      const { data, error } = await (supabase as any)
        .from("user_panel_permissions")
        .select("panel_id, can_access")
        .eq("user_id", user.id)
        .eq("can_access", true);

      if (error) {
        console.error("[usePanelPermissions] erro ao carregar permissões", error);
        setAllowedPanelIds([]);
        setLoading(false);
        return;
      }

      setAllowedPanelIds((data || []).map((row: any) => row.panel_id));
      setLoading(false);
    };

    setLoading(true);
    load();
  }, [user?.id, isAdmin]);

  const canAccessPanel = useMemo(() => {
    return (panelId: string) => isAdmin || allowedPanelIds.includes(panelId);
  }, [allowedPanelIds, isAdmin]);

  return { allowedPanelIds, canAccessPanel, loading };
}
