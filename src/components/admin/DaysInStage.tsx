import { Clock } from "lucide-react";

interface DaysInStageProps {
  dataEntrada?: string | null;
  compact?: boolean;
}

export const DaysInStage = ({ dataEntrada, compact = false }: DaysInStageProps) => {
  if (!dataEntrada) return null;

  const dias = Math.max(0, Math.floor((Date.now() - new Date(dataEntrada).getTime()) / (1000 * 60 * 60 * 24)));

  const colorClass =
    dias <= 3 ? "text-emerald-600" :
    dias <= 7 ? "text-amber-500" :
    "text-destructive";

  const dotClass =
    dias <= 3 ? "bg-emerald-500" :
    dias <= 7 ? "bg-amber-500" :
    "bg-destructive";

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[10px] ${colorClass}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
        {dias}d
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${colorClass}`}>
      <Clock className="w-3 h-3" />
      {dias} {dias === 1 ? "dia" : "dias"} nesta etapa
    </span>
  );
};
