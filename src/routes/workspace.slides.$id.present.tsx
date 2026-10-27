import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Maximize, Minimize, StickyNote } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { loadPresentation, slideImageUrl } from "@/lib/workspace/presentations";
import { SLIDE_W, elementStyle, type Deck } from "@/lib/workspace/slides";

export const Route = createFileRoute("/workspace/slides/$id/present")({
  ssr: false,
  head: () => ({ meta: [{ title: "Life Slides — Apresentação" }, { name: "robots", content: "noindex" }] }),
  component: PresentMode,
});

function PresentMode() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const [deck, setDeck] = useState<Deck | null>(null);
  const [missing, setMissing] = useState(false);
  const [index, setIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const backTo = `/workspace/slides/${id}`;

  useEffect(() => {
    if (!uid) return;
    loadPresentation(id)
      .then((res) => {
        if (!res) { setMissing(true); return; }
        setDeck(res.deck);
      })
      .catch(() => setMissing(true));
  }, [uid, id]);

  useEffect(() => {
    if (!deck) return;
    deck.slides.flatMap((s) => s.elements).forEach((e) => {
      const p = e.storagePath;
      if (e.kind !== "image" || !p) return;
      slideImageUrl(p)
        .then((url) => setImageUrls((m) => ({ ...m, [p]: url })))
        .catch(() => {});
    });
  }, [deck]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const last = deck ? deck.slides.length - 1 : 0;
  const go = useCallback((n: number) => setIndex((i) => Math.max(0, Math.min(last, n))), [last]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault(); go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault(); go(index - 1);
      } else if (e.key === "Home") { go(0); }
      else if (e.key === "End") { go(last); }
      else if (k === "f") { toggleFullscreen(); }
      else if (k === "n") { setShowNotes((v) => !v); }
      else if (e.key === "Escape" && !document.fullscreenElement) { window.location.assign(backTo); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, go, backTo, toggleFullscreen]);

  if (missing) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">Apresentação não encontrada ou você não tem acesso.</p>
      <Link to="/workspace/slides" className="text-sm text-primary underline">Voltar ao Life Slides</Link>
    </div>
  );
  if (!deck) return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>;

  const slide = deck.slides[index];
  const bar = "absolute top-2 right-2 z-10 flex gap-1.5 opacity-40 hover:opacity-100";
  const chip = "rounded-md bg-black/60 p-1.5 text-white";

  return (
    <div className="flex h-screen w-screen flex-col bg-black">
      <div className="relative flex min-h-0 flex-1 items-center justify-center"
        onClick={(e) => { if (e.clientX > window.innerWidth / 2) go(index + 1); else go(index - 1); }}>
        <div className="relative w-full overflow-hidden"
          style={{ aspectRatio: `${SLIDE_W} / 1080`, maxHeight: "100%", maxWidth: `calc(100% * ${SLIDE_W} / 1080)`, background: slide.background, containerType: "size" }}>
          {slide.elements.map((el) => (
            <div key={el.id} className="absolute overflow-hidden" style={elementStyle(el)}>
              {el.kind === "text" ? el.text : null}
              {el.kind === "image" && el.storagePath && imageUrls[el.storagePath] && (
                <img src={imageUrls[el.storagePath]} alt="" className="h-full w-full object-contain" draggable={false} />
              )}
            </div>
          ))}
        </div>
        <div className={bar} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes} title="Anotações (N)" className={chip}><StickyNote className="h-4 w-4" /></button>
          <button onClick={toggleFullscreen} title="Tela cheia (F)" className={chip}>
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <Link to={backTo} title="Sair (Esc)" className={`${chip} px-2 text-sm`}>Sair</Link>
        </div>
        <div className="absolute bottom-2 right-3 text-xs text-white/50">{index + 1} / {deck.slides.length}</div>
      </div>
      {showNotes && (
        <div className="max-h-[30vh] overflow-y-auto border-t border-white/10 bg-zinc-900 p-4 text-sm text-white" onClick={(e) => e.stopPropagation()}>
          <div className="mb-1 text-xs uppercase tracking-wide text-white/50">Anotações do slide {index + 1}</div>
          <p className="whitespace-pre-wrap">{slide.notes || "Sem anotações neste slide."}</p>
        </div>
      )}
    </div>
  );
}
