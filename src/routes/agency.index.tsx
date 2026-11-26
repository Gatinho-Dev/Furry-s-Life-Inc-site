import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Eye, Search } from "lucide-react";

export const Route = createFileRoute("/agency/")({
  head: () => ({
    meta: [
      { title: "Life Agency — Inteligência e operações especiais" },
      { name: "description", content: "Agência interna de inteligência da holding Furry's Life Inc." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AgencyLanding,
});

function AgencyLanding() {
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xs text-white/60 hover:text-white">← Furry's Life Inc.</Link>
          <Link to="/agency/staff" className="inline-flex items-center gap-1.5 rounded-xl border border-red-600/60 bg-red-600/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-600/20">
            <Shield className="h-3.5 w-3.5" /> Painel restrito
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-red-600/40 bg-red-600/10 text-red-400">
          <Eye className="h-6 w-6" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-6xl">Life Agency</h1>
        <p className="mt-4 max-w-2xl text-lg text-white/70">
          Inteligência, OSINT e operações especiais para o ecossistema FLI.
        </p>
        <div className="mt-10 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
          <Search className="h-4 w-4" /> Acesso somente com autorização explícita.
        </div>
      </section>
    </div>
  );
}
