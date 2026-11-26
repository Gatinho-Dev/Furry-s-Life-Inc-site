import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  AtSign, Building2, ChevronLeft, ChevronRight, Command, ExternalLink, FileBarChart, FileText, FolderOpen,
  Globe, History, Image as ImageIcon, LayoutDashboard, Library, Link2, Mail, Map as MapIcon, Menu, Network,
  PlugZap, Radar, Search, Server, Settings as SettingsIcon, Share2, ShieldAlert, ShieldCheck, Waypoints, Workflow, X,
} from "lucide-react";
import { NAV, NAV_GROUPS, APP_VERSION } from "@/lib/agency/catalog";
import { getPrefs, subscribeStore } from "@/lib/agency/store";
import { cx } from "./kit";

const ICONS: Record<string, typeof Globe> = {
  LayoutDashboard, Search, Library, Globe, Server, Network, AtSign, Mail, Link2, Share2, Building2,
  Image: ImageIcon, FileText, Map: MapIcon, ShieldAlert, Radar, FolderOpen, Waypoints,
  FileBarChart, Workflow, History, PlugZap, Settings: SettingsIcon,
};

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="ag-mono hidden text-[11px] text-[var(--ag-faint)] md:inline">
      {now.toISOString().slice(11, 19)} UTC
    </span>
  );
}

export function AgencyShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("life-agency.sidebar") === "collapsed");
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const applyPrefs = () => {
      const prefs = getPrefs();
      const root = document.documentElement;
      root.dataset.agencyTheme = prefs.theme;
      root.dataset.agencyCompact = prefs.compact ? "true" : "false";
      root.dataset.agencyMotion = prefs.reduceMotion ? "reduced" : "full";
      root.dataset.agencyBlur = prefs.blurPii ? "true" : "false";
      root.lang = prefs.language;
    };
    applyPrefs();
    return subscribeStore(applyPrefs);
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try { window.localStorage.setItem("life-agency.sidebar", next ? "collapsed" : "open"); } catch { /* ignore */ }
      return next;
    });
  };

  useEffect(() => { setMobile(false); }, [pathname]);

  const active = useMemo(() => {
    const found = NAV.find((n) => (n.to === "/agency" ? pathname === "/agency" || pathname === "/agency/" : pathname.startsWith(n.to)));
    return found ?? NAV[0];
  }, [pathname]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    window.location.assign(`/agency/quick-search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div className="agency-root flex min-h-screen">
      {/* ---------- mobile overlay ---------- */}
      {mobile && <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setMobile(false)} />}

      {/* ---------- sidebar ---------- */}
      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-50 flex w-[236px] flex-col border-r border-[var(--ag-border)] bg-[#070a0e]/95 backdrop-blur transition-transform duration-200 md:static md:translate-x-0 md:z-auto",
          collapsed && "md:w-[64px]",
          mobile ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-[62px] items-center gap-2.5 border-b border-[var(--ag-border)] px-3.5">
          <Link to="/agency" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-cyan-400/40 bg-gradient-to-br from-cyan-400/20 to-blue-600/20">
            <ShieldCheck className="h-4 w-4 text-cyan-300" />
          </Link>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-[13px] font-bold leading-none tracking-tight">LIFE AGENCY</div>
              <div className="mt-1 truncate text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--ag-faint)]">OSINT · Cyber Intel</div>
            </div>
          )}
          <button onClick={() => setMobile(false)} className="ag-btn ag-btn-ghost !p-1.5 md:hidden"><X className="h-4 w-4" /></button>
        </div>

        <div className="border-b border-[var(--ag-border)] p-2.5">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ag-faint)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={collapsed ? "" : "Pesquisa universal…"}
              title="Pesquisa universal"
              className="ag-input !py-1.5 !pl-8 !text-[11.5px] md:!pl-8"
            />
          </form>
        </div>

        <nav className="ag-scroll flex-1 overflow-y-auto px-2 py-2">
          {NAV_GROUPS.map((group) => {
            const items = NAV.filter((n) => n.group === group);
            return (
              <div key={group} className="mb-3">
                {!collapsed && <div className="ag-label px-1.5 pb-1 pt-1.5">{group}</div>}
                {collapsed && <div className="mx-auto my-2 h-px w-6 bg-[var(--ag-border)]" />}
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = ICONS[item.icon] ?? Globe;
                    const isActive = item.key === active.key;
                    return (
                      <Link
                        key={item.key}
                        to={item.to}
                        className="ag-nav-item"
                        data-active={isActive}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--ag-border)] p-2.5">
          {!collapsed && (
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="ag-pulse-dot" />
              <span className="text-[10px] text-[var(--ag-faint)]">Fontes gratuitas · sem chave obrigatória</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-1">
            <Link to="/agency/settings" className="ag-btn ag-btn-ghost !px-2 !py-1.5" title="Sobre / versão">
              <span className="ag-mono text-[10px]">v{APP_VERSION}</span>
            </Link>
            <Link to="/agency/staff" className="ag-btn ag-btn-ghost !px-2 !py-1.5" title="Painel restrito legado">
              <ShieldAlert className="h-3.5 w-3.5" />
            </Link>
            <button onClick={toggle} className="ag-btn ag-btn-ghost hidden !px-2 !py-1.5 md:inline-flex" title={collapsed ? "Expandir" : "Recolher"}>
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[62px] items-center justify-between gap-3 border-b border-[var(--ag-border)] bg-[#06080b]/85 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobile(true)} className="ag-btn ag-btn-ghost !p-2 md:hidden"><Menu className="h-4 w-4" /></button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--ag-faint)]">
                Life Agency <ChevronRight className="h-2.5 w-2.5" /> {active.group}
              </div>
              <div className="truncate text-[13px] font-semibold leading-tight">{active.label}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock />
            <span className="hidden items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:inline-flex">
              <span className="ag-pulse-dot" /> Público
            </span>
            <Link to="/agency/quick-search" search={{ q: undefined }} className="ag-btn ag-btn-primary !px-3 !py-1.5 !text-[11.5px]">
              <Command className="h-3.5 w-3.5" /> Quick Search
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-5 p-4 md:p-6">
          <Outlet />
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--ag-border)] px-4 py-3 text-[10.5px] text-[var(--ag-faint)] md:px-6">
          <div>Life Agency v{APP_VERSION} · Intelligence. Investigation. Insight.</div>
          <div className="flex items-center gap-3">
            <span>Somente fontes públicas e gratuitas</span>
            <Link to="/" className="inline-flex items-center gap-1 hover:text-white">Furry&apos;s Life Inc. <ExternalLink className="h-3 w-3" /></Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
