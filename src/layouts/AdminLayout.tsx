import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";
import { NotificationCenter } from "@/components/admin/NotificationCenter";

const AdminLayout = () => {
  const navigate = useNavigate();
  const { user, isInternalUser, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isInternalUser) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 sm:h-14 flex items-center justify-between border-b border-border bg-card/95 px-3 sm:px-4 shadow-sm">
            <div className="flex items-center min-w-0">
              <SidebarTrigger className="mr-2 sm:mr-4" />
              <span className="text-xs sm:text-sm font-medium text-foreground truncate">Retaguarda Monnera</span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationCenter />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0">
                <LogOut className="mr-1 sm:mr-2 h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-8 overflow-x-clip">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
