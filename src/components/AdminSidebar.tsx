import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, Users, FileText, UserCog, DollarSign, Briefcase, Settings, ShieldCheck, PlugZap, Contact, HeartPulse } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { usePanelPermissions } from "@/hooks/usePanelPermissions";
import { supabase } from "@/integrations/supabase/client";
import logoMonnera from "@/assets/logo-monnera.jpg";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AdminSidebar() {
  const { state } = useSidebar();
  const { isAdmin } = useAuth();
  const { canAccessPanel } = usePanelPermissions();
  const collapsed = state === "collapsed";
  const [panels, setPanels] = useState<Array<{ id: string; name: string; sort_order: number }>>([]);

  useEffect(() => {
    const loadPanels = async () => {
      const { data } = await (supabase as any)
        .from("pipeline_panels")
        .select("id,name,sort_order")
        .order("sort_order", { ascending: true });
      setPanels((data as Array<{ id: string; name: string; sort_order: number }>) || []);
    };
    loadPanels();
  }, []);

  const fixedItems = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
    { title: "Embaixadores Monnera", url: "/admin/parceiros", icon: Users },
    { title: "Contatos", url: "/admin/contatos", icon: Contact },
    { title: "Atualizar Kit e Redes Sociais", url: "/admin/kit-vendas", icon: Briefcase },
  ];

  const dynamicPanelItems = useMemo(
    () =>
      panels
        .filter((panel) => isAdmin || canAccessPanel(panel.id))
        .map((panel) => ({ title: panel.name, url: `/admin/painel/${panel.id}`, icon: FileText })),
    [panels, isAdmin, canAccessPanel],
  );
  const items = [...fixedItems, ...dynamicPanelItems];

  const configItems = isAdmin
    ? [
        { title: "Usuários", url: "/admin/usuarios", icon: UserCog },
        { title: "Permissões", url: "/admin/permissoes", icon: ShieldCheck },
        { title: "Integrações", url: "/admin/integracoes", icon: PlugZap },
        { title: "Edição de Painel", url: "/admin/edicao-painel", icon: Settings },
      ]
    : [];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center gap-2">
          <img src={logoMonnera} alt="Monnera" className="w-8 h-8 rounded-md border border-[#6BB0A1]/40" />
          {!collapsed && (
            <h2 className="text-lg font-display font-bold text-sidebar-foreground">Monnera</h2>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel>Retaguarda</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/admin"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>
              <span className="flex items-center gap-2">
                <Settings className="h-3.5 w-3.5" />
                Configurações
              </span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="hover:bg-sidebar-accent/50"
                        activeClassName="bg-sidebar-accent text-primary font-medium"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
