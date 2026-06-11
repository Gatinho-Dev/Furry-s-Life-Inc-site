import { newsItems } from "@/lib/site-data";
import { Calendar } from "lucide-react";

export function News() {
  return (
    <section id="noticias" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Notícias & avisos</div>
          <h2 className="mt-3 text-balance text-3xl font-bold md:text-4xl">Comunicados oficiais</h2>
        </div>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {newsItems.map((n) => (
          <article key={n.title} className="glass-card group rounded-2xl p-6 transition-all hover:border-primary/40">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{n.date}</span>
              <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">{n.tag}</span>
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold leading-snug">{n.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{n.description}</p>
            <button className="mt-4 text-sm text-primary transition-opacity hover:opacity-80">Ler mais →</button>
          </article>
        ))}
      </div>
    </section>
  );
}
