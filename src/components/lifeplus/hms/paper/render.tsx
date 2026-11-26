/**
 * Geração de PDF e utilitários de impressão/download do padrão Life+.
 * O PDF é vetorial (react-pdf): fonte incorporada, A4 real e quebra automática.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PaperModel } from "./model";

/* ------------------------------- utilidades -------------------------------- */

const imageCache = new Map<string, Promise<string | null>>();

async function toDataUrl(url: string, timeout = 3500): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const res = await fetch(url, { signal: ctrl.signal, mode: "cors" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\//.test(blob.type) || blob.size > 4_000_000) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Logotipos e assinaturas viram data URL; se falharem, o documento cai no monograma. */
async function resolveImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  if (!/^https?:\/\//.test(url) && !url.startsWith("/")) return null;
  const hit = imageCache.get(url);
  if (hit) return hit;
  const job = toDataUrl(url);
  imageCache.set(url, job);
  return job;
}

export function modelKey(model: PaperModel) {
  const clone = { ...model, institution: { ...model.institution, logoUrl: null, signatureUrl: null } };
  return JSON.stringify(clone) + (model.institution.logoUrl ?? "") + (model.institution.signatureUrl ?? "");
}

export async function buildPdfBlob(model: PaperModel): Promise<Blob> {
  const [{ pdf }, { DocPdf, ensureFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./DocPdf")]);
  ensureFonts();
  const [logoUrl, signatureUrl] = await Promise.all([resolveImage(model.institution.logoUrl), resolveImage(model.institution.signatureUrl)]);
  const doc = <DocPdf model={{ ...model, institution: { ...model.institution, logoUrl, signatureUrl } }} />;
  return await pdf(doc).toBlob();
}

function countPages(buffer: ArrayBuffer): number {
  try {
    const text = new TextDecoder("latin1").decode(buffer);
    const pages = text.match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
    return pages > 0 ? pages : 1;
  } catch {
    return 1;
  }
}

export type PdfArtifact = { url: string; pages: number; blob: Blob };

/** Renderiza (ou reaproveita) o PDF de um modelo. */
export async function buildPdfArtifact(model: PaperModel): Promise<PdfArtifact> {
  const blob = await buildPdfBlob(model);
  const buffer = await blob.arrayBuffer();
  return { url: URL.createObjectURL(new Blob([buffer], { type: "application/pdf" })), pages: countPages(buffer), blob };
}

/* ------------------------------ carregamento ------------------------------- */

export type PdfState = { status: "loading" | "ready" | "error"; url: string | null; pages: number; error: string | null };

/** Hook: gera o PDF do modelo com debounce e devolve uma URL de objeto. */
export function usePdfModel(model: PaperModel, delay = 450): PdfState {
  const [state, setState] = useState<PdfState>({ status: "loading", url: null, pages: 1, error: null });
  const key = useMemo(() => modelKey(model), [model]);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      buildPdfArtifact(model)
        .then((art) => {
          if (!alive) { URL.revokeObjectURL(art.url); return; }
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = art.url;
          setState({ status: "ready", url: art.url, pages: art.pages, error: null });
        })
        .catch((e: unknown) => {
          if (!alive) return;
          setState((s) => ({ ...s, status: "error", error: e instanceof Error ? e.message : "Não foi possível gerar o PDF." }));
        });
    }, delay);
    setState((s) => (s.status === "ready" ? s : { ...s, status: "loading" }));
    return () => { alive = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
  return state;
}

/* -------------------------------- ações ----------------------------------- */

export function pdfFileName(model: PaperModel) {
  const base = (model.code || model.kind || "documento").toString().toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-lifeplus-${stamp}.pdf`;
}

export async function downloadPdf(model: PaperModel, filename = pdfFileName(model)) {
  const art = await buildPdfArtifact(model);
  const a = document.createElement("a");
  a.href = art.url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(art.url), 30_000);
}

/** Imprime exatamente o PDF gerado (sem a interface do sistema). */
export async function printPdf(model: PaperModel) {
  const art = await buildPdfArtifact(model);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;";
  frame.src = art.url;
  document.body.appendChild(frame);
  const cleanup = () => { frame.remove(); setTimeout(() => URL.revokeObjectURL(art.url), 10_000); };
  frame.onload = () => {
    setTimeout(() => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      } finally {
        setTimeout(cleanup, 60_000);
      }
    }, 180);
  };
}

export async function openPdf(model: PaperModel) {
  const art = await buildPdfArtifact(model);
  const win = window.open(art.url, "_blank", "noopener");
  if (!win) throw new Error("Permita pop-ups para abrir o PDF em outra aba.");
  setTimeout(() => URL.revokeObjectURL(art.url), 120_000);
}

/** Abre o diálogo de impressão de uma URL de PDF já gerada. */
export function printPdfUrl(url: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;height:297mm;border:0;opacity:0;";
  frame.src = url;
  document.body.appendChild(frame);
  const cleanup = () => { frame.remove(); };
  frame.onload = () => {
    setTimeout(() => {
      try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } finally { setTimeout(cleanup, 60_000); }
    }, 180);
  };
}

/** Hook que expõe as ações com estado de carregamento. */
export function usePdfActions(model: PaperModel) {
  const [busy, setBusy] = useState<"download" | "print" | "open" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (kind: "download" | "print" | "open") => {
    setBusy(kind); setError(null);
    try {
      if (kind === "download") await downloadPdf(model);
      else if (kind === "print") await printPdf(model);
      else await openPdf(model);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }, [model]);

  return { busy, error, download: () => run("download"), print: () => run("print"), open: () => run("open") };
}
