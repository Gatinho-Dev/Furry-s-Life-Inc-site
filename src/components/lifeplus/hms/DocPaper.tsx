import { forwardRef } from "react";
import { DISCLAIMER, type Settings, type Template } from "./core";

/** A4 official-looking Life+ document. Colors are fixed (printed paper). */
export const DocPaper = forwardRef<HTMLDivElement, { settings: Settings; template?: Partial<Template> | null; title: string; body: string; code: string; signer?: string; signerInfo?: string; status?: string }>(
  function DocPaper({ settings, template, title, body, code, signer, signerInfo, status }, ref) {
    const accent = template?.accent || settings.accent || "#0e5ea8";
    const font = template?.font === "sans" ? "Helvetica, Arial, sans-serif" : "Georgia, 'Times New Roman', serif";
    const m = template?.margin_mm ?? 20;
    const logo = template?.logo_url || settings.logo_url;
    return (
      <div ref={ref} className="lp-paper relative mx-auto flex flex-col" style={{ padding: `${m}mm`, fontFamily: font }}>
        {status === "rascunho" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[90px] font-bold" style={{ color: "rgb(0 0 0 / .05)", transform: "rotate(-30deg)" }}>RASCUNHO</div>}
        <header className="flex items-center justify-between pb-4" style={{ borderBottom: `3px solid ${accent}` }}>
          <div className="flex items-center gap-3">
            {logo ? <img src={logo} alt="" className="h-14 w-14 object-contain" crossOrigin="anonymous" /> :
              <div className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl font-bold" style={{ background: accent, color: "#fff" }}>+</div>}
            <div>
              <div className="text-xl font-bold" style={{ color: accent }}>{settings.name}</div>
              <div className="text-[11px]" style={{ color: "#555" }}>{template?.header || `${settings.address ?? ""} · ${settings.phone ?? ""}`}</div>
              {settings.cnpj && <div className="text-[10px]" style={{ color: "#777" }}>CNPJ {settings.cnpj}</div>}
            </div>
          </div>
          <div className="text-right text-[10px]" style={{ color: "#555" }}><div className="font-semibold">Nº {code}</div></div>
        </header>
        <h1 className="mt-8 text-center text-lg font-bold tracking-wide" style={{ color: "#111" }}>{title}</h1>
        <div className="mt-6 flex-1 whitespace-pre-wrap text-[13.5px] leading-7" style={{ color: "#1a1a1a", textAlign: "justify" }}>{body}</div>
        {signer && (
          <div className="mx-auto mt-16 w-72 text-center text-[12px]" style={{ color: "#222" }}>
            <div style={{ borderTop: "1px solid #333" }} className="pt-1 font-semibold">{signer}</div>
            <div style={{ color: "#555" }}>{signerInfo}</div>
          </div>
        )}
        <footer className="mt-10 pt-3 text-center text-[9.5px]" style={{ borderTop: `1px solid ${accent}55`, color: "#666" }}>
          {template?.footer && <div className="mb-1">{template.footer}</div>}
          <div className="font-semibold tracking-wider" style={{ color: "#a33" }}>{DISCLAIMER}</div>
          <div>{settings.name} · Documento {code}</div>
        </footer>
      </div>
    );
  },
);

export async function downloadPdf(el: HTMLElement, name: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const w = 210, h = (canvas.height * w) / canvas.width, pageH = 297;
  const img = canvas.toDataURL("image/jpeg", 0.95);
  let y = 0;
  while (y < h - 0.5) { if (y > 0) pdf.addPage(); pdf.addImage(img, "JPEG", 0, -y, w, h); y += pageH; }
  const blob = pdf.output("blob");
  if (blob.size < 1000) throw new Error("PDF vazio");
  pdf.save(name);
}

export function printEl(el: HTMLElement) {
  const root = document.createElement("div"); root.className = "lp-print-root";
  root.appendChild(el.cloneNode(true)); document.body.appendChild(root);
  const done = () => { root.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  window.print();
  setTimeout(done, 60000);
}
