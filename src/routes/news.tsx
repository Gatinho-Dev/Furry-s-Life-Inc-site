import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Plus, Trash2, Loader2, Pencil, X, Eye } from "lucide-react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { Markdown } from "@/lib/markdown";

export const Route = createFileRoute("/news")({
  head: () => ({
    meta: [
      { title: "Notícias — Furry's Life Inc." },
      { name: "description", content: "Comunicados oficiais, novidades e avisos da Furry's Life Inc. e suas subsidiárias." },
      { property: "og:title", content: "Notícias — Furry's Life Inc." },
      { property: "og:description", content: "Comunicados oficiais e novidades da holding." },
    ],
  }),
  component: NewsPage,
});

type Post = { id: string; title: string; subtitle: string | null; content: string; tag: string; published: boolean; created_at: string };
const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const TAGS = ["Comunicado", "Novidade", "Evento", "Atualização", "Imprensa"];

function NewsPage() {
  const auth = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [editing, setEditing] = useState<Post | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("news_posts")
      .select("id, title, subtitle, content, tag, published, created_at")
      .order("created_at", { ascending: false });
    setPosts((data ?? []) as Post[]);
  };
  useEffect(() => { load(); }, []);

  const canEdit = auth.isCeoOrAdmin;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pb-20 pt-32">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-primary">Notícias & avisos</div>
            <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">Centro de notícias</h1>
            <p className="mt-2 text-muted-foreground">Comunicados oficiais da holding e das subsidiárias.</p>
          </div>
          {canEdit && (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Nova notícia
            </button>
          )}
        </div>

        {showForm && canEdit && (
          <NewsEditor
            initial={editing}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onSaved={() => { setShowForm(false); setEditing(null); load(); }}
          />
        )}

        <div className="mt-10 space-y-6">
          {posts === null ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center text-sm text-muted-foreground">
              Nenhuma notícia publicada ainda.
            </div>
          ) : (
            posts.map((p) => (
              <article key={p.id} id={p.id} className="glass-card scroll-mt-28 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                    <span className="rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-foreground/80">{p.tag}</span>
                    {!p.published && <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-400">Rascunho</span>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(p); setShowForm(true); }} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={async () => { if (confirm("Excluir notícia?")) { await supabase.from("news_posts").delete().eq("id", p.id); load(); } }} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Excluir">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <h2 className="mt-3 font-display text-2xl font-bold leading-tight">{p.title}</h2>
                {p.subtitle && <p className="mt-1 text-base text-muted-foreground">{p.subtitle}</p>}
                <div className="mt-5"><Markdown source={p.content} /></div>
              </article>
            ))
          )}
        </div>

        <div className="mt-12 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Voltar ao início</Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function NewsEditor({ initial, onCancel, onSaved }: { initial: Post | null; onCancel: () => void; onSaved: () => void }) {
  const auth = useAuth();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [tag, setTag] = useState(initial?.tag ?? "Comunicado");
  const [published, setPublished] = useState(initial?.published ?? true);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setErr("Título e conteúdo são obrigatórios."); return; }
    setSaving(true); setErr(null);
    const payload = { title: title.trim(), subtitle: subtitle.trim() || null, content, tag, published };
    const res = initial
      ? await supabase.from("news_posts").update(payload).eq("id", initial.id)
      : await supabase.from("news_posts").insert({ ...payload, author_id: auth.user?.id ?? null });
    setSaving(false);
    if (res.error) { setErr(res.error.message); return; }
    onSaved();
  };

  const fmt = (wrap: string) => {
    const ta = document.getElementById("news-md") as HTMLTextAreaElement | null;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = content.slice(s, e) || "texto";
    const next = content.slice(0, s) + wrap + sel + wrap + content.slice(e);
    setContent(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + wrap.length, s + wrap.length + sel.length); }, 0);
  };
  const prefix = (p: string) => setContent((c) => c + (c.endsWith("\n") || !c ? "" : "\n") + p);

  return (
    <form onSubmit={save} className="mt-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">{initial ? "Editar notícia" : "Nova notícia"}</h2>
        <button type="button" onClick={onCancel} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <input className={`${fld} sm:col-span-2`} placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required />
        <select className={fld} value={tag} onChange={(e) => setTag(e.target.value)}>
          {TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className={`${fld} sm:col-span-3`} placeholder="Subtítulo (opcional)" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} maxLength={300} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-background/50 p-2 text-xs">
        <button type="button" onClick={() => fmt("**")} className="rounded px-2 py-1 font-bold hover:bg-secondary">B</button>
        <button type="button" onClick={() => fmt("*")} className="rounded px-2 py-1 italic hover:bg-secondary">I</button>
        <button type="button" onClick={() => fmt("`")} className="rounded px-2 py-1 font-mono hover:bg-secondary">{`< >`}</button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" onClick={() => prefix("# ")} className="rounded px-2 py-1 hover:bg-secondary">H1</button>
        <button type="button" onClick={() => prefix("## ")} className="rounded px-2 py-1 hover:bg-secondary">H2</button>
        <button type="button" onClick={() => prefix("### ")} className="rounded px-2 py-1 hover:bg-secondary">H3</button>
        <button type="button" onClick={() => prefix("- ")} className="rounded px-2 py-1 hover:bg-secondary">•&nbsp;Lista</button>
        <span className="ml-auto" />
        <button type="button" onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-secondary"><Eye className="h-3.5 w-3.5" />{preview ? "Editar" : "Pré-visualizar"}</button>
      </div>

      {preview ? (
        <div className="mt-2 min-h-[200px] rounded-xl border border-border bg-background/50 p-4">
          <Markdown source={content || "_Nada para pré-visualizar._"} />
        </div>
      ) : (
        <textarea
          id="news-md"
          className={`${fld} mt-2 min-h-[260px] font-mono text-[13px] leading-relaxed`}
          placeholder={"Escreva em markdown:\n\n# Título grande\n**negrito** *itálico*\n- item de lista"}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
        />
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="h-4 w-4 rounded border-border" />
          Publicar agora
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-secondary">Cancelar</button>
          <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {initial ? "Salvar alterações" : "Publicar notícia"}
          </button>
        </div>
      </div>
      {err && <div className="mt-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</div>}
    </form>
  );
}
