import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CadastroParceiro from "./pages/CadastroParceiro";
import ConfirmacaoCadastro from "./pages/ConfirmacaoCadastro";
import LoginParceiro from "./pages/LoginParceiro";
import PainelParceiro from "./pages/PainelParceiro";
import CadastroLead from "./pages/CadastroLead";
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminParceiros from "./pages/admin/AdminParceiros";
import AdminLeads from "./pages/admin/AdminLeads";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
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
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="parceiros" element={<AdminParceiros />} />
            <Route path="leads" element={<AdminLeads />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
