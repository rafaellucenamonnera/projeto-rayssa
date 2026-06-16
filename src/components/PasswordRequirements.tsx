import { Check, X } from "lucide-react";
import { passwordChecks } from "@/lib/passwordPolicy";

interface Props {
  password: string;
}

const Item = ({ ok, label }: { ok: boolean; label: string }) => (
  <li className={`flex items-center gap-2 text-xs ${ok ? "text-emerald-600" : "text-muted-foreground"}`}>
    {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
    <span>{label}</span>
  </li>
);

export default function PasswordRequirements({ password }: Props) {
  const c = passwordChecks(password);
  return (
    <ul className="mt-2 space-y-1">
      <Item ok={c.length} label="Mínimo de 6 caracteres" />
      <Item ok={c.uppercase} label="Uma letra maiúscula" />
      <Item ok={c.special} label="Um caractere especial" />
    </ul>
  );
}
