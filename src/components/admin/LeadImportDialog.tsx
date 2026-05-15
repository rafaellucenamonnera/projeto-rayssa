import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";

interface LeadImportDialogProps {
  parceiros: { id: string; nome: string }[];
  onImported: () => void;
  customCrmMode?: boolean;
  users?: { user_id: string; nome: string }[];
  panelId?: string;
  firstStageId?: string;
}

interface ParsedRow {
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  cidade: string;
  nome_responsavel: string;
  telefone_responsavel: string;
  email_responsavel: string;
  erp_utilizado: string;
  quantidade_lojas: number;
  quantidade_funcionarios: number | null;
  valor_campanhas: number | null;
  descricao_necessidade: string | null;
  parceiro_nome: string;
}

const REQUIRED_COLUMNS_DEFAULT = [
  "nome_fantasia",
  "razao_social",
  "cnpj",
  "cidade",
  "nome_responsavel",
  "telefone_responsavel",
  "email_responsavel",
  "erp_utilizado",
  "quantidade_lojas",
];

const COLUMN_ALIASES: Record<string, string> = {
  "nome completo": "nome_completo",
  "e-mail": "e_mail",
  "região de atuação": "regiao",
  "nome fantasia": "nome_fantasia",
  "razão social": "razao_social",
  "razao social": "razao_social",
  cnpj: "cnpj",
  cidade: "cidade",
  "nome responsável": "nome_responsavel",
  "nome responsavel": "nome_responsavel",
  responsável: "nome_responsavel",
  responsavel: "nome_responsavel",
  "telefone responsável": "telefone_responsavel",
  "telefone responsavel": "telefone_responsavel",
  telefone: "telefone_responsavel",
  "email responsável": "email_responsavel",
  "email responsavel": "email_responsavel",
  email: "email_responsavel",
  "erp utilizado": "erp_utilizado",
  erp: "erp_utilizado",
  "qtd lojas": "quantidade_lojas",
  "quantidade lojas": "quantidade_lojas",
  "qtd funcionários": "quantidade_funcionarios",
  "qtd funcionarios": "quantidade_funcionarios",
  "quantidade funcionários": "quantidade_funcionarios",
  "quantidade funcionarios": "quantidade_funcionarios",
  "valor campanhas": "valor_campanhas",
  necessidade: "descricao_necessidade",
  "descrição necessidade": "descricao_necessidade",
  "descricao necessidade": "descricao_necessidade",
  consultor: "parceiro_nome",
  "nome consultor": "parceiro_nome",
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === "," || char === ";") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export const LeadImportDialog = ({ parceiros, onImported }: LeadImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setPreview([]);
    setErrors([]);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        if (lines.length < 2) {
          setErrors(["Arquivo deve ter pelo menos um cabeçalho e uma linha de dados"]);
          return;
        }

        const headerLine = parseCsvLine(lines[0]);
        const columnMap: Record<number, string> = {};

        headerLine.forEach((h, i) => {
          const normalized = h.toLowerCase().trim().replace(/[_-]/g, " ");
          const mapped = COLUMN_ALIASES[normalized] || normalized.replace(/\s+/g, "_");
          columnMap[i] = mapped;
        });

        const missingCols = REQUIRED_COLUMNS.filter(
          (col) => !Object.values(columnMap).includes(col)
        );

        if (missingCols.length > 0) {
          setErrors([`Colunas obrigatórias ausentes: ${missingCols.join(", ")}`]);
          return;
        }

        const parseErrors: string[] = [];
        const rows: ParsedRow[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          const row: Record<string, string> = {};
          Object.entries(columnMap).forEach(([idx, col]) => {
            row[col] = values[Number(idx)] || "";
          });

          if (!row.nome_fantasia || !row.cnpj || !row.email_responsavel) {
            parseErrors.push(`Linha ${i + 1}: campos obrigatórios vazios (nome_fantasia, cnpj ou email)`);
            continue;
          }

          rows.push({
            nome_fantasia: row.nome_fantasia,
            razao_social: row.razao_social || row.nome_fantasia,
            cnpj: row.cnpj,
            cidade: row.cidade || "",
            nome_responsavel: row.nome_responsavel || "",
            telefone_responsavel: row.telefone_responsavel || "",
            email_responsavel: row.email_responsavel,
            erp_utilizado: row.erp_utilizado || "Não informado",
            quantidade_lojas: parseInt(row.quantidade_lojas) || 1,
            quantidade_funcionarios: row.quantidade_funcionarios ? parseInt(row.quantidade_funcionarios) : null,
            valor_campanhas: row.valor_campanhas ? parseFloat(row.valor_campanhas.replace(",", ".")) : null,
            descricao_necessidade: row.descricao_necessidade || null,
            parceiro_nome: row.parceiro_nome || "",
          });
        }

        setPreview(rows);
        setErrors(parseErrors);
      } catch {
        setErrors(["Erro ao processar arquivo. Verifique o formato CSV."]);
      }
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setImporting(true);
    let successCount = 0;
    const importErrors: string[] = [];

    const parceiroMap: Record<string, string> = {};
    parceiros.forEach((p) => {
      parceiroMap[p.nome.toLowerCase()] = p.id;
    });

    const defaultParceiroId = parceiros.length > 0 ? parceiros[0].id : null;

    for (const row of preview) {
      const parceiroId =
        parceiroMap[row.parceiro_nome.toLowerCase()] || defaultParceiroId;

      if (!parceiroId) {
        importErrors.push(`${row.nome_fantasia}: nenhum consultor encontrado`);
        continue;
      }

      const { error } = await supabase.from("leads").insert({
        nome_fantasia: row.nome_fantasia,
        razao_social: row.razao_social,
        cnpj: row.cnpj,
        cidade: row.cidade,
        nome_responsavel: row.nome_responsavel,
        telefone_responsavel: row.telefone_responsavel,
        email_responsavel: row.email_responsavel,
        erp_utilizado: row.erp_utilizado,
        quantidade_lojas: row.quantidade_lojas,
        quantidade_funcionarios: row.quantidade_funcionarios,
        valor_campanhas: row.valor_campanhas,
        descricao_necessidade: row.descricao_necessidade,
        parceiro_id: parceiroId,
      });

      if (error) {
        importErrors.push(`${row.nome_fantasia}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} leads importados com sucesso`);
      onImported();
    }
    if (importErrors.length > 0) {
      toast.error(`${importErrors.length} erros na importação`);
      setErrors(importErrors);
    } else {
      setOpen(false);
      reset();
    }

    setImporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">Importar CSV</span>
          <span className="sm:hidden">Importar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Importar Leads via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* File input */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            {fileName ? (
              <p className="text-sm font-medium">{fileName}</p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">Clique para selecionar um arquivo CSV</p>
                <p className="text-xs text-muted-foreground mt-1">Separado por vírgula ou ponto e vírgula</p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Required columns info */}
          <div className="text-xs text-muted-foreground bg-secondary/50 p-3 rounded">
            <p className="font-medium mb-1">Colunas obrigatórias:</p>
            <p>nome_fantasia, razao_social, cnpj, cidade, nome_responsavel, telefone_responsavel, email_responsavel, erp_utilizado, quantidade_lojas</p>
            <p className="mt-1">Opcional: quantidade_funcionarios, valor_campanhas, descricao_necessidade, consultor</p>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1 text-destructive text-sm font-medium">
                <AlertCircle className="h-4 w-4" />
                <span>{errors.length} erro(s)</span>
              </div>
              <div className="max-h-24 overflow-y-auto">
                {errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive/80">{err}</p>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center gap-1 text-primary text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>{preview.length} leads prontos para importar</span>
              </div>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {preview.slice(0, 5).map((r, i) => (
                  <p key={i} className="text-xs">
                    {r.nome_fantasia} — {r.cnpj} — {r.cidade}
                  </p>
                ))}
                {preview.length > 5 && (
                  <p className="text-xs text-muted-foreground">...e mais {preview.length - 5}</p>
                )}
              </div>
            </div>
          )}

          {/* Action */}
          {preview.length > 0 && (
            <Button onClick={handleImport} className="w-full" disabled={importing}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Importar {preview.length} leads
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
