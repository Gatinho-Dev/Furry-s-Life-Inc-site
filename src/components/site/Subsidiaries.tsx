import { subsidiaries } from "@/lib/site-data";

const accentMap: Record<string, string> = {
  blue: "from-primary/30 to-primary/0 text-primary",
  purple: "from-accent/30 to-accent/0 text-accent",
  green: "from-success/30 to-success/0 text-success",
};

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
          return (
            <article key={s.name}
              className="glass-card group relative overflow-hidden rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40">
              <div className={`pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-radial bg-gradient-to-br ${accentMap[s.accent]} opacity-50 blur-2xl transition-opacity group-hover:opacity-80`} />
              <div className={`relative inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary/60 ${accentMap[s.accent].split(" ").pop()}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="relative mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {s.category}
              </div>
              <h3 className="relative mt-1 font-display text-lg font-semibold">{s.name}</h3>
              <p className="relative mt-2 text-sm text-muted-foreground">{s.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
