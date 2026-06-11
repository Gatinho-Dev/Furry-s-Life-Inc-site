import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Bell, LogOut, Building2, Activity,
  Search, Settings, ShieldCheck,
} from "lucide-react";
import { admins, internalNotices, subsidiaries } from "@/lib/site-data";
import symbol from "@/assets/fli-symbol.png.asset.json";

export const Route = createFileRoute("/staff/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Painel de Staff · Furry's Life Inc." },
      { name: "description", content: "Painel interno da Furry's Life Inc." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("fli_staff") !== "1") {
      nav({ to: "/staff" });
    } else {
      setReady(true);
    }
  }, [nav]);

  const logout = () => {
    sessionStorage.removeItem("fli_staff");
    nav({ to: "/staff" });
  };

  if (!ready) return null;

  const onlineCount = admins.filter((a) => a.status === "online").length;

  const navItems = [
    { icon: LayoutDashboard, label: "Visão Geral", active: true },
    { icon: Users, label: "Administradores" },
    { icon: Bell, label: "Avisos" },
    { icon: Building2, label: "Subsidiárias" },
    { icon: Settings, label: "Configurações" },
  ];

  const metrics = [
    { label: "Admins online", value: onlineCount, icon: Activity, tone: "text-success" },
    { label: "Avisos internos", value: internalNotices.length, icon: Bell, tone: "text-primary" },
    { label: "Subsidiárias", value: subsidiaries.length, icon: Building2, tone: "text-accent" },
  ];

  return (
    <div className="min-h-screen">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="hidden border-r border-border bg-card/40 backdrop-blur md:flex md:flex-col">
          <div className="flex items-center gap-2.5 border-b border-border p-5">
            <img src={symbol.url} alt="" className="h-7 w-7" />
            <div>
              <div className="font-display text-sm font-semibold">FLI Console</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Painel de Staff</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((n) => (
              <button key={n.label}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  n.active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}>
                <n.icon className="h-4 w-4" /> {n.label}
              </button>
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <button onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/60 px-6 py-4 backdrop-blur">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Painel de Staff</div>
              <h1 className="font-display text-xl font-semibold">Visão Geral</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2 md:flex">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input placeholder="Buscar..." className="w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-sm">
                <span className="text-lg">🐺</span>
                <div className="leading-tight">
                  <div className="font-medium">Lobo_2033</div>
                  <div className="text-[10px] uppercase tracking-wider text-success">Online</div>
                </div>
              </div>
              <Link to="/" className="hidden text-xs text-muted-foreground hover:text-foreground md:inline">Ir ao site</Link>
            </div>
          </header>

          <main className="flex-1 space-y-6 p-6">
            {/* Metrics */}
            <div className="grid gap-4 sm:grid-cols-3">
              {metrics.map((m) => (
                <div key={m.label} className="glass-card flex items-center justify-between rounded-2xl p-5">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
                    <div className="mt-1 font-display text-3xl font-bold">{m.value}</div>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 ${m.tone}`}>
                    <m.icon className="h-5 w-5" />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
              {/* Admin table */}
              <div className="glass-card rounded-2xl">
                <div className="flex items-center justify-between border-b border-border p-5">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Administradores</h2>
                    <p className="text-xs text-muted-foreground">Equipe de gestão da holding</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" /> {onlineCount} online
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {admins.map((a) => (
                    <div key={a.name} className="flex items-center justify-between px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary/60 text-lg">{a.avatar}</div>
                        <div>
                          <div className="text-sm font-medium">{a.name}</div>
                          <div className="text-xs text-muted-foreground">{a.role}</div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${
                        a.status === "online"
                          ? "bg-success/10 text-success border border-success/30"
                          : "bg-muted/40 text-muted-foreground border border-border"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${a.status === "online" ? "bg-success animate-pulse-dot" : "bg-muted-foreground"}`} />
                        {a.status === "online" ? "Online" : "Offline"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notices */}
              <div className="glass-card rounded-2xl">
                <div className="flex items-center justify-between border-b border-border p-5">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Avisos Internos</h2>
                    <p className="text-xs text-muted-foreground">Comunicados da diretoria</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-3 p-5">
                  {internalNotices.map((n) => (
                    <div key={n.title} className="rounded-xl border border-border bg-secondary/30 p-4">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{n.date}</div>
                      <div className="mt-1 text-sm font-semibold">{n.title}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                    </div>
                  ))}
                  <button className="w-full rounded-xl border border-dashed border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground">
                    + Novo aviso
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
