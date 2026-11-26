import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle, Bell, Check, ChevronRight, Copy, HeartPulse, Loader2, LogOut, Menu, Moon,
  Search, Sun, X, type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { DISCLAIMER, fDate, fDateTime, type Patient } from "./core";
import { LifeMark } from "../Brand";
import { useHms, type ModuleKey } from "./data";

/* ---------------------------------- theme ---------------------------------- */

export function useHmsTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("lifeplus.hms.theme");
    const initial = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    setDark(initial);
  }, []);
  const toggle = () => {
    setDark((d) => { localStorage.setItem("lifeplus.hms.theme", d ? "light" : "dark"); return !d; });
  };
  return { dark, toggle };
}

/* ---------------------------------- shell ---------------------------------- */

export type NavItem = { key: ModuleKey; label: string; icon: LucideIcon; group: string; count?: number };

export function EcgLine({ beating = true }: { beating?: boolean }) {
  return (
    <svg className={`hms-ecg ${beating ? "is-beating" : ""}`} viewBox="0 0 240 30" preserveAspectRatio="none" aria-hidden>
      <path d="M0 18 H38 l4 -3 3 6 4 -14 4 22 5 -11 H92 l6 0 5 -6 4 9 3 -3 H160 l4 0 5 -8 4 12 3 -4 H240" />
    </svg>
  );
}

