import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardList, Plus, Sparkles, Loader2, Search, Trash2, Users, LayoutGrid } from "lucide-react";
import symbol from "@/assets/fli-symbol.png.asset.json";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { TEMPLATES, themeColor, type Field, type FormRow } from "@/lib/workspace/forms";
import { generateFormWithAI } from "@/lib/workspace/forms-ai.functions";

export const Route = createFileRoute("/workspace/forms/")({
  head: () => ({
    meta: [
      { title: "Life Forms — Life Workspace" },
      { name: "description", content: "Crie, publique e analise formulários com o Life Forms da Furry's Life." },
      { property: "og:title", content: "Life Forms — Life Workspace" },
      { property: "og:description", content: "Crie, publique e analise formulários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FormsHome,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const STATUS: Record<string, string> = { draft: "Rascunho", published: "Publicado", closed: "Encerrado" };

function FormsHome() {
  const auth = useAuth();
  const nav = useNavigate();
  const ai = useServerFn(generateFormWithAI);
  const [forms, setForms] = useState<(FormRow & { count: number })[] | null>(null);
  const [q, setQ] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await db.from("forms").select("*, form_responses(count)").order("updated_at", { ascending: false });
    if (error) return toast.error(error.message);
    // só os meus e os que colaboro (não listar todos os publicados)
    const { data: collab } = await db.from("form_collaborators").select("form_id").eq("user_id", (auth.user?.id ?? ""));
    const mine = new Set((collab ?? []).map((c: { form_id: string }) => c.form_id));
    setForms(data.filter((f: FormRow) => f.owner_id === (auth.user?.id ?? "") || mine.has(f.id))
      .map((f: FormRow & { form_responses: { count: number }[] }) => ({ ...f, count: f.form_responses?.[0]?.count ?? 0 })));
  };
  useEffect(() => { if (auth.user) load(); }, [auth.user?.id]); // eslint-disable-line

  const create = async (title: string, fields: Field[], theme: string, description = "") => {
    const { data, error } = await db.from("forms").insert({ owner_id: (auth.user?.id ?? ""), title, description, fields, settings: { theme, accepting: true } }).select("id").single();
    if (error) return toast.error(error.message);
    nav({ to: "/workspace/forms/$id", params: { id: data.id } });
  };
  const fromAI = async (e: React.FormEvent) => {
    e.preventDefault(); if (prompt.trim().length < 3) return;
    setBusy(true);
    try { const r = await ai({ data: { prompt } }); await create(r.title, r.fields as Field[], "violet", r.description); }
    catch (er) { toast.error((er as Error).message); }
    setBusy(false);
  };
  const remove = async (f: FormRow) => {
    if (!confirm(`Excluir “${f.title}” e todas as respostas?`)) return;
    await db.from("forms").delete().eq("id", f.id); load();
  };

  const list = (forms ?? []).filter((f) => f.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-background/80 px-5 py-3 backdrop-blur md:px-8">
        <Link to="/workspace" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl text-primary-foreground" style={{ background: themeColor("violet") }}><ClipboardList className="h-5 w-5" /></div>
          <div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Life Workspace</div><div className="font-display text-base font-bold leading-tight">Life Forms</div></div>
        </Link>
        <div className="relative ml-4 hidden max-w-md flex-1 sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar formulários" className="w-full rounded-full border border-border bg-secondary/60 py-2 pl-10 pr-4 text-sm outline-none focus:bg-card focus:ring-4 focus:ring-primary/10" />
        </div>
        <Link to="/workspace" className="ml-auto rounded-full p-2 text-muted-foreground hover:bg-secondary" title="Todas as ferramentas"><LayoutGrid className="h-5 w-5" /></Link>
        <img src={symbol.url} alt="" className="h-7 w-7" />
      </header>

      <section className="border-b border-border bg-secondary/40 px-5 py-8 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-display text-2xl font-bold">Criar um formulário</h1>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TEMPLATES.map((t) => (
              <button key={t.key} onClick={() => create(t.title, t.fields(), t.theme)} className="group text-left">
                <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-border bg-card transition group-hover:-translate-y-0.5 group-hover:shadow-lg" style={{ borderTop: `6px solid ${themeColor(t.theme)}` }}>
                  {t.key === "blank" ? <Plus className="h-10 w-10" style={{ color: themeColor(t.theme) }} /> : <ClipboardList className="h-9 w-9 opacity-60" style={{ color: themeColor(t.theme) }} />}
                </div>
                <div className="mt-2 text-sm font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.description}</div>
              </button>
            ))}
          </div>
          <form onSubmit={fromAI} className="mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
            <Sparkles className="ml-1 hidden h-5 w-5 text-primary sm:block" />
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva o formulário e a IA monta para você. Ex: pesquisa de clima para a equipe de TI"
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none" />
            <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Gerar com IA
            </button>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        <h2 className="mb-4 text-sm font-semibold text-muted-foreground">Formulários recentes</h2>
        {!forms ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
          : !list.length ? <div className="rounded-3xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">Nenhum formulário ainda. Escolha um modelo acima.</div>
          : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((f) => (
                <div key={f.id} className="group relative rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg" style={{ borderLeft: `5px solid ${themeColor(f.settings?.theme)}` }}>
                  <Link to="/workspace/forms/$id" params={{ id: f.id }} className="block">
                    <div className="truncate font-semibold">{f.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`rounded-full px-2 py-0.5 ${f.status === "published" ? "bg-success/15 text-success" : "bg-secondary"}`}>{STATUS[f.status]}</span>
                      <span>{f.count} resposta(s)</span>
                      {f.owner_id !== (auth.user?.id ?? "") && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />Compartilhado</span>}
                    </div>
                    <div className="mt-3 text-xs text-muted-foreground">Editado {new Date(f.updated_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</div>
                  </Link>
                  {f.owner_id === (auth.user?.id ?? "") && <button onClick={() => remove(f)} aria-label="Excluir" className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>}
                </div>
              ))}
            </div>
          )}
      </main>
    </div>
  );
}
