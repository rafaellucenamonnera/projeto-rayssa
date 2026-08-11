import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Link2, Pencil, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface AmbassadorLinksSectionProps {
  parceiroId?: string | null;
  codigoParceiro?: string | null;
  slugConsultor?: string | null;
  canEdit?: boolean;
}

const normalizeSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export function AmbassadorLinksSection({ parceiroId, codigoParceiro, slugConsultor, canEdit }: AmbassadorLinksSectionProps) {
  const [slug, setSlug] = useState<string>(slugConsultor || "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(slugConsultor || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSlug(slugConsultor || "");
    setDraft(slugConsultor || "");
    setEditing(false);
  }, [slugConsultor, parceiroId]);

  if (!parceiroId && !codigoParceiro) return null;

  const origin = window.location.origin;
  const finalName = slug || codigoParceiro || "";

  const links = [
    { label: "Cadastro de lead (código)", url: `${origin}/lead/${codigoParceiro || finalName}` },
    { label: "Link de indicação", url: `${origin}/indicacao/${finalName}` },
    { label: "Teste Monnera", url: `${origin}/testemonnera/${finalName}` },
  ].filter((l) => l.url.split("/").pop());

  const copy = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleSave = async () => {
    const next = normalizeSlug(draft);
    if (next.length < 3) {
      toast.error("O nome final do link precisa ter ao menos 3 caracteres.");
      return;
    }
    if (!parceiroId) {
      toast.error("Embaixador não vinculado a um cadastro.");
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await (supabase as any)
        .from("parceiros_comerciais")
        .select("id")
        .eq("slug_consultor", next)
        .neq("id", parceiroId)
        .maybeSingle();
      if (existing) {
        toast.error("Já existe um embaixador usando este nome de link.");
        return;
      }
      const { error } = await (supabase as any)
        .from("parceiros_comerciais")
        .update({ slug_consultor: next })
        .eq("id", parceiroId);
      if (error) throw error;

      const { data: check } = await (supabase as any)
        .from("parceiros_comerciais")
        .select("slug_consultor")
        .eq("id", parceiroId)
        .maybeSingle();
      if (check?.slug_consultor !== next) {
        toast.error("Você não tem permissão para alterar o nome do link.");
        return;
      }
      setSlug(next);
      setDraft(next);
      setEditing(false);
      toast.success("Nome do link atualizado! Os links antigos deixam de funcionar.");
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Já existe um embaixador usando este nome de link." : "Não foi possível atualizar o link.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-border pt-4 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Link2 className="h-4 w-4" /> Links personalizados
      </h3>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Nome final do link</p>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="nome-do-embaixador"
              className="max-w-xs"
            />
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Check className="mr-1 h-3 w-3" />} Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setDraft(slug); setEditing(false); }} disabled={saving}>
              <X className="mr-1 h-3 w-3" /> Cancelar
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-primary">{finalName || "—"}</span>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-3 w-3" /> Editar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        {links.map((l) => (
          <div key={l.label} className="rounded-lg bg-secondary/50 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">{l.label}</p>
            <p className="break-all font-mono text-xs text-primary">{l.url}</p>
            <Button size="sm" variant="outline" onClick={() => copy(l.url)}>
              <Copy className="mr-1 h-3 w-3" /> Copiar link
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
