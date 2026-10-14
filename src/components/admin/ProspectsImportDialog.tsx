import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { COMMERCIAL_STAGE_PROSPECTS, CANAL_OPTIONS, IMPACTO_OPTIONS, MERCADO_OPTIONS, TEMPERATURA_OPTIONS, TIPO_NEGOCIO_OPTIONS } from "@/lib/commercialPanel";
import { PROSPECT_TEMPLATE_COLUMNS, parseProspectRows, ProspectRow, ProspectRowError } from "@/lib/prospectsImport";

interface Props {
  parceiros: { id: string; nome: string }[];
  vendedores: { user_id: string; nome: string }[];
  onImported: () => void;
}

const downloadTemplate = (parceiros: Props["parceiros"], vendedores: Props["vendedores"]) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[...PROSPECT_TEMPLATE_COLUMNS]]);
  ws["!cols"] = PROSPECT_TEMPLATE_COLUMNS.map((c) => ({ wch: Math.max(16, c.length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, "Prospects");
  const lists = [
    ["Canal", CANAL_OPTIONS.map((o) => o.label)],
    ["Mercado", MERCADO_OPTIONS.map((o) => o.label)],
    ["Tipo", TIPO_NEGOCIO_OPTIONS.map((o) => o.label)],
    ["Impacto", IMPACTO_OPTIONS.map((o) => o.label)],
    ["Temperatura", TEMPERATURA_OPTIONS.map((o) => o.label)],
    ["Embaixador Monnera", parceiros.map((p) => p.nome)],
    ["Vendedor Responsável", vendedores.map((v) => v.nome)],
  ] as const;
  const max = Math.max(...lists.map(([, v]) => v.length));
  const aoa: string[][] = [lists.map(([h]) => h)];
  for (let i = 0; i < max; i++) aoa.push(lists.map(([, v]) => v[i] ?? ""));
  const opt = XLSX.utils.aoa_to_sheet(aoa);
  opt["!cols"] = lists.map(() => ({ wch: 28 }));
  XLSX.utils.book_append_sheet(wb, opt, "Opções válidas");
  XLSX.writeFile(wb, "modelo-lista-prospects.xlsx");
};

export const ProspectsImportDialog = ({ parceiros, vendedores, onImported }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ProspectRow[]>([]);
  const [errors, setErrors] = useState<ProspectRowError[]>([]);
  const [importing, setImporting] = useState(false);
  const [ownParceiroId, setOwnParceiroId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("parceiros_comerciais").select("id").eq("user_id", user.id).limit(1).maybeSingle()
      .then(({ data }) => setOwnParceiroId((data as any)?.id ?? null));
  }, [open, user]);

  const reset = () => { setRows([]); setErrors([]); setFileName(""); if (inputRef.current) inputRef.current.value = ""; };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const res = parseProspectRows(data, { parceiros, vendedores });
      setFileName(file.name);
      setRows(res.ok);
      setErrors(res.errors);
      if (!res.ok.length && !res.errors.length) toast.warning("A planilha está vazia. Use o modelo e preencha a partir da linha 2.");
    } catch {
      toast.error("Não foi possível ler o arquivo. Envie uma planilha do Excel (.xlsx).");
    }
  };

  const doImport = async () => {
    if (errors.length) return toast.error("Corrija as linhas com erro na planilha e envie de novo.");
    let created = 0;
    const failed: string[] = [];
    setImporting(true);
    for (const r of rows) {
      const parceiroId = r.parceiro_id || ownParceiroId;
      if (!parceiroId) { failed.push(`Linha ${r.linha}: escolha o Embaixador Monnera responsável`); continue; }
      const { data, error } = await supabase.from("leads").insert({
        nome_fantasia: r.razao_social, razao_social: r.razao_social, cnpj: r.cnpj,
        mercado: r.mercado, tipo_negocio: r.tipo_negocio, impacto: r.impacto, temperatura: r.temperatura,
        canal: r.canal, parceiro_id: parceiroId, responsible_user_id: r.responsible_user_id,
        panel_id: "comercial", status: COMMERCIAL_STAGE_PROSPECTS, status_lead: COMMERCIAL_STAGE_PROSPECTS,
        origem: "importacao_planilha",
        nome_responsavel: r.contato.nome, telefone_responsavel: r.contato.telefone || "", email_responsavel: r.contato.email,
      } as any).select("id").single();
      if (error) {
        failed.push(`Linha ${r.linha}: ${error.message.includes("duplicate") ? "já existe um card com esse CNPJ ou e-mail" : error.message}`);
        continue;
      }
      await (supabase as any).from("lead_contatos").insert({
        lead_id: data.id, nome: r.contato.nome, cargo: r.contato.cargo, telefone: r.contato.telefone, email: r.contato.email, principal: true,
      });
      created++;
    }
    setImporting(false);
    if (created) { toast.success(`${created} card(s) criados em Lista Prospects.`); onImported(); }
    if (failed.length) {
      setRows([]);
      setErrors(failed.map((f) => ({ linha: Number(f.match(/Linha (\d+)/)?.[1] || 0), erros: [f.replace(/^Linha \d+: /, "")] })));
      toast.error(`${failed.length} linha(s) não foram importadas. Veja os motivos na janela.`);
    } else { reset(); setOpen(false); }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><FileSpreadsheet className="mr-1 h-4 w-4" />Importar prospects</Button>
      <Dialog open={open} onOpenChange={(v) => { if (!importing) { setOpen(v); if (!v) reset(); } }}>
        <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Importar cards para Lista Prospects</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-border p-3">
              <p className="mb-2">1. Baixe o modelo e preencha uma linha por empresa. A aba "Opções válidas" mostra o que pode ser escrito em cada coluna.</p>
              <Button size="sm" variant="outline" onClick={() => downloadTemplate(parceiros, vendedores)}>
                <Download className="mr-1 h-4 w-4" />Baixar modelo em Excel
              </Button>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="mb-2">2. Envie a planilha preenchida. Todos os cards entram na coluna Lista Prospects.</p>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
              <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={importing}>
                <Upload className="mr-1 h-4 w-4" />Escolher planilha
              </Button>
              {fileName && <span className="ml-2 text-xs text-muted-foreground">{fileName}</span>}
            </div>
            {(rows.length > 0 || errors.length > 0) && (
              <div className="space-y-2">
                <p>{rows.length} linha(s) prontas para importar{errors.length ? ` · ${errors.length} com erro` : ""}.</p>
                {errors.length > 0 && (
                  <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
                    {errors.map((e, i) => (
                      <li key={i} className="flex gap-1"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />Linha {e.linha}: {e.erros.join("; ")}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>Cancelar</Button>
            <Button onClick={doImport} disabled={importing || !rows.length || errors.length > 0}>
              {importing && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Importar {rows.length || ""} card(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
