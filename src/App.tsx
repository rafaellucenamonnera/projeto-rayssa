import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense } from "react";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CadastroParceiro = lazy(() => import("./pages/CadastroParceiro"));
const ConfirmacaoCadastro = lazy(() => import("./pages/ConfirmacaoCadastro"));
const LoginParceiro = lazy(() => import("./pages/LoginParceiro"));
const PainelParceiro = lazy(() => import("./pages/PainelParceiro"));
const CadastroLead = lazy(() => import("./pages/CadastroLead"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminParceiros = lazy(() => import("./pages/admin/AdminParceiros"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminUsuarios = lazy(() => import("./pages/admin/AdminUsuarios"));
const PrimeiroAcesso = lazy(() => import("./pages/PrimeiroAcesso"));
const ResetarSenha = lazy(() => import("./pages/ResetarSenha"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/cadastro" element={<CadastroParceiro />} />
            <Route path="/confirmacao" element={<ConfirmacaoCadastro />} />
            <Route path="/login" element={<LoginParceiro />} />
            <Route path="/parceiro" element={<PainelParceiro />} />
            <Route path="/lead/:codigoParceiro" element={<CadastroLead />} />
            <Route path="/indicacao/:slugConsultor" element={<CadastroLead />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="parceiros" element={<AdminParceiros />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="usuarios" element={<AdminUsuarios />} />
            </Route>
            <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
            <Route path="/resetar-senha" element={<ResetarSenha />} />
            <Route path="/esqueci-senha" element={<EsqueciSenha />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
