import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import {
  ArrowLeft, FileText, Undo2, Redo2, Bold, Italic, Underline as U, Strikethrough, Eraser, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent, Link2, Image as Img, Table as Tbl, Minus, CalendarDays, Share2, Printer, Check, Loader2, AlertCircle, WifiOff, X, Trash2, Folder,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { ddb, fmtDate, type DocRow, type DocShare } from "@/lib/workspace/docs";
import { docExtensions } from "@/components/workspace/docs/extensions";

export const Route = createFileRoute("/workspace/docs/$id")({
  head: () => ({
    meta: [
      { title: "Documento — Life Docs" },
      { name: "description", content: "Edite seu documento no Life Docs." },
      { property: "og:title", content: "Documento — Life Docs" },
      { property: "og:description", content: "Edite seu documento no Life Docs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DocEditor,
});

type Save = "saved" | "saving" | "dirty" | "error" | "offline" | "conflict";

function DocEditor() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const uid = auth.user?.id ?? "";
  const [doc, setDoc] = useState<DocRow | null>(null);
  const [role, setRole] = useState<"owner" | "editor" | "viewer" | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [save, setSave] = useState<Save>("saved");
  const [shareOpen, setShareOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const version = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ title?: string; content?: unknown; preview?: string }>({});
  const inflight = useRef(false);

  const flush = useCallback(async () => {
    if (inflight.current) { timer.current = setTimeout(flush, 400); return; }
    const patch = pending.current; if (!Object.keys(patch).length) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setSave("offline"); return; }
    pending.current = {}; inflight.current = true; setSave("saving");
    const { data, error } = await ddb.from("docs").update(patch).eq("id", id).eq("version", version.current).select("version");
    inflight.current = false;
    if (error || !data) { pending.current = { ...patch, ...pending.current }; setSave("error"); return; }
    if (data.length === 0) { pending.current = { ...patch, ...pending.current }; setSave("conflict"); return; }
    version.current = data[0].version;
    setSave(Object.keys(pending.current).length ? "dirty" : "saved");
    if (Object.keys(pending.current).length) timer.current = setTimeout(flush, 800);
  }, [id]);

  const queue = useCallback((p: typeof pending.current) => {
    pending.current = { ...pending.current, ...p }; setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 900);
  }, [flush]);

  const editor = useEditor({
    extensions: docExtensions(),
    content: "",
    editable: false,
    immediatelyRender: false,
    editorProps: { attributes: { class: "life-doc-content focus:outline-none", "aria-label": "Conteúdo do documento" } },
    onUpdate: ({ editor }) => queue({ content: editor.getJSON(), preview: editor.getText().slice(0, 300) }),
  });

  useEffect(() => {
    if (!uid || !editor) return;
    (async () => {
      const { data } = await ddb.from("docs").select("*").eq("id", id).maybeSingle();
      if (!data) { setMissing(true); return; }
      const { data: r } = await ddb.rpc("doc_role", { _doc: id, _uid: uid });
      setDoc(data); setTitle(data.title); version.current = data.version; setRole(r);
      editor.commands.setContent(data.content as object, false);
      editor.setEditable(r === "owner" || r === "editor");
    })();
  }, [uid, id, editor]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (Object.keys(pending.current).length || inflight.current) { e.preventDefault(); e.returnValue = ""; } };
    const online = () => { if (Object.keys(pending.current).length) flush(); };
    window.addEventListener("beforeunload", warn); window.addEventListener("online", online);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("online", online); };
  }, [flush]);

  const reloadLatest = async () => {
    const { data } = await ddb.from("docs").select("version").eq("id", id).single();
    if (data) { version.current = data.version; flush(); }
  };

  if (missing) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-center"><p className="font-medium">Documento não encontrado ou você não tem acesso.</p><Link to="/workspace/docs" className="text-sm text-primary underline">Voltar ao Life Docs</Link></div>;
  const canEdit = role === "owner" || role === "editor";

  return (
    <div className="flex min-h-screen flex-col bg-muted/50">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2 md:px-5">
          <Link to="/workspace/docs" aria-label="Voltar aos documentos" className="rounded-full p-2 hover:bg-muted"><ArrowLeft className="h-5 w-5" /></Link>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><FileText className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <input value={title} disabled={!canEdit} aria-label="Título do documento"
              onChange={(e) => { setTitle(e.target.value); queue({ title: e.target.value.trim() || "Documento sem título" }); }}
              className="w-full max-w-md truncate rounded-md bg-transparent px-1.5 py-0.5 font-medium outline-none hover:ring-1 hover:ring-border focus:ring-2 focus:ring-primary/40" />
            <div className="px-1.5 text-[11px] text-muted-foreground"><SaveState s={save} onRetry={save === "conflict" ? reloadLatest : flush} />{doc && <span className="hidden sm:inline"> · Editado {fmtDate(doc.updated_at)}</span>}{role === "viewer" && " · Somente leitura"}</div>
          </div>
          <button onClick={() => editor?.chain().focus().undo().run()} aria-label="Desfazer" className="rounded-full p-2 hover:bg-muted"><Undo2 className="h-4 w-4" /></button>
          <button onClick={() => editor?.chain().focus().redo().run()} aria-label="Refazer" className="rounded-full p-2 hover:bg-muted"><Redo2 className="h-4 w-4" /></button>
          <button onClick={() => window.print()} aria-label="Exportar PDF" title="Exportar PDF (escolha 'Salvar como PDF')" className="inline-flex items-center gap-1.5 rounded-full p-2 text-sm hover:bg-muted sm:px-3"><Printer className="h-4 w-4" /><span className="hidden sm:inline">PDF</span></button>
          {role === "owner" && doc && <button onClick={() => setFolderOpen(true)} aria-label="Pasta no Life Drive" title="Organizar no Life Drive" className="inline-flex items-center gap-1.5 rounded-full p-2 text-sm hover:bg-muted sm:px-3"><Folder className="h-4 w-4" /><span className="hidden md:inline">Pasta</span></button>}
          {role === "owner" && <button onClick={() => setShareOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Share2 className="h-4 w-4" /><span className="hidden sm:inline">Compartilhar</span></button>}
          <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase sm:flex" title={auth.user?.email ?? ""}>{auth.user?.email?.[0]}</div>
        </div>
        {editor && canEdit && <Toolbar editor={editor} />}
      </header>

      <main className="flex-1 overflow-x-hidden px-2 py-6 md:py-10">
        <div className="life-doc-page mx-auto w-full max-w-[816px] bg-background px-6 py-10 shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.06)] md:min-h-[1056px] md:px-[72px] md:py-[72px]" style={{ background: "white", color: "#1f2328" }}>
          {!doc && <div className="py-20 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>}
          <EditorContent editor={editor} />
        </div>
      </main>
      {folderOpen && doc && <FolderDialog doc={doc} onClose={() => setFolderOpen(false)} onMoved={(fid) => { setDoc({ ...doc, folder_id: fid }); version.current += 1; }} />}
      {shareOpen && doc && <ShareDialog doc={doc} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function SaveState({ s, onRetry }: { s: Save; onRetry: () => void }) {
  if (s === "saving") return <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Salvando...</span>;
  if (s === "dirty") return <span>Alterações não salvas</span>;
  if (s === "error") return <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />Erro ao salvar · <button className="underline" onClick={onRetry}>Tentar de novo</button></span>;
  if (s === "conflict") return <span className="inline-flex items-center gap-1 text-destructive"><AlertCircle className="h-3 w-3" />Outra pessoa editou · <button className="underline" onClick={onRetry}>Salvar minha versão</button></span>;
  if (s === "offline") return <span className="inline-flex items-center gap-1 text-amber-600"><WifiOff className="h-3 w-3" />Sem conexão — salvaremos ao reconectar</span>;
  return <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" />Salvo</span>;
}

function Toolbar({ editor }: { editor: Editor }) {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force((n) => n + 1); editor.on("transaction", f); return () => { editor.off("transaction", f); }; }, [editor]);
  const fileRef = useRef<HTMLInputElement>(null);
  const c = () => editor.chain().focus();

  const setLink = useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = prompt("Endereço do link (deixe vazio para remover)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) return c().unsetLink().run();
    if (!/^(https?:|mailto:)/i.test(url.trim())) return toast.error("Use um link começando com https:// ou mailto:");
    c().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }, [editor]); // eslint-disable-line
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && editor.isFocused) { e.preventDefault(); setLink(); } };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [editor, setLink]);

  const block = editor.isActive("heading", { level: 1 }) ? "h1" : editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";
  const indent = (d: number) => {
    const type = editor.isActive("heading") ? "heading" : "paragraph";
    const cur = Number(editor.getAttributes(type).indent || 0);
    c().updateAttributes(type, { indent: Math.max(0, Math.min(8, cur + d)) }).run();
  };
  const onImage = (f: File) => {
    if (!f.type.startsWith("image/")) return toast.error("Escolha um arquivo de imagem.");
    if (f.size > 2 * 1024 * 1024) return toast.error("Imagem muito grande (máx. 2 MB).");
    const r = new FileReader(); r.onload = () => c().setImage({ src: String(r.result), alt: f.name }).run(); r.readAsDataURL(f);
  };

  const B = ({ on, label, icon: I, run }: { on?: boolean; label: string; icon: typeof Bold; run: () => void }) => (
    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={run} aria-label={label} title={label} aria-pressed={on}
      className={`shrink-0 rounded-md p-1.5 ${on ? "bg-primary/15 text-primary" : "hover:bg-muted"}`}><I className="h-4 w-4" /></button>
  );
  const sel = "shrink-0 rounded-md border border-border bg-background px-1.5 py-1 text-xs";
  const Sep = () => <div className="mx-1 h-5 w-px shrink-0 bg-border" />;

  return (
    <div className="flex items-center gap-0.5 overflow-x-auto border-t border-border px-3 py-1.5 md:justify-center" role="toolbar" aria-label="Formatação">
      <select aria-label="Estilo do parágrafo" className={sel} value={block} onChange={(e) => {
        const v = e.target.value; if (v === "p") c().setParagraph().run(); else c().setHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
      }}>
        <option value="p">Texto normal</option><option value="h1">Título (H1)</option><option value="h2">Subtítulo (H2)</option><option value="h3">Cabeçalho (H3)</option>
      </select>
      <select aria-label="Fonte" className={sel} value={editor.getAttributes("textStyle").fontFamily ?? ""} onChange={(e) => e.target.value ? c().setFontFamily(e.target.value).run() : c().unsetFontFamily().run()}>
        <option value="">Padrão</option><option value="Georgia, serif">Georgia</option><option value="'Times New Roman', serif">Times</option><option value="Arial, sans-serif">Arial</option><option value="'Courier New', monospace">Courier</option>
      </select>
      <select aria-label="Tamanho da fonte" className={sel} value={editor.getAttributes("textStyle").fontSize ?? ""} onChange={(e) => c().setMark("textStyle", { fontSize: e.target.value || null }).run()}>
        <option value="">Tam.</option>{[10, 12, 14, 16, 18, 24, 32, 40].map((n) => <option key={n} value={`${n}px`}>{n}</option>)}
      </select>
      <Sep />
      <B label="Negrito (Ctrl+B)" icon={Bold} on={editor.isActive("bold")} run={() => c().toggleBold().run()} />
      <B label="Itálico (Ctrl+I)" icon={Italic} on={editor.isActive("italic")} run={() => c().toggleItalic().run()} />
      <B label="Sublinhado (Ctrl+U)" icon={U} on={editor.isActive("underline")} run={() => c().toggleUnderline().run()} />
      <B label="Tachado" icon={Strikethrough} on={editor.isActive("strike")} run={() => c().toggleStrike().run()} />
      <label className="relative shrink-0 cursor-pointer rounded-md p-1.5 hover:bg-muted" title="Cor do texto">
        <span className="block text-sm font-bold leading-4" style={{ borderBottom: `3px solid ${editor.getAttributes("textStyle").color ?? "#1f2328"}` }}>A</span>
        <input type="color" aria-label="Cor do texto" className="absolute inset-0 opacity-0" onChange={(e) => c().setColor(e.target.value).run()} />
      </label>
      <label className="relative shrink-0 cursor-pointer rounded-md p-1.5 hover:bg-muted" title="Realce">
        <span className="block rounded px-0.5 text-sm font-bold leading-4" style={{ background: "#fde68a" }}>A</span>
        <input type="color" defaultValue="#fde68a" aria-label="Cor de realce" className="absolute inset-0 opacity-0" onChange={(e) => c().setHighlight({ color: e.target.value }).run()} />
      </label>
      <B label="Limpar formatação" icon={Eraser} run={() => c().unsetAllMarks().clearNodes().run()} />
      <Sep />
      <B label="Alinhar à esquerda" icon={AlignLeft} on={editor.isActive({ textAlign: "left" })} run={() => c().setTextAlign("left").run()} />
      <B label="Centralizar" icon={AlignCenter} on={editor.isActive({ textAlign: "center" })} run={() => c().setTextAlign("center").run()} />
      <B label="Alinhar à direita" icon={AlignRight} on={editor.isActive({ textAlign: "right" })} run={() => c().setTextAlign("right").run()} />
      <B label="Justificar" icon={AlignJustify} on={editor.isActive({ textAlign: "justify" })} run={() => c().setTextAlign("justify").run()} />
      <B label="Lista com marcadores" icon={List} on={editor.isActive("bulletList")} run={() => c().toggleBulletList().run()} />
      <B label="Lista numerada" icon={ListOrdered} on={editor.isActive("orderedList")} run={() => c().toggleOrderedList().run()} />
      <B label="Diminuir recuo" icon={Outdent} run={() => editor.isActive("listItem") ? c().liftListItem("listItem").run() : indent(-1)} />
      <B label="Aumentar recuo" icon={Indent} run={() => editor.isActive("listItem") ? c().sinkListItem("listItem").run() : indent(1)} />
      <select aria-label="Espaçamento entre parágrafos" className={sel} value="" onChange={(e) => {
        const type = editor.isActive("heading") ? "heading" : "paragraph"; c().updateAttributes(type, { spacing: e.target.value || null }).run();
      }}>
        <option value="">Espaço</option><option value="0">Nenhum</option><option value="0.5em">Pequeno</option><option value="1.25em">Médio</option><option value="2em">Grande</option>
      </select>
      <Sep />
      <B label="Link (Ctrl+K)" icon={Link2} on={editor.isActive("link")} run={setLink} />
      <B label="Imagem" icon={Img} run={() => fileRef.current?.click()} />
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImage(f); e.target.value = ""; }} />
      <B label="Tabela" icon={Tbl} on={editor.isActive("table")} run={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
      {editor.isActive("table") && <>
        <button className="shrink-0 rounded-md px-1.5 py-1 text-xs hover:bg-muted" onClick={() => c().addRowAfter().run()}>+ Linha</button>
        <button className="shrink-0 rounded-md px-1.5 py-1 text-xs hover:bg-muted" onClick={() => c().addColumnAfter().run()}>+ Coluna</button>
        <B label="Excluir tabela" icon={Trash2} run={() => c().deleteTable().run()} />
      </>}
      <B label="Linha horizontal" icon={Minus} run={() => c().setHorizontalRule().run()} />
      <B label="Inserir data atual" icon={CalendarDays} run={() => c().insertContent(new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" })).run()} />
    </div>
  );
}

function ShareDialog({ doc, onClose }: { doc: DocRow; onClose: () => void }) {
  const [list, setList] = useState<DocShare[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"viewer" | "editor">("viewer");
  const load = async () => { const { data } = await ddb.from("doc_shares").select("*").eq("doc_id", doc.id); setList(data ?? []); };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: uid } = await ddb.rpc("docs_find_user", { _email: email });
    if (!uid) return toast.error("Nenhuma conta com esse e-mail.");
    if (uid === doc.owner_id) return toast.error("Você já é o dono.");
    const { error } = await ddb.from("doc_shares").upsert({ doc_id: doc.id, user_id: uid, email: email.trim().toLowerCase(), role });
    if (error) return toast.error("Não foi possível compartilhar.");
    toast.success("Acesso concedido."); setEmail(""); load();
  };
  const upd = async (s: DocShare, r: string) => { await ddb.from("doc_shares").update({ role: r }).eq("doc_id", s.doc_id).eq("user_id", s.user_id); load(); };
  const del = async (s: DocShare) => { await ddb.from("doc_shares").delete().eq("doc_id", s.doc_id).eq("user_id", s.user_id); load(); };
  const copy = async () => { await navigator.clipboard.writeText(window.location.href); toast.success("Link copiado. Só pessoas com acesso conseguem abrir."); };
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Compartilhar documento">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Compartilhar “{doc.title}”</h2><button aria-label="Fechar" onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button></div>
        <form onSubmit={add} className="mt-4 flex gap-2">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da pessoa" aria-label="E-mail" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={role} onChange={(e) => setRole(e.target.value as "viewer" | "editor")} aria-label="Permissão" className="rounded-lg border border-border bg-background px-2 text-sm"><option value="viewer">Leitor</option><option value="editor">Editor</option></select>
          <button className="rounded-lg bg-primary px-3 text-sm text-primary-foreground">Adicionar</button>
        </form>
        <div className="mt-4 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Pessoas com acesso</div>
          <div className="flex items-center justify-between text-sm"><span>Você</span><span className="text-xs text-muted-foreground">Proprietário</span></div>
          {list.map((s) => (
            <div key={s.user_id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{s.email}</span>
              <select value={s.role} onChange={(e) => upd(s, e.target.value)} aria-label="Permissão" className="rounded-md border border-border bg-background px-1.5 py-1 text-xs"><option value="viewer">Leitor</option><option value="editor">Editor</option></select>
              <button aria-label="Remover acesso" onClick={() => del(s)} className="rounded-full p-1 text-destructive hover:bg-muted"><X className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <button onClick={copy} className="mt-5 w-full rounded-lg border border-border py-2 text-sm hover:bg-muted">Copiar link</button>
      </div>
    </div>
  );
}

function FolderDialog({ doc, onClose, onMoved }: { doc: DocRow; onClose: () => void; onMoved: (f: string | null) => void }) {
  const [folders, setFolders] = useState<{ id: string; name: string; parent_id: string | null }[] | null>(null);
  useEffect(() => { ddb.from("drive_folders").select("id,name,parent_id").eq("owner_id", doc.owner_id).is("trashed_at", null).then(({ data }: { data: { id: string; name: string; parent_id: string | null }[] | null }) => setFolders(data ?? [])); }, [doc.owner_id]);
  const path = (id: string): string => { const f = folders?.find((x) => x.id === id); if (!f) return ""; return f.parent_id ? `${path(f.parent_id)} / ${f.name}` : f.name; };
  const opts = (folders ?? []).map((f) => ({ id: f.id, label: path(f.id) })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  const move = async (fid: string | null) => {
    const { data, error } = await ddb.from("docs").update({ folder_id: fid }).eq("id", doc.id).select("version");
    if (error || !data?.length) return toast.error("Não foi possível mover o documento.");
    onMoved(fid); toast.success(fid ? `Movido para ${path(fid)}` : "Movido para Meu Drive"); onClose();
  };
  return (
    <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label="Organizar no Life Drive">
      <div className="w-full max-w-md rounded-2xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Organizar no Life Drive</h2><button aria-label="Fechar" onClick={onClose} className="rounded-full p-1 hover:bg-muted"><X className="h-4 w-4" /></button></div>
        <p className="mt-1 text-sm text-muted-foreground">Pasta atual: {doc.folder_id ? path(doc.folder_id) || "…" : "Meu Drive"}</p>
        <div className="mt-4 max-h-72 space-y-1 overflow-y-auto">
          {folders === null ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : <>
            <button onClick={() => move(null)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${!doc.folder_id ? "bg-primary/10" : ""}`}><Folder className="h-4 w-4" />Meu Drive</button>
            {opts.map((o) => <button key={o.id} onClick={() => move(o.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${doc.folder_id === o.id ? "bg-primary/10" : ""}`}><Folder className="h-4 w-4 text-primary" />{o.label}</button>)}
            {opts.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Você ainda não tem pastas no Life Drive.</p>}
          </>}
        </div>
      </div>
    </div>
  );
}
