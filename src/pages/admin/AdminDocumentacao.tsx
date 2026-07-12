import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Paperclip,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Attachment = {
  id: string;
  article_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
};

type Article = {
  id: string;
  title: string;
  question: string;
  answer: string;
  tags: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  attachments: Attachment[];
};

const BUCKET = "documentation-files";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx"];

const extOf = (name: string) => {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
};

const AdminDocumentacao = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [canInsert, setCanInsert] = useState(false);
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<Article[]>([]);
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formQuestion, setFormQuestion] = useState("");
  const [formAnswer, setFormAnswer] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formFiles, setFormFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Article | null>(null);

  // Access control
  useEffect(() => {
    if (authLoading) return;
    const check = async () => {
      if (!user) {
        setHasAccess(false);
        setCheckingAccess(false);
        return;
      }
      if (isAdmin) {
        setHasAccess(true);
        setCheckingAccess(false);
        return;
      }
      const { data } = await (supabase as any)
        .from("module_permissions")
        .select("permitido")
        .eq("user_id", user.id)
        .eq("modulo", "documentacao")
        .eq("acao", "acessar")
        .maybeSingle();
      setHasAccess(!!data?.permitido);
      setCheckingAccess(false);
    };
    check();
  }, [user, isAdmin, authLoading]);

  const loadArticles = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("documentation_articles")
      .select("id,title,question,answer,tags,is_active,created_at,updated_at,documentation_attachments(id,article_id,storage_path,file_name,mime_type,size_bytes)")
      .order("created_at", { ascending: false });
    if (!isAdmin) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      toast.error("Erro ao carregar documentação");
      setArticles([]);
    } else {
      setArticles(
        (data || []).map((row: any) => ({
          ...row,
          attachments: row.documentation_attachments || [],
        })),
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasAccess) loadArticles();
  }, [hasAccess, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const hay = [
        a.title,
        a.question,
        a.answer,
        (a.tags || []).join(" "),
        (a.attachments || []).map((f) => f.file_name).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [articles, search]);

  const resetForm = () => {
    setEditing(null);
    setFormTitle("");
    setFormQuestion("");
    setFormAnswer("");
    setFormTags("");
    setFormActive(true);
    setFormFiles([]);
  };

  const openNew = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (a: Article) => {
    setEditing(a);
    setFormTitle(a.title);
    setFormQuestion(a.question);
    setFormAnswer(a.answer);
    setFormTags((a.tags || []).join(", "));
    setFormActive(a.is_active);
    setFormFiles([]);
    setFormOpen(true);
  };

  const onFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const f of list) {
      const ext = extOf(f.name);
      if (!ALLOWED_EXT.includes(ext)) {
        toast.error(`Tipo não permitido: ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`Arquivo maior que 15 MB: ${f.name}`);
        continue;
      }
      valid.push(f);
    }
    setFormFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const uploadAttachments = async (articleId: string) => {
    for (const file of formFiles) {
      const ext = extOf(file.name);
      const path = `${articleId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) {
        toast.error(`Falha ao enviar ${file.name}: ${upErr.message}`);
        continue;
      }
      const { error: insErr } = await (supabase as any)
        .from("documentation_attachments")
        .insert({
          article_id: articleId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
          created_by: user?.id ?? null,
        });
      if (insErr) toast.error(`Falha ao registrar ${file.name}`);
    }
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formQuestion.trim() || !formAnswer.trim()) {
      toast.error("Preencha título, pergunta e resposta");
      return;
    }
    setSaving(true);
    const tags = formTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (editing) {
      const { error } = await (supabase as any)
        .from("documentation_articles")
        .update({
          title: formTitle.trim(),
          question: formQuestion.trim(),
          answer: formAnswer,
          tags,
          is_active: formActive,
          updated_by: user?.id ?? null,
        })
        .eq("id", editing.id);
      if (error) {
        toast.error("Erro ao atualizar");
        setSaving(false);
        return;
      }
      if (formFiles.length > 0) await uploadAttachments(editing.id);
      toast.success("Documentação atualizada");
    } else {
      const { data, error } = await (supabase as any)
        .from("documentation_articles")
        .insert({
          title: formTitle.trim(),
          question: formQuestion.trim(),
          answer: formAnswer,
          tags,
          is_active: formActive,
          created_by: user?.id ?? null,
          updated_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (error || !data) {
        toast.error("Erro ao criar");
        setSaving(false);
        return;
      }
      if (formFiles.length > 0) await uploadAttachments(data.id);
      toast.success("Documentação criada");
    }
    setSaving(false);
    setFormOpen(false);
    resetForm();
    loadArticles();
  };

  const handleRemoveAttachment = async (att: Attachment) => {
    if (!confirm(`Remover anexo "${att.file_name}"?`)) return;
    await supabase.storage.from(BUCKET).remove([att.storage_path]);
    const { error } = await (supabase as any)
      .from("documentation_attachments")
      .delete()
      .eq("id", att.id);
    if (error) toast.error("Erro ao remover anexo");
    else {
      toast.success("Anexo removido");
      loadArticles();
    }
  };

  const handleDeleteArticle = async () => {
    if (!confirmDelete) return;
    const paths = confirmDelete.attachments.map((a) => a.storage_path);
    if (paths.length > 0) await supabase.storage.from(BUCKET).remove(paths);
    const { error } = await (supabase as any)
      .from("documentation_articles")
      .delete()
      .eq("id", confirmDelete.id);
    if (error) toast.error("Erro ao excluir");
    else toast.success("Documentação excluída");
    setConfirmDelete(null);
    loadArticles();
  };

  const openAttachment = async (att: Attachment) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(att.storage_path, 3600);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o anexo");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (authLoading || checkingAccess) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!hasAccess) return <Navigate to="/admin" replace />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Documentação</h1>
          <p className="text-muted-foreground mt-1">
            Manuais, respostas rápidas e arquivos de apoio para uso do painel comercial.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Nova documentação
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Digite uma pergunta, termo, tag ou nome de arquivo"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-md">
          Nenhum item encontrado.
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {filtered.map((a) => (
            <AccordionItem
              key={a.id}
              value={a.id}
              className="border border-border rounded-md px-4 bg-card"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex-1 text-left pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{a.question}</span>
                    {isAdmin && !a.is_active && (
                      <Badge variant="outline" className="text-xs">
                        Inativa
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{a.title}</div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <p className="whitespace-pre-wrap text-sm">{a.answer}</p>

                  {a.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {a.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {a.attachments?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-muted-foreground">
                        Anexos
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {a.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1 border border-border rounded-md pl-2 pr-1 py-1 bg-background"
                          >
                            <button
                              type="button"
                              onClick={() => openAttachment(att)}
                              className="flex items-center gap-2 text-sm hover:text-primary"
                            >
                              <FileText className="h-4 w-4" />
                              {att.file_name}
                            </button>
                            {isAdmin && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRemoveAttachment(att)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDelete(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Form */}
      <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar documentação" : "Nova documentação"}</DialogTitle>
            <DialogDescription>
              Materiais de apoio, FAQs e arquivos exibidos aos usuários com acesso.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div>
              <Label>Pergunta</Label>
              <Input value={formQuestion} onChange={(e) => setFormQuestion(e.target.value)} />
            </div>
            <div>
              <Label>Resposta / resumo</Label>
              <Textarea
                rows={6}
                value={formAnswer}
                onChange={(e) => setFormAnswer(e.target.value)}
              />
            </div>
            <div>
              <Label>Tags (separadas por vírgula)</Label>
              <Input value={formTags} onChange={(e) => setFormTags(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="doc-active"
                checked={formActive}
                onCheckedChange={(v) => setFormActive(!!v)}
              />
              <Label htmlFor="doc-active" className="cursor-pointer">
                Publicar para usuários com acesso
              </Label>
            </div>
            <div>
              <Label>Anexos</Label>
              <Input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx"
                onChange={onFilesChange}
              />
              <p className="text-xs text-muted-foreground mt-1">
                pdf, png, jpg, jpeg, webp, doc, docx, xls, xlsx · até 15 MB por arquivo
              </p>
              {formFiles.length > 0 && (
                <div className="mt-2 space-y-1">
                  {formFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm border border-border rounded px-2 py-1"
                    >
                      <span className="flex items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5" />
                        {f.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          setFormFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documentação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o artigo e todos os anexos vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteArticle}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDocumentacao;
