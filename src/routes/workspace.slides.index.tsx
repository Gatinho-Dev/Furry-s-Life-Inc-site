import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Presentation, Plus, Search, LayoutGrid, List, Clock, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { fmtDate } from "@/lib/workspace/docs";
import { createPresentation, listPresentations, type PresentationRow } from "@/lib/workspace/presentations";
import { SLIDE_TEMPLATES } from "@/lib/workspace/slide-templates";

export const Route = createFileRoute("/workspace/slides/")({
  head: () => ({
    meta: [
      { title: "Life Slides — Life Workspace" },
      { name: "description", content: "Transforme suas ideias em apresentações extraordinárias." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SlidesHome,
});

type Sort = "updated" | "created" | "name";

function SlidesHome() {
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const nav = useNavigate();
  const [rows, setRows] = useState<PresentationRow[] | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!uid) return;
    listPresentations()
      .then(setRows)
      .catch(() => { toast.error("Não foi possível carregar as apresentações."); setRows([]); });
  }, [uid]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !r.trashed_at && r.title.toLowerCase().includes(s));
    const cmp = (a: PresentationRow, b: PresentationRow) =>
      sort === "name" ? a.title.localeCompare(b.title, "pt-BR")
        : sort === "created" ? +new Date(b.created_at) - +new Date(a.created_at)
          : +new Date(b.updated_at) - +new Date(a.updated_at);
    return [...list].sort(cmp);
  }, [rows, q, sort]);

  const create = async (templateKey: string) => {
    if (!uid || creating) return;
    const t = SLIDE_TEMPLATES.find((x) => x.key === templateKey) ?? SLIDE_TEMPLATES[0];
    setCreating(true);
    try {
      const id = await createPresentation(uid, t.title, t.build());
      nav({ to: "/workspace/slides/$id", params: { id } });
    } catch {
      toast.error("Não foi possível criar a apresentação.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur md:px-8">
        <Link to="/workspace" className="flex items-center gap-2 text-sm font-semibold"><Presentation className="h-5 w-5 text-primary" />Life Slides</Link>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar apresentações"
            className="w-full rounded-full border border-border bg-secondary/60 py-2 pl-9 pr-4 text-sm outline-none focus:border-primary" />
        </div>
        <Link to="/workspace" className="text-sm text-muted-foreground hover:text-foreground">Life Workspace</Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Comece uma nova apresentação</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SLIDE_TEMPLATES.map((t) => (
              <button key={t.key} disabled={creating} onClick={() => create(t.key)}
                className="group rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:opacity-60">
                <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground group-hover:text-primary">
                  {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                </div>
                <div className="mt-2 truncate text-sm font-medium">{t.name}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Minhas apresentações</h2>
            <div className="ml-auto flex items-center gap-2">
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar"
                className="rounded-xl border border-border bg-transparent px-3 py-1.5 text-xs outline-none">
                <option value="updated">Modificação</option><option value="created">Criação</option><option value="name">Nome</option>
              </select>
              <div className="flex rounded-xl border border-border p-0.5">
                {(["grid", "list"] as const).map((v) => {
                  const I = v === "grid" ? LayoutGrid : List;
                  return <button key={v} onClick={() => setView(v)} aria-label={v === "grid" ? "Grade" : "Lista"}
                    className={`rounded-lg p-1.5 ${view === v ? "bg-secondary text-foreground" : "text-muted-foreground"}`}><I className="h-4 w-4" /></button>;
                })}
              </div>
            </div>
          </div>

          {rows === null ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : visible.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
              <Presentation className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-medium">{q ? "Nenhuma apresentação encontrada." : "Você ainda não tem apresentações."}</p>
              {!q && <p className="mt-1 text-sm text-muted-foreground">Escolha um modelo acima para criar a primeira.</p>}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((r) => (
                <Link key={r.id} to="/workspace/slides/$id" params={{ id: r.id }}
                  className="group rounded-2xl border border-border bg-card p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex aspect-video items-center justify-center rounded-xl bg-secondary/60 text-primary"><Presentation className="h-6 w-6" /></div>
                  <div className="mt-2 truncate text-sm font-medium">{r.title}</div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="h-3 w-3" />{fmtDate(r.updated_at)}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {visible.map((r) => (
                <Link key={r.id} to="/workspace/slides/$id" params={{ id: r.id }}
                  className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-secondary/60">
                  <Presentation className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(r.updated_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
