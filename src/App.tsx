import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { lazy, Suspense, type ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

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
const Index = lazyWithRetry(() => import("./pages/IndexFigma"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const CadastroParceiro = lazyWithRetry(() => import("./pages/CadastroParceiro"));
const ConfirmacaoCadastro = lazyWithRetry(() => import("./pages/ConfirmacaoCadastro"));
const LoginParceiro = lazyWithRetry(() => import("./pages/LoginParceiro"));
const PainelParceiro = lazyWithRetry(() => import("./pages/PainelParceiro"));
const CadastroLead = lazyWithRetry(() => import("./pages/CadastroLead"));
const FormularioConversao = lazyWithRetry(() => import("./pages/FormularioConversao"));
const AdminLayout = lazyWithRetry(() => import("./layouts/AdminLayout"));
const AdminLogin = lazyWithRetry(() => import("./pages/admin/AdminLogin"));
const OAuthConsent = lazyWithRetry(() => import("./pages/OAuthConsent"));
const AdminDashboard = lazyWithRetry(() => import("./pages/admin/AdminDashboard"));
const AdminFinanceiro = lazyWithRetry(() => import("./pages/admin/AdminFinanceiro"));
const AdminParceiros = lazyWithRetry(() => import("./pages/admin/AdminParceiros"));
const AdminLeads = lazyWithRetry(() => import("./pages/admin/AdminLeads"));
const AdminSuccessPanel = lazyWithRetry(() => import("./pages/admin/AdminSuccessPanel"));
const AdminUsuarios = lazyWithRetry(() => import("./pages/admin/AdminUsuarios"));
const AdminKitVendas = lazyWithRetry(() => import("./pages/admin/AdminKitVendas"));
const AdminPermissoes = lazyWithRetry(() => import("./pages/admin/AdminPermissoes"));
const AdminIntegracoes = lazyWithRetry(() => import("./pages/admin/AdminIntegracoes"));
const AdminContatos = lazyWithRetry(() => import("./pages/admin/AdminContatos"));
const AdminPipelineEdit = lazyWithRetry(() => import("./pages/admin/AdminPipelineEdit"));
const AdminGeradorProposta = lazyWithRetry(() => import("./pages/admin/AdminGeradorProposta"));
const AdminDocumentacao = lazyWithRetry(() => import("./pages/admin/AdminDocumentacao"));
const AdminTriagemGmail = lazyWithRetry(() => import("./pages/admin/AdminTriagemGmail"));
const AdminImportWhatsapp = lazyWithRetry(() => import("./pages/admin/AdminImportWhatsapp"));
const AdminEmailOnboarding = lazyWithRetry(() => import("./pages/admin/AdminEmailOnboarding"));
const PrimeiroAcesso = lazyWithRetry(() => import("./pages/PrimeiroAcesso"));
const ResetarSenha = lazyWithRetry(() => import("./pages/ResetarSenha"));
const EsqueciSenha = lazyWithRetry(() => import("./pages/EsqueciSenha"));
const PropostaPublica = lazyWithRetry(() => import("./pages/PropostaPublica"));
const TesteMonnera = lazyWithRetry(() => import("./pages/TesteMonnera"));

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
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppErrorBoundary>
          <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background" aria-label="Carregando tela"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>}>
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
              <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
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
                <Route path="triagem-gmail" element={<AdminTriagemGmail />} />
                <Route path="importar-whatsapp" element={<AdminImportWhatsapp />} />
                <Route path="email-onboarding" element={<AdminEmailOnboarding />} />
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
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
