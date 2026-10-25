import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { WORKSPACE_APPS } from "@/lib/workspace/apps";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/workspace/")({
  head: () => ({
    meta: [
      { title: "Life Workspace — Furry's Life Inc." },
      { name: "description", content: "Seu espaço de trabalho digital da Furry's Life Inc." },
      { property: "og:title", content: "Life Workspace — Furry's Life Inc." },
      { property: "og:description", content: "Seu espaço de trabalho digital." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Launcher,
});

function Launcher() {
  const auth = useAuth();
  const drive = WORKSPACE_APPS.find((a) => a.key === "drive")!;
  const docs = WORKSPACE_APPS.find((a) => a.key === "docs")!;
  const forms = WORKSPACE_APPS.find((a) => a.key === "forms")!;
  const soon = WORKSPACE_APPS.filter((a) => !a.available);
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="flex items-center gap-2.5"><img src={symbol.url} alt="" className="h-8 w-8" /><span className="font-display text-sm font-semibold">Furry's Life Inc.</span></Link>
        <span className="text-xs text-muted-foreground">{auth.user?.email}</span>
      </header>
      <main className="mx-auto max-w-5xl px-6 pb-20 pt-10 md:pt-16">
        <div className="animate-fade-up">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Furry's Life Inc.</div>
          <h1 className="mt-3 font-display text-4xl font-bold md:text-6xl">Life Workspace</h1>
          <p className="mt-3 text-lg text-muted-foreground">Seu espaço de trabalho digital.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {[drive, docs, forms].map((app) => {
            const inner = (<>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><app.icon className="h-7 w-7" /></div>
              <div className="flex-1"><h2 className="font-display text-xl font-bold">{app.name}</h2><p className="mt-1 text-sm text-muted-foreground">{app.description}</p></div>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
            </>);
            const cls = "group flex items-center gap-5 rounded-3xl border border-border bg-card p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl";
            return app.key === "drive"
              ? <Link key={app.key} to="/workspace/drive" search={{ folder: undefined }} className={cls}>{inner}</Link>
              : app.key === "docs"
                ? <Link key={app.key} to="/workspace/docs" className={cls}>{inner}</Link>
                : <Link key={app.key} to="/workspace/forms" className={cls}>{inner}</Link>;
          })}
        </div>
        <div className="mt-14">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Em breve</div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {soon.map((a) => (
              <div key={a.key} className="flex items-center gap-2.5 rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground opacity-70">
                <a.icon className="h-4 w-4" />{a.name}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
