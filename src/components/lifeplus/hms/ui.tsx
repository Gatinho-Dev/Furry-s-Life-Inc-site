import type { ReactNode } from "react";
import { X } from "lucide-react";

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1>{sub && <p className="h-muted mt-1 text-sm">{sub}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
export function Stat({ label, value, icon: I, tone }: { label: string; value: ReactNode; icon?: React.ComponentType<{ className?: string }>; tone?: string }) {
  return (
    <div className="h-panel p-4">
      <div className="flex items-center justify-between"><span className="h-muted text-xs font-medium">{label}</span>{I && <span className={`h-accent-soft rounded-lg p-1.5 ${tone ?? ""}`}><I className="h-4 w-4" /></span>}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
export function Badge({ children, tone = "soft" }: { children: ReactNode; tone?: "soft" | "ok" | "warn" | "danger" | "muted" }) {
  const c = { soft: "h-accent-soft", ok: "h-ok", warn: "h-warn", danger: "h-danger", muted: "h-muted" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`} style={tone !== "soft" ? { background: "color-mix(in srgb, currentColor 12%, transparent)" } : undefined}>{children}</span>;
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-10" style={{ background: "rgb(0 0 0 / .45)" }} onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className={`h-panel w-full ${wide ? "max-w-5xl" : "max-w-xl"} p-6 shadow-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Fechar" onClick={onClose} className="rounded-full p-1.5 hover:opacity-70"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
export function F({ label, children, span }: { label: string; children: ReactNode; span?: boolean }) {
  return <label className={`block ${span ? "md:col-span-2" : ""}`}><span className="h-muted mb-1 block text-xs font-medium">{label}</span>{children}</label>;
}
export function Empty({ text }: { text: string }) {
  return <div className="h-muted rounded-2xl border border-dashed h-border py-12 text-center text-sm">{text}</div>;
}
export function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="h-muted w-32 shrink-0 truncate text-xs">{d.label}</span>
          <div className="h-soft h-2.5 flex-1 overflow-hidden rounded-full"><div className="h-accent-bg h-full rounded-full transition-all duration-700" style={{ width: `${(d.value / max) * 100}%` }} /></div>
          <span className="w-8 text-right text-xs tabular-nums">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
export function Columns({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="group flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.value}`}>
          <span className="h-muted text-[10px] opacity-0 group-hover:opacity-100">{d.value}</span>
          <div className="h-accent-bg w-full rounded-t-md transition-all duration-700" style={{ height: `${Math.max(3, (d.value / max) * 120)}px` }} />
          <span className="h-muted text-[10px]">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
export function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <div className="h-panel p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold">{title}</h3>{action}</div>{children}</div>;
}
