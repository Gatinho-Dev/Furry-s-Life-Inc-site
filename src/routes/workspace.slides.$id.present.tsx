import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { loadPresentation, slideImageUrl } from "@/lib/workspace/presentations";
import { SLIDE_W, SLIDE_H, type Deck } from "@/lib/workspace/slides";

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
  const [backTo, setBackTo] = useState("/workspace/slides");
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!uid) return;
    loadPresentation(id)
      .then((res) => {
        if (!res) { setMissing(true); return; }
        setDeck(res.deck);
        setBackTo(`/workspace/slides/${id}`);
      })
      .catch(() => setMissing(true));
  }, [uid, id]);

  useEffect(() => {
    if (!deck) return;
    deck.slides.flatMap((s) => s.elements).forEach((e) => {
      if (e.kind !== "image" || !e.storagePath) return;
      slideImageUrl(e.storagePath)
        .then((url) => setImageUrls((m) => ({ ...m, [e.storagePath!]: url })))
        .catch(() => {});
    });
  }, [deck]);

  const last = deck ? deck.slides.length - 1 : 0;
  const go = useCallback((n: number) => setIndex((i) => Math.max(0, Math.min(last, n))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault(); go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault(); go(index - 1);
      } else if (e.key === "Home") { go(0); }
      else if (e.key === "End") { go(last); }
      else if (e.key === "Escape") { window.location.assign(backTo); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, last, go, backTo]);

  if (missing) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">Apresentação não encontrada ou você não tem acesso.</p>
      <Link to="/workspace/slides" className="text-sm text-primary underline">Voltar ao Life Slides</Link>
    </div>
  );
  if (!deck) return <div className="flex h-screen items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>;

  const slide = deck.slides[index];
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-black" onClick={(e) => { if (e.clientX > window.innerWidth / 2) go(index + 1); else go(index - 1); }}>
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${SLIDE_W} / ${SLIDE_H}`, maxHeight: "100vh", maxWidth: `calc(100vh * ${SLIDE_W} / ${SLIDE_H})`, background: slide.background, containerType: "size" }}>
        {slide.elements.map((el) => (
          <div key={el.id}
            className="absolute overflow-hidden"
            style={{
              left: `${(el.x / SLIDE_W) * 100}%`, top: `${(el.y / SLIDE_H) * 100}%`,
              width: `${(el.w / SLIDE_W) * 100}%`, height: `${(el.h / SLIDE_H) * 100}%`,
              background: el.kind === "shape" ? el.fill : undefined,
              border: el.kind === "shape" && el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
              borderRadius: el.shape === "ellipse" ? "50%" : el.shape === "round" ? "12%" : undefined,
              color: el.color, textAlign: el.align,
              fontSize: el.fontSize ? `${(el.fontSize / SLIDE_H) * 100}cqh` : undefined,
              fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? "italic" : "normal",
              whiteSpace: "pre-wrap",
            }}>
            {el.kind === "text" ? el.text : null}
            {el.kind === "image" && el.storagePath && imageUrls[el.storagePath] && (
              <img src={imageUrls[el.storagePath]} alt="" className="h-full w-full object-contain" draggable={false} />
            )}
          </div>
        ))}
        <div className="absolute bottom-2 right-3 text-xs text-black/40">{index + 1} / {deck.slides.length}</div>
      </div>
    </div>
  );
}
