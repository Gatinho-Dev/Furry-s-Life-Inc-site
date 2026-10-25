import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Presentation, Check, Loader2, AlertCircle, ArrowLeft, Plus, Copy, Trash2, Type, Square, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { loadPresentation, saveDeck, renamePresentation, uploadSlideImage, slideImageUrl } from "@/lib/workspace/presentations";
import { duplicateSlide, insertSlide, removeSlide, blankSlide, updateElement, newId, SLIDE_W, SLIDE_H, type Deck } from "@/lib/workspace/slides";

export const Route = createFileRoute("/workspace/slides/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Life Slides — Apresentação" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SlideEditor,
});

type Save = "saved" | "dirty" | "saving" | "error" | "conflict";

function SlideEditor() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const [title, setTitle] = useState("");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [current, setCurrent] = useState(0);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<Save>("saved");
  const [canEdit, setCanEdit] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  // Estado de salvamento: o deck pendente fica em memória até o backend confirmar.
  const version = useRef(0);
  const pendingDeck = useRef<Deck | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  const flush = useCallback(async () => {
    if (inflight.current || !pendingDeck.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setSave("error"); return; }
    const snapshot = pendingDeck.current;
    pendingDeck.current = null;
    inflight.current = true;
    setSave("saving");
    try {
      const v = await saveDeck(id, snapshot, version.current);
      if (v === null) {
        pendingDeck.current = pendingDeck.current ?? snapshot;
        setSave("conflict");
      } else {
        version.current = v;
        setSave(pendingDeck.current ? "dirty" : "saved");
      }
    } catch {
      pendingDeck.current = pendingDeck.current ?? snapshot;
      setSave("error");
    } finally {
      inflight.current = false;
    }
    if (pendingDeck.current && !timer.current) timer.current = setTimeout(() => { timer.current = null; flush(); }, 800);
  }, [id]);

  const queue = useCallback((next: Deck) => {
    setDeck(next);
    pendingDeck.current = next;
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; flush(); }, 900);
  }, [flush]);

  useEffect(() => {
    if (!uid) return;
    loadPresentation(id)
      .then((res) => {
        if (!res) { setMissing(true); return; }
        version.current = res.row.version;
        setTitle(res.row.title);
        setDeck(res.deck);
        setCanEdit(res.row.owner_id === uid);
      })
      .catch(() => setMissing(true));
  }, [uid, id]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pendingDeck.current || inflight.current) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const commitTitle = async (t: string) => {
    const clean = t.trim() || "Apresentação sem título";
    setTitle(clean);
    try { await renamePresentation(id, clean); } catch { toast.error("Não foi possível renomear."); }
  };

  // URLs assinadas só em memória. Precisa ficar antes dos returns condicionais (regra dos hooks).
  useEffect(() => {
    if (!deck) return;
    const wanted = deck.slides.flatMap((s) => s.elements).filter((e) => e.kind === "image" && e.storagePath);
    wanted.forEach((e) => {
      if (imageUrls[e.storagePath!]) return;
      slideImageUrl(e.storagePath!)
        .then((url) => setImageUrls((m) => ({ ...m, [e.storagePath!]: url })))
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck]);

  if (missing) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">Apresentação não encontrada ou você não tem acesso.</p>
      <Link to="/workspace/slides" className="text-sm text-primary underline">Voltar ao Life Slides</Link>
    </div>
  );
  if (!deck) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const slide = deck.slides[current] ?? deck.slides[0];
  const idx = deck.slides[current] ? current : 0;

  const addImage = async (file: File) => {
    if (!uid || !canEdit) return;
    setUploading(true);
    try {
      const path = await uploadSlideImage(uid, id, file);
      const el: import("@/lib/workspace/slides").SlideElement = { id: newId(), kind: "image", x: 320, y: 240, w: 640, h: 400, storagePath: path };
      queue({ slides: deck.slides.map((s, i) => (i === idx ? { ...slide, elements: [...slide.elements, el] } : s)) });
      setSelected(el.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const addElement = (kind: "text" | "shape") => {
    const el: import("@/lib/workspace/slides").SlideElement = kind === "text"
      ? { id: newId(), kind, x: 160, y: 380, w: 900, h: 200, text: "Novo texto", fontSize: 72, color: "#111827", align: "left" }
      : { id: newId(), kind, x: 300, y: 300, w: 400, h: 300, shape: "rect", fill: "#dbeafe", stroke: "transparent", strokeWidth: 0 };
    queue({ slides: deck.slides.map((s, i) => (i === idx ? { ...slide, elements: [...slide.elements, el] } : s)) });
    setSelected(el.id);
  };

  const addSlide = () => { const d = insertSlide(deck, blankSlide(), idx); queue(d); setCurrent(idx + 1); };
  const dupSlide = () => { queue(duplicateSlide(deck, idx)); setCurrent(idx + 1); };
  const delSlide = () => {
    if (deck.slides.length <= 1) return toast.error("A apresentação precisa de pelo menos um slide.");
    if (!window.confirm("Excluir este slide?")) return;
    queue(removeSlide(deck, idx));
    setCurrent(Math.max(0, idx - 1));
  };

  const sel = slide.elements.find((e) => e.id === selected) ?? null;
  const patchSel = (p: Partial<import("@/lib/workspace/slides").SlideElement>) => {
    if (!sel || !canEdit) return;
    const nextSlide = updateElement(slide, sel.id, p);
    queue({ slides: deck.slides.map((s, i) => (i === idx ? nextSlide : s)) });
  };

  const status = {
    saved: { icon: Check, text: "Salvo", cls: "text-muted-foreground" },
    dirty: { icon: Loader2, text: "Alterações pendentes", cls: "text-muted-foreground" },
    saving: { icon: Loader2, text: "Salvando…", cls: "text-muted-foreground" },
    error: { icon: AlertCircle, text: "Erro ao salvar — será tentado novamente", cls: "text-destructive" },
    conflict: { icon: AlertCircle, text: "Conflito: a apresentação foi alterada em outra sessão. Recarregue antes de continuar.", cls: "text-destructive" },
  }[save];

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Link to="/workspace/slides" aria-label="Voltar" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-4 w-4" /></Link>
        <Presentation className="h-5 w-5 text-primary" />
        <input key={title} defaultValue={title} onBlur={(e) => e.currentTarget.value !== title && commitTitle(e.currentTarget.value)}
          disabled={!canEdit} aria-label="Nome da apresentação"
          className="min-w-0 max-w-md flex-1 rounded-lg bg-transparent px-2 py-1 text-sm font-medium outline-none focus:bg-muted disabled:opacity-70" />
        <span className={`flex items-center gap-1.5 text-xs ${status.cls}`} role="status">
          <status.icon className={`h-3.5 w-3.5 ${save === "saving" || save === "dirty" ? "animate-spin" : ""}`} />{status.text}
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-border bg-secondary/30 p-3">
          {deck.slides.map((s, i) => (
            <button key={s.id} onClick={() => setCurrent(i)} aria-label={`Slide ${i + 1}`}
              className={`mb-3 flex aspect-video w-full items-center justify-center rounded-lg border text-xs text-muted-foreground ${i === idx ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
              style={{ background: s.background }}>
              {i + 1}
            </button>
          ))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
            <button disabled={!canEdit} onClick={addSlide} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"><Plus className="h-4 w-4" />Slide</button>
            <button disabled={!canEdit} onClick={dupSlide} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"><Copy className="h-4 w-4" />Duplicar</button>
            <button disabled={!canEdit} onClick={delSlide} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-destructive hover:bg-muted disabled:opacity-40"><Trash2 className="h-4 w-4" />Excluir</button>
            <span className="mx-2 h-5 w-px bg-border" />
            <button disabled={!canEdit} onClick={() => addElement("text")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"><Type className="h-4 w-4" />Texto</button>
            <button disabled={!canEdit} onClick={() => addElement("shape")} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-muted disabled:opacity-40"><Square className="h-4 w-4" />Forma</button>
            <button disabled={!canEdit || uploading} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-muted disabled:opacity-40">{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}Imagem</button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addImage(f); }} />
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-6">
            <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl shadow-lg" style={{ background: slide.background }} data-slide-id={slide.id}>
              {slide.elements.length === 0 && <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Slide vazio</div>}
              {slide.elements.map((el) => (
                <div key={el.id} data-element-id={el.id}
                  onPointerDown={() => canEdit && setSelected(el.id)}
                  className={`absolute overflow-hidden ${selected === el.id ? "outline outline-2 outline-primary" : ""}`}
                  style={{
                    left: `${(el.x / SLIDE_W) * 100}%`, top: `${(el.y / SLIDE_H) * 100}%`,
                    width: `${(el.w / SLIDE_W) * 100}%`, height: `${(el.h / SLIDE_H) * 100}%`,
                    background: el.kind === "shape" ? el.fill : undefined,
                    border: el.kind === "shape" && el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
                    borderRadius: el.shape === "ellipse" ? "50%" : el.shape === "round" ? "12%" : undefined,
                    color: el.color, textAlign: el.align,
                    fontSize: el.fontSize ? `${(el.fontSize / SLIDE_H) * 100}cqh` : undefined,
                    fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? "italic" : "normal",
                    whiteSpace: "pre-wrap", containerType: "size",
                  }}>
                  {el.kind === "text" ? el.text : null}
                  {el.kind === "image" && el.storagePath && imageUrls[el.storagePath] && (
                    <img src={imageUrls[el.storagePath]} alt="" className="h-full w-full object-contain" draggable={false} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        {sel && (
          <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4 text-sm">
            <div className="font-medium">{sel.kind === "text" ? "Texto" : sel.kind === "image" ? "Imagem" : "Forma"}</div>
            {sel.kind === "text" && (
              <>
                <label className="block">Conteúdo
                  <textarea value={sel.text ?? ""} disabled={!canEdit} onChange={(e) => patchSel({ text: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-transparent p-2 outline-none focus:border-primary" rows={4} />
                </label>
                <label className="block">Tamanho da fonte
                  <input type="number" min={8} max={400} value={sel.fontSize ?? 56} disabled={!canEdit}
                    onChange={(e) => patchSel({ fontSize: Math.max(8, Math.min(400, Number(e.target.value) || 8)) })}
                    className="mt-1 w-full rounded-lg border border-border bg-transparent px-2 py-1 outline-none" />
                </label>
                <div className="flex gap-2">
                  <button disabled={!canEdit} onClick={() => patchSel({ bold: !sel.bold })} aria-pressed={!!sel.bold}
                    className={`rounded-lg border border-border px-3 py-1 font-bold ${sel.bold ? "bg-secondary" : ""}`}>N</button>
                  <button disabled={!canEdit} onClick={() => patchSel({ italic: !sel.italic })} aria-pressed={!!sel.italic}
                    className={`rounded-lg border border-border px-3 py-1 italic ${sel.italic ? "bg-secondary" : ""}`}>I</button>
                </div>
              </>
            )}
            {sel.kind !== "image" && <label className="block">Cor
              <input type="color" value={sel.kind === "text" ? (sel.color ?? "#111827") : (sel.fill ?? "#dbeafe")} disabled={!canEdit}
                onChange={(e) => patchSel(sel.kind === "text" ? { color: e.target.value } : { fill: e.target.value })}
                className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-transparent" />
            </label>}
            <div className="grid grid-cols-2 gap-2">
              {(["x", "y", "w", "h"] as const).map((k) => (
                <label key={k} className="block uppercase">{k}
                  <input type="number" value={Math.round(sel[k])} disabled={!canEdit}
                    onChange={(e) => patchSel({ [k]: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-border bg-transparent px-2 py-1 outline-none" />
                </label>
              ))}
            </div>
            {canEdit && (
              <button onClick={() => { queue({ slides: deck.slides.map((s, i) => (i === idx ? { ...slide, elements: slide.elements.filter((e) => e.id !== sel.id) } : s)) }); setSelected(null); }}
                className="w-full rounded-lg border border-border px-3 py-2 text-destructive hover:bg-muted">Remover elemento</button>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
