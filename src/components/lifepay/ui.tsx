import * as React from "react";
import { Loader2 } from "lucide-react";

/* Identidade visual própria do LifePay — escopo isolado, não vaza pro resto do site. */
export const LIFEPAY_CSS = `
.lp-root {
  --lp-bg: #0A0B0D;
  --lp-bg-2: #101215;
  --lp-surface: #15181C;
  --lp-surface-2: #1C2026;
  --lp-line: rgba(255,255,255,0.07);
  --lp-line-2: rgba(255,255,255,0.14);
  --lp-fg: #F4F6F7;
  --lp-fg-2: #9AA3AC;
  --lp-accent: #2FE3C2;
  --lp-accent-2: #14B894;
  --lp-danger: #FF6B6B;
  --lp-warn: #FFC65C;
  background: var(--lp-bg);
  color: var(--lp-fg);
  min-height: 100vh;
  font-family: "SF Pro Display", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.011em;
}
.lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }
.lp-card { background: var(--lp-surface); border: 1px solid var(--lp-line); border-radius: 22px; box-shadow: 0 18px 40px -30px rgba(0,0,0,0.9); }
.lp-card-2 { background: var(--lp-surface-2); border: 1px solid var(--lp-line); border-radius: 16px; }
.lp-muted { color: var(--lp-fg-2); }
.lp-accent { color: var(--lp-accent); }
.lp-btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; border-radius:14px; padding:.75rem 1.15rem;
  font-size:.875rem; font-weight:600; transition: all .18s ease; border:1px solid transparent; cursor:pointer; }
.lp-btn:disabled { opacity:.55; cursor:not-allowed; }
.lp-btn-primary { background: var(--lp-accent); color:#04211B; }
.lp-btn-primary:hover:not(:disabled) { background: var(--lp-accent-2); }
.lp-btn-ghost { background: transparent; border-color: var(--lp-line-2); color: var(--lp-fg); }
.lp-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,.05); }
.lp-btn-soft { background: var(--lp-surface-2); color: var(--lp-fg); border-color: var(--lp-line); }
.lp-btn-soft:hover:not(:disabled) { background: #232830; }
.lp-btn-danger { background: rgba(255,107,107,.12); color: var(--lp-danger); border-color: rgba(255,107,107,.35); }
.lp-input { width:100%; background: var(--lp-bg-2); border:1px solid var(--lp-line-2); border-radius:14px;
  padding:.8rem 1rem; font-size:.9rem; color: var(--lp-fg); outline:none; transition: border-color .15s ease, box-shadow .15s ease; }
.lp-input::placeholder { color:#69727B; }
.lp-input:focus { border-color: var(--lp-accent); box-shadow: 0 0 0 3px rgba(47,227,194,.15); }
/* Rede de segurança: qualquer campo dentro do tema LifePay fica legível. */
.lp-root input, .lp-root select, .lp-root textarea {
  background-color: var(--lp-bg-2); color: var(--lp-fg); border-color: var(--lp-line-2); color-scheme: dark; }
.lp-root input::placeholder, .lp-root textarea::placeholder { color:#69727B; }
.lp-root option { background: var(--lp-surface); color: var(--lp-fg); }
.lp-root input[type="checkbox"], .lp-root input[type="radio"] { background-color: transparent; }
.lp-label { display:block; font-size:.7rem; text-transform:uppercase; letter-spacing:.09em; color: var(--lp-fg-2); margin-bottom:.4rem; font-weight:600; }
.lp-chip { display:inline-flex; align-items:center; gap:.35rem; border-radius:999px; padding:.25rem .7rem; font-size:.7rem; font-weight:600;
  border:1px solid var(--lp-line-2); color: var(--lp-fg-2); }
.lp-chip-ok { color: var(--lp-accent); border-color: rgba(47,227,194,.4); background: rgba(47,227,194,.08); }
.lp-chip-bad { color: var(--lp-danger); border-color: rgba(255,107,107,.4); background: rgba(255,107,107,.08); }
.lp-divide { border-color: var(--lp-line); }
.lp-grid-bg { background-image: radial-gradient(circle at 20% 0%, rgba(47,227,194,.09), transparent 45%),
  radial-gradient(circle at 85% 10%, rgba(47,227,194,.05), transparent 40%); }
@keyframes lp-fade-up { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform:none; } }
.lp-fade { animation: lp-fade-up .35s ease both; }
/* Transições estilo Apple para o fluxo de transferência */
@keyframes lp-slide-in { from { opacity:0; transform: translateX(22px) scale(.99); } to { opacity:1; transform:none; } }
@keyframes lp-slide-back { from { opacity:0; transform: translateX(-22px) scale(.99); } to { opacity:1; transform:none; } }
@keyframes lp-pop { 0% { opacity:0; transform: scale(.86); } 60% { transform: scale(1.04); } 100% { opacity:1; transform: scale(1); } }
.lp-step-in { animation: lp-slide-in .42s cubic-bezier(.22,.9,.24,1) both; }
.lp-step-back { animation: lp-slide-back .42s cubic-bezier(.22,.9,.24,1) both; }
.lp-pop { animation: lp-pop .5s cubic-bezier(.22,1.2,.3,1) both; }
.lp-press { transition: transform .16s cubic-bezier(.2,.8,.2,1), background .16s ease, box-shadow .16s ease; }
.lp-press:active:not(:disabled) { transform: scale(.97); }
.lp-btn { will-change: transform; }
.lp-btn:active:not(:disabled) { transform: scale(.975); }
@media (prefers-reduced-motion: reduce) {
  .lp-fade, .lp-step-in, .lp-step-back, .lp-pop { animation: none; }
}

`;

export function LifePayTheme({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`lp-root ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: LIFEPAY_CSS }} />
      {children}
    </div>
  );
}

export function LpSpinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 lp-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function LpEmpty({ icon, title, hint, action }: { icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="lp-card flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 rounded-2xl p-3" style={{ background: "var(--lp-surface-2)" }}>{icon}</div>}
      <div className="text-sm font-semibold">{title}</div>
      {hint && <p className="mt-1 max-w-sm text-xs lp-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LpAlert({ tone = "error", children }: { tone?: "error" | "info" | "success"; children: React.ReactNode }) {
  const style = {
    error: { color: "var(--lp-danger)", border: "1px solid rgba(255,107,107,.35)", background: "rgba(255,107,107,.08)" },
    info: { color: "var(--lp-fg-2)", border: "1px solid var(--lp-line-2)", background: "rgba(255,255,255,.03)" },
    success: { color: "var(--lp-accent)", border: "1px solid rgba(47,227,194,.35)", background: "rgba(47,227,194,.08)" },
  }[tone];
  return <div className="rounded-2xl px-4 py-3 text-sm" style={style} role={tone === "error" ? "alert" : undefined}>{children}</div>;
}

export function LpSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: "rgba(0,0,0,.7)" }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="lp-card lp-fade max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-b-none sm:rounded-b-[22px]"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 lp-divide"
          style={{ background: "var(--lp-surface)" }}>
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="lp-btn lp-btn-ghost px-3 py-1.5 text-xs">Fechar</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function LifePayMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="grid place-items-center rounded-xl font-black"
        style={{ width: size, height: size, background: "var(--lp-accent)", color: "#04211B", fontSize: size * 0.5 }}>L</span>
      <span className="font-semibold tracking-tight">LifePay</span>
    </span>
  );
}

export const DISCLOSURE =
  "O LifePay funciona exclusivamente dentro do ecossistema da Furry's Life Inc. e não realiza movimentações financeiras externas.";
