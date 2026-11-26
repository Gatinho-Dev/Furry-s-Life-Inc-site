import { useEffect, useState, type ReactNode } from "react";
import { Download, ExternalLink, FileSignature, Loader2, Minus, Plus, Printer, X } from "lucide-react";
import { Btn, Chip, Modal } from "../ui";
import type { PaperModel } from "./model";
import { pdfFileName, printPdfUrl, usePdfActions, usePdfModel } from "./render";

/**
 * Palco de papel A4: mostra o PDF real gerado pelo motor, com zoom e navegação
 * entre páginas. O que aparece aqui é exatamente o arquivo enviado à impressora.
 */
export function DocStage({ model, delay = 450, chrome = true, className = "" }: {
  model: PaperModel; delay?: number; chrome?: boolean; className?: string;
}) {
  const state = usePdfModel(model, delay);
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [state.url]);
  useEffect(() => { if (page > state.pages) setPage(1); }, [state.pages, page]);

  const src = state.url ? `${state.url}#page=${page}&view=FitH&toolbar=0&navpanes=0&statusbar=0` : undefined;

  return (
    <div className={`hms-doc ${className}`}>
      {chrome && (
        <div className="hms-doc-tools">
          <span className="hms-doc-tool-label">A4 · 210 × 297 mm</span>
          <div className="hms-doc-zoom">
            <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}><Minus className="h-3 w-3" /></button>
            <span>{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}><Plus className="h-3 w-3" /></button>
          </div>
          {state.pages > 1 && (
            <div className="hms-doc-zoom">
              <button type="button" aria-label="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))}><Minus className="h-3 w-3" /></button>
              <span>{page} / {state.pages}</span>
              <button type="button" aria-label="Próxima página" onClick={() => setPage((p) => Math.min(state.pages, p + 1))}><Plus className="h-3 w-3" /></button>
            </div>
          )}
          {state.url && (
            <a className="hms-doc-open" href={state.url} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" /> Nova aba
            </a>
          )}
        </div>
      )}

      <div className="hms-doc-canvas">
        <div className="hms-doc-sheet" style={{ width: `${zoom * 100}%` }}>
          {state.status === "ready" && src ? (
            <iframe key={src} src={src} title={model.title} className="hms-doc-frame" />
          ) : state.status === "error" ? (
            <div className="hms-doc-fallback">
              <FileSignature className="h-5 w-5" />
              <strong>Não foi possível montar o PDF</strong>
              <span>{state.error}</span>
            </div>
          ) : (
            <div className="hms-doc-fallback">
              <Loader2 className="h-5 w-5 animate-spin" />
              <strong>Diagramando documento…</strong>
              <span>Gerando o PDF A4 com as fontes incorporadas.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type DocPreviewProps = {
  model: PaperModel;
  onClose: () => void;
  onEdit?: () => void;
  onSaveDraft?: () => void;
  onFinalize?: () => void;
  busy?: boolean | "rascunho" | "finalizado";
  canFinalize?: boolean;
  statusLabel?: string;
  footerExtra?: ReactNode;
};

/** Visualização em tela cheia com todas as ações do documento. */
export function DocPreviewModal({ model, onClose, onEdit, onSaveDraft, onFinalize, busy, canFinalize, statusLabel, footerExtra }: DocPreviewProps) {
  const actions = usePdfActions(model);
  const status = statusLabel ?? model.status;

  return (
    <Modal
      wide
      title={model.title}
      sub={`${model.kicker}${model.code ? " · " + model.code : " · sem registro"}${status ? " · " + status : ""}`}
      onClose={onClose}
      footer={
        <>
          <Chip tone={model.status === "finalizado" ? "ok" : model.status === "rascunho" ? "warn" : "outline"}>{status}</Chip>
          {footerExtra}
          <div className="ml-auto flex flex-wrap gap-2">
            <Btn variant="ghost" onClick={onClose}>Voltar</Btn>
            {onSaveDraft && <Btn variant="soft" disabled={!!busy} onClick={onSaveDraft}>{busy === "rascunho" ? "Salvando…" : "Salvar rascunho"}</Btn>}
            {onEdit && <Btn variant="ghost" onClick={onEdit}>Editar</Btn>}
            <Btn variant="ghost" icon={Printer} disabled={!!actions.busy} onClick={actions.print}>{actions.busy === "print" ? "Abrindo…" : "Imprimir"}</Btn>
            <Btn icon={Download} disabled={!!actions.busy} onClick={actions.download}>{actions.busy === "download" ? "Gerando…" : "Gerar PDF"}</Btn>
            {onFinalize && canFinalize !== false && model.status === "rascunho" && (
              <Btn variant="soft" disabled={!!busy} onClick={onFinalize}>{busy === "finalizado" ? "Finalizando…" : "Finalizar"}</Btn>
            )}
          </div>
        </>
      }
    >
      {actions.error && <div className="hms-banner error mb-2"><X className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div>{actions.error}</div></div>}
      <DocStage model={model} delay={120} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--h-muted)]">
        <span>Pré-visualização idêntica ao PDF final · {pdfFileName(model)}</span>
        <button className="underline" onClick={actions.open}>Abrir em nova aba</button>
      </div>
    </Modal>
  );
}

/** Botões de PDF/impressão reaproveitados por listas e modelos. */
export function PdfActions({ model, compact }: { model: PaperModel; compact?: boolean }) {
  const actions = usePdfActions(model);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn size={compact ? "sm" : "md"} variant="ghost" icon={Printer} disabled={!!actions.busy} onClick={actions.print}>
        {actions.busy === "print" ? "Abrindo…" : "Imprimir"}
      </Btn>
      <Btn size={compact ? "sm" : "md"} variant="ghost" icon={Download} disabled={!!actions.busy} onClick={actions.download}>
        {actions.busy === "download" ? "Gerando…" : "PDF"}
      </Btn>
      {actions.error && <span className="text-[11px] text-[var(--h-vital)]">{actions.error}</span>}
    </div>
  );
}

/** Impressão de uma URL de PDF já pronta (usada pelo visor). */
export { printPdfUrl };
