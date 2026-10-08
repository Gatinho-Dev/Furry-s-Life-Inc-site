import { Link } from "@tanstack/react-router";
import { LayoutGrid, LogOut, type LucideIcon } from "lucide-react";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { useAuth } from "@/lib/use-auth";

export type NavItem<T extends string> = { key: T; label: string; icon: LucideIcon };

/** Layout reutilizável por todas as ferramentas do Life Workspace. */
export function WorkspaceShell<T extends string>({
  product, nav, bottomNav, active, onSelect, header, children,
}: {
  product: string;
  nav: NavItem<T>[];
  bottomNav?: NavItem<T>[];
  active: T;
  onSelect: (k: T) => void;
  header?: React.ReactNode;
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const Btn = ({ n }: { n: NavItem<T> }) => {
    const a = n.key === active; const I = n.icon;
    return (
      <button onClick={() => onSelect(n.key)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${a ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
        <I className="h-4 w-4 shrink-0" />{n.label}
      </button>
    );
  };
  const initial = (auth.user?.email ?? "?")[0]?.toUpperCase();
  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card/70 backdrop-blur md:flex">
        <Link to="/workspace" className="flex items-center gap-3 px-5 py-5">
          <img src={symbol.url} alt="" className="h-8 w-8" />
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Life Workspace</div>
            <div className="font-display text-base font-bold">{product}</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 px-3">{nav.map((n) => <Btn key={n.key} n={n} />)}</nav>
        <div className="space-y-0.5 border-t border-border px-3 py-3">
          {bottomNav?.map((n) => <Btn key={n.key} n={n} />)}
          <Link to="/workspace" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">
            <LayoutGrid className="h-4 w-4" />Todas as ferramentas
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:px-6">
          <div className="min-w-0 flex-1">{header}</div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right lg:block">
              <div className="text-xs font-medium">{auth.user?.email}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{initial}</div>
            <button onClick={() => auth.signOut()} title="Sair" className="rounded-full p-2 text-muted-foreground hover:bg-secondary"><LogOut className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 py-2 md:hidden">
          {[...nav, ...(bottomNav ?? [])].map((n) => (
            <button key={n.key} onClick={() => onSelect(n.key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${n.key === active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{n.label}</button>
          ))}
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
