import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export interface PropostaMonneraPayload {
  company?: string;
  leadName?: string;
  contato?: {
    nome?: string;
    email?: string;
    telefone?: string;
  };
  objetivo?: string;
  escopo_itens?: Array<{ titulo?: string; descricao?: string }>;
  financeiro?: {
    valor_setup?: number | null;
    valor_mensalidade?: number | null;
    valor_campanhas?: number | null;
    qtd_parcelas?: number | null;
  } | null;
  prazos?: {
    prazo_implantacao?: string;
    validade_proposta?: string;
    condicoes_pagamento?: string;
  };
  observacoes?: string;
}

interface Props {
  proposalName?: string | null;
  clientName: string;
  createdAt?: string | null;
  payload: PropostaMonneraPayload | null | undefined;
  omitFinancials?: boolean;
  omitFinancialsReason?: string | null;
}

function fmtBRL(v?: number | null) {
  if (v == null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

/**
 * Template visual fallback da proposta Monnera.
 * Usado tanto no preview interno quanto na rota pública.
 * Quando o HTML/assets oficiais forem anexados, este componente recebe a
 * versão fiel (mantendo a mesma assinatura de props).
 */
export function PropostaMonneraTemplate({
  proposalName,
  clientName,
  createdAt,
  payload,
  omitFinancials,
  omitFinancialsReason,
}: Props) {
  const p = payload || {};
  const escopo = (p.escopo_itens || []).filter(
    (it) => (it?.titulo || "").trim() || (it?.descricao || "").trim(),
  );
  const fin = p.financeiro || null;

  return (
    <div className="bg-background text-foreground">
      {/* Header / Capa */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-12">
        <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-primary/80">
          Proposta Comercial Monnera
        </p>
        <h1 className="mt-3 text-3xl sm:text-5xl font-semibold leading-tight">
          {clientName}
        </h1>
        {proposalName && (
          <p className="mt-3 text-base sm:text-lg text-muted-foreground">
            {proposalName}
          </p>
        )}
        {createdAt && (
          <p className="mt-2 text-sm text-muted-foreground">
            Emitida em {formatDate(createdAt)}
          </p>
        )}
      </section>

      <div className="mt-6 space-y-6">
        {/* Contato */}
        {(p.contato?.nome || p.contato?.email || p.contato?.telefone) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {p.contato?.nome && (
                <div>
                  <div className="text-muted-foreground">Nome</div>
                  <div className="font-medium">{p.contato.nome}</div>
                </div>
              )}
              {p.contato?.email && (
                <div>
                  <div className="text-muted-foreground">Email</div>
                  <div className="font-medium break-all">{p.contato.email}</div>
                </div>
              )}
              {p.contato?.telefone && (
                <div>
                  <div className="text-muted-foreground">Telefone</div>
                  <div className="font-medium">{p.contato.telefone}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Objetivo */}
        {p.objetivo && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Objetivo</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed whitespace-pre-wrap">
              {p.objetivo}
            </CardContent>
          </Card>
        )}

        {/* Escopo */}
        {escopo.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escopo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {escopo.map((it, idx) => (
                <div key={idx} className="space-y-1">
                  {it.titulo && (
                    <div className="font-medium text-foreground">
                      {it.titulo}
                    </div>
                  )}
                  {it.descricao && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {it.descricao}
                    </p>
                  )}
                  {idx < escopo.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Comercial */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condições Comerciais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {omitFinancials || !fin ? (
              <p className="text-muted-foreground">
                Valores comerciais omitidos nesta visualização.
                {omitFinancialsReason ? ` Motivo: ${omitFinancialsReason}` : ""}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground">Setup</div>
                  <div className="font-medium">{fmtBRL(fin.valor_setup)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Mensalidade</div>
                  <div className="font-medium">
                    {fmtBRL(fin.valor_mensalidade)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Campanhas</div>
                  <div className="font-medium">
                    {fmtBRL(fin.valor_campanhas)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Parcelas</div>
                  <div className="font-medium">
                    {fin.qtd_parcelas ?? "—"}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Prazos */}
        {(p.prazos?.prazo_implantacao ||
          p.prazos?.validade_proposta ||
          p.prazos?.condicoes_pagamento) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prazos e Condições</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {p.prazos?.prazo_implantacao && (
                <div>
                  <div className="text-muted-foreground">Prazo de implantação</div>
                  <div className="font-medium">{p.prazos.prazo_implantacao}</div>
                </div>
              )}
              {p.prazos?.validade_proposta && (
                <div>
                  <div className="text-muted-foreground">Validade da proposta</div>
                  <div className="font-medium">{p.prazos.validade_proposta}</div>
                </div>
              )}
              {p.prazos?.condicoes_pagamento && (
                <div className="sm:col-span-2">
                  <div className="text-muted-foreground">Condições de pagamento</div>
                  <div className="font-medium">{p.prazos.condicoes_pagamento}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Observações */}
        {p.observacoes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Observações</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-wrap leading-relaxed">
              {p.observacoes}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
