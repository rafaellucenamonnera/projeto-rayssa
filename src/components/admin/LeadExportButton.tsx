import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PIPELINE_LABELS } from "@/lib/pipelineConstants";

interface Lead {
  full_name?: string;
  phone?: string;
  email?: string;
  state?: string;
  region?: string;
  responsible_user_id?: string | null;

  id: string;
  data_cadastro: string;
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
  status_lead: string;
  parceiro_id: string;
}

interface LeadExportButtonProps {
  leads: Lead[];
  parceiros: Record<string, string>;
  customCrmMode?: boolean;
  users?: Record<string, string>;
}

const CSV_HEADERS_DEFAULT = [
  "Data Cadastro",
  "Embaixador Monnera",
  "Nome Fantasia",
  "Razão Social",
  "CNPJ",
  "Cidade",
  "Responsável",
  "Telefone",
  "Email",
  "ERP Utilizado",
  "Qtd Lojas",
  "Qtd Funcionários",
  "Valor Campanhas",
  "Necessidade",
  "Status",
];

const CSV_HEADERS_REPRESENTATIVE = [
  "Nome completo",
  "Telefone",
  "E-mail",
  "Cidade",
  "Estado",
  "Região de atuação",
  "Responsável",
  "Status",
];

const STATUS_LABELS = PIPELINE_LABELS;

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const LeadExportButton = ({ leads, parceiros, customCrmMode = false, users = {} }: LeadExportButtonProps) => {
  const handleExport = () => {
    if (leads.length === 0) {
      toast.error("Nenhum lead para exportar");
      return;
    }

    const rows = customCrmMode
      ? leads.map((l) => [
          l.full_name || l.nome_fantasia || "",
          l.phone || l.telefone_responsavel || "",
          l.email || l.email_responsavel || "",
          l.cidade || "",
          l.state || "",
          l.region || "",
          users[l.responsible_user_id || ""] || "-",
          STATUS_LABELS[l.status_lead] || l.status_lead,
        ])
      : leads.map((l) => [
          new Date(l.data_cadastro).toLocaleDateString("pt-BR"),
          parceiros[l.parceiro_id] || "-",
          l.nome_fantasia,
          l.razao_social,
          l.cnpj,
          l.cidade,
          l.nome_responsavel,
          l.telefone_responsavel,
          l.email_responsavel,
          l.erp_utilizado,
          l.quantidade_lojas,
          l.quantidade_funcionarios,
          l.valor_campanhas,
          l.descricao_necessidade,
          STATUS_LABELS[l.status_lead] || l.status_lead,
        ]);

    const csvContent =
      "\uFEFF" +
      [(customCrmMode ? CSV_HEADERS_REPRESENTATIVE : CSV_HEADERS_DEFAULT).map(escapeCsvField).join(",")]
        .concat(rows.map((row) => row.map(escapeCsvField).join(",")))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${customCrmMode ? "representantes" : "leads"}_monnera_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`${leads.length} registros exportados`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="mr-1 h-4 w-4" />
      <span className="hidden sm:inline">Exportar CSV</span>
      <span className="sm:hidden">CSV</span>
    </Button>
  );
};
