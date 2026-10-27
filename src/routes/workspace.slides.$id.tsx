import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { toast } from "sonner";
import {
  Presentation, Check, Loader2, AlertCircle, ArrowLeft, Plus, Copy, Trash2, Type, Square, Image as ImageIcon,
  Undo2, Redo2, ChevronLeft, ChevronRight, Play, AlignLeft, AlignCenter, AlignRight, Bold, Italic,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { loadPresentation, saveDeck, renamePresentation, uploadSlideImage, slideImageUrl } from "@/lib/workspace/presentations";
import {
  blankSlide, clampRect, duplicateElement, duplicateSlide, elementStyle, insertSlide, moveElementZ, moveSlide,
  newId, removeElement, removeSlide, SLIDE_W, updateElement, withSlide,
  type Deck, type Slide, type SlideElement,
} from "@/lib/workspace/slides";

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

const HISTORY_LIMIT = 100;

/** Conteúdo de um elemento (texto ou imagem). A posição e o estilo vêm de elementStyle. */
function ElementBody({ el, url }: { el: SlideElement; url?: string }) {
  if (el.kind === "text") return <div className="h-full w-full overflow-hidden">{el.text}</div>;
  if (el.kind === "image" && url) {
    return <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />;
  }
  return null;
}

const LABEL: Record<SlideElement["kind"], string> = { text: "Texto", shape: "Forma", image: "Imagem" };

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
  const canvasRef = useRef<HTMLDivElement>(null);

  // Estado de salvamento: o deck pendente fica em memória até o backend confirmar.
  const version = useRef(0);
  const pendingDeck = useRef<Deck | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  // Histórico de desfazer/refazer, e o deck mais recente lido pelos atalhos e pelo arraste.
  const latest = useRef<Deck | null>(null);
  const past = useRef<Deck[]>([]);
  const future = useRef<Deck[]>([]);
  // Uma sessão de edição contínua (digitação em campo) vira um único passo de histórico.
  const session = useRef(false);
  const drag = useRef<{
    id: string; mode: "move" | "resize"; sx: number; sy: number;
    orig: Pick<SlideElement, "x" | "y" | "w" | "h">; started: boolean;
  } | null>(null);
  const idxRef = useRef(0);
  const requested = useRef(new Set<string>());

  const flush = useCallback(async () => {
    if (inflight.current || !pendingDeck.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setSave("error"); return; }
    const snapshot = pendingDeck.current;
    pendingDeck.current = null;
    inflight.current = true;
    setSave("saving");
    // Conflito não é tentado de novo sozinho: exige recarregar a página.
    let retry = true;
    try {
      const v = await saveDeck(id, snapshot, version.current);
      if (v === null) {
        pendingDeck.current = pendingDeck.current ?? snapshot;
        setSave("conflict");
        retry = false;
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
    if (retry && pendingDeck.current && !timer.current) timer.current = setTimeout(() => { timer.current = null; flush(); }, 800);
  }, [id]);

  const queue = useCallback((next: Deck) => {
    latest.current = next;
    setDeck(next);
    pendingDeck.current = next;
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; flush(); }, 900);
  }, [flush]);

  const pushHistory = () => {
    if (!latest.current) return;
    past.current = [...past.current.slice(-(HISTORY_LIMIT - 1)), latest.current];
    future.current = [];
  };
  const endSession = () => { session.current = false; };
  /** Ação pontual (um passo de histórico). */
  const edit = (next: Deck) => { endSession(); pushHistory(); queue(next); };
  /** Edição contínua, como digitar num campo: um passo de histórico por sessão. */
  const touch = (next: Deck) => {
    if (!session.current) { pushHistory(); session.current = true; }
    queue(next);
  };
  /** Aplica uma mudança no slide atual, usando sempre o deck mais recente. */
  const mapCurrent = (fn: (s: Slide) => Slide, continuous = false) => {
    const cur = latest.current;
    if (!cur) return;
    const i = idxRef.current;
    const next = withSlide(cur, i, fn(cur.slides[i]));
    if (continuous) touch(next); else edit(next);
  };
  const undo = () => {
    endSession();
    const prev = past.current.pop();
    if (!prev || !latest.current) return;
    future.current.push(latest.current);
    queue(prev);
  };
  const redo = () => {
    endSession();
    const next = future.current.pop();
    if (!next || !latest.current) return;
    past.current.push(latest.current);
    queue(next);
  };

  useEffect(() => {
    if (!uid) return;
    loadPresentation(id)
      .then((res) => {
        if (!res) { setMissing(true); return; }
        version.current = res.row.version;
        latest.current = res.deck;
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

  // Arrastar e redimensionar: converte pixels da tela em unidades do slide (1920 x 1080).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      const box = canvasRef.current;
      const cur = latest.current;
      if (!d || !box || !cur || !cur.slides[idxRef.current]) return;
      const k = SLIDE_W / box.getBoundingClientRect().width;
      const dx = (e.clientX - d.sx) * k;
      const dy = (e.clientY - d.sy) * k;
      if (!d.started) { pushHistory(); d.started = true; }
      const rect = d.mode === "move"
        ? clampRect({ ...d.orig, x: d.orig.x + dx, y: d.orig.y + dy })
        : clampRect({ x: d.orig.x, y: d.orig.y, w: d.orig.w + dx, h: d.orig.h + dy });
      const i = idxRef.current;
      queue(withSlide(cur, i, updateElement(cur.slides[i], d.id, rect)));
    };
    const onUp = () => { drag.current = null; endSession(); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [queue]);

  // URLs assinadas só em memória, pedidas uma vez por caminho. Ficam antes dos returns condicionais.
  useEffect(() => {
    if (!deck) return;
    deck.slides.flatMap((s) => s.elements).forEach((e) => {
      const p = e.storagePath;
      if (e.kind !== "image" || !p || requested.current.has(p)) return;
      requested.current.add(p);
      slideImageUrl(p)
        .then((url) => setImageUrls((m) => ({ ...m, [p]: url })))
        .catch(() => requested.current.delete(p));
    });
  }, [deck]);

  // Atalhos do editor. Sem array de dependências: re-registra a cada render com os valores atuais.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && key === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && key === "y") { e.preventDefault(); redo(); return; }
      if (e.key === "Escape") { setSelected(null); return; }
      const cur = latest.current;
      if (!cur || !canEdit || !selected) return;
      const i = idxRef.current;
      const slide = cur.slides[i];
      const el = slide?.elements.find((x) => x.id === selected);
      if (!el) return;
      if (mod && key === "d") {
        e.preventDefault();
        const next = duplicateElement(slide, el.id);
        edit(withSlide(cur, i, next));
        setSelected(next.elements[next.elements.length - 1].id);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        edit(withSlide(cur, i, removeElement(slide, el.id)));
        setSelected(null);
        return;
      }
      const step = e.shiftKey ? 50 : 10;
      const moves: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const m = moves[e.key];
      if (m) {
        e.preventDefault();
        edit(withSlide(cur, i, updateElement(slide, el.id, clampRect({ ...el, x: el.x + m[0], y: el.y + m[1] }))));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (missing) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">Apresentação não encontrada ou você não tem acesso.</p>
      <Link to="/workspace/slides" className="text-sm text-primary underline">Voltar ao Life Slides</Link>
    </div>
  );
  if (!deck) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const idx = deck.slides[current] ? current : 0;
  idxRef.current = idx;
  const slide = deck.slides[idx];
  const sel = slide.elements.find((e) => e.id === selected) ?? null;

  const commitTitle = async (t: string) => {
    const clean = t.trim() || "Apresentação sem título";
    setTitle(clean);
    try { await renamePresentation(id, clean); } catch { toast.error("Não foi possível renomear."); }
  };

  const goTo = (i: number) => { setCurrent(i); setSelected(null); };

  const addImage = async (file: File) => {
    if (!uid || !canEdit) return;
    setUploading(true);
    try {
      const path = await uploadSlideImage(uid, id, file);
      const el: SlideElement = { id: newId(), kind: "image", x: 320, y: 240, w: 640, h: 400, storagePath: path };
      mapCurrent((s) => ({ ...s, elements: [...s.elements, el] }));
      setSelected(el.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const addElement = (kind: "text" | "shape") => {
    const el: SlideElement = kind === "text"
      ? { id: newId(), kind, x: 160, y: 380, w: 900, h: 200, text: "Novo texto", fontSize: 72, color: "#111827", align: "left" }
      : { id: newId(), kind, x: 300, y: 300, w: 400, h: 300, shape: "rect", fill: "#dbeafe", stroke: "transparent", strokeWidth: 0 };
    mapCurrent((s) => ({ ...s, elements: [...s.elements, el] }));
    setSelected(el.id);
  };

  const addSlide = () => { edit(insertSlide(deck, blankSlide(), idx)); goTo(idx + 1); };
  const dupSlide = () => { edit(duplicateSlide(deck, idx)); goTo(idx + 1); };
  const delSlide = () => {
    if (deck.slides.length <= 1) return toast.error("A apresentação precisa de pelo menos um slide.");
    if (!window.confirm("Excluir este slide?")) return;
    edit(removeSlide(deck, idx));
    goTo(Math.max(0, idx - 1));
  };
  const moveSlideBy = (d: number) => {
    const to = idx + d;
    if (to < 0 || to >= deck.slides.length) return;
    edit(moveSlide(deck, idx, to));
    goTo(to);
  };

  const patchSel = (p: Partial<SlideElement>, continuous = false) => {
    if (!sel || !canEdit) return;
    mapCurrent((s) => updateElement(s, sel.id, p), continuous);
  };
  const duplicateSel = () => {
    if (!sel || !canEdit) return;
    const next = duplicateElement(slide, sel.id);
    edit(withSlide(deck, idx, next));
    setSelected(next.elements[next.elements.length - 1].id);
  };
  const removeSel = () => {
    if (!sel || !canEdit) return;
    edit(withSlide(deck, idx, removeElement(slide, sel.id)));
    setSelected(null);
  };
  const startDrag = (e: ReactPointerEvent, el: SlideElement, mode: "move" | "resize") => {
    if (!canEdit) return;
    e.stopPropagation();
    setSelected(el.id);
    drag.current = { id: el.id, mode, sx: e.clientX, sy: e.clientY, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, started: false };
  };

  const status = {
    saved: { icon: Check, text: "Salvo", cls: "text-muted-foreground" },
    dirty: { icon: Loader2, text: "Alterações pendentes", cls: "text-muted-foreground" },
    saving: { icon: Loader2, text: "Salvando…", cls: "text-muted-foreground" },
    error: { icon: AlertCircle, text: "Erro ao salvar — será tentado novamente", cls: "text-destructive" },
    conflict: { icon: AlertCircle, text: "Conflito: a apresentação foi alterada em outra sessão. Recarregue antes de continuar.", cls: "text-destructive" },
  }[save];

  const btn = "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm hover:bg-muted disabled:opacity-40";
  const field = "mt-1 w-full rounded-lg border border-border bg-transparent px-2 py-1 outline-none focus:border-primary";
  const iconBtn = (on: boolean) => `rounded-lg border border-border p-1.5 hover:bg-muted disabled:opacity-40 ${on ? "bg-secondary" : ""}`;

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
        <Link to="/workspace/slides/$id/present" params={{ id }} className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90">
          <Play className="h-4 w-4" />Apresentar
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="w-44 shrink-0 overflow-y-auto border-r border-border bg-secondary/30 p-3">
          {deck.slides.map((s, i) => (
            <button key={s.id} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`}
              className={`mb-3 block w-full overflow-hidden rounded-lg border ${i === idx ? "border-primary ring-2 ring-primary/30" : "border-border"}`}>
              <div className="relative aspect-video w-full" style={{ background: s.background, containerType: "size" }}>
                {s.elements.map((el) => (
                  <div key={el.id} className="absolute" style={elementStyle(el)}>
                    <ElementBody el={el} url={el.storagePath ? imageUrls[el.storagePath] : undefined} />
                  </div>
                ))}
              </div>
              <div className="bg-background py-0.5 text-center text-[10px] text-muted-foreground">{i + 1}</div>
            </button>
          ))}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1.5">
            <button disabled={!canEdit || past.current.length === 0} onClick={undo} title="Desfazer (Ctrl+Z)" className={btn}><Undo2 className="h-4 w-4" /></button>
            <button disabled={!canEdit || future.current.length === 0} onClick={redo} title="Refazer (Ctrl+Y)" className={btn}><Redo2 className="h-4 w-4" /></button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button disabled={!canEdit} onClick={addSlide} className={btn}><Plus className="h-4 w-4" />Slide</button>
            <button disabled={!canEdit} onClick={dupSlide} className={btn}><Copy className="h-4 w-4" />Duplicar</button>
            <button disabled={!canEdit || idx === 0} onClick={() => moveSlideBy(-1)} title="Mover slide para a esquerda" className={btn}><ChevronLeft className="h-4 w-4" /></button>
            <button disabled={!canEdit || idx === deck.slides.length - 1} onClick={() => moveSlideBy(1)} title="Mover slide para a direita" className={btn}><ChevronRight className="h-4 w-4" /></button>
            <button disabled={!canEdit} onClick={delSlide} className={`${btn} text-destructive`}><Trash2 className="h-4 w-4" />Excluir</button>
            <span className="mx-1 h-5 w-px bg-border" />
            <button disabled={!canEdit} onClick={() => addElement("text")} className={btn}><Type className="h-4 w-4" />Texto</button>
            <button disabled={!canEdit} onClick={() => addElement("shape")} className={btn}><Square className="h-4 w-4" />Forma</button>
            <button disabled={!canEdit || uploading} onClick={() => fileInput.current?.click()} className={btn}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}Imagem
            </button>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addImage(f); }} />
          </div>

          <div className="flex flex-1 items-center justify-center overflow-auto p-6" onPointerDown={() => setSelected(null)}>
            <div ref={canvasRef} className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-xl shadow-lg"
              style={{ background: slide.background, containerType: "size" }} data-slide-id={slide.id}>
              {slide.elements.length === 0 && <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Slide vazio</div>}
              {slide.elements.map((el) => (
                <div key={el.id} data-element-id={el.id}
                  onPointerDown={(e) => startDrag(e, el, "move")}
                  className={`absolute ${canEdit ? "cursor-move" : ""} ${selected === el.id ? "outline outline-2 outline-primary" : ""}`}
                  style={elementStyle(el)}>
                  <ElementBody el={el} url={el.storagePath ? imageUrls[el.storagePath] : undefined} />
                  {canEdit && selected === el.id && (
                    <div onPointerDown={(e) => startDrag(e, el, "resize")} aria-label="Redimensionar"
                      className="absolute bottom-0 right-0 h-3.5 w-3.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-primary bg-background" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className="w-64 shrink-0 space-y-4 overflow-y-auto border-l border-border p-4 text-sm">
          {sel ? (
            <>
              <div className="font-medium">{LABEL[sel.kind]}</div>
              {sel.kind === "text" && (
                <>
                  <label className="block">Conteúdo
                    <textarea value={sel.text ?? ""} disabled={!canEdit} onChange={(e) => patchSel({ text: e.target.value }, true)} onBlur={endSession}
                      className={field} rows={4} />
                  </label>
                  <label className="block">Tamanho da fonte
                    <input type="number" min={8} max={400} value={sel.fontSize ?? 56} disabled={!canEdit}
                      onChange={(e) => patchSel({ fontSize: Math.max(8, Math.min(400, Number(e.target.value) || 8)) }, true)} onBlur={endSession}
                      className={field} />
                  </label>
                  <div className="flex gap-1.5">
                    <button disabled={!canEdit} onClick={() => patchSel({ bold: !sel.bold })} aria-pressed={!!sel.bold} title="Negrito" className={iconBtn(!!sel.bold)}><Bold className="h-4 w-4" /></button>
                    <button disabled={!canEdit} onClick={() => patchSel({ italic: !sel.italic })} aria-pressed={!!sel.italic} title="Itálico" className={iconBtn(!!sel.italic)}><Italic className="h-4 w-4" /></button>
                    <span className="mx-1 w-px bg-border" />
                    {(["left", "center", "right"] as const).map((a) => {
                      const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                      return (
                        <button key={a} disabled={!canEdit} onClick={() => patchSel({ align: a })} aria-pressed={sel.align === a} title={`Alinhar ${a}`}
                          className={iconBtn(sel.align === a)}><Icon className="h-4 w-4" /></button>
                      );
                    })}
                  </div>
                  <label className="block">Cor do texto
                    <input type="color" value={sel.color ?? "#111827"} disabled={!canEdit}
                      onChange={(e) => patchSel({ color: e.target.value }, true)} onBlur={endSession}
                      className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-transparent" />
                  </label>
                </>
              )}
              {sel.kind === "shape" && (
                <>
                  <label className="block">Formato
                    <select value={sel.shape ?? "rect"} disabled={!canEdit} onChange={(e) => patchSel({ shape: e.target.value as SlideElement["shape"] })}
                      className={field}>
                      <option value="rect">Retângulo</option>
                      <option value="round">Cantos arredondados</option>
                      <option value="ellipse">Elipse</option>
                    </select>
                  </label>
                  <label className="block">Cor de preenchimento
                    <input type="color" value={sel.fill ?? "#dbeafe"} disabled={!canEdit}
                      onChange={(e) => patchSel({ fill: e.target.value }, true)} onBlur={endSession}
                      className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-transparent" />
                  </label>
                  <label className="block">Cor da borda
                    <input type="color" value={sel.stroke && sel.stroke !== "transparent" ? sel.stroke : "#111827"} disabled={!canEdit}
                      onChange={(e) => patchSel({ stroke: e.target.value, strokeWidth: sel.strokeWidth || 8 }, true)} onBlur={endSession}
                      className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-transparent" />
                  </label>
                  <label className="block">Espessura da borda
                    <input type="number" min={0} max={200} value={sel.strokeWidth ?? 0} disabled={!canEdit}
                      onChange={(e) => patchSel({ strokeWidth: Math.max(0, Math.min(200, Number(e.target.value) || 0)) }, true)} onBlur={endSession}
                      className={field} />
                  </label>
                </>
              )}
              {sel.kind === "image" && (
                <p className="text-xs text-muted-foreground">Remover tira a imagem deste slide. O arquivo continua no armazenamento.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                {(["x", "y", "w", "h"] as const).map((k) => (
                  <label key={k} className="block uppercase">{k}
                    <input type="number" value={Math.round(sel[k])} disabled={!canEdit}
                      onChange={(e) => patchSel({ [k]: Number(e.target.value) || 0 }, true)} onBlur={endSession}
                      className={field} />
                  </label>
                ))}
              </div>
              {canEdit && (
                <>
                  <div className="flex gap-2">
                    <button onClick={() => mapCurrent((s) => moveElementZ(s, sel.id, "front"))} className="flex-1 rounded-lg border border-border px-2 py-1.5 hover:bg-muted">Trazer para frente</button>
                    <button onClick={() => mapCurrent((s) => moveElementZ(s, sel.id, "back"))} className="flex-1 rounded-lg border border-border px-2 py-1.5 hover:bg-muted">Enviar para trás</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={duplicateSel} className="flex-1 rounded-lg border border-border px-2 py-1.5 hover:bg-muted">Duplicar</button>
                    <button onClick={removeSel} className="flex-1 rounded-lg border border-border px-2 py-1.5 text-destructive hover:bg-muted">Remover</button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="font-medium">Slide {idx + 1}</div>
              <label className="block">Cor de fundo
                <input type="color" value={slide.background} disabled={!canEdit}
                  onChange={(e) => mapCurrent((s) => ({ ...s, background: e.target.value }), true)} onBlur={endSession}
                  className="mt-1 h-9 w-full cursor-pointer rounded-lg border border-border bg-transparent" />
              </label>
              <label className="block">Anotações do apresentador
                <textarea value={slide.notes} disabled={!canEdit} rows={8}
                  onChange={(e) => mapCurrent((s) => ({ ...s, notes: e.target.value }), true)} onBlur={endSession}
                  className={field} />
              </label>
              <p className="text-xs text-muted-foreground">Clique em um elemento para editar. Atalhos: Delete remove, setas movem, Ctrl+D duplica, Ctrl+Z desfaz.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
