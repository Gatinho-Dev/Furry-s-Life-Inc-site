import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { subsidiaries } from "@/lib/site-data";

export function Subsidiaries() {
  return (
    <section id="subsidiarias" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-widest text-primary">Nossas empresas</div>
        <h2 className="mt-3 text-balance text-3xl font-bold md:text-4xl">
          14 subsidiárias, <span className="text-gradient">um propósito</span>.
        </h2>
        <p className="mt-4 text-muted-foreground">
          Cada empresa do grupo é referência em seu segmento e contribui para o ecossistema FLI.
        </p>
      </div>

      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {subsidiaries.map((s) => {
          const Icon = s.icon;
          const cls = "glass-card group flex h-full flex-col rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg";
          const inner = (
            <>
              <div className="flex items-center justify-between">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-primary/5 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                {(s.href || s.externalHref) && (
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                )}
              </div>
              <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.category}</div>
              <h3 className="mt-1 font-display text-lg font-semibold">{s.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
              {!s.href && !s.externalHref && (
                <span className="mt-3 inline-flex w-fit rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Em breve</span>
              )}
            </>
          );
          if (s.externalHref) {
            return <a key={s.name} href={s.externalHref} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
          }
          if (s.href) {
            return <Link key={s.name} to={s.href} className={cls}>{inner}</Link>;
          }
          return <article key={s.name} className={cls}>{inner}</article>;
        })}
      </div>
    </section>
  );
}
