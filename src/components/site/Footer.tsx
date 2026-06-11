import symbol from "@/assets/fli-symbol.png.asset.json";

export function Footer() {
  const cols = [
    { title: "Empresa", links: ["Sobre", "Subsidiárias", "Notícias", "Carreiras"] },
    { title: "Legal", links: ["Termos de Uso", "Privacidade", "Cookies", "Conformidade"] },
    { title: "Contato", links: ["Imprensa", "Parcerias", "Suporte", "Investidores"] },
  ];
  return (
    <footer className="mt-10 border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <img src={symbol.url} alt="" className="h-8 w-8" />
              <span className="font-display text-sm font-semibold">Furry's Life Inc.</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Conectando criatividade, tecnologia e experiências para o futuro.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-widest text-foreground">{c.title}</div>
              <ul className="mt-3 space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l}><a href="#" className="text-muted-foreground transition-colors hover:text-foreground">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <div>© 2026 Furry's Life Inc. Todos os direitos reservados.</div>
          <div>Holding corporativa · Todas as subsidiárias</div>
        </div>
      </div>
    </footer>
  );
}
