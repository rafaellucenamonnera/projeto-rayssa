import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Upload, FileText, MessageSquare, Video, MessagesSquare, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

type WMsg = { id: string; titulo: string; subtitulo: string | null; mensagem: string; imagem_url: string | null; ordem: number };
type Vid = { id: string; titulo: string; subtitulo: string | null; descricao: string | null; video_url: string; thumbnail_url: string | null; ordem: number };
type Port = { id: string; titulo: string; pdf_url: string; ativo: boolean };
type Arg = { id: string; objecao: string; resposta: string; pilar: string; pilar_descricao: string | null; ordem: number };
type Rede = { id: string; titulo: string; link: string; comentario: string | null; imagem_url: string | null; ordem: number };

export default function AdminKitVendas() {
  const [whatsapp, setWhatsapp] = useState<WMsg[]>([]);
  const [videos, setVideos] = useState<Vid[]>([]);
  const [portfolio, setPortfolio] = useState<Port[]>([]);
  const [argumentos, setArgumentos] = useState<Arg[]>([]);
  const [redes, setRedes] = useState<Rede[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [editing, setEditing] = useState<null | { type: string; data: any }>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    setLoading(true);
    const [w, v, p, a, r] = await Promise.all([
      supabase.from("kit_whatsapp_messages").select("*").order("ordem"),
      supabase.from("kit_videos").select("*").order("ordem"),
      supabase.from("kit_portfolio").select("*").order("created_at", { ascending: false }),
      supabase.from("kit_argumentos").select("*").order("ordem"),
      supabase.from("kit_redes_sociais").select("*").order("ordem"),
    ]);
    setWhatsapp((w.data as WMsg[]) || []);
    setVideos((v.data as Vid[]) || []);
    setPortfolio((p.data as Port[]) || []);
    setArgumentos((a.data as Arg[]) || []);
    setRedes((r.data as Rede[]) || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const tableMap: Record<string, "kit_whatsapp_messages" | "kit_videos" | "kit_portfolio" | "kit_argumentos" | "kit_redes_sociais"> = {
    whatsapp: "kit_whatsapp_messages",
    video: "kit_videos",
    portfolio: "kit_portfolio",
    argumento: "kit_argumentos",
    rede: "kit_redes_sociais",
  };

  useEffect(() => { reload(); }, []);


  const handleDelete = async (type: string, id: string) => {
    if (!confirm("Remover este item?")) return;
    const { error } = await supabase.from(tableMap[type]).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removido");
    reload();
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { type, data } = editing;
    if (type === "argumento") {
      const argumentosLista = (data.argumentos as string[] | undefined) || [data.objecao || ""];
      const argumentosValidos = argumentosLista.map((item: string) => item.trim()).filter(Boolean);
      if (argumentosValidos.length === 0) {
        setSaving(false);
        return toast.error("Informe ao menos 1 argumento.");
      }
      if (argumentosValidos.length > 10) {
        setSaving(false);
        return toast.error("Máximo de 10 argumentos.");
      }
    }
    const table = tableMap[type];
    const { id, argumentos: _argumentos, ...payloadBase } = data;
    let op;
    if (type === "argumento") {
      const argumentosLista = (data.argumentos as string[] | undefined) || [data.objecao || ""];
      const argumentosValidos = argumentosLista.map((item: string) => item.trim()).filter(Boolean);
      if (id) {
        op = supabase.from(table).update({ ...payloadBase, objecao: argumentosValidos[0] }).eq("id", id);
      } else {
        op = supabase.from(table).insert(
          argumentosValidos.map((argumento: string, index: number) => ({
            ...payloadBase,
            objecao: argumento,
            resposta: "",
            ordem: (payloadBase.ordem || 0) + index,
          }))
        );
      }
    } else {
      op = id
        ? supabase.from(table).update(payloadBase).eq("id", id)
        : supabase.from(table).insert(payloadBase);
    }
    const { error } = await op;
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Salvo");
    setEditing(null);
    reload();
  };

  const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("kit-vendas").upload(path, file);
    setUploading(false);
    if (error) { toast.error(error.message); return null; }
    const { data } = supabase.storage.from("kit-vendas").getPublicUrl(path);
    return data.publicUrl;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">Kit de Vendas</h1>
      </div>

      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp"><MessageSquare className="w-4 h-4 mr-2" />WhatsApp</TabsTrigger>
          <TabsTrigger value="videos"><Video className="w-4 h-4 mr-2" />Vídeos</TabsTrigger>
          <TabsTrigger value="portfolio"><FileText className="w-4 h-4 mr-2" />Portfólio</TabsTrigger>
          <TabsTrigger value="argumentos"><MessagesSquare className="w-4 h-4 mr-2" />Argumentos</TabsTrigger>
          <TabsTrigger value="redes"><Share2 className="w-4 h-4 mr-2" />Redes Sociais</TabsTrigger>
        </TabsList>

        {/* WhatsApp */}
        <TabsContent value="whatsapp" className="space-y-3">
          <Button onClick={() => setEditing({ type: "whatsapp", data: { titulo: "", subtitulo: "1º contato", mensagem: "", imagem_url: "", ordem: whatsapp.length } })}>
            <Plus className="w-4 h-4 mr-2" />Nova mensagem
          </Button>
          {whatsapp.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma mensagem cadastrada.</p>}
          {whatsapp.map((m) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-center justify-between p-4">
                <CardTitle className="text-base">{m.titulo}</CardTitle>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ type: "whatsapp", data: m })}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete("whatsapp", m.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.mensagem}</p></CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Vídeos */}
        <TabsContent value="videos" className="space-y-3">
          <Button onClick={() => setEditing({ type: "video", data: { titulo: "", subtitulo: "", descricao: "", video_url: "", thumbnail_url: "", ordem: videos.length } })}>
            <Plus className="w-4 h-4 mr-2" />Novo vídeo
          </Button>
          {videos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum vídeo cadastrado.</p>}
          {videos.map((v) => (
            <Card key={v.id}>
              <CardHeader className="flex flex-row items-center justify-between p-4">
                <div>
                  <CardTitle className="text-base">{v.titulo}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1 break-all">{v.video_url}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ type: "video", data: v })}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete("video", v.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              {v.descricao && <CardContent className="p-4 pt-0"><p className="text-sm text-muted-foreground">{v.descricao}</p></CardContent>}
            </Card>
          ))}
        </TabsContent>

        {/* Portfólio */}
        <TabsContent value="portfolio" className="space-y-3">
          <Button onClick={() => setEditing({ type: "portfolio", data: { titulo: "Portfólio Monnera", pdf_url: "", ativo: true } })}>
            <Plus className="w-4 h-4 mr-2" />Novo PDF
          </Button>
          {portfolio.length === 0 && <p className="text-sm text-muted-foreground">Nenhum portfólio cadastrado.</p>}
          {portfolio.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between p-4">
                <div>
                  <CardTitle className="text-base">{p.titulo} {p.ativo && <span className="text-xs text-emerald-500 ml-2">(ativo)</span>}</CardTitle>
                  <a href={p.pdf_url} target="_blank" rel="noreferrer" className="text-xs text-primary break-all hover:underline">{p.pdf_url}</a>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ type: "portfolio", data: p })}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete("portfolio", p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        {/* Argumentos */}
        <TabsContent value="argumentos" className="space-y-3">
          <Button onClick={() => setEditing({ type: "argumento", data: { objecao: "", argumentos: [""], resposta: "", pilar: "Conexão", pilar_descricao: "", ordem: argumentos.length } })}>
            <Plus className="w-4 h-4 mr-2" />Novo argumento
          </Button>
          {argumentos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum argumento cadastrado.</p>}
          {argumentos.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-center justify-between p-4">
                <CardTitle className="text-base">{a.objecao}</CardTitle>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ type: "argumento", data: a })}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete("argumento", a.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.resposta}</p></CardContent>
            </Card>
          ))}
        </TabsContent>
        {/* Redes Sociais */}
        <TabsContent value="redes" className="space-y-3">
          <Button onClick={() => setEditing({ type: "rede", data: { titulo: "", link: "", comentario: "", imagem_url: "", ordem: redes.length } })}>
            <Plus className="w-4 h-4 mr-2" />Novo material
          </Button>
          {redes.length === 0 && <p className="text-sm text-muted-foreground">Nenhum material cadastrado.</p>}
          {redes.map((r) => (
            <Card key={r.id}>
              <CardHeader className="flex flex-row items-center justify-between p-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {r.imagem_url && (
                    <img src={r.imagem_url} alt="" className="w-12 h-12 rounded-md object-cover border border-border shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0">
                    <CardTitle className="text-base">{r.titulo}</CardTitle>
                    <a href={r.link} target="_blank" rel="noreferrer" className="text-xs text-primary break-all hover:underline">{r.link}</a>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ type: "rede", data: r })}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete("rede", r.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardHeader>
              {r.comentario && <CardContent className="p-4 pt-0"><p className="text-sm text-muted-foreground whitespace-pre-wrap">{r.comentario}</p></CardContent>}
            </Card>
          ))}
        </TabsContent>
      </Tabs>
      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.data.id ? "Editar" : "Novo"} {editing?.type === "whatsapp" ? "mensagem" : editing?.type === "video" ? "vídeo" : editing?.type === "portfolio" ? "PDF do portfólio" : editing?.type === "rede" ? "material de rede social" : "argumento"}
            </DialogTitle>
          </DialogHeader>

          {editing?.type === "whatsapp" && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editing.data.titulo} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, titulo: e.target.value } })} /></div>
              <div><Label>Subtítulo (ex: "1º contato")</Label><Input value={editing.data.subtitulo || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, subtitulo: e.target.value } })} /></div>
              <div><Label>Mensagem</Label><Textarea rows={6} value={editing.data.mensagem} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, mensagem: e.target.value } })} /></div>
              <div>
                <Label>Imagem (opcional)</Label>
                <Input value={editing.data.imagem_url || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, imagem_url: e.target.value } })} placeholder="https://..." />
                <div className="mt-2">
                  <Input type="file" accept="image/*" disabled={uploading} onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadFile(f, "whatsapp");
                    if (url) setEditing({ ...editing, data: { ...editing.data, imagem_url: url } });
                  }} />
                  {uploading && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Enviando...</p>}
                </div>
                {editing.data.imagem_url && <img src={editing.data.imagem_url} alt="" className="mt-2 max-h-32 rounded border border-border" />}
              </div>
              <div><Label>Ordem</Label><Input type="number" value={editing.data.ordem} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, ordem: Number(e.target.value) } })} /></div>
            </div>
          )}

          {editing?.type === "video" && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editing.data.titulo} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, titulo: e.target.value } })} /></div>
              <div><Label>Subtítulo (opcional)</Label><Input value={editing.data.subtitulo || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, subtitulo: e.target.value } })} /></div>
              <div><Label>Descrição</Label><Textarea rows={3} value={editing.data.descricao || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, descricao: e.target.value } })} /></div>
              <div>
                <Label>URL do vídeo (YouTube/Vimeo) ou upload MP4</Label>
                <Input value={editing.data.video_url} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, video_url: e.target.value } })} placeholder="https://..." />
                <div className="mt-2">
                  <Input type="file" accept="video/*" disabled={uploading} onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadFile(f, "videos");
                    if (url) setEditing({ ...editing, data: { ...editing.data, video_url: url } });
                  }} />
                  {uploading && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Enviando...</p>}
                </div>
              </div>
              <div>
                <Label>Thumbnail (opcional, usado se não for YouTube)</Label>
                <Input value={editing.data.thumbnail_url || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, thumbnail_url: e.target.value } })} placeholder="https://..." />
                <div className="mt-2">
                  <Input type="file" accept="image/*" disabled={uploading} onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadFile(f, "thumbnails");
                    if (url) setEditing({ ...editing, data: { ...editing.data, thumbnail_url: url } });
                  }} />
                </div>
              </div>
              <div><Label>Ordem</Label><Input type="number" value={editing.data.ordem} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, ordem: Number(e.target.value) } })} /></div>
            </div>
          )}

          {editing?.type === "portfolio" && (
            <div className="space-y-3">
              <div><Label>Título</Label><Input value={editing.data.titulo} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, titulo: e.target.value } })} /></div>
              <div>
                <Label>URL do PDF ou upload</Label>
                <Input value={editing.data.pdf_url} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, pdf_url: e.target.value } })} placeholder="https://..." />
                <div className="mt-2">
                  <Input type="file" accept="application/pdf" disabled={uploading} onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadFile(f, "portfolio");
                    if (url) setEditing({ ...editing, data: { ...editing.data, pdf_url: url } });
                  }} />
                  {uploading && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Enviando...</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={editing.data.ativo} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, ativo: e.target.checked } })} />
                <Label htmlFor="ativo">Ativo (exibido aos consultores)</Label>
              </div>
            </div>
          )}

          {editing?.type === "argumento" && (
            <div className="space-y-3">
              <div>
                <Label>Pilar</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editing.data.pilar || "Conexão"}
                  onChange={(e) => setEditing({ ...editing, data: { ...editing.data, pilar: e.target.value } })}
                >
                  <option value="Conexão">Conexão</option>
                  <option value="Centralização">Centralização</option>
                  <option value="Segurança">Segurança</option>
                </select>
              </div>
              <div>
                <Label>Descrição do pilar (opcional, aparece uma vez por pilar)</Label>
                <Textarea rows={3} value={editing.data.pilar_descricao || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, pilar_descricao: e.target.value } })} />
              </div>
              <div><Label>Frase / argumento (texto que será copiado)</Label><Textarea rows={3} value={editing.data.objecao} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, objecao: e.target.value } })} /></div>
              <div><Label>Resposta detalhada (opcional, uso interno)</Label><Textarea rows={3} value={editing.data.resposta || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, resposta: e.target.value } })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={editing.data.ordem} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, ordem: Number(e.target.value) } })} /></div>
            </div>
          )}

          {editing?.type === "rede" && (
            <div className="space-y-3">
              <div><Label>Título do material</Label><Input value={editing.data.titulo} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, titulo: e.target.value } })} placeholder="Ex: Post Instagram - Lançamento" /></div>
              <div><Label>Link do material</Label><Input value={editing.data.link} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, link: e.target.value } })} placeholder="https://..." /></div>
              <div><Label>Comentário sobre o material</Label><Textarea rows={3} value={editing.data.comentario || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, comentario: e.target.value } })} placeholder="Como e quando usar este material" /></div>
              <div>
                <Label>Imagem de capa (opcional — aparece no preview)</Label>
                <Input value={editing.data.imagem_url || ""} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, imagem_url: e.target.value } })} placeholder="https://..." />
                <div className="mt-2">
                  <Input type="file" accept="image/*" disabled={uploading} onChange={async (e) => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const url = await uploadFile(f, "redes");
                    if (url) setEditing({ ...editing, data: { ...editing.data, imagem_url: url } });
                  }} />
                  {uploading && <p className="text-xs text-muted-foreground mt-1"><Loader2 className="inline w-3 h-3 animate-spin mr-1" />Enviando...</p>}
                </div>
                {editing.data.imagem_url && <img src={editing.data.imagem_url} alt="" className="mt-2 max-h-32 rounded border border-border" />}
              </div>
              <div><Label>Ordem</Label><Input type="number" value={editing.data.ordem} onChange={(e) => setEditing({ ...editing, data: { ...editing.data, ordem: Number(e.target.value) } })} /></div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
