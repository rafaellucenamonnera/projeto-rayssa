import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowUpRight,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  MessagesSquare,
  PlayCircle,
  Share2,
  Sparkles,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type WMsg = { id: string; titulo: string; subtitulo: string | null; mensagem: string; imagem_url: string | null };
type Vid = { id: string; titulo: string; subtitulo: string | null; descricao: string | null; video_url: string; thumbnail_url: string | null };
type Port = { id: string; titulo: string; pdf_url: string };
type Arg = { id: string; objecao: string; resposta: string; pilar: string; pilar_descricao: string | null };
type Rede = { id: string; titulo: string; link: string; comentario: string | null; imagem_url: string | null };

const isYoutube = (url: string) => /youtube\.com|youtu\.be/.test(url);
const isVimeo = (url: string) => /vimeo\.com/.test(url);
const ytId = (url: string) => url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
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
        "h-5 w-5 shrink-0 text-[#6BB0A1] transition-transform",
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
        supabase.from("kit_redes_sociais").select("id, titulo, link, comentario, imagem_url").order("ordem"),
      ]);
      setWhatsapp((w.data as WMsg[]) || []);
      setVideos((v.data as Vid[]) || []);
      setPortfolio((p.data as Port[]) || []);
      setArgumentos((a.data as Arg[]) || []);
      setRedes((r.data as Rede[]) || []);
    })();
  }, []);

  const cards = [
    {
      key: "whatsapp" as const,
      icon: MessageSquare,
      title: "WhatsApp",
      eyebrow: "Primeiro contato",
      desc: "Mensagens prontas para abrir conversa com clareza, contexto e próximo passo.",
      count: whatsapp.length,
    },
    {
      key: "videos" as const,
      icon: Video,
      title: "Vídeos",
      eyebrow: "Explicação rápida",
      desc: "Conteúdos para tornar a solução mais visual e fácil de entender.",
      count: videos.length,
    },
    {
      key: "portfolio" as const,
      icon: FileText,
      title: "Portfólio",
      eyebrow: "Material institucional",
      desc: "PDF para enviar quando o lead pedir uma visão mais completa da Monnera.",
      count: portfolio.length,
    },
    {
      key: "argumentos" as const,
      icon: MessagesSquare,
      title: "Argumentos",
      eyebrow: "Condução da conversa",
      desc: "Frases e pilares para responder objeções com segurança e naturalidade.",
      count: argumentos.length,
    },
    {
      key: "redes" as const,
      icon: Share2,
      title: "Redes sociais",
      eyebrow: "Presença digital",
      desc: "Materiais para reforçar autoridade e manter a Monnera no radar.",
      count: redes.length,
    },
  ];

  const dialogCopy: Record<NonNullable<typeof openDialog>, { title: string; intro: string }> = {
    whatsapp: {
      title: "WhatsApp",
      intro: "Escolha a mensagem que combina com o momento da conversa, copie e personalize com o nome do lead.",
    },
    videos: {
      title: "Vídeos",
      intro: "Use vídeos para explicar a Monnera com mais fluidez depois que o lead demonstrar interesse.",
    },
    portfolio: {
      title: "Portfólio",
      intro: "Envie o PDF quando a conversa pedir uma visão institucional, comercial ou de continuidade.",
    },
    argumentos: {
      title: "Argumentos",
      intro: "Use os pilares de conexão, centralização e segurança para conduzir objeções sem exagero comercial.",
    },
    redes: {
      title: "Redes sociais",
      intro: "Compartilhe materiais prontos para fortalecer presença digital e abrir novas conversas.",
    },
  };

  const copy = (text: string, msg = "Copiado!") => {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  };

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const handleCardClick = (key: typeof cards[number]["key"]) => {
    setExpanded({});
    setOpenDialog(key);
  };

  const WhatsAppItem = ({ m }: { m: WMsg }) => {
    const open = !!expanded[m.id];
    return (
      <div className="overflow-hidden rounded-lg border border-[#d7e9e4] bg-white">
        <button
          type="button"
          onClick={() => toggle(m.id)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f3faf7]"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#003729]">{m.titulo}</p>
            {m.subtitulo && <p className="mt-1 text-xs text-[#587169]">{m.subtitulo}</p>}
          </div>
          <ExpandIcon open={open} />
        </button>
        {open && (
          <div className="space-y-3 border-t border-[#d7e9e4] px-4 pb-4 pt-3">
            {m.imagem_url && (
              <div className="max-w-xs overflow-hidden rounded-md bg-[#003729]/10">
                <img src={m.imagem_url} alt={m.titulo} className="h-auto w-full" loading="lazy" />
              </div>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d5d54]">{m.mensagem}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(m.mensagem, "Mensagem copiada!")} className="bg-[#003729] text-white hover:bg-[#064b3a]">
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copiar mensagem
              </Button>
              {m.imagem_url && (
                <Button size="sm" variant="outline" onClick={() => downloadFile(m.imagem_url!, `${m.titulo}.jpg`)}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Baixar imagem
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
      <div className="overflow-hidden rounded-lg border border-[#d7e9e4] bg-white">
        <button
          type="button"
          onClick={() => toggle(v.id)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f3faf7]"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#6BB0A1]/15 text-[#003729]">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#003729]">{v.titulo}</p>
              {v.subtitulo && <p className="mt-1 text-xs text-[#587169]">{v.subtitulo}</p>}
            </div>
          </div>
          <ExpandIcon open={open} />
        </button>
        {open && (
          <div className="space-y-3 border-t border-[#d7e9e4] px-4 pb-4 pt-3">
            <div className="aspect-video overflow-hidden rounded-md bg-[#003729]">
              {isYoutube(v.video_url) ? (
                <iframe src={ytEmbed(v.video_url)} className="h-full w-full" allowFullScreen title={v.titulo} />
              ) : isVimeo(v.video_url) ? (
                <iframe src={vimeoEmbed(v.video_url)} className="h-full w-full" allowFullScreen title={v.titulo} />
              ) : (
                <video src={v.video_url} poster={thumb || undefined} controls className="h-full w-full" />
              )}
            </div>
            {v.descricao && <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d5d54]">{v.descricao}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(v.video_url, "Link copiado!")} className="bg-[#003729] text-white hover:bg-[#064b3a]">
                <LinkIcon className="mr-2 h-3.5 w-3.5" />
                Copiar link
              </Button>
              {!isExternal ? (
                <Button size="sm" variant="outline" onClick={() => downloadFile(v.video_url, `${v.titulo}.mp4`)}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Baixar vídeo
                </Button>
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <a href={v.video_url} target="_blank" rel="noreferrer">
                    <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
                    Abrir
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
      <div className="overflow-hidden rounded-lg border border-[#d7e9e4] bg-white">
        <button
          type="button"
          onClick={() => toggle(p.id)}
          className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f3faf7]"
        >
          <div className="min-w-0">
            <p className="truncate font-semibold text-[#003729]">{p.titulo}</p>
            <p className="mt-1 text-xs text-[#587169]">PDF institucional</p>
          </div>
          <ExpandIcon open={open} />
        </button>
        {open && (
          <div className="space-y-3 border-t border-[#d7e9e4] px-4 pb-4 pt-3">
            <div className="aspect-[4/3] overflow-hidden rounded-md bg-[#003729]/10">
              <iframe src={p.pdf_url} className="h-full w-full" title={p.titulo} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => copy(p.pdf_url, "Link copiado!")} className="bg-[#003729] text-white hover:bg-[#064b3a]">
                <LinkIcon className="mr-2 h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadFile(p.pdf_url, `${p.titulo}.pdf`)}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Baixar PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const argumentosByPilar = argumentos.reduce<Record<string, { descricao: string | null; itens: Arg[] }>>((acc, a) => {
    const key = a.pilar || "Outros";
    if (!acc[key]) acc[key] = { descricao: a.pilar_descricao, itens: [] };
    if (!acc[key].descricao && a.pilar_descricao) acc[key].descricao = a.pilar_descricao;
    acc[key].itens.push(a);
    return acc;
  }, {});

  const activeCopy = openDialog ? dialogCopy[openDialog] : null;

  return (
    <>
      <Card className="monnera-card-elevated overflow-hidden">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[0.88fr_1.12fr]">
            <div className="border-b border-[#d7e9e4] bg-[#e7f4f0] p-5 text-[#003729] sm:p-7 lg:border-b-0 lg:border-r">
              <div className="monnera-eyebrow">
                <Sparkles className="h-3.5 w-3.5" />
                Kit de vendas
              </div>
              <h2 className="mt-5 text-3xl font-bold leading-tight">Materiais para abrir conversas com mais clareza.</h2>
              <p className="mt-4 text-sm leading-relaxed text-[#33584f]">
                Use o kit como apoio de conversa, não como substituto da relação. Primeiro entenda o contexto do lead,
                depois escolha o material que ajuda a explicar como a Monnera conecta estratégia, operação e pessoas.
              </p>
              <div className="mt-6 grid gap-3 text-sm">
                {["Identifique a dor", "Envie o material certo", "Cadastre o lead", "Convide o time Monnera"].map((step, index) => (
                  <div key={step} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#6BB0A1] text-xs font-bold text-[#003729]">
                      {index + 1}
                    </span>
                    <span className="text-[#33584f]">{step}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {cards.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleCardClick(c.key)}
                  className="group rounded-lg border border-[#d7e9e4] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#6BB0A1] hover:shadow-lg hover:shadow-[#003729]/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[#6BB0A1]/15 text-[#003729]">
                      <c.icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-[#eef7f4] px-2 py-1 text-xs font-semibold text-[#2b6d5e]">
                      {c.count}
                    </span>
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[#6b8a82]">{c.eyebrow}</p>
                  <h3 className="mt-1 text-lg font-bold text-[#003729]">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#4f6d65]">{c.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#00624b]">
                    Acessar material
                    <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openDialog === "whatsapp"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-[#f5faf8] text-[#003729]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessageSquare className="h-5 w-5 text-[#00624b]" />
              {activeCopy?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[#4f6d65]">{activeCopy?.intro}</p>
          {whatsapp.length === 0 ? (
            <p className="text-sm text-[#4f6d65]">Nenhuma mensagem disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">{whatsapp.map((m) => <WhatsAppItem key={m.id} m={m} />)}</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "videos"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-[#f5faf8] text-[#003729]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Video className="h-5 w-5 text-[#00624b]" />
              {activeCopy?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[#4f6d65]">{activeCopy?.intro}</p>
          {videos.length === 0 ? (
            <p className="text-sm text-[#4f6d65]">Nenhum vídeo disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">{videos.map((v) => <VideoItem key={v.id} v={v} />)}</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "portfolio"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-[#f5faf8] text-[#003729]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="h-5 w-5 text-[#00624b]" />
              {activeCopy?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[#4f6d65]">{activeCopy?.intro}</p>
          {portfolio.length === 0 ? (
            <p className="text-sm text-[#4f6d65]">Nenhum portfólio disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">{portfolio.map((p) => <PortfolioItem key={p.id} p={p} />)}</div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "argumentos"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-[#f5faf8] text-[#003729]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <MessagesSquare className="h-5 w-5 text-[#00624b]" />
              {activeCopy?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[#4f6d65]">{activeCopy?.intro}</p>
          {argumentos.length === 0 ? (
            <p className="text-sm text-[#4f6d65]">Nenhum argumento disponível ainda.</p>
          ) : (
            <div className="space-y-5">
              {Object.entries(argumentosByPilar).map(([pilar, { descricao, itens }]) => (
                <div key={pilar} className="space-y-2.5">
                  <div className="rounded-lg bg-[#003729] p-4 text-white">
                    <p className="font-semibold">
                      <span className="text-[#9fd4c8]">{pilar}</span>
                    </p>
                    {descricao && <p className="mt-1 text-sm leading-relaxed text-white/72">{descricao}</p>}
                  </div>
                  <div className="space-y-2">
                    {itens.map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border border-[#d7e9e4] bg-white p-4">
                        <p className="text-sm leading-relaxed text-[#3d5d54]">{a.objecao}</p>
                        <Button size="sm" variant="outline" onClick={() => copy(a.objecao, "Frase copiada!")} className="shrink-0">
                          <Copy className="mr-2 h-3.5 w-3.5" />
                          Copiar
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

      <Dialog open={openDialog === "redes"} onOpenChange={(o) => !o && setOpenDialog(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto bg-[#f5faf8] text-[#003729]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Share2 className="h-5 w-5 text-[#00624b]" />
              {activeCopy?.title}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-[#4f6d65]">{activeCopy?.intro}</p>
          {redes.length === 0 ? (
            <p className="text-sm text-[#4f6d65]">Nenhum material disponível ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {redes.map((r) => {
                const open = !!expanded[r.id];
                let domain = r.link;
                try {
                  domain = new URL(r.link).hostname.replace(/^www\./, "");
                } catch {}
                return (
                  <div key={r.id} className="overflow-hidden rounded-lg border border-[#d7e9e4] bg-white">
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f3faf7]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {r.imagem_url ? (
                          <img src={r.imagem_url} alt="" className="h-12 w-12 shrink-0 rounded-md border border-[#d7e9e4] object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#6BB0A1]/15">
                            <Share2 className="h-5 w-5 text-[#003729]" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#003729]">{r.titulo}</p>
                          <p className="mt-1 truncate text-xs text-[#587169]">{domain}</p>
                        </div>
                      </div>
                      <ExpandIcon open={open} />
                    </button>
                    {open && (
                      <div className="space-y-3 border-t border-[#d7e9e4] px-4 pb-4 pt-3">
                        {r.imagem_url && (
                          <div className="max-w-xs overflow-hidden rounded-md bg-[#003729]/10">
                            <img src={r.imagem_url} alt={r.titulo} className="h-auto w-full" loading="lazy" />
                          </div>
                        )}
                        {r.comentario && <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#3d5d54]">{r.comentario}</p>}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => copy(r.link, "Link copiado!")} className="bg-[#003729] text-white hover:bg-[#064b3a]">
                            <LinkIcon className="mr-2 h-3.5 w-3.5" />
                            Copiar link
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={r.link} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              Abrir
                            </a>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
