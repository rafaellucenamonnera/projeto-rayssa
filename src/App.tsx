import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CadastroParceiro from "./pages/CadastroParceiro";
import ConfirmacaoCadastro from "./pages/ConfirmacaoCadastro";
import LoginParceiro from "./pages/LoginParceiro";
import PainelParceiro from "./pages/PainelParceiro";
import CadastroLead from "./pages/CadastroLead";
import AdminLayout from "./layouts/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminParceiros from "./pages/admin/AdminParceiros";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminUsuarios from "./pages/admin/AdminUsuarios";
import PrimeiroAcesso from "./pages/PrimeiroAcesso";
import ResetarSenha from "./pages/ResetarSenha";
import EsqueciSenha from "./pages/EsqueciSenha";

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
