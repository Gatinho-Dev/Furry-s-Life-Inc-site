import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, type LucideIcon } from "lucide-react";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { useAuth } from "@/lib/use-auth";

export type ShellTab<T extends string = string> = {
  key: T;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
};

type Props<T extends string> = {
  brand: string;
  subtitle?: string;
  accent?: string; // tailwind color name token e.g. "primary"
  tabs: ShellTab<T>[];
  active: T;
  onSelect: (k: T) => void;
  children: React.ReactNode;
  topRight?: React.ReactNode;
};

export function StaffShell<T extends string>({ brand, subtitle, tabs, active, onSelect, children, topRight }: Props<T>) {
  const auth = useAuth();
  const nav = useNavigate();
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur md:flex">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <img src={symbol.url} alt="" className="h-8 w-8" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold">{brand}</div>
            {subtitle && <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">{subtitle}</div>}
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {tabs.map((t) => {
            const Icon = t.icon;
            const a = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onSelect(t.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${a ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{t.label}</span>
                {t.badge !== undefined && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">{t.badge}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <Link to="/staff/dashboard" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Painel central
          </Link>
          <button onClick={async () => { await auth.signOut(); nav({ to: "/auth" }); }}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-5 py-3 backdrop-blur">
          <div className="md:hidden">
            <select value={active} onChange={(e) => onSelect(e.target.value as T)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              {tabs.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {topRight}
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium">{auth.user?.email}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{auth.roles[0] ?? "staff"}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function KpiCard({ label, value, hint, icon: Icon, tone = "primary" }: { label: string; value: string | number; hint?: string; icon?: LucideIcon; tone?: "primary" | "success" | "warning" | "danger" }) {
  const tones = {
    primary: "from-primary/20 to-primary/5 border-primary/30 text-primary",
    success: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    warning: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
    danger: "from-rose-500/20 to-rose-500/5 border-rose-500/30 text-rose-400",
  }[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-5 ${tones}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-1 font-display text-3xl font-black text-foreground">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {Icon && <div className="rounded-xl bg-background/40 p-2.5"><Icon className="h-5 w-5" /></div>}
      </div>
    </div>
  );
}
