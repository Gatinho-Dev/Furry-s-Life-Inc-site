import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutGrid, Mail as MailIcon } from "lucide-react";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { DISCORD_URL } from "@/lib/site-data";


function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 71 55" className={className} fill="currentColor" aria-hidden xmlns="http://www.w3.org/2000/svg">
      <path d="M60.105 4.898A58.55 58.55 0 0 0 45.653.415a.22.22 0 0 0-.233.11c-.624 1.111-1.317 2.56-1.803 3.7-5.452-.815-10.875-.815-16.216 0-.486-1.164-1.2-2.589-1.83-3.7a.228.228 0 0 0-.233-.11A58.39 58.39 0 0 0 10.89 4.898a.21.21 0 0 0-.094.083C1.578 18.73-.944 32.144.293 45.39a.244.244 0 0 0 .093.167c6.073 4.46 11.955 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42.08 42.08 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 38.77 38.77 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378c.372-.279.744-.569 1.1-.862a.219.219 0 0 1 .229-.031c11.62 5.304 24.198 5.304 35.681 0a.219.219 0 0 1 .232.028c.356.293.728.586 1.103.865a.228.228 0 0 1-.02.378 36.36 36.36 0 0 1-5.54 2.637.227.227 0 0 0-.121.315 47.25 47.25 0 0 0 3.624 5.897.224.224 0 0 0 .249.084c5.801-1.794 11.684-4.502 17.757-8.961a.228.228 0 0 0 .093-.164c1.48-15.315-2.48-28.617-10.497-40.412a.18.18 0 0 0-.093-.084Zm-36.38 32.427c-3.497 0-6.38-3.211-6.38-7.156 0-3.944 2.827-7.156 6.38-7.156 3.583 0 6.438 3.24 6.382 7.156 0 3.945-2.827 7.156-6.382 7.156Zm23.593 0c-3.498 0-6.38-3.211-6.38-7.156 0-3.944 2.826-7.156 6.38-7.156 3.582 0 6.437 3.24 6.38 7.156 0 3.945-2.798 7.156-6.38 7.156Z"/>
    </svg>
  );
}

export function Navbar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isHome = path === "/";
  const [activeHash, setActiveHash] = useState<string>("");

  // scroll-spy on home page
  useEffect(() => {
    if (!isHome) return;
    const ids = ["sobre", "subsidiarias", "contato"];
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveHash(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [isHome]);

  const links: { kind: "hash" | "route"; id: string; label: string; to?: string }[] = [
    { kind: "hash", id: "sobre", label: "Sobre" },
    { kind: "hash", id: "subsidiarias", label: "Subsidiárias" },
    { kind: "route", id: "news", label: "Notícias", to: "/news" },
    { kind: "hash", id: "contato", label: "Contato" },
  ];

  const isActive = (l: typeof links[number]) => {
    if (l.kind === "route") return path.startsWith(l.to!);
    return isHome && activeHash === l.id;
  };

  const workspaceActive = path.startsWith("/workspace");

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto mt-4 max-w-6xl px-4">
        <nav className="glass-pill flex items-center justify-between rounded-full px-3 py-2">
          <Link to="/" className="dock-link flex items-center gap-2.5 rounded-full px-2 py-1 hover:-translate-y-0.5">
            <img src={symbol.url} alt="" className="h-8 w-8" />
            <span className="font-display text-sm font-semibold tracking-tight">
              Furry's Life <span className="text-muted-foreground">Inc.</span>
            </span>
          </Link>
          <div className="hidden items-center gap-0.5 md:flex">
            {links.map((l) => {
              const active = isActive(l);
              const cls = `dock-link rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/40"
                  : "text-foreground/80 hover:-translate-y-1 hover:scale-105 hover:text-foreground hover:bg-white/30"
              }`;
              if (l.kind === "route") return <Link key={l.id} to={l.to!} className={cls}>{l.label}</Link>;
              return (
                <a key={l.id} href={isHome ? `#${l.id}` : `/#${l.id}`} className={cls}>
                  {l.label}
                </a>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
              className="glass-button hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium sm:inline-flex">
              <DiscordIcon className="h-4 w-4 text-[color:var(--color-discord,#5865F2)]" />
              Discord
            </a>
            <Link to="/mail"
              className="glass-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium"
              title="Abrir a caixa de entrada do seu e-mail do domínio (requer login)">
              <MailIcon className="h-4 w-4" />
              <span className="hidden sm:inline">E-mail</span>
            </Link>
            <Link to="/workspace"
              className={`glass-button inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ${
                workspaceActive ? "ring-primary/45" : "ring-primary/20"
              }`}
              title="Abrir o Life Workspace (requer login)">
              <span className={`flex items-center gap-1.5 ${workspaceActive ? "text-primary" : "text-primary/90"}`}>
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Workspace</span>
              </span>
            </Link>
            <Link to="/staff"
              className="glass-button rounded-full px-3.5 py-1.5 text-[13px] font-medium">
              Painel de Staff
            </Link>

          </div>
        </nav>
      </div>
    </header>
  );
}