export function HmsShell({ items, children }: { items: NavItem[]; children: ReactNode }) {
  const { mod, go, notifications, role, me, error } = useHms();
  const { dark, toggle } = useHmsTheme();
  const auth = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const groups = useMemo(() => Array.from(new Set(items.map((i) => i.group))), [items]);
  const current = items.find((i) => i.key === mod);
  const roleLabel = role ? { administrador: "Administrador", diretor: "Diretor", medico: "Médico", enfermeiro: "Enfermeiro", recepcionista: "Recepcionista", farmaceutico: "Farmacêutico", tecnico: "Técnico", administrativo: "Administrativo" }[role] ?? role : "Sem cargo";

  useEffect(() => { setOpen(false); }, [mod]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); }
      if (e.key === "Escape") setSearch(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`hms ${dark ? "dark" : ""}`}>
      <div className="hms-shell">
        {open && <div className="hms-scrim" onClick={() => setOpen(false)} />}
        <aside className={`hms-side ${open ? "is-open" : ""}`}>
          <div className="hms-brand">
            <span className="hms-brand-mark hms-brand-plate"><LifeMark size={25} alt="" /></span>
            <div>
              <div className="hms-brand-name">Life<span className="hms-brand-plus">+</span></div>
              <div className="hms-brand-sub">Sistema Hospitalar</div>
            </div>
            <button className="ml-auto text-white/50 md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu"><X className="h-4 w-4" /></button>
          </div>
          <div className="px-4"><EcgLine /></div>
          <nav className="flex-1 pb-4">
            {groups.map((g) => (
              <div className="hms-side-group" key={g}>
                <div className="hms-side-label">{g}</div>
                {items.filter((i) => i.group === g).map((i) => {
                  const Icon = i.icon; const active = mod === i.key;
                  return (
                    <button key={i.key} className={`hms-nav-item ${active ? "is-active" : ""}`} onClick={() => go(i.key)}>
                      <Icon /> <span className="truncate">{i.label}</span>
                      {!!i.count && <span className="hms-nav-count">{i.count > 99 ? "99+" : i.count}</span>}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="hms-side-foot">
            <Link to="/lifeplus" className="hms-nav-item"><HeartPulse /><span>Site público Life+</span></Link>
            <Link to="/staff/dashboard" className="hms-nav-item"><ChevronRight /><span>Painel central FLI</span></Link>
            <div className="px-2 pt-2 text-[9.5px] leading-relaxed text-white/30">
              Documentos e dados fictícios.<br />Uso exclusivo em roleplay.
            </div>
          </div>
        </aside>

        <div className="hms-main">
          <header className="hms-top">
            <button className="hms-btn ghost icon sm md:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="h-4 w-4" /></button>
            <div className="hms-crumb hidden sm:flex">
              <span>{current?.group ?? "Life+"}</span>
              <ChevronRight className="h-3 w-3" />
              <b>{current?.label ?? "Dashboard"}</b>
            </div>
            <div className="hms-top-actions">
              <button className="hms-btn ghost icon sm" onClick={() => setSearch(true)} title="Buscar (Ctrl K)" aria-label="Buscar"><Search className="h-4 w-4" /></button>
              <button className="hms-btn ghost icon sm relative" onClick={() => go("notifications")} title="Notificações" aria-label="Notificações">
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--h-vital)] px-1 text-[9px] font-bold text-white">{notifications.length > 9 ? "9+" : notifications.length}</span>}
              </button>
              <button className="hms-btn ghost icon sm" onClick={toggle} title={dark ? "Modo claro" : "Modo escuro"} aria-label="Alternar tema">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="hms-user">
                <span className="hms-avatar">{me?.photo_url ? <img src={me.photo_url} alt="" /> : initials(me?.full_name ?? auth.user?.email ?? "L+")}</span>
                <div className="hidden leading-tight sm:block">
                  <div className="max-w-[150px] truncate text-[12px] font-semibold">{me?.full_name ?? auth.user?.email}</div>
                  <div className="text-[9.5px] uppercase tracking-[0.12em] text-[var(--h-faint)]">{roleLabel}</div>
                </div>
                <button className="hms-btn ghost icon sm" title="Sair" aria-label="Sair"
                  onClick={async () => { await auth.signOut(); nav({ to: "/auth", search: { redirect: undefined } }); }}>
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </header>

          {error && (
            <div className="px-6 pt-4">
              <div className="hms-banner error">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <b>Não foi possível carregar parte dos dados.</b> {error}
                  <div className="mt-1 text-[11px] opacity-80">Verifique se as migrações <code>drizzle/migrations/0005_lifeplus_hms.sql</code> e <code>0006_lp_files_policies.sql</code> foram aplicadas no banco.</div>
                </div>
              </div>
            </div>
          )}

          <main className="hms-page">{children}</main>
        </div>
      </div>
      {search && <QuickSearch onClose={() => setSearch(false)} />}
    </div>
  );
}

function QuickSearch({ onClose }: { onClose: () => void }) {
  const { data, go } = useHms();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const term = q.trim().toLowerCase();
  const patients = term ? (data.patients as Patient[]).filter((p) => [p.full_name, p.code, p.nickname, p.insurance].some((v) => (v ?? "").toLowerCase().includes(term))).slice(0, 6) : [];
  const docs = term ? data.docs.filter((d) => [d.title, d.code, d.kind].some((v) => (v ?? "").toLowerCase().includes(term))).slice(0, 5) : [];
  const staff = term ? data.staff.filter((s) => (s.full_name ?? "").toLowerCase().includes(term)).slice(0, 4) : [];
  const hasResults = patients.length + docs.length + staff.length > 0;

  return (
    <div className="hms-overlay center" onClick={onClose}>
      <div className="hms-modal slim" onClick={(e) => e.stopPropagation()} style={{ marginTop: "4vh" }}>
        <div className="flex items-center gap-2 border-b border-[var(--h-line)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--h-faint)]" />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar paciente, código LIFE-, documento, equipe…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--h-faint)]" />
          <button className="hms-chip outline" onClick={onClose}>ESC</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!term && <div className="px-3 py-6 text-center text-xs text-[var(--h-muted)]">Digite para buscar em pacientes, documentos e equipe.</div>}
          {term && !hasResults && <div className="px-3 py-6 text-center text-xs text-[var(--h-muted)]">Nada encontrado para “{q}”.</div>}
          {patients.map((p) => (
            <button key={p.id} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--h-soft)]" onClick={() => { go("patients", { patientId: p.id }); onClose(); }}>
              <span className="hms-avatar h-7 w-7 text-[10px]">{initials(p.full_name)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{p.full_name}</span><span className="hms-code">{p.code}</span></span>
              <span className="hms-chip brand">Paciente</span>
            </button>
          ))}
          {docs.map((d) => (
            <button key={d.id} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--h-soft)]" onClick={() => { go("documents", { docId: d.id }); onClose(); }}>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--h-ok-soft)] text-[var(--h-ok)]"><Check className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{d.title}</span><span className="hms-code">{d.code}</span></span>
              <span className="hms-chip">{d.status}</span>
            </button>
          ))}
          {staff.map((s) => (
            <button key={s.id} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--h-soft)]" onClick={() => { go("team"); onClose(); }}>
              <span className="hms-avatar h-7 w-7 text-[10px]">{initials(s.full_name)}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{s.full_name}</span><span className="text-[11px] text-[var(--h-muted)]">{s.specialty ?? s.role}</span></span>
              <span className="hms-chip brand">Equipe</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- primitives ------------------------------- */

export function Page({ eyebrow, title, sub, actions, children }: { eyebrow?: string; title: string; sub?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="hms-rise">
      <div className="hms-page-head">
        <div className="min-w-0">
          {eyebrow && <div className="hms-eyebrow">{eyebrow}</div>}
          <h1 className="hms-title">{title}</h1>
          {sub && <div className="hms-sub">{sub}</div>}
        </div>
        {actions && <div className="hms-page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, sub, actions, children, className = "", bodyClass = "hms-card-body", noBody }: {
  title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string; noBody?: boolean;
}) {
  return (
    <section className={`hms-card ${className}`}>
      {(title || actions) && (
        <div className="hms-card-head">
          <div className="min-w-0">{title && <h3>{title}</h3>}{sub && <div className="hms-sub">{sub}</div>}</div>
          {actions && <div className="hms-card-head-actions">{actions}</div>}
        </div>
      )}
      {noBody ? children : <div className={bodyClass}>{children}</div>}
    </section>
  );
}

export function Kpi({ label, value, note, icon: Icon, tone = "default" }: { label: string; value: ReactNode; note?: ReactNode; icon?: LucideIcon; tone?: "default" | "brand" | "vital" | "ok" | "warn" }) {
  return (
    <div className={`hms-kpi ${tone === "default" ? "" : `is-${tone}`}`}>
      <div className="hms-kpi-label">{label}</div>
      <div className="hms-kpi-value">{value}</div>
      {note && <div className="hms-kpi-note">{note}</div>}
      {Icon && <span className="hms-kpi-icon"><Icon className="h-4 w-4" /></span>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "soft" | "danger" | "danger-ghost";
  size?: "md" | "sm" | "icon";
  icon?: LucideIcon;
};
export function Btn({ variant = "primary", size = "md", icon: Icon, className = "", children, ...rest }: BtnProps) {
  const v = variant === "primary" ? "" : variant;
  const s = size === "sm" ? "sm" : size === "icon" ? "icon" : "";
  return (
    <button className={`hms-btn ${v} ${s} ${className}`} {...rest}>
      {Icon && <Icon />}
      {children}
    </button>
  );
}

export function Field({ label, hint, className = "", children }: { label?: string; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`hms-field ${className}`}>
      {label && <label className="hms-label">{label}</label>}
      {children}
      {hint && <div className="hms-field-hint">{hint}</div>}
    </div>
  );
}

/* Overlays are portaled to <body>. Inside an animated/contained ancestor, a
   fixed overlay would be clipped to that ancestor's box — which used to cut
   long forms (patient/modals) down to a few centimeters tall. */
function OverlayLayer({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); }, []);
  useEffect(() => {
    if (!host) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [host]);
  if (!host) return null;
  const dark = !!document.querySelector(".hms.dark");
  return createPortal(
    <div className={`hms${dark ? " dark" : ""}`} style={{ display: "contents" }}>{children}</div>,
    host,
  );
}

export function Modal({ title, sub, onClose, children, footer, size = "md", wide, slim }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "md" | "wide" | "slim"; wide?: boolean; slim?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const resolved = wide ? "wide" : slim ? "slim" : size;
  return (
    <OverlayLayer>
      <div className="hms-overlay center" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className={`hms-modal ${resolved === "wide" ? "wide" : resolved === "slim" ? "slim" : ""}`} role="dialog" aria-modal="true">
          <div className="hms-overlay-head">
            <div className="min-w-0 flex-1"><h2 className="truncate">{title}</h2>{sub && <div className="hms-sub mt-0.5">{sub}</div>}</div>
            <button className="hms-btn ghost icon sm" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
          <div className="hms-overlay-body">{children}</div>
          {footer && <div className="hms-overlay-foot">{footer}</div>}
        </div>
      </div>
    </OverlayLayer>
  );
}

export function Drawer({ title, sub, onClose, children, footer }: { title: ReactNode; sub?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <OverlayLayer>
      <div className="hms-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="hms-drawer" role="dialog" aria-modal="true">
          <div className="hms-overlay-head">
            <div className="min-w-0 flex-1"><h2 className="truncate">{title}</h2>{sub && <div className="hms-sub mt-0.5">{sub}</div>}</div>
            <button className="hms-btn ghost icon sm" onClick={onClose} aria-label="Fechar"><X className="h-4 w-4" /></button>
          </div>
          <div className="hms-overlay-body">{children}</div>
          {footer && <div className="hms-overlay-foot">{footer}</div>}
        </div>
      </div>
    </OverlayLayer>
  );
}

export function Tabs<T extends string>({ items, value, onChange }: { items: { key: T; label: string; count?: number }[]; value: T; onChange: (k: T) => void }) {
  return (
    <div className="hms-tabs">
      {items.map((i) => (
        <button key={i.key} className={`hms-tab ${value === i.key ? "is-active" : ""}`} onClick={() => onChange(i.key)}>
          {i.label}{i.count !== undefined && <span className="hms-tab-count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Chip({ tone = "default", children }: { tone?: "default" | "brand" | "ok" | "warn" | "vital" | "outline"; children: ReactNode }) {
  return <span className={`hms-chip ${tone === "default" ? "" : tone}`}>{children}</span>;
}

export function Empty({ icon: Icon, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="hms-empty">
      {Icon && <span className="hms-empty-icon"><Icon className="h-5 w-5" /></span>}
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Banner({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  return <div className={`hms-banner ${tone}`}><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><div>{children}</div></div>;
}

export function Avatar({ name, url, size = 34 }: { name?: string | null; url?: string | null; size?: number }) {
  return (
    <span className="hms-avatar" style={{ height: size, width: size, fontSize: size * 0.34 }}>
      {url ? <img src={url} alt="" /> : initials(name ?? "L+")}
    </span>
  );
}

export function initials(name: string | null | undefined) {
  if (!name) return "L+";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "L+";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function CopyBtn({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Btn variant="ghost" size="sm" icon={done ? Check : Copy} onClick={async () => {
      try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* clipboard blocked */ }
    }}>{done ? "Copiado" : label}</Btn>
  );
}

export function Table({ head, children, empty }: { head: ReactNode; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="hms-table-wrap">
      <table className="hms-table">
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Buscar…", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--h-faint)]" />
      <input className="hms-input hms-search pl-8" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function Loading({ label = "Carregando…" }: { label?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--h-muted)]"><Loader2 className="h-4 w-4 animate-spin" />{label}</div>;
}

export function PatientCell({ patient, small }: { patient?: Patient; small?: boolean }) {
  if (!patient) return <span className="text-[var(--h-faint)]">—</span>;
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={patient.full_name} url={patient.photo_url} size={small ? 28 : 32} />
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold">{patient.full_name}</div>
        <div className="hms-code truncate">{patient.code}{patient.insurance ? ` · ${patient.insurance}` : ""}</div>
      </div>
    </div>
  );
}

export function Disclaimer() {
  return <Chip tone="warn">{DISCLAIMER}</Chip>;
}

export function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="hms-section-label">{label}</div>
      <div className="mt-1 truncate text-[13px] font-medium">{value || <span className="text-[var(--h-faint)]">—</span>}</div>
    </div>
  );
}

export function DateText({ value }: { value: string | null | undefined }) {
  return <span title={value ? fDateTime(value) : ""}>{fDate(value)}</span>;
}

/* ---------------------------------- charts --------------------------------- */

export function Bars({ data, height = 140, altKey, formatter }: { data: { label: string; value: number; alt?: number }[]; height?: number; altKey?: string; formatter?: (n: number) => string }) {
  const max = Math.max(...data.map((d) => Math.max(d.value, d.alt ?? 0)), 1);
  const w = 320, pad = 18, bw = data.length ? (w - pad * 2) / data.length : 0;
  return (
    <div>
      <svg className="hms-chart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={altKey ?? "Gráfico de barras"}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} className="grid-line" x1={pad} x2={w - pad} y1={height - 16 - (height - 26) * f} y2={height - 16 - (height - 26) * f} strokeDasharray="2 3" />)}
        {data.map((d, i) => {
          const h = ((height - 26) * d.value) / max;
          const x = pad + i * bw + bw * 0.18;
          return (
            <g key={`${d.label}-${i}`}>
              <rect className="bar" x={x} y={height - 16 - h} width={bw * 0.64} height={Math.max(h, 0.8)} rx={2}>
                <title>{`${d.label}: ${formatter ? formatter(d.value) : d.value}`}</title>
              </rect>
              <text className="axis-text" x={x + bw * 0.32} y={height - 5} textAnchor="middle">{d.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AreaLine({ points, labels, height = 130 }: { points: number[]; labels: string[]; height?: number }) {
  const w = 340, pad = 10, max = Math.max(...points, 1), n = Math.max(points.length - 1, 1);
  const coords = points.map((v, i) => [pad + (i / n) * (w - pad * 2), height - 22 - (v / max) * (height - 32)] as const);
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${w - pad},${height - 22} L${pad},${height - 22} Z`;
  return (
    <svg className="hms-chart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Série temporal">
      {[0.33, 0.66, 1].map((f) => <line key={f} className="grid-line" x1={pad} x2={w - pad} y1={height - 22 - (height - 32) * f} y2={height - 22 - (height - 32) * f} strokeDasharray="2 3" />)}
      <path className="area" d={area} />
      <path className="line" d={d} />
      {coords.map(([x, y], i) => <circle key={i} className="dot" cx={x} cy={y} r={2.2} />)}
      {labels.map((l, i) => (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) && (
        <text key={l + i} className="axis-text" x={coords[i]?.[0] ?? 0} y={height - 6} textAnchor="middle">{l}</text>
      ))}
    </svg>
  );
}

const DONUT_COLORS = ["#1258d6", "#17795e", "#c98a1a", "#cf3d3d", "#5d6f86", "#7b5cc4"];

export function Donut({ data, total, label }: { data: { label: string; value: number }[]; total?: number; label?: string }) {
  const sum = total ?? data.reduce((a, b) => a + b.value, 0);
  const r = 30, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg className="hms-chart h-[104px] w-[104px] shrink-0" viewBox="0 0 80 80" role="img" aria-label={label ?? "Distribuição"}>
        <circle className="donut-track" cx="40" cy="40" r={r} strokeWidth="11" />
        {data.map((d, i) => {
          const frac = sum ? d.value / sum : 0;
          const el = (
            <circle key={d.label} className="donut-seg" cx="40" cy="40" r={r} strokeWidth="11"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeDasharray={`${frac * c} ${c}`} strokeDashoffset={-offset}
              transform="rotate(-90 40 40)"><title>{`${d.label}: ${d.value}`}</title></circle>
          );
          offset += frac * c; return el;
        })}
        <text x="40" y="40" textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--h-fg)", fontSize: 13, fontWeight: 600, fontFamily: "var(--h-serif)" }}>{sum}</text>
      </svg>
      <div className="hms-legend mt-0 flex-col items-start gap-1.5">
        {data.map((d, i) => (
          <span key={d.label}><i style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />{d.label}<b className="ml-1 text-[var(--h-fg)]">{d.value}</b></span>
        ))}
        {!data.length && <span className="text-[var(--h-faint)]">Sem dados.</span>}
      </div>
    </div>
  );
}

export function BarList({ rows, tone = "brand" }: { rows: { label: string; value: number }[]; tone?: "brand" | "ok" | "vital" }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div>
      {rows.map((r) => (
        <div className="hms-bar-row" key={r.label}>
          <div className="hms-bar-head"><span className="truncate">{r.label}</span><b className="text-[var(--h-fg)]">{r.value}</b></div>
          <div className="hms-bar-track"><div className="hms-bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: tone === "ok" ? "var(--h-ok)" : tone === "vital" ? "var(--h-vital)" : undefined }} /></div>
        </div>
      ))}
      {!rows.length && <div className="py-6 text-center text-xs text-[var(--h-faint)]">Sem dados no período.</div>}
    </div>
  );
}
