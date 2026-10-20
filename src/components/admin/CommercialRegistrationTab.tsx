import { useEffect, useState } from "react";
import { Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Store = { id: string; cnpj: string; razao_social: string; nome_interno: string };

export function CommercialRegistrationLink({ lead, onSaved }: { lead: any; onSaved: (patch: Record<string, any>) => void }) {
  const [token, setToken] = useState<string | null>(lead.completion_token || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const load = async () => {
    setLoading(true);
    setError(false);
    const { data, error: requestError } = await supabase.rpc("ensure_lead_completion_token", { p_lead_id: lead.id });
    setLoading(false);
    if (requestError || !data) { setError(true); return; }
    setToken(data);
    if (lead.completion_token !== data) onSaved({ completion_token: data });
  };
  useEffect(() => {
    setToken(lead.completion_token || null);
    if (!lead.completion_token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.completion_token]);
  const link = token ? `${window.location.origin}/completar-cadastro/${token}` : "";
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <span className="mr-auto text-sm font-medium">Cadastro do cliente</span>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : error ? (
        <><span className="text-xs text-destructive">Link indisponível.</span><Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1 h-3 w-3" />Tentar novamente</Button></>
      ) : token ? (
        <>
          <Button variant="outline" size="sm" onClick={async () => {
            try { await navigator.clipboard.writeText(link); toast.success("Link de cadastro copiado."); }
            catch { toast.error("Não foi possível copiar o link."); }
          }}><Copy className="mr-1 h-3 w-3" />Copiar link de cadastro</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir cadastro do cliente" asChild>
            <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Abrir cadastro do cliente"><ExternalLink className="h-4 w-4" /></a>
          </Button>
        </>
      ) : null}
    </div>
  );
}

export function CommercialRegistrationTab({ lead }: { lead: any }) {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.from("lojas").select("id,cnpj,razao_social,nome_interno").eq("lead_id", lead.id).order("created_at").then(({ data, error }) => {
      if (!active) return;
      setStores(data || []); setError(Boolean(error)); setLoading(false);
    });
    return () => { active = false; };
  }, [lead.id, lead.dados_completos, lead.cadastro_cliente_recebido_at]);
  const data = lead.cadastro_cliente_data || lead;
  const field = (label: string, value: unknown) => (
    <div key={label} className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-sm">{value == null || value === "" ? "—" : String(value)}</p></div>
  );
  return (
    <div className="space-y-5">
      <p className="text-sm font-medium">{lead.dados_completos ? "Dados completos recebidos" : "Aguardando preenchimento do cliente"}</p>
      {lead.cadastro_cliente_recebido_at && <p className="text-xs text-muted-foreground">Recebido em {new Date(lead.cadastro_cliente_recebido_at).toLocaleString("pt-BR")}</p>}
      <section className="space-y-3"><h3 className="text-sm font-semibold">Empresa e endereço</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("Nome fantasia", data.nome_fantasia)}{field("Razão social matriz", data.razao_social)}
          {field("Rua / Avenida", data.endereco_rua)}{field("Número", data.endereco_numero)}
          {field("Cidade", data.cidade)}{field("Estado", data.endereco_estado)}{field("CEP", data.endereco_cep)}{field("Quantidade de lojas", data.quantidade_lojas)}
        </div>
      </section>
      {[
        ["Responsável pela assinatura", "nome_responsavel", "telefone_responsavel", "email_responsavel"],
        ["Responsável técnico pela instalação", "responsavel_tecnico_nome", "responsavel_tecnico_telefone", "responsavel_tecnico_email"],
        ["Responsável comercial pelas campanhas", "responsavel_comercial_nome", "responsavel_comercial_telefone", "responsavel_comercial_email"],
        ["Responsável pelo RH", "responsavel_rh_nome", "responsavel_rh_telefone", "responsavel_rh_email"],
      ].map(([title, name, phone, email]) => <section key={title} className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">{title}</h3><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{field("Nome", data[name])}{field("Telefone", data[phone])}{field("E-mail", data[email])}</div></section>)}
      <section className="space-y-3 border-t border-border pt-4"><h3 className="text-sm font-semibold">Lojas cadastradas</h3>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : error ? <p className="text-sm text-destructive">Não foi possível carregar as lojas.</p> : !stores.length ? <p className="text-sm text-muted-foreground">Nenhuma loja cadastrada separadamente.</p> : stores.map((store) => <div key={store.id} className="grid grid-cols-1 gap-3 border-b border-border pb-3 sm:grid-cols-3">{field("Nome interno", store.nome_interno)}{field("Razão social", store.razao_social)}{field("CNPJ", store.cnpj)}</div>)}
      </section>
    </div>
  );
}