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
        <nav className="glass-card flex items-center justify-between rounded-2xl px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={symbol.url} alt="" className="h-8 w-8" />
            <span className="font-display text-sm font-semibold tracking-tight">
              Furry's Life <span className="text-muted-foreground">Inc.</span>
            </span>
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <a key={l.href} href={l.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex">
              <MessageCircle className="h-4 w-4 text-[color:var(--color-discord)]" />
              Discord
            </a>
            <Link to="/staff"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
              Painel de Staff
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
