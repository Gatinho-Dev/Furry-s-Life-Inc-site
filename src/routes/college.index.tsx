import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, Shield, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/college/")({
  head: () => ({
    meta: [
      { title: "Life College — Universidade da holding FLI" },
      { name: "description", content: "Universidade privada Life College: alunos, professores e turmas." },
      { property: "og:title", content: "Life College" },
      { property: "og:description", content: "Universidade privada com excelência acadêmica." },
    ],
  }),
  component: CollegeLanding,
});

function CollegeLanding() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Furry's Life Inc.</Link>
          <Link to="/college/staff" className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            <Shield className="h-3.5 w-3.5" /> Painel Staff
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-primary/5 text-primary">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="mt-6 font-display text-4xl font-bold md:text-5xl">Life College</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Universidade privada com excelência acadêmica e formação humanística.
        </p>
        <Link to="/college/staff" className="mt-10 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Acessar painel acadêmico <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
