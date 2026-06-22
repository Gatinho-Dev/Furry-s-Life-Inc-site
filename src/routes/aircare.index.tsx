import { createFileRoute, Link } from "@tanstack/react-router";
import { Wind, Factory, Sun, Leaf, ShieldCheck, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/aircare")({
  head: () => ({
    meta: [
      { title: "Life AirCare — Ar limpo para fábricas" },
      { name: "description", content: "Life AirCare entrega tecnologia de filtragem e energia limpa para reduzir poluição industrial." },
      { property: "og:title", content: "Life AirCare — Clean Air Factories" },
      { property: "og:description", content: "Reduzimos fumaça e poluentes em fábricas com filtros multicamadas e energia renovável." },
    ],
  }),
  component: AirCarePublic,
});

function AirCarePublic() {
  return (
    <div className="min-h-screen bg-[#0b1f12] text-emerald-50">
      {/* decorative dots */}
      <div className="pointer-events-none fixed inset-0 -z-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(circle, #65d188 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300"><Wind className="h-5 w-5" /></span>
          <span className="font-display text-lg font-semibold">Life AirCare</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="#problema" className="text-emerald-100/70 hover:text-emerald-50">Problema</a>
          <a href="#solucao" className="text-emerald-100/70 hover:text-emerald-50">Solução</a>
          <a href="#tecnologia" className="text-emerald-100/70 hover:text-emerald-50">Tecnologia</a>
          <Link to="/aircare/staff" className="rounded-full bg-emerald-400/90 px-3 py-1.5 text-xs font-semibold text-emerald-950 hover:bg-emerald-300">Painel</Link>
          <Link to="/" className="text-xs text-emerald-200/60 hover:text-emerald-100">← FLI</Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-8 px-6 pb-16 pt-10 md:grid-cols-[1.2fr_1fr] md:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
            <Leaf className="h-3 w-3" /> Clean Air Initiative
          </div>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[1.05] md:text-6xl">Clean Air <span className="text-emerald-400">Factories</span></h1>
          <div className="mt-5 inline-block rounded-full bg-emerald-400/90 px-5 py-2 text-sm font-medium text-emerald-950">A project to reduce factory smoke and air pollution</div>
          <p className="mt-6 max-w-lg text-emerald-100/80">
            Combinamos filtros industriais multicamadas e energia renovável para entregar ar mais limpo às comunidades ao redor de cada fábrica.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#solucao" className="inline-flex items-center gap-2 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-950 hover:bg-emerald-300">Ver a solução <ArrowRight className="h-4 w-4" /></a>
            <Link to="/aircare/staff" className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 px-5 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/10">Painel da equipe</Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -right-4 top-6 h-40 w-40 rounded-full bg-emerald-500/30 blur-3xl" />
          <div className="relative grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-900/40 p-6 text-center">
              <div className="text-4xl font-bold text-emerald-300">99%</div>
              <div className="mt-1 text-xs text-emerald-100/70">de partículas capturadas</div>
            </div>
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-900/40 p-6 text-center">
              <div className="text-4xl font-bold text-emerald-300">0</div>
              <div className="mt-1 text-xs text-emerald-100/70">emissão na energia limpa</div>
            </div>
            <div className="col-span-2 rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-700/40 to-emerald-900/60 p-6">
              <div className="flex items-center gap-3">
                <Factory className="h-8 w-8 text-emerald-300" />
                <div>
                  <div className="text-sm font-semibold">Monitoramento contínuo</div>
                  <div className="text-xs text-emerald-100/70">PM2.5, CO₂, temperatura e umidade em tempo real</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problema" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="rounded-3xl border border-emerald-300/15 bg-emerald-950/40 p-8 md:p-12">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">The Problem</div>
          <h2 className="mt-2 font-display text-4xl font-bold">Factory <span className="text-emerald-400">Air Pollution</span></h2>
          <p className="mt-4 max-w-2xl text-emerald-100/80">Muitas fábricas liberam fumaça e gases tóxicos no ar todos os dias. Essas emissões incluem CO₂, SO₂ e outros químicos perigosos que se espalham pelas comunidades.</p>
          <div className="mt-6 inline-flex items-start gap-3 rounded-2xl bg-emerald-400/15 p-5 text-sm text-emerald-50">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-300" />
            <div><span className="font-semibold">A urgência:</span> a poluição causa asma, doenças pulmonares e contribui para mudanças climáticas. Agir agora protege saúde e planeta.</div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section id="solucao" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">The Solution</div>
        <h2 className="mt-2 font-display text-4xl font-bold">Clean Air <span className="text-emerald-400">Methods</span></h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-emerald-300/15 bg-emerald-900/40 p-7">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300"><Factory className="h-5 w-5" /></div>
            <h3 className="mt-4 font-display text-xl font-semibold">Filtros especiais de fumaça</h3>
            <p className="mt-2 text-sm text-emerald-100/80">Instalados em chaminés, capturam até 99% das partículas e gases antes que cheguem à atmosfera.</p>
          </div>
          <div className="rounded-3xl border border-emerald-300/15 bg-emerald-900/40 p-7">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300"><Sun className="h-5 w-5" /></div>
            <h3 className="mt-4 font-display text-xl font-semibold">Mudança para energia limpa</h3>
            <p className="mt-2 text-sm text-emerald-100/80">Solar e eólica substituem combustíveis fósseis — zero emissão durante operação.</p>
          </div>
        </div>
      </section>

      {/* Tecnology */}
      <section id="tecnologia" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Filter technology</div>
        <h2 className="mt-2 font-display text-4xl font-bold">Camadas que purificam o ar</h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {[
            { n: 1, t: "Malha externa", d: "Proteção contra detritos grandes." },
            { n: 2, t: "Pré-filtro", d: "Poeira e partículas grandes." },
            { n: 3, t: "Eletrostático", d: "Pólen, pelos e finas." },
            { n: 4, t: "Carvão ativado", d: "Odores, fumaça e gases." },
            { n: 5, t: "Microfibra HEPA", d: "Partículas ultrafinas." },
            { n: 6, t: "Saída de ar limpo", d: "Ar respirável devolvido." },
          ].map((l) => (
            <div key={l.n} className="rounded-2xl border border-emerald-300/15 bg-emerald-900/40 p-4">
              <div className="text-xs text-emerald-300">Camada {l.n}</div>
              <div className="mt-1 font-display text-sm font-semibold">{l.t}</div>
              <div className="mt-1 text-xs text-emerald-100/70">{l.d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-emerald-300/10 px-6 py-8 text-center text-xs text-emerald-200/60">
        © {new Date().getFullYear()} Life AirCare · subsidiária de Furry's Life Inc.
      </footer>
    </div>
  );
}
