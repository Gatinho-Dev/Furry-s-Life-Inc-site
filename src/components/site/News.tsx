import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type NewsRow = { id: string; title: string; subtitle: string | null; tag: string; created_at: string };

export function News() {
  const [items, setItems] = useState<NewsRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("news_posts")
      .select("id, title, subtitle, tag, created_at")
      .eq("published", true)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => { if (!cancelled) setItems((data ?? []) as NewsRow[]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section id="noticias" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Notícias & avisos</div>
          <h2 className="mt-3 text-balance text-3xl font-bold md:text-4xl">Comunicados oficiais</h2>
        </div>
        <Link to="/news" className="hidden items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 sm:inline-flex">
          Ver todas <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {items === null ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-40 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">
          Nenhuma notícia publicada ainda.
        </div>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {items.map((n) => (
            <Link key={n.id} to="/news" hash={n.id} className="glass-card group block rounded-2xl p-6 transition-all hover:border-primary/40">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(n.created_at).toLocaleDateString("pt-BR")}</span>
                <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">{n.tag}</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{n.title}</h3>
              {n.subtitle && <p className="mt-2 text-sm text-muted-foreground">{n.subtitle}</p>}
              <span className="mt-4 inline-block text-sm text-primary transition-opacity group-hover:opacity-80">Ler mais →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
