import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { DISCORD_URL } from "@/lib/site-data";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3a14.5 14.5 0 0 0-.66 1.337 18.27 18.27 0 0 0-5.487 0A14 14 0 0 0 9.74 3a19.74 19.74 0 0 0-3.76 1.369C2.157 9.916 1.13 15.317 1.64 20.642A19.93 19.93 0 0 0 7.69 23a14.3 14.3 0 0 0 1.234-1.97 12.84 12.84 0 0 1-1.945-.92c.163-.12.323-.246.477-.376a14.21 14.21 0 0 0 12.087 0c.156.13.316.255.478.376-.62.367-1.27.676-1.948.92A14.2 14.2 0 0 0 19.31 23a19.86 19.86 0 0 0 6.052-2.358c.598-6.18-1.034-11.532-4.045-16.273ZM9.68 17.276c-1.182 0-2.156-1.077-2.156-2.4 0-1.32.953-2.4 2.156-2.4 1.204 0 2.178 1.087 2.156 2.4 0 1.323-.96 2.4-2.156 2.4Zm6.638 0c-1.183 0-2.157-1.077-2.157-2.4 0-1.32.952-2.4 2.157-2.4 1.203 0 2.178 1.087 2.156 2.4 0 1.323-.953 2.4-2.156 2.4Z"/>
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
