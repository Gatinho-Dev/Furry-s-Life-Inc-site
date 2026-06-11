export function About() {
  const stats = [
    { value: "14", label: "Subsidiárias ativas" },
    { value: "10+", label: "Setores estratégicos" },
    { value: "2026", label: "Visão global" },
  ];
  return (
    <section id="sobre" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20">
      <div className="grid items-center gap-12 md:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-primary">Sobre nós</div>
          <h2 className="mt-3 text-balance text-3xl font-bold md:text-4xl">
            A holding que organiza um <span className="text-gradient">ecossistema completo</span>.
          </h2>
          <p className="mt-5 text-muted-foreground">
            A Furry's Life Inc. é o órgão principal responsável por organizar, administrar e
            expandir suas empresas subsidiárias. Atuamos em tecnologia, entretenimento, turismo,
            educação, saúde, energia, jogos e serviços especiais — sempre buscando inovação,
            criatividade, qualidade e experiências únicas.
          </p>
          <p className="mt-4 text-muted-foreground">
            Cada subsidiária opera com autonomia operacional sob diretrizes unificadas de
            excelência e propósito, formando uma rede integrada que se fortalece a cada novo passo.
          </p>
        </div>
        <div className="glass-card rounded-3xl p-8">
          <div className="grid gap-6 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-4xl font-bold text-gradient">{s.value}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-5 text-sm text-muted-foreground">
            "Construímos pontes entre setores aparentemente distintos para criar valor real,
            sustentável e duradouro."
            <div className="mt-3 text-xs uppercase tracking-wider text-foreground/80">— Conselho Diretor FLI</div>
          </div>
        </div>
      </div>
    </section>
  );
}
