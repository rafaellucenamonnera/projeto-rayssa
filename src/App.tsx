import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense, type ComponentType } from "react";

const lazyWithRetry = <T extends { default: ComponentType<any> }>(
  importer: () => Promise<T>,
  retries = 2,
  delayMs = 400,
) =>
  lazy(async () => {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importer();
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }

    throw new Error("Falha ao carregar módulo dinâmico");
  });

// Lazy load pages with prefetch hints
const Index = lazy(() => import("./pages/IndexFigma"));
const NotFound = lazy(() => import("./pages/NotFound"));
const CadastroParceiro = lazy(() => import("./pages/CadastroParceiro"));
const ConfirmacaoCadastro = lazy(() => import("./pages/ConfirmacaoCadastro"));
const LoginParceiro = lazy(() => import("./pages/LoginParceiro"));
const PainelParceiro = lazy(() => import("./pages/PainelParceiro"));
const CadastroLead = lazy(() => import("./pages/CadastroLead"));
const FormularioConversao = lazy(() => import("./pages/FormularioConversao"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminFinanceiro = lazy(() => import("./pages/admin/AdminFinanceiro"));
const AdminParceiros = lazyWithRetry(() => import("./pages/admin/AdminParceiros"));
const AdminLeads = lazyWithRetry(() => import("./pages/admin/AdminLeads"));
const AdminSuccessPanel = lazyWithRetry(() => import("./pages/admin/AdminSuccessPanel"));
const AdminUsuarios = lazyWithRetry(() => import("./pages/admin/AdminUsuarios"));
const AdminKitVendas = lazy(() => import("./pages/admin/AdminKitVendas"));
const AdminPermissoes = lazy(() => import("./pages/admin/AdminPermissoes"));
const AdminIntegracoes = lazy(() => import("./pages/admin/AdminIntegracoes"));
const AdminContatos = lazy(() => import("./pages/admin/AdminContatos"));
const AdminPipelineEdit = lazy(() => import("./pages/admin/AdminPipelineEdit"));
const AdminGeradorProposta = lazy(() => import("./pages/admin/AdminGeradorProposta"));
const AdminDocumentacao = lazy(() => import("./pages/admin/AdminDocumentacao"));
const PrimeiroAcesso = lazy(() => import("./pages/PrimeiroAcesso"));
const ResetarSenha = lazy(() => import("./pages/ResetarSenha"));
const EsqueciSenha = lazy(() => import("./pages/EsqueciSenha"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const TesteMonnera = lazy(() => import("./pages/TesteMonnera"));

// Configure QueryClient with optimized defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/cadastro" element={<CadastroParceiro />} />
              <Route path="/confirmacao" element={<ConfirmacaoCadastro />} />
              <Route path="/login" element={<LoginParceiro />} />
              <Route path="/parceiro" element={<PainelParceiro />} />
              <Route path="/lead/:codigoParceiro" element={<CadastroLead />} />
              <Route path="/indicacao/:slugConsultor" element={<CadastroLead />} />
              <Route path="/completar-cadastro/:token" element={<FormularioConversao />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="financeiro" element={<AdminFinanceiro />} />
                <Route path="parceiros" element={<AdminParceiros />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="painel-comercial" element={<AdminLeads />} />
                <Route path="painel-onboarding" element={<AdminLeads />} />
                <Route path="painel-sucesso" element={<AdminSuccessPanel />} />
                <Route path="painel/sucesso" element={<AdminSuccessPanel />} />
                <Route path="painel-campanhas" element={<AdminLeads />} />
                <Route path="painel/:panelId" element={<AdminLeads />} />
                <Route path="contatos" element={<AdminContatos />} />
                <Route path="usuarios" element={<AdminUsuarios />} />
                <Route path="permissoes" element={<AdminPermissoes />} />
                <Route path="integracoes" element={<AdminIntegracoes />} />
                <Route path="edicao-painel" element={<AdminPipelineEdit />} />
                <Route path="kit-vendas" element={<AdminKitVendas />} />
                <Route path="gerador-proposta/:leadId" element={<AdminGeradorProposta />} />
                <Route path="documentacao" element={<AdminDocumentacao />} />
              </Route>
              <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
              <Route path="/resetar-senha" element={<ResetarSenha />} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/proposta/:token" element={<PropostaPublica />} />
              <Route path="/teste-monnera" element={<TesteMonnera />} />
              <Route path="/testemonnera" element={<TesteMonnera />} />
              <Route path="/testemonnera/:slugConsultor" element={<TesteMonnera />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
