import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle } from "lucide-react";

/**
 * Tarjeta vermelha do fluxo Onb Clientes Cross no card aberto.
 * Mostra a etapa que falhou, motivo, data/hora e o próximo passo — ou a
 * mensagem amigável quando o Código Monnera ainda não chegou.
 * Nunca simula sucesso: sem falha e sem código, o componente não aparece.
 */
const STEP_LABELS: Record<string, string> = {
  codigo_validado: "Código Monnera validado",
  codigo_aplicado: "Código aplicado ao card",
  card_movido_material: "Card movido para Material Onboarding Cliente",
  canva_pendente: "Material Canva",
  canva_pronto: "Material Canva",
  html_pronto: "HTML v2 personalizado",
  email_pendente: "Preparação do e-mail",
  email_enviado: "Envio do e-mail",
  card_movido: "Card movido para Recebimento Dados",
};

const NEXT_STEP_HINT: Record<string, string> = {
  canva_pendente: "Cole o link público https://canva.link/... no card e clique em Retomar automação.",
  canva_pronto: "Cole o link público https://canva.link/... no card e clique em Retomar automação.",
  html_pronto: "Revise nome do parceiro, código e link do material e clique em Retomar automação.",
  email_pendente: "Confirme a thread de origem e os destinatários e clique em Retomar automação.",
  email_enviado: "Verifique o envio na conta Gmail autorizada e clique em Retomar automação.",
};

interface CardStatus {
  has_codigo: boolean;
  failed_step: string | null;
  failed_status: string | null;
  failed_reason: string | null;
  failed_at: string | null;
  attempt: number | null;
}

export default function CrossFlowAlert({ cardId }: { cardId: string }) {
  const [status, setStatus] = useState<CardStatus | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "cross_onboarding_card_status" as never,
      { p_card_id: cardId } as never,
    );
    if (error) return;
    setStatus(data as unknown as CardStatus);
  }, [cardId]);

  useEffect(() => { void load(); }, [load]);

  if (!status) return null;

  const missingCode = !status.has_codigo;
  const hasFailure = Boolean(status.failed_step);
  if (!missingCode && !hasFailure) return null;

  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-1">
          {missingCode ? (
            <>
              <p className="text-sm font-medium text-destructive">Fluxo parado: falta o Código Monnera</p>
              <p className="text-xs text-destructive/90">
                Ainda falta o código Monnera para avançarmos. Insira o código Monnera e seguiremos com as próximas etapas.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-destructive">
                Falha na etapa: {STEP_LABELS[status.failed_step ?? ""] ?? status.failed_step}
              </p>
              {status.failed_reason && (
                <p className="text-xs text-destructive/90 break-words">{status.failed_reason}</p>
              )}
              <p className="text-[11px] text-destructive/80">
                {status.failed_at ? new Date(status.failed_at).toLocaleString("pt-BR") : "sem data"}
                {" · tentativa "}
                {status.attempt ?? 1}
              </p>
              <p className="text-xs text-destructive/90">
                Próximo passo: {NEXT_STEP_HINT[status.failed_step ?? ""] ?? "Corrija a pendência registrada no card e clique em Retomar automação."}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
