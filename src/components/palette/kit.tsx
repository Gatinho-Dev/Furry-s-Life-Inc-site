import { useEffect, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AtSign, BadgeCheck, Blocks, Building2, CalendarClock, CircleDot, FileKey2, FileSearch, FileText,
  Fingerprint, Globe, Hash, IdCard, KeySquare, Link2, MapPin, Network, NotebookPen, Phone, Radar,
  ScanLine, Server, ShieldAlert, ShieldCheck, UserRound, Wallet, Waypoints, X,
} from "lucide-react";
import {
  CONFIDENCE_LABEL, NODE_KIND_LABEL,
  type ConfidenceLevel, type PaletteNodeKind,
} from "@/lib/palette/types";
import { cx } from "@/components/agency/kit";

export const KIND_ICON: Record<PaletteNodeKind, LucideIcon> = {
  domain: Globe, subdomain: Globe, ipv4: Server, ipv6: Server, asn: Network, network: Network,
  url: Link2, certificate: ShieldCheck, "dns-record": ScanLine,
  username: AtSign, email: AtSign, hash: Hash, cve: ShieldAlert, file: FileKey2, document: FileText,
  company: Building2, organization: Building2, website: Globe, "public-service": BadgeCheck,
  person: UserRound, phone: Phone, wallet: Wallet, location: MapPin, "social-profile": IdCard,
  custom: Blocks,
  event: CalendarClock, observation: FileSearch, evidence: FileSearch, source: Radar, note: NotebookPen,
};

export const KIND_COLOR: Record<PaletteNodeKind, string> = {
  domain: "#38bdf8", subdomain: "#7dd3fc", ipv4: "#22d3ee", ipv6: "#67e8f9", asn: "#818cf8", network: "#a5b4fc",
  url: "#f472b6", certificate: "#c084fc", "dns-record": "#5eead4",
  username: "#34d399", email: "#fb7185", hash: "#f59e0b", cve: "#ef4444", file: "#fbbf24", document: "#a3a3a3",
  company: "#eab308", organization: "#facc15", website: "#60a5fa", "public-service": "#2dd4bf",
  person: "#a78bfa", phone: "#2dd4bf", wallet: "#f59e0b", location: "#fb7185",
  "social-profile": "#a3e635", custom: "#e879f9",
  event: "#f97316", observation: "#94a3b8", evidence: "#10b981", source: "#8b5cf6", note: "#64748b",
};

export const CONF_COLOR: Record<ConfidenceLevel, { dot: string; text: string; bg: string; border: string }> = {
  verified: { dot: "#34d399", text: "#a7f3d0", bg: "rgba(52,211,153,.1)", border: "rgba(52,211,153,.35)" },
  high: { dot: "#22d3ee", text: "#a5f3fc", bg: "rgba(34,211,238,.1)", border: "rgba(34,211,238,.32)" },
  medium: { dot: "#fbbf24", text: "#fde68a", bg: "rgba(251,191,36,.1)", border: "rgba(251,191,36,.3)" },
  low: { dot: "#fb923c", text: "#fed7aa", bg: "rgba(251,146,60,.1)", border: "rgba(251,146,60,.3)" },
  unverified: { dot: "#a78bfa", text: "#ddd6fe", bg: "rgba(167,139,250,.1)", border: "rgba(167,139,250,.3)" },
};

export function KindIcon({ kind, className }: { kind: PaletteNodeKind; className?: string }) {
  const Icon = KIND_ICON[kind] ?? CircleDot;
  return <Icon className={className ?? "h-3.5 w-3.5"} />;
}

export function ConfidencePill({ level, small }: { level: ConfidenceLevel; small?: boolean }) {
  const c = CONF_COLOR[level];
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full border font-medium", small ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]")}
      style={{ color: c.text, borderColor: c.border, background: c.bg }}
      title={CONFIDENCE_LABEL[level]}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.dot }} />
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

export function KindPill({ kind }: { kind: PaletteNodeKind }) {
  const color = KIND_COLOR[kind];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px]" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
      <KindIcon kind={kind} className="h-2.5 w-2.5" /> {NODE_KIND_LABEL[kind]}
    </span>
  );
}

export function PalLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#6b7f94]", className)}>{children}</div>;
}

export function IconBtn({
  icon: Icon, label, onClick, active, danger, disabled,
}: { icon: LucideIcon; label: string; onClick?: () => void; active?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-7 w-7 items-center justify-center rounded-lg border transition-colors",
        active ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200" : "border-[#1e2c3a] bg-[#0c131b] text-[#8ea3b8] hover:border-cyan-400/40 hover:text-cyan-200",
        danger && "hover:border-rose-400/50 hover:text-rose-300",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

export function PalButton({
  children, onClick, variant = "ghost", size = "md", disabled, type = "button", className,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "soft" | "danger";
  size?: "sm" | "md"; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium transition-all disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "px-2 py-1 text-[10.5px]" : "px-3 py-1.5 text-[11.5px]",
        variant === "primary" && "border-cyan-400/40 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/25",
        variant === "soft" && "border-[#243346] bg-[#101a26] text-[#c9d8e7] hover:border-cyan-400/40",
        variant === "ghost" && "border-transparent text-[#9db0c4] hover:bg-white/[0.04] hover:text-white",
        variant === "danger" && "border-rose-500/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Modal({
  open, onClose, title, subtitle, children, width = "max-w-2xl", footer,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: ReactNode; width?: string; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <div className={cx("ag-modal-in my-auto w-full rounded-2xl border border-[#243346] bg-[#080e15] shadow-2xl", width)}>
        <div className="flex items-start justify-between gap-3 border-b border-[#182432] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#eaf3fb]">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11px] text-[#7f94a9]">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[#7f94a9] hover:bg-white/5 hover:text-white" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#182432] px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function PalField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#7f94a9]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10px] leading-snug text-[#5f7286]">{hint}</span>}
    </label>
  );
}

export const inputCls = "w-full rounded-lg border border-[#21303f] bg-[#0a1017] px-2.5 py-1.5 text-[12px] text-[#e6eef7] outline-none transition-colors placeholder:text-[#55687c] focus:border-cyan-400/60";
export const selectCls = "w-full rounded-lg border border-[#21303f] bg-[#0a1017] px-2 py-1.5 text-[11.5px] text-[#e6eef7] outline-none focus:border-cyan-400/60";

export function PalEmpty({ icon: Icon = Fingerprint, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#243346] px-5 py-10 text-center">
      <Icon className="mb-2 h-5 w-5 text-[#587086]" />
      <div className="text-[12.5px] font-medium text-[#c8d7e6]">{title}</div>
      {hint && <p className="mt-1 max-w-sm text-[10.5px] leading-relaxed text-[#71879c]">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx("inline-flex h-4 w-7 items-center rounded-full border transition-colors", checked ? "border-cyan-400/50 bg-cyan-400/25" : "border-[#2a3b4d] bg-[#0d151e]")}
      aria-pressed={checked}
      aria-label={label}
    >
      <span className={cx("h-3 w-3 rounded-full transition-transform", checked ? "translate-x-3 bg-cyan-300" : "translate-x-0.5 bg-[#60748a]")} />
    </button>
  );
}

export function KeyCap({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-[#2a3b4d] bg-[#0c141d] px-1.5 py-0.5 font-mono text-[9.5px] text-[#93a8bd]">{children}</kbd>;
}
