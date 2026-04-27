import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Video, FileText, MessagesSquare, Copy, Download, ChevronDown, Link as LinkIcon, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WMsg = { id: string; titulo: string; subtitulo: string | null; mensagem: string; imagem_url: string | null };
type Vid = { id: string; titulo: string; subtitulo: string | null; descricao: string | null; video_url: string; thumbnail_url: string | null };
type Port = { id: string; titulo: string; pdf_url: string };
type Arg = { id: string; objecao: string; resposta: string; pilar: string; pilar_descricao: string | null };
type Rede = { id: string; titulo: string; link: string; comentario: string | null };

const isYoutube = (url: string) => /youtube\.com|youtu\.be/.test(url);
const isVimeo = (url: string) => /vimeo\.com/.test(url);
const ytId = (url: string) => url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1];
const ytEmbed = (url: string) => {
  const id = ytId(url);
  return id ? `https://www.youtube.com/embed/${id}` : url;
};
const ytThumb = (url: string) => {
  const id = ytId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
};
const vimeoEmbed = (url: string) => {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
};

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank");
  }
}

function ExpandIcon({ open }: { open: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "w-5 h-5 text-primary transition-transform shrink-0",
        open ? "rotate-180" : "rotate-0"
      )}
    />
  );
}

export function KitVendasSection() {
  const [openDialog, setOpenDialog] = useState<null | "whatsapp" | "videos" | "portfolio" | "argumentos" | "redes">(null);
  const [whatsapp, setWhatsapp] = useState<WMsg[]>([]);
  const [videos, setVideos] = useState<Vid[]>([]);
  const [portfolio, setPortfolio] = useState<Port[]>([]);
  const [argumentos, setArgumentos] = useState<Arg[]>([]);
  const [redes, setRedes] = useState<Rede[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const [w, v, p, a, r] = await Promise.all([
        supabase.from("kit_whatsapp_messages").select("id, titulo, subtitulo, mensagem, imagem_url").order("ordem"),
        supabase.from("kit_videos").select("id, titulo, subtitulo, descricao, video_url, thumbnail_url").order("ordem"),
        supabase.from("kit_portfolio").select("id, titulo, pdf_url").eq("ativo", true).order("created_at", { ascending: false }),
        supabase.from("kit_argumentos").select("id, objecao, resposta, pilar, pilar_descricao").order("ordem"),
        supabase.from("kit_redes_sociais").select("id, titulo, link, comentario").order("ordem"),
      ]);
      setWhatsapp((w.data as WMsg[]) || []);
      setVideos((v.data as Vid[]) || []);
      setPortfolio((p.data as Port[]) || []);
      setArgumentos((a.data as Arg[]) || []);
      setRedes((r.data as Rede[]) || []);
    })();
  }, []);

  const cards = [
    { key: "whatsapp" as const, icon: MessageSquare, title: "WhatsApp", desc: "Mensagens prontas para facilitar suas conversas com leads no WhatsApp" },
    { key: "videos" as const, icon: Video, title: "Vídeos", desc: "Vídeos prontos para apoiar suas abordagens e tornar a conversa com leads mais clara e envolvente." },
    { key: "portfolio" as const, icon: FileText, title: "Portfólio", desc: "Portfólio resumido para enviar onde quiser e acrescentar conteúdo nas negociações" },
    { key: "argumentos" as const, icon: MessagesSquare, title: "Argumentos", desc: "Argumentos de venda organizados para facilitar suas conversas e conduzir leads com mais segurança" },
    { key: "redes" as const, icon: Share2, title: "Redes Sociais", desc: "Materiais de redes sociais prontos para você compartilhar e fortalecer sua presença digital." },
  ];

  const copy = (text: string, msg = "Copiado!") => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const handleCardClick = (key: typeof cards[number]["key"]) => {
    setExpanded({});
    setOpenDialog(key);
  };

  // ---------- Item renderers ----------

  const WhatsAppItem = ({ m }: { m: WMsg }) => {
    const open = !!expanded[m.id];
    return (
      <div className="rounded-xl bg-secondary/40 border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => toggle(m.id)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-secondary/60 transition-colors"
        >
          <div className="min-w-0">
            <p className="font-display font-semibold text-base truncate">{m.titulo}</p>
            {m.subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{m.subtitulo}</p>}
          </div>
          <ExpandIcon open={open} />
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
            {m.imagem_url && (
              <div className="rounded-lg overflow-hidden bg-black/20 max-w-xs">
                <img src={m.imagem_url} alt={m.titulo} className="w-full h-auto" loading="lazy" />
              </div>
            )}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{m.mensagem}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(m.mensagem, "Mensagem copiada!")}>
                <Copy className="w-3.5 h-3.5 mr-1.5" />Copiar Mensagem
              </Button>
              {m.imagem_url && (
                <Button size="sm" variant="outline" onClick={() => downloadFile(m.imagem_url!, `${m.titulo}.jpg`)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />Baixar Imagem
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const VideoItem = ({ v }: { v: Vid }) => {
    const open = !!expanded[v.id];
    const thumb = v.thumbnail_url || (isYoutube(v.video_url) ? ytThumb(v.video_url) : null);
    const isExternal = isYoutube(v.video_url) || isVimeo(v.video_url);
    return (
      <div className="rounded-xl bg-secondary/40 border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => toggle(v.id)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-secondary/60 transition-colors"
        >
          <div className="min-w-0">
            <p className="font-display font-semibold text-base truncate">{v.titulo}</p>
            {v.subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{v.subtitulo}</p>}
          </div>
          <ExpandIcon open={open} />
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {isYoutube(v.video_url) ? (
                <iframe src={ytEmbed(v.video_url)} className="w-full h-full" allowFullScreen title={v.titulo} />
              ) : isVimeo(v.video_url) ? (
                <iframe src={vimeoEmbed(v.video_url)} className="w-full h-full" allowFullScreen title={v.titulo} />
              ) : (
                <video src={v.video_url} poster={thumb || undefined} controls className="w-full h-full" />
              )}
            </div>
            {v.descricao && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.descricao}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(v.video_url, "Link copiado!")}>
                <LinkIcon className="w-3.5 h-3.5 mr-1.5" />Copiar Link
              </Button>
              {!isExternal ? (
                <Button size="sm" variant="outline" onClick={() => downloadFile(v.video_url, `${v.titulo}.mp4`)}>
                  <Download className="w-3.5 h-3.5 mr-1.5" />Baixar Vídeo
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <a href={v.video_url} target="_blank" rel="noreferrer">
                    <Download className="w-3.5 h-3.5 mr-1.5" />Abrir no {isYoutube(v.video_url) ? "YouTube" : "Vimeo"}
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const PortfolioItem = ({ p }: { p: Port }) => {
    const open = !!expanded[p.id];
    return (
      <div className="rounded-xl bg-secondary/40 border border-border overflow-hidden">
        <button
          type="button"
          onClick={() => toggle(p.id)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-secondary/60 transition-colors"
        >
          <div className="min-w-0">
            <p className="font-display font-semibold text-base truncate">{p.titulo}</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF</p>
          </div>
          <ExpandIcon open={open} />
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
            <div className="aspect-[4/3] bg-black/20 rounded-lg overflow-hidden">
              <iframe src={p.pdf_url} className="w-full h-full" title={p.titulo} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(p.pdf_url, "Link copiado!")}>
                <LinkIcon className="w-3.5 h-3.5 mr-1.5" />Copiar Link
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadFile(p.pdf_url, `${p.titulo}.pdf`)}>
                <Download className="w-3.5 h-3.5 mr-1.5" />Baixar PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Group argumentos by pilar
  const argumentosByPilar = argumentos.reduce<Record<string, { descricao: string | null; itens: Arg[] }>>((acc, a) => {
    const key = a.pilar || "Outros";
    if (!acc[key]) acc[key] = { descricao: a.pilar_descricao, itens: [] };
    if (!acc[key].descricao && a.pilar_descricao) acc[key].descricao = a.pilar_descricao;
    acc[key].itens.push(a);
    return acc;
  }, {});

  return (
    <>
      <Card className="border-border">
        <CardContent className="p-4 sm:p-6 space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold">Kit de Vendas</h2>
          </div>

          <div>
            <h3 className="text-base font-semibold text-muted-foreground mb-2">A Monnera</h3>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
              A Monnera é uma solução que ajuda o varejo a alcançar o desempenho extraordinário. Ela atua na operação,
              aprimorando e automatizando as estratégias de incentivo de vendas.
              <br /><br />
              Crie campanhas, premiações e faça pagamentos com conformidade legal. Processos otimizados e com estratégia,
              tudo dentro de uma única plataforma.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
            {cards.map((c) => (
              <button
                key={c.key}
                onClick={() => handleCardClick(c.key)}
                className="text-left rounded-2xl border border-border bg-secondary/40 hover:bg-secondary/70 hover:border-primary/40 transition-all p-5 sm:p-6 flex flex-col items-center text-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <c.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-lg font-display font-semibold">{c.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{c.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Dialog */}
      <Dialog open={openDialog === "whatsapp"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display">
              <MessageSquare className="w-5 h-5 text-primary" />WhatsApp
            </DialogTitle>
          </DialogHeader>
          {whatsapp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {whatsapp.map((m) => <WhatsAppItem key={m.id} m={m} />)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Videos Dialog */}
      <Dialog open={openDialog === "videos"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display">
              <Video className="w-5 h-5 text-primary" />Vídeos
            </DialogTitle>
          </DialogHeader>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vídeo disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {videos.map((v) => <VideoItem key={v.id} v={v} />)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Portfólio Dialog */}
      <Dialog open={openDialog === "portfolio"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display">
              <FileText className="w-5 h-5 text-primary" />Portfólio
            </DialogTitle>
          </DialogHeader>
          {portfolio.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum portfólio disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {portfolio.map((p) => <PortfolioItem key={p.id} p={p} />)}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Argumentos Dialog */}
      <Dialog open={openDialog === "argumentos"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display">
              <MessagesSquare className="w-5 h-5 text-primary" />Argumentos
            </DialogTitle>
          </DialogHeader>
          {argumentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum argumento disponível ainda.</p>
          ) : (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                A principal força da nossa solução é o <span className="text-primary font-semibold">jeito monnera</span> de gerir
                incentivos financeiros, que se baseia em 3 pilares:
              </p>
              {Object.entries(argumentosByPilar).map(([pilar, { descricao, itens }]) => (
                <div key={pilar} className="space-y-2.5">
                  <div>
                    <p className="font-display font-semibold text-base">
                      <span className="text-primary">{pilar}:</span>
                    </p>
                    {descricao && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                        {descricao} <span className="text-primary font-medium">Use frases como:</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {itens.map((a) => (
                      <div key={a.id} className="rounded-xl bg-secondary/40 border border-border p-4 flex items-start justify-between gap-3">
                        <p className="text-sm leading-relaxed">{a.objecao}</p>
                        <Button size="sm" variant="outline" onClick={() => copy(a.objecao, "Frase copiada!")} className="shrink-0">
                          <Copy className="w-3.5 h-3.5 mr-1.5" />Copiar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
