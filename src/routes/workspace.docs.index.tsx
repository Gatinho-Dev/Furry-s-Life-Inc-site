import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, Plus, Search, LayoutGrid, List, Star, Trash2, RotateCcw, Copy, Pencil, Users, Clock, MoreVertical, Upload, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { ddb, DOC_TEMPLATES, createDoc, fmtDate, type DocRow } from "@/lib/workspace/docs";

export const Route = createFileRoute("/workspace/docs/")({
  head: () => ({
    meta: [
      { title: "Life Docs — Life Workspace" },
      { name: "description", content: "Seu espaço para escrever, criar e colaborar no Life Workspace da Furry's Life." },
      { property: "og:title", content: "Life Docs — Life Workspace" },
      { property: "og:description", content: "Seu espaço para escrever, criar e colaborar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocsHome,
});

type Tab = "recent" | "mine" | "shared" | "fav" | "trash";
const TABS: { key: Tab; label: string; icon: typeof Clock }[] = [
  { key: "recent", label: "Recentes", icon: Clock },
  { key: "mine", label: "Meus documentos", icon: FileText },
  { key: "shared", label: "Compartilhados comigo", icon: Users },
  { key: "fav", label: "Favoritos", icon: Star },
  { key: "trash", label: "Lixeira", icon: Trash2 },
];

function DocsHome() {
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const nav = useNavigate();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [sharedIds, setSharedIds] = useState<Set<string>>(new Set());
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>("recent");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "name">("date");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menu, setMenu] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = async () => {
    const [d, f, s] = await Promise.all([
      ddb.from("docs").select("id,owner_id,title,preview,folder_id,trashed_at,version,created_at,updated_at").order("updated_at", { ascending: false }),
      ddb.from("doc_favorites").select("doc_id").eq("user_id", uid),
      ddb.from("doc_shares").select("doc_id,user_id"),
    ]);
    if (d.error) { toast.error("Não foi possível carregar os documentos."); setDocs([]); return; }
    setDocs(d.data);
    setFavs(new Set((f.data ?? []).map((x: { doc_id: string }) => x.doc_id)));
    setSharedIds(new Set((s.data ?? []).map((x: { doc_id: string }) => x.doc_id)));
    const ids = [...new Set((d.data as DocRow[]).map((x) => x.owner_id))];
    const { data: em } = await ddb.rpc("docs_owner_emails", { _ids: ids });
    setOwners(Object.fromEntries((em ?? []).map((r: { id: string; email: string }) => [r.id, r.email])));
  };
  useEffect(() => { if (uid) load(); }, [uid]); // eslint-disable-line

  const newDoc = async (key = "blank") => {
    const t = DOC_TEMPLATES.find((x) => x.key === key)!;
    try { const id = await createDoc(uid, t.title, t.content); nav({ to: "/workspace/docs/$id", params: { id } }); }
    catch { toast.error("Erro ao criar o documento."); }
  };

  const importDocx = async (file: File) => {
    setImporting(true);
    try {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      if (!value.trim()) throw new Error("vazio");
      const { generateJSON } = await import("@tiptap/react");
      const { docExtensions } = await import("@/components/workspace/docs/extensions");
      const json = generateJSON(value, docExtensions());
      const id = await createDoc(uid, file.name.replace(/\.docx$/i, ""), json);
      toast.success("Documento importado.");
      nav({ to: "/workspace/docs/$id", params: { id } });
    } catch { toast.error("Não foi possível importar este arquivo DOCX."); }
    setImporting(false);
  };

  const act = async (d: DocRow, a: string) => {
    setMenu(null);
    let r: { error: unknown } = { error: null };
    if (a === "rename") { const t = prompt("Novo nome", d.title); if (!t?.trim()) return; r = await ddb.from("docs").update({ title: t.trim() }).eq("id", d.id); }
    if (a === "fav") r = favs.has(d.id) ? await ddb.from("doc_favorites").delete().eq("doc_id", d.id).eq("user_id", uid) : await ddb.from("doc_favorites").insert({ doc_id: d.id, user_id: uid });
    if (a === "trash") r = await ddb.from("docs").update({ trashed_at: new Date().toISOString() }).eq("id", d.id);
    if (a === "restore") r = await ddb.from("docs").update({ trashed_at: null }).eq("id", d.id);
    if (a === "delete") { if (!confirm(`Excluir “${d.title}” definitivamente? Isso não pode ser desfeito.`)) return; r = await ddb.from("docs").delete().eq("id", d.id); }
    if (a === "dup") {
      const { data } = await ddb.from("docs").select("content,title").eq("id", d.id).single();
      try { await createDoc(uid, `Cópia de ${data.title}`, data.content); } catch (e) { r = { error: e }; }
    }
    if (r.error) toast.error("A ação não pôde ser concluída."); else load();
  };

  const list = useMemo(() => {
    let l = docs ?? [];
    l = tab === "trash" ? l.filter((d) => d.trashed_at && d.owner_id === uid) : l.filter((d) => !d.trashed_at);
    if (tab === "mine") l = l.filter((d) => d.owner_id === uid);
    if (tab === "shared") l = l.filter((d) => d.owner_id !== uid);
    if (tab === "fav") l = l.filter((d) => favs.has(d.id));
    if (tab === "recent") l = l.slice(0, 30);
    if (q) l = l.filter((d) => d.title.toLowerCase().includes(q.toLowerCase()));
    return [...l].sort((a, b) => sort === "name" ? a.title.localeCompare(b.title, "pt-BR") : b.updated_at.localeCompare(a.updated_at));
  }, [docs, tab, q, sort, favs, uid]);

  const Menu = ({ d }: { d: DocRow }) => (
    <div className="absolute right-2 top-10 z-30 w-48 rounded-xl border border-border bg-popover p-1 text-sm shadow-lg" role="menu">
      {tab === "trash" ? (<>
        <MI icon={RotateCcw} label="Restaurar" onClick={() => act(d, "restore")} />
        <MI icon={Trash2} label="Excluir definitivamente" danger onClick={() => act(d, "delete")} />
      </>) : (<>
        <MI icon={FileText} label="Abrir" onClick={() => nav({ to: "/workspace/docs/$id", params: { id: d.id } })} />
        <MI icon={Pencil} label="Renomear" onClick={() => act(d, "rename")} />
        <MI icon={Star} label={favs.has(d.id) ? "Remover dos favoritos" : "Favoritar"} onClick={() => act(d, "fav")} />
        <MI icon={Copy} label="Duplicar" onClick={() => act(d, "dup")} />
        {d.owner_id === uid && <MI icon={Trash2} label="Mover para a lixeira" danger onClick={() => act(d, "trash")} />}
      </>)}
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30" onClick={() => setMenu(null)}>
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-background/80 px-5 py-3 backdrop-blur md:px-8">
        <Link to="/workspace" className="flex items-center gap-2.5" aria-label="Voltar ao Life Workspace">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><FileText className="h-5 w-5" /></div>
          <div className="leading-tight"><div className="font-display text-base font-semibold">Life Docs</div><div className="text-[11px] text-muted-foreground">Life Workspace</div></div>
        </Link>
        <label className="relative order-3 w-full md:order-none md:mx-6 md:max-w-xl md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar documentos" aria-label="Pesquisar documentos"
            className="w-full rounded-full border border-border bg-muted/50 py-2 pl-9 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/40" />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/workspace/drive" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted sm:block">Life Drive</Link>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm hover:bg-muted">
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Importar DOCX
            <input type="file" accept=".docx" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) importDocx(f); e.target.value = ""; }} />
          </label>
          <button onClick={() => newDoc()} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Novo documento
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase" title={auth.user?.email ?? ""}>{auth.user?.email?.[0]}</div>
        </div>
      </header>

      <section className="border-b border-border bg-background px-5 py-8 md:px-8">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground">Comece um novo documento</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {DOC_TEMPLATES.map((t) => (
            <button key={t.key} onClick={() => newDoc(t.key)} className="group shrink-0 text-left">
              <div className="flex h-40 w-32 items-center justify-center rounded-lg border border-border bg-card shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-md">
                {t.key === "blank" ? <Plus className="h-8 w-8 text-primary" /> : <div className="w-20 space-y-1.5">{[90, 60, 80, 70, 50].map((w, i) => <div key={i} className="h-1.5 rounded bg-muted" style={{ width: `${w}%` }} />)}</div>}
              </div>
              <div className="mt-2 text-sm font-medium">{t.name}</div>
            </button>
          ))}
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-5 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <select value={sort} onChange={(e) => setSort(e.target.value as "date" | "name")} aria-label="Ordenar" className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
              <option value="date">Última modificação</option><option value="name">Nome</option>
            </select>
            <button aria-label="Grade" onClick={() => setView("grid")} className={`rounded-lg p-2 ${view === "grid" ? "bg-muted" : ""}`}><LayoutGrid className="h-4 w-4" /></button>
            <button aria-label="Lista" onClick={() => setView("list")} className={`rounded-lg p-2 ${view === "list" ? "bg-muted" : ""}`}><List className="h-4 w-4" /></button>
          </div>
        </div>

        {docs === null ? <div className="py-20 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border bg-background py-16 text-center">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">{q ? "Nenhum documento encontrado." : tab === "trash" ? "A lixeira está vazia." : "Nenhum documento aqui ainda."}</p>
            {tab !== "trash" && !q && <button onClick={() => newDoc()} className="mt-4 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">Criar meu primeiro documento</button>}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {list.map((d) => (
              <div key={d.id} className="relative rounded-2xl border border-border bg-card transition hover:shadow-md">
                <Link to="/workspace/docs/$id" params={{ id: d.id }} className="block">
                  <div className="h-36 overflow-hidden rounded-t-2xl border-b border-border bg-background p-4 text-[10px] leading-snug text-muted-foreground">{d.preview || "Documento vazio"}</div>
                  <div className="p-3">
                    <div className="flex items-center gap-1.5 truncate text-sm font-medium"><FileText className="h-4 w-4 shrink-0 text-primary" />{d.title}{favs.has(d.id) && <Star className="h-3 w-3 fill-current text-amber-500" aria-label="Favorito" />}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">{fmtDate(d.updated_at)}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.owner_id === uid ? "Você" : owners[d.owner_id] ?? "—"}{(sharedIds.has(d.id) || d.owner_id !== uid) && " · Compartilhado"}</div>
                  </div>
                </Link>
                <button aria-label="Ações" onClick={(e) => { e.stopPropagation(); setMenu(menu === d.id ? null : d.id); }} className="absolute bottom-3 right-2 rounded-full p-1.5 hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
                {menu === d.id && <div onClick={(e) => e.stopPropagation()} className="absolute bottom-0 right-0"><Menu d={d} /></div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-border rounded-2xl border border-border bg-card">
            {list.map((d) => (
              <div key={d.id} className="relative flex items-center gap-3 px-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <Link to="/workspace/docs/$id" params={{ id: d.id }} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{d.preview}</div>
                </Link>
                <div className="hidden w-48 truncate text-xs text-muted-foreground md:block">{d.owner_id === uid ? "Você" : owners[d.owner_id]}</div>
                <div className="hidden w-40 text-xs text-muted-foreground sm:block">{fmtDate(d.updated_at)}</div>
                <div className="w-24 text-xs text-muted-foreground">{sharedIds.has(d.id) || d.owner_id !== uid ? "Compartilhado" : "Privado"}</div>
                <button aria-label="Ações" onClick={(e) => { e.stopPropagation(); setMenu(menu === d.id ? null : d.id); }} className="rounded-full p-1.5 hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
                {menu === d.id && <div onClick={(e) => e.stopPropagation()}><Menu d={d} /></div>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MI({ icon: I, label, onClick, danger }: { icon: typeof Clock; label: string; onClick: () => void; danger?: boolean }) {
  return <button role="menuitem" onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-muted ${danger ? "text-destructive" : ""}`}><I className="h-4 w-4" />{label}</button>;
}
