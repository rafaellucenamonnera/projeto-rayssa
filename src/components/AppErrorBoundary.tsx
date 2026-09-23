import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHUNK_RELOAD_KEY = "monnera:chunk-reload";

const isChunkLoadError = (error: Error) =>
  /dynamically imported module|loading chunk|chunkloaderror|importing a module script failed/i.test(error.message);

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary] Falha ao renderizar a tela", error, info);

    if (isChunkLoadError(error) && sessionStorage.getItem(CHUNK_RELOAD_KEY) !== window.location.href) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, window.location.href);
      window.location.reload();
    }
  }

  private retry = () => {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <div className="w-full max-w-md space-y-4 rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <AlertTriangle className="mx-auto h-8 w-8 text-warning" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Não foi possível abrir esta tela</h1>
            <p className="text-sm text-muted-foreground">Atualize para carregar a versão mais recente e continuar.</p>
          </div>
          <Button type="button" onClick={this.retry} className="w-full">
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar agora
          </Button>
        </div>
      </div>
    );
  }
}