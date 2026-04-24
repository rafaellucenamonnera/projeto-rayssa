import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MessageSquare, Video, FileText, MessagesSquare, Copy, Download, Play } from "lucide-react";
import { toast } from "sonner";

type WMsg = { id: string; titulo: string; mensagem: string };
type Vid = { id: string; titulo: string; descricao: string | null; video_url: string };
type Port = { id: string; titulo: string; pdf_url: string };
type Arg = { id: string; objecao: string; resposta: string };

const isYoutube = (url: string) => /youtube\.com|youtu\.be/.test(url);
const isVimeo = (url: string) => /vimeo\.com/.test(url);
const ytEmbed = (url: string) => {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : url;
};
const vimeoEmbed = (url: string) => {
  const m = url.match(/vimeo\.com\/(\d+)/);
  return m ? `https://player.vimeo.com/video/${m[1]}` : url;
};

export function KitVendasSection() {
  const [open, setOpen] = useState<null | "whatsapp" | "videos" | "portfolio" | "argumentos">(null);
  const [whatsapp, setWhatsapp] = useState<WMsg[]>([]);
  const [videos, setVideos] = useState<Vid[]>([]);
  const [portfolio, setPortfolio] = useState<Port | null>(null);
  const [argumentos, setArgumentos] = useState<Arg[]>([]);

  useEffect(() => {
    (async () => {
      const [w, v, p, a] = await Promise.all([
        supabase.from("kit_whatsapp_messages").select("id, titulo, mensagem").order("ordem"),
        supabase.from("kit_videos").select("id, titulo, descricao, video_url").order("ordem"),
        supabase.from("kit_portfolio").select("id, titulo, pdf_url").eq("ativo", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("kit_argumentos").select("id, objecao, resposta").order("ordem"),
      ]);
      setWhatsapp((w.data as WMsg[]) || []);
      setVideos((v.data as Vid[]) || []);
      setPortfolio((p.data as Port) || null);
      setArgumentos((a.data as Arg[]) || []);
    })();
  }, []);

  const cards = [
    { key: "whatsapp" as const, icon: MessageSquare, title: "WhatsApp", desc: "Mensagens prontas para facilitar suas conversas com leads no WhatsApp" },
    { key: "videos" as const, icon: Video, title: "Vídeos", desc: "Vídeos prontos para apoiar suas abordagens e tornar a conversa com leads mais clara e envolvente." },
    { key: "portfolio" as const, icon: FileText, title: "Portfólio", desc: "Portfólio resumido para enviar onde quiser e acrescentar conteúdo nas negociações" },
    { key: "argumentos" as const, icon: MessagesSquare, title: "Argumentos", desc: "Argumentos de venda organizados para facilitar suas conversas e conduzir leads com mais segurança" },
  ];

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada!");
  };

  const handleCardClick = (key: typeof cards[number]["key"]) => {
    if (key === "portfolio") {
      if (!portfolio) return toast.error("Portfólio ainda não disponível.");
      window.open(portfolio.pdf_url, "_blank");
      return;
    }
    setOpen(key);
  };

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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
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
      <Dialog open={open === "whatsapp"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" />Mensagens de WhatsApp</DialogTitle></DialogHeader>
          {whatsapp.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma mensagem disponível ainda.</p>
          ) : (
            <div className="space-y-3">
              {whatsapp.map((m) => (
                <div key={m.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{m.titulo}</p>
                    <Button size="sm" variant="outline" onClick={() => copy(m.mensagem)}><Copy className="w-3 h-3 mr-1" />Copiar</Button>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{m.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Videos Dialog */}
      <Dialog open={open === "videos"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Video className="w-5 h-5 text-primary" />Vídeos</DialogTitle></DialogHeader>
          {videos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vídeo disponível ainda.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {videos.map((v) => (
                <div key={v.id} className="rounded-lg border border-border overflow-hidden">
                  <div className="aspect-video bg-black">
                    {isYoutube(v.video_url) ? (
                      <iframe src={ytEmbed(v.video_url)} className="w-full h-full" allowFullScreen />
                    ) : isVimeo(v.video_url) ? (
                      <iframe src={vimeoEmbed(v.video_url)} className="w-full h-full" allowFullScreen />
                    ) : (
                      <video src={v.video_url} controls className="w-full h-full" />
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="font-medium text-sm">{v.titulo}</p>
                    {v.descricao && <p className="text-xs text-muted-foreground">{v.descricao}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={v.video_url} target="_blank" rel="noreferrer"><Play className="w-3 h-3 mr-1" />Abrir</a>
                      </Button>
                      {!isYoutube(v.video_url) && !isVimeo(v.video_url) && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={v.video_url} download><Download className="w-3 h-3 mr-1" />Baixar</a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Argumentos Dialog */}
      <Dialog open={open === "argumentos"} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><MessagesSquare className="w-5 h-5 text-primary" />Argumentos de venda</DialogTitle></DialogHeader>
          {argumentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum argumento disponível ainda.</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {argumentos.map((a) => (
                <AccordionItem key={a.id} value={a.id}>
                  <AccordionTrigger className="text-left text-sm">{a.objecao}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground whitespace-pre-wrap">{a.resposta}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
