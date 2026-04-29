import { LayoutDashboard, Users, FileText, UserCog, DollarSign, Briefcase, Settings, ShieldCheck, PlugZap, Contact } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
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
  const collapsed = state === "collapsed";

  const items = [
    { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
    { title: "Financeiro", url: "/admin/financeiro", icon: DollarSign },
    { title: "Consultores", url: "/admin/parceiros", icon: Users },
    { title: "Painel Comercial", url: "/admin/painel-comercial", icon: FileText },
    { title: "Painel Onboarding / Integração", url: "/admin/painel-onboarding", icon: FileText },
    { title: "Painel Sucesso", url: "/admin/painel-sucesso", icon: FileText },
    { title: "Painel Criação Campanhas", url: "/admin/painel-campanhas", icon: FileText },
    { title: "Contatos", url: "/admin/contatos", icon: Contact },
    { title: "Atualizar Kit e Redes Sociais", url: "/admin/kit-vendas", icon: Briefcase },
  ];

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
          <img src={logoMonnera} alt="Monnera" className="w-8 h-8 rounded-md" />
          {!collapsed && (
            <h2 className="text-lg font-display font-bold glow-text text-[#32b89b] shadow-none">Monnera</h2>
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
