import { Link } from "@tanstack/react-router";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { DISCORD_URL } from "@/lib/site-data";
import { MessageCircle } from "lucide-react";

export function Navbar() {
  const links = [
    { href: "#sobre", label: "Sobre" },
    { href: "#subsidiarias", label: "Subsidiárias" },
    { href: "#noticias", label: "Notícias" },
    { href: "#contato", label: "Contato" },
  ];
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
            {links.map((l) => (
              <a key={l.href} href={l.href}
                className="dock-link rounded-full px-3.5 py-1.5 text-[13px] font-medium text-foreground/80 hover:-translate-y-1 hover:scale-105 hover:text-foreground hover:bg-white/30">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
              className="glass-button hidden items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium sm:inline-flex">
              <MessageCircle className="h-4 w-4 text-[color:var(--color-discord)]" />
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
