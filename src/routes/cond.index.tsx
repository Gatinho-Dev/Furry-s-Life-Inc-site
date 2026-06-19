import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, Users, Shield, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/cond/")({
  head: () => ({
    meta: [
      { title: "Furry's Life Cond. — Condomínio de alto padrão" },
      { name: "description", content: "Condomínio privado da holding Furry's Life Inc. Gestão de moradores e visitantes em um só lugar." },
      { property: "og:title", content: "Furry's Life Cond." },
      { property: "og:description", content: "Condomínio privado de alto padrão." },
    ],
  }),
  component: CondLanding,
});

function CondLanding() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Furry's Life Inc.</Link>
          <Link to="/cond/staff" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Shield className="h-3.5 w-3.5" /> Painel Staff
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-primary/5 text-primary">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">Furry's Life Cond.</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Condomínio privado de alto padrão. Tecnologia e bem-estar para nossos moradores.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { t: "Moradores", d: "Cadastro completo com foto, unidade e contato." },
            { t: "Visitantes", d: "Registro de entrada e saída com histórico." },
            { t: "Segurança 24h", d: "Equipe própria, integrada ao sistema." },
          ].map((b) => (
            <div key={b.t} className="glass-card rounded-2xl p-5">
              <div className="font-display font-semibold">{b.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
        <Link to="/cond/staff" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Users className="h-4 w-4" /> Acessar painel de gestão <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
