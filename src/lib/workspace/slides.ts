// Modelo de dados do Life Slides. Funções puras, sem acesso ao banco.

export const SLIDE_W = 1920;
export const SLIDE_H = 1080;

export type ElementKind = "text" | "shape" | "image";

export type SlideElement = {
  id: string;
  kind: ElementKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** texto (kind=text) */
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  /** forma (kind=shape) */
  shape?: "rect" | "round" | "ellipse";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** imagem (kind=image): caminho no bucket, nunca URL temporária */
  storagePath?: string;
};

export type Slide = {
  id: string;
  elements: SlideElement[];
  background: string;
  notes: string;
};

export type Deck = {
  slides: Slide[];
};

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const blankSlide = (): Slide => ({ id: newId(), elements: [], background: "#ffffff", notes: "" });

/** Insere um slide depois do índice dado (ou ao final, se index for -1 ou maior que o tamanho). */
export function insertSlide(deck: Deck, slide: Slide, afterIndex: number): Deck {
  const at = afterIndex < 0 || afterIndex >= deck.slides.length ? deck.slides.length : afterIndex + 1;
  const slides = [...deck.slides.slice(0, at), slide, ...deck.slides.slice(at)];
  return { slides };
}

/** Duplica o slide no índice dado, colocando a cópia logo depois, com novos ids. */
export function duplicateSlide(deck: Deck, index: number): Deck {
  const src = deck.slides[index];
  if (!src) return deck;
  const copy: Slide = {
    ...src,
    id: newId(),
    elements: src.elements.map((e) => ({ ...e, id: newId() })),
  };
  return insertSlide(deck, copy, index);
}

/** Remove o slide. Mantém pelo menos um slide na apresentação. */
export function removeSlide(deck: Deck, index: number): Deck {
  if (deck.slides.length <= 1 || !deck.slides[index]) return deck;
  return { slides: deck.slides.filter((_, i) => i !== index) };
}

/** Move o slide de `from` para `to` (reordenação por arrastar e soltar). */
export function moveSlide(deck: Deck, from: number, to: number): Deck {
  const n = deck.slides.length;
  if (from < 0 || from >= n || to < 0 || to >= n || from === to) return deck;
  const slides = [...deck.slides];
  const [item] = slides.splice(from, 1);
  slides.splice(to, 0, item);
  return { slides };
}

/** Atualiza um elemento do slide pelo id, mantendo os demais intactos. */
export function updateElement(slide: Slide, elementId: string, patch: Partial<SlideElement>): Slide {
  return {
    ...slide,
    elements: slide.elements.map((e) => (e.id === elementId ? { ...e, ...patch } : e)),
  };
}

/** Limita posição e tamanho dentro do slide para evitar elementos perdidos fora da área. */
export function clampRect(e: Pick<SlideElement, "x" | "y" | "w" | "h">) {
  const w = Math.min(Math.max(e.w, 20), SLIDE_W);
  const h = Math.min(Math.max(e.h, 20), SLIDE_H);
  const x = Math.min(Math.max(e.x, 0), SLIDE_W - w);
  const y = Math.min(Math.max(e.y, 0), SLIDE_H - h);
  return { x, y, w, h };
}

/** Valida um deck vindo do banco antes de usá-lo. Retorna null se a estrutura for inválida. */
export function parseDeck(input: unknown): Deck | null {
  if (!input || typeof input !== "object" || !Array.isArray((input as Deck).slides)) return null;
  const slides = (input as Deck).slides;
  if (slides.length === 0) return null;
  for (const s of slides) {
    if (!s || typeof s !== "object" || typeof s.id !== "string" || !Array.isArray(s.elements)) return null;
  }
  return input as Deck;
}
