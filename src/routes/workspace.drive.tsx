import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ddb, DOC_TEMPLATES, createDoc, fmtDate as fmtDocDate, type DocRow } from "@/lib/workspace/docs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Home, HardDrive, Star, Clock, Users, Trash2, Settings, HelpCircle, Search, Plus, FolderPlus, Upload, FolderUp,
  LayoutGrid, List, MoreVertical, Folder, FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet, File as FileIcon,
  ChevronRight, Download, Share2, Link2, Pencil, Move, Info, Eye, ExternalLink, RotateCcw, X, ArrowUpDown, Loader2, CheckCircle2,
} from "lucide-react";
import { WorkspaceShell, type NavItem } from "@/components/workspace/WorkspaceShell";
import { useAuth } from "@/lib/use-auth";
import { PERMISSION_LABEL, type Permission } from "@/lib/workspace/apps";
import * as api from "@/lib/workspace/drive-api";
import type { DriveFile, DriveFolder, DriveShare, Item } from "@/lib/workspace/drive-api";

export const Route = createFileRoute("/workspace/drive")({
  validateSearch: (s: Record<string, unknown>) => ({ folder: typeof s.folder === "string" ? s.folder : undefined }),
  head: () => ({
    meta: [
      { title: "Life Drive — Life Workspace" },
      { name: "description", content: "Armazene, organize e compartilhe seus arquivos no Life Drive da Furry's Life." },
      { property: "og:title", content: "Life Drive — Life Workspace" },
      { property: "og:description", content: "Armazene, organize e compartilhe seus arquivos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DrivePage,
});

type View = "home" | "drive" | "favorites" | "recent" | "shared" | "trash" | "settings" | "help";
const NAV: NavItem<View>[] = [
  { key: "home", label: "Início", icon: Home },
  { key: "drive", label: "Meu Drive", icon: HardDrive },
  { key: "favorites", label: "Favoritos", icon: Star },
  { key: "recent", label: "Recentes", icon: Clock },
  { key: "shared", label: "Compartilhados comigo", icon: Users },
  { key: "trash", label: "Lixeira", icon: Trash2 },
];
const BOTTOM: NavItem<View>[] = [
  { key: "settings", label: "Configurações", icon: Settings },
  { key: "help", label: "Ajuda", icon: HelpCircle },
];
type Sort = "name" | "updated" | "size";

function fileVisual(f: DriveFile) {
  const n = f.name.toLowerCase(); const m = f.mime_type;
  if (m.startsWith("image/")) return { Icon: FileImage, tone: "text-sky-500 bg-sky-500/10", label: "Imagem" };
  if (m === "application/pdf" || n.endsWith(".pdf")) return { Icon: FileText, tone: "text-rose-500 bg-rose-500/10", label: "PDF" };
  if (m.startsWith("video/")) return { Icon: FileVideo, tone: "text-violet-500 bg-violet-500/10", label: "Vídeo" };
  if (m.startsWith("audio/")) return { Icon: FileAudio, tone: "text-amber-500 bg-amber-500/10", label: "Áudio" };
  if (/\.(zip|rar|7z|tar|gz)$/.test(n)) return { Icon: FileArchive, tone: "text-orange-500 bg-orange-500/10", label: "Compactado" };
  if (/\.(xlsx?|csv|ods)$/.test(n)) return { Icon: FileSpreadsheet, tone: "text-emerald-500 bg-emerald-500/10", label: "Planilha" };
  if (/\.(docx?|odt|rtf|txt|md)$/.test(n)) return { Icon: FileText, tone: "text-blue-500 bg-blue-500/10", label: "Documento" };
  return { Icon: FileIcon, tone: "text-muted-foreground bg-secondary", label: "Arquivo" };
}
const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

type Upload = { id: string; name: string; progress: number; done: boolean; error?: string };

function DrivePage() {
  const auth = useAuth();
  const me = auth.user?.id ?? "";
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [view, setView] = useState<View>("home");
  const [layout, setLayout] = useState<"grid" | "list">(() => (typeof localStorage !== "undefined" && (localStorage.getItem("lw-drive-layout") as "grid" | "list")) || "grid");
  const [sort, setSort] = useState<Sort>("name");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ folders: DriveFolder[]; files: DriveFile[]; favorites: Set<string>; shares: DriveShare[] } | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [menu, setMenu] = useState<{ item: Item; x: number; y: number } | null>(null);
  const [dialog, setDialog] = useState<null | { type: "newFolder" } | { type: "rename" | "move" | "share" | "info" | "preview"; item: Item }>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const folderId = view === "drive" || view === "shared" ? search.folder ?? null : null;
  const routerNav = useNavigate();
  const newDocHere = async () => {
    setNewOpen(false);
    try { const t = DOC_TEMPLATES[0]; const id = await createDoc(me, t.title, t.content, view === "drive" ? folderId : null); routerNav({ to: "/workspace/docs/$id", params: { id } }); }
    catch { toast.error("Não foi possível criar o documento."); }
  };

  const reload = useCallback(async () => {
    try { setData(await api.listAll()); } catch (e) { toast.error((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { localStorage.setItem("lw-drive-layout", layout); }, [layout]);
  useEffect(() => { if (search.folder && view === "home") setView("drive"); }, [search.folder]); // eslint-disable-line

  const go = (v: View) => { setView(v); setQ(""); navigate({ search: { folder: undefined } }); };
  const openFolder = (id: string) => navigate({ search: { folder: id } });

  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const F: Item[] = data.folders.map((f) => ({ kind: "folder", ...f }));
    const D: Item[] = data.files.map((f) => ({ kind: "file", ...f }));
    let list: Item[];
    const live = (i: Item) => !i.trashed_at;
    const parentOf = (i: Item) => (i.kind === "file" ? i.folder_id : i.parent_id);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = [...F, ...D].filter((i) => live(i) && i.name.toLowerCase().includes(s));
    } else switch (view) {
      case "drive": list = [...F, ...D].filter((i) => live(i) && i.owner_id === me && parentOf(i) === folderId); break;
      case "favorites": list = [...F, ...D].filter((i) => live(i) && data.favorites.has(i.id)); break;
      case "recent": list = D.filter(live).sort((a, b) => +new Date((b as DriveFile).last_opened_at ?? b.updated_at) - +new Date((a as DriveFile).last_opened_at ?? a.updated_at)).slice(0, 50); return list;
      case "shared": list = folderId ? [...F, ...D].filter((i) => live(i) && parentOf(i) === folderId) : [...F, ...D].filter((i) => live(i) && i.owner_id !== me); break;
      case "trash": list = [...F, ...D].filter((i) => i.owner_id === me && i.trashed_at); break;
      case "home": list = D.filter((i) => live(i) && i.owner_id === me).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 12); return list;
      default: list = [];
    }
    const cmp = (a: Item, b: Item) => sort === "name" ? a.name.localeCompare(b.name) : sort === "updated" ? +new Date(b.updated_at) - +new Date(a.updated_at)
      : (b.kind === "file" ? b.size_bytes : 0) - (a.kind === "file" ? a.size_bytes : 0);
    return list.sort((a, b) => (a.kind === b.kind ? cmp(a, b) : a.kind === "folder" ? -1 : 1));
  }, [data, view, q, sort, folderId, me]);

  const crumbs = useMemo(() => {
    const out: DriveFolder[] = [];
    let id = folderId;
    while (id && data) { const f = data.folders.find((x) => x.id === id); if (!f) break; out.unshift(f); id = f.parent_id; }
    return out;
  }, [folderId, data]);

  // ---------- upload ----------
  const doUpload = async (files: File[], keepPaths = false) => {
    if (view !== "drive") { setView("drive"); }
    const target = view === "drive" ? folderId : null;
    const cache = new Map<string, string>();
    for (const file of files) {
      const id = crypto.randomUUID();
      setUploads((u) => [...u, { id, name: file.name, progress: 0, done: false }]);
      try {
        let dest = target;
        const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
        if (keepPaths && rel) { const parts = rel.split("/").slice(0, -1); dest = await api.ensurePath(parts, target, cache); }
        await api.uploadFile(file, dest, (p) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: 1, done: true } : x)));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, done: true, error: (e as Error).message } : x)));
      }
    }
    toast.success(files.length > 1 ? `${files.length} arquivos enviados` : "Upload concluído");
    reload();
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const fs = Array.from(e.dataTransfer.files);
    if (fs.length) doUpload(fs);
  };

  // ---------- actions ----------
  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast.success(msg); await reload(); } catch (e) { toast.error((e as Error).message); }
  };
  const open = async (item: Item) => {
    if (item.kind === "folder") { if (view !== "drive" && view !== "shared") setView(item.owner_id === me ? "drive" : "shared"); openFolder(item.id); return; }
    api.touchOpened(item.id);
    setDialog({ type: "preview", item });
  };
  const copyLink = async (item: Item) => {
    const url = item.kind === "folder" ? `${location.origin}/workspace/drive?folder=${item.id}` : await api.signedUrl(item);
    await navigator.clipboard.writeText(url);
    toast.success(item.kind === "folder" ? "Link copiado (acesso para quem tem permissão)" : "Link copiado — válido por 1 hora");
  };
  const download = async (f: DriveFile) => { const u = await api.signedUrl(f, true); const a = document.createElement("a"); a.href = u; a.click(); };

  const onContext = (e: React.MouseEvent, item: Item) => { e.preventDefault(); setMenu({ item, x: e.clientX, y: e.clientY }); };
  const title = q ? `Resultados para “${q}”` : NAV.concat(BOTTOM).find((n) => n.key === view)?.label;

  return (
    <WorkspaceShell product="Life Drive" nav={NAV} bottomNav={BOTTOM} active={view} onSelect={go}
      header={
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar no Life Drive"
              className="w-full rounded-full border border-border bg-secondary/60 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10" />
          </div>
        </div>
      }>
      <div className="relative min-h-full p-4 md:p-8"
        onDragOver={(e) => { e.preventDefault(); if (view !== "trash") setDragging(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={onDrop}>
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) doUpload(f); }} />
        <input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: "", directory: "" }} onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (f.length) doUpload(f, true); }} />

        {/* toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative">
            <button onClick={() => setNewOpen((o) => !o)} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0">
              <Plus className="h-4 w-4" /> Novo
            </button>
            {newOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setNewOpen(false)} />
                <div className="animate-spring-in absolute left-0 top-full z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-border bg-popover p-1.5 shadow-2xl">
                  <MenuBtn icon={FolderPlus} label="Nova pasta" onClick={() => { setNewOpen(false); setView("drive"); setDialog({ type: "newFolder" }); }} />
                  <MenuBtn icon={FileText} label="Documento do Life Docs" onClick={newDocHere} />
                  <div className="my-1 h-px bg-border" />
                  <MenuBtn icon={Upload} label="Enviar arquivo" onClick={() => { setNewOpen(false); fileInput.current?.click(); }} />
                  <MenuBtn icon={FolderUp} label="Enviar pasta" onClick={() => { setNewOpen(false); folderInput.current?.click(); }} />
                </div>
              </>
            )}
          </div>
          <h1 className="font-display text-xl font-bold md:text-2xl">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {!["home", "recent", "settings", "help"].includes(view) && (
              <label className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="bg-transparent text-foreground outline-none">
                  <option value="name">Nome</option><option value="updated">Modificação</option><option value="size">Tamanho</option>
                </select>
              </label>
            )}
            <div className="flex rounded-xl border border-border p-0.5">
              {(["grid", "list"] as const).map((l) => {
                const I = l === "grid" ? LayoutGrid : List;
                return <button key={l} onClick={() => setLayout(l)} aria-label={l} className={`rounded-lg p-2 transition ${layout === l ? "bg-secondary text-foreground" : "text-muted-foreground"}`}><I className="h-4 w-4" /></button>;
              })}
            </div>
          </div>
        </div>

        {(view === "drive" || view === "shared") && folderId && !q && (
          <div className="mb-5 flex flex-wrap items-center gap-1 text-sm">
            <button onClick={() => navigate({ search: { folder: undefined } })} className="rounded-lg px-2 py-1 text-muted-foreground hover:bg-secondary">{view === "drive" ? "Meu Drive" : "Compartilhados"}</button>
            {crumbs.map((c) => (
              <span key={c.id} className="flex items-center gap-1"><ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button onClick={() => openFolder(c.id)} className="rounded-lg px-2 py-1 font-medium hover:bg-secondary">{c.name}</button></span>
            ))}
          </div>
        )}

        {data && (view === "home" || view === "drive") && <DocsStrip me={me} folderId={view === "drive" ? folderId : undefined} q={q} />}

        {view === "settings" && !q ? <SettingsPanel data={data} me={me} layout={layout} setLayout={setLayout} />
          : view === "help" && !q ? <HelpPanel />
          : !data ? <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : items.length === 0 ? <Empty view={view} onUpload={() => fileInput.current?.click()} />
          : (
            <>
              {view === "home" && !q && <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arquivos recentes</div>}
              {view === "trash" && <div className="mb-4 rounded-2xl border border-border bg-secondary/50 px-4 py-3 text-sm text-muted-foreground">Itens na lixeira podem ser restaurados ou excluídos permanentemente.</div>}
              {layout === "grid" ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {items.map((i) => <GridCard key={i.id} item={i} fav={data.favorites.has(i.id)} onOpen={() => open(i)} onMenu={(e) => onContext(e, i)} />)}
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="hidden grid-cols-[1fr_140px_140px_100px_44px] gap-3 border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
                    <span>Nome</span><span>Proprietário</span><span>Modificado</span><span>Tamanho</span><span />
                  </div>
                  {items.map((i) => <ListRow key={i.id} item={i} me={me} fav={data.favorites.has(i.id)} onOpen={() => open(i)} onMenu={(e) => onContext(e, i)} />)}
                </div>
              )}
            </>
          )}

        {dragging && (
          <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-3xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
            <div className="text-center"><Upload className="mx-auto h-10 w-10 text-primary" /><div className="mt-2 font-semibold">Solte para enviar ao Life Drive</div></div>
          </div>
        )}
      </div>

      {menu && (
        <ItemMenu menu={menu} me={me} fav={data?.favorites.has(menu.item.id) ?? false} trash={view === "trash"} onClose={() => setMenu(null)}
          actions={{
            open: () => open(menu.item),
            preview: () => menu.item.kind === "file" && setDialog({ type: "preview", item: menu.item }),
            download: () => menu.item.kind === "file" && download(menu.item),
            share: () => setDialog({ type: "share", item: menu.item }),
            copy: () => copyLink(menu.item),
            rename: () => setDialog({ type: "rename", item: menu.item }),
            move: () => setDialog({ type: "move", item: menu.item }),
            fav: () => act(() => api.toggleFavorite(menu.item, !data?.favorites.has(menu.item.id)), data?.favorites.has(menu.item.id) ? "Removido dos favoritos" : "Adicionado aos favoritos"),
            info: () => setDialog({ type: "info", item: menu.item }),
            trash: () => act(() => api.setTrashed(menu.item, true), "Movido para a lixeira"),
            restore: () => act(() => api.setTrashed(menu.item, false), "Restaurado"),
            destroy: () => confirm("Excluir permanentemente? Esta ação não pode ser desfeita.") && act(() => api.destroy(menu.item, data!.files, data!.folders), "Excluído permanentemente"),
          }} />
      )}

      {dialog?.type === "newFolder" && <PromptDialog title="Nova pasta" initial="Pasta sem título" onClose={() => setDialog(null)} onSubmit={(n) => act(() => api.createFolder(n, view === "drive" ? folderId : null), "Pasta criada")} />}
      {dialog?.type === "rename" && <PromptDialog title="Renomear" initial={dialog.item.name} onClose={() => setDialog(null)} onSubmit={(n) => act(() => api.rename(dialog.item, n), "Renomeado")} />}
      {dialog?.type === "move" && data && <MoveDialog item={dialog.item} folders={data.folders.filter((f) => f.owner_id === me && !f.trashed_at)} onClose={() => setDialog(null)} onMove={(t) => act(() => api.move(dialog.item, t), "Movido")} />}
      {dialog?.type === "share" && data && <ShareDialog item={dialog.item} me={me} shares={data.shares.filter((s) => (s.file_id ?? s.folder_id) === dialog.item.id)} onClose={() => setDialog(null)} reload={reload} onCopy={() => copyLink(dialog.item)} />}
      {dialog?.type === "info" && data && <InfoDialog item={dialog.item} me={me} folders={data.folders} shares={data.shares} onClose={() => setDialog(null)} />}
      {dialog?.type === "preview" && dialog.item.kind === "file" && <PreviewDialog file={dialog.item} onClose={() => setDialog(null)} onDownload={() => download(dialog.item as DriveFile)} />}

      <UploadTray uploads={uploads} onClear={() => setUploads([])} />
    </WorkspaceShell>
  );
}

/* ================= pieces ================= */

function MenuBtn({ icon: I, label, onClick, danger }: { icon: typeof Home; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-secondary ${danger ? "text-destructive" : ""}`}>
      <I className="h-4 w-4 opacity-80" />{label}
    </button>
  );
}

function Thumb({ item, big }: { item: Item; big?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImg = item.kind === "file" && item.mime_type.startsWith("image/");
  useEffect(() => { if (isImg && big) api.signedUrl(item as DriveFile).then(setUrl).catch(() => {}); }, [isImg, big, item]);
  if (item.kind === "folder") return <div className={`flex items-center justify-center rounded-xl bg-primary/10 text-primary ${big ? "h-full w-full" : "h-9 w-9"}`}><Folder className={big ? "h-12 w-12" : "h-4 w-4"} fill="currentColor" fillOpacity={0.2} /></div>;
  if (url) return <img src={url} alt={item.name} loading="lazy" className="h-full w-full rounded-xl object-cover" />;
  const v = fileVisual(item);
  return <div className={`flex items-center justify-center rounded-xl ${v.tone} ${big ? "h-full w-full" : "h-9 w-9"}`}><v.Icon className={big ? "h-12 w-12" : "h-4 w-4"} /></div>;
}

function GridCard({ item, fav, onOpen, onMenu }: { item: Item; fav: boolean; onOpen: () => void; onMenu: (e: React.MouseEvent) => void }) {
  return (
    <div onDoubleClick={onOpen} onContextMenu={onMenu}
      className="group animate-fade-up cursor-pointer rounded-2xl border border-border bg-card p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg">
      <div onClick={onOpen} className="aspect-[4/3] overflow-hidden rounded-xl"><Thumb item={item} big /></div>
      <div className="mt-2.5 flex items-center gap-2 px-1">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.name}>{item.name}</span>
        {fav && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
        <button onClick={(e) => { e.stopPropagation(); onMenu(e); }} aria-label="Mais opções" className="rounded-lg p-1 text-muted-foreground opacity-60 hover:bg-secondary group-hover:opacity-100"><MoreVertical className="h-4 w-4" /></button>
      </div>
      <div className="px-1 pb-0.5 text-[11px] text-muted-foreground">{item.kind === "file" ? api.formatBytes(item.size_bytes) : "Pasta"} · {fmtDate(item.updated_at)}</div>
    </div>
  );
}

function ListRow({ item, me, fav, onOpen, onMenu }: { item: Item; me: string; fav: boolean; onOpen: () => void; onMenu: (e: React.MouseEvent) => void }) {
  return (
    <div onDoubleClick={onOpen} onContextMenu={onMenu}
      className="grid cursor-pointer grid-cols-[1fr_44px] items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0 hover:bg-secondary/60 md:grid-cols-[1fr_140px_140px_100px_44px]">
      <div onClick={onOpen} className="flex min-w-0 items-center gap-3"><Thumb item={item} /><span className="truncate font-medium">{item.name}</span>{fav && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}</div>
      <span className="hidden text-muted-foreground md:block">{item.owner_id === me ? "Eu" : "Outra pessoa"}</span>
      <span className="hidden text-muted-foreground md:block">{fmtDate(item.updated_at)}</span>
      <span className="hidden text-muted-foreground md:block">{item.kind === "file" ? api.formatBytes(item.size_bytes) : "—"}</span>
      <button onClick={(e) => { e.stopPropagation(); onMenu(e); }} aria-label="Mais opções" className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"><MoreVertical className="h-4 w-4" /></button>
    </div>
  );
}

type Acts = Record<"open" | "preview" | "download" | "share" | "copy" | "rename" | "move" | "fav" | "info" | "trash" | "restore" | "destroy", () => unknown>;
function ItemMenu({ menu, me, fav, trash, actions, onClose }: { menu: { item: Item; x: number; y: number }; me: string; fav: boolean; trash: boolean; actions: Acts; onClose: () => void }) {
  const own = menu.item.owner_id === me;
  const run = (k: keyof Acts) => () => { onClose(); actions[k](); };
  const x = Math.min(menu.x, (typeof window !== "undefined" ? window.innerWidth : 1000) - 240);
  const y = Math.min(menu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 440);
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div style={{ left: x, top: Math.max(8, y) }} className="animate-spring-in fixed z-50 w-56 rounded-2xl border border-border bg-popover p-1.5 shadow-2xl">
        {trash ? (<>
          <MenuBtn icon={RotateCcw} label="Restaurar" onClick={run("restore")} />
          <MenuBtn icon={Trash2} label="Excluir permanentemente" onClick={run("destroy")} danger />
        </>) : (<>
          <MenuBtn icon={ExternalLink} label="Abrir" onClick={run("open")} />
          {menu.item.kind === "file" && <MenuBtn icon={Eye} label="Visualizar" onClick={run("preview")} />}
          {menu.item.kind === "file" && <MenuBtn icon={Download} label="Baixar" onClick={run("download")} />}
          <div className="my-1 h-px bg-border" />
          {own && <MenuBtn icon={Share2} label="Compartilhar" onClick={run("share")} />}
          <MenuBtn icon={Link2} label="Copiar link" onClick={run("copy")} />
          {own && <MenuBtn icon={Pencil} label="Renomear" onClick={run("rename")} />}
          {own && <MenuBtn icon={Move} label="Mover" onClick={run("move")} />}
          <MenuBtn icon={Star} label={fav ? "Remover dos favoritos" : "Adicionar aos favoritos"} onClick={run("fav")} />
          {menu.item.kind === "file" && <MenuBtn icon={Info} label="Informações" onClick={run("info")} />}
          {own && <><div className="my-1 h-px bg-border" /><MenuBtn icon={Trash2} label="Excluir" onClick={run("trash")} danger /></>}
        </>)}
      </div>
    </>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); addEventListener("keydown", k); return () => removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`animate-spring-in w-full ${wide ? "max-w-4xl" : "max-w-md"} rounded-3xl border border-border bg-card p-6 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3"><h2 className="truncate font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button></div>
        {children}
      </div>
    </div>
  );
}
const inputCls = "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10";
const primaryBtn = "rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";
const ghostBtn = "rounded-xl px-4 py-2.5 text-sm text-muted-foreground hover:bg-secondary";

function PromptDialog({ title, initial, onSubmit, onClose }: { title: string; initial: string; onSubmit: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, []);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSubmit(v.trim()); onClose(); } }}>
        <input ref={ref} autoFocus value={v} onChange={(e) => setV(e.target.value)} className={inputCls} />
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className={ghostBtn}>Cancelar</button><button className={primaryBtn}>Salvar</button></div>
      </form>
    </Modal>
  );
}

function MoveDialog({ item, folders, onMove, onClose }: { item: Item; folders: DriveFolder[]; onMove: (t: string | null) => void; onClose: () => void }) {
  // não permitir mover pasta para dentro dela mesma/descendentes
  const blocked = new Set<string>();
  if (item.kind === "folder") { blocked.add(item.id); let g = true; while (g) { g = false; for (const f of folders) if (f.parent_id && blocked.has(f.parent_id) && !blocked.has(f.id)) { blocked.add(f.id); g = true; } } }
  const [sel, setSel] = useState<string | null>(null);
  const path = (f: DriveFolder): string => { const p = folders.find((x) => x.id === f.parent_id); return p ? `${path(p)} / ${f.name}` : f.name; };
  const opts = folders.filter((f) => !blocked.has(f.id)).map((f) => ({ id: f.id, label: path(f) })).sort((a, b) => a.label.localeCompare(b.label));
  return (
    <Modal title={`Mover “${item.name}”`} onClose={onClose}>
      <div className="max-h-72 space-y-1 overflow-y-auto">
        {[{ id: null as string | null, label: "Meu Drive" }, ...opts].map((o) => (
          <button key={o.id ?? "root"} onClick={() => setSel(o.id)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${sel === o.id ? "bg-primary/10 text-primary" : "hover:bg-secondary"}`}>
            {o.id ? <Folder className="h-4 w-4" /> : <HardDrive className="h-4 w-4" />}<span className="truncate">{o.label}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className={ghostBtn}>Cancelar</button><button onClick={() => { onMove(sel); onClose(); }} className={primaryBtn}>Mover aqui</button></div>
    </Modal>
  );
}

function ShareDialog({ item, shares, onClose, reload, onCopy }: { item: Item; me: string; shares: DriveShare[]; onClose: () => void; reload: () => Promise<void>; onCopy: () => void }) {
  const [email, setEmail] = useState("");
  const [perm, setPerm] = useState<Permission>("view");
  const [busy, setBusy] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try { await api.shareWith(item, email, perm); setEmail(""); toast.success("Compartilhado"); await reload(); } catch (er) { toast.error((er as Error).message); }
    setBusy(false);
  };
  return (
    <Modal title={`Compartilhar “${item.name}”`} onClose={onClose}>
      <form onSubmit={add} className="flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da pessoa" className={inputCls} />
        <select value={perm} onChange={(e) => setPerm(e.target.value as Permission)} className="rounded-xl border border-border bg-background px-2 text-sm">
          <option value="view">Visualizar</option><option value="edit">Editar</option>
        </select>
        <button disabled={busy} className={primaryBtn}>{busy ? "…" : "Enviar"}</button>
      </form>
      <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pessoas com acesso</div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm"><span>Você</span><span className="text-muted-foreground">Proprietário</span></div>
        {shares.map((s) => (
          <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm hover:bg-secondary/60">
            <span className="truncate">{s.shared_with_email}</span>
            <div className="flex items-center gap-1">
              <select value={s.permission} onChange={async (e) => { await api.updateShare(s.id, e.target.value as Permission); reload(); }} className="rounded-lg bg-transparent text-xs text-muted-foreground">
                <option value="view">{PERMISSION_LABEL.view}</option><option value="edit">{PERMISSION_LABEL.edit}</option>
              </select>
              <button onClick={async () => { await api.unshare(s.id); reload(); }} aria-label="Remover acesso" className="rounded-lg p-1 text-muted-foreground hover:text-destructive"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-between gap-2">
        <button onClick={onCopy} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-secondary"><Link2 className="h-4 w-4" />Copiar link</button>
        <button onClick={onClose} className={primaryBtn}>Concluído</button>
      </div>
    </Modal>
  );
}

function InfoDialog({ item, me, folders, shares, onClose }: { item: Item; me: string; folders: DriveFolder[]; shares: DriveShare[]; onClose: () => void }) {
  const parent = item.kind === "file" ? item.folder_id : item.parent_id;
  const loc = parent ? folders.find((f) => f.id === parent)?.name ?? "—" : "Meu Drive";
  const n = shares.filter((s) => (s.file_id ?? s.folder_id) === item.id).length;
  const rows: [string, string][] = [
    ["Tipo", item.kind === "file" ? `${fileVisual(item).label} (${item.mime_type})` : "Pasta"],
    ["Tamanho", item.kind === "file" ? api.formatBytes(item.size_bytes) : "—"],
    ["Proprietário", item.owner_id === me ? "Você" : "Outra pessoa"],
    ["Local", loc],
    ["Compartilhado com", n ? `${n} pessoa(s)` : "Ninguém"],
    ["Criado em", new Date(item.created_at).toLocaleString("pt-BR")],
    ["Modificado em", new Date(item.updated_at).toLocaleString("pt-BR")],
  ];
  return (
    <Modal title={item.name} onClose={onClose}>
      <div className="mb-4 h-32 overflow-hidden rounded-2xl"><Thumb item={item} big /></div>
      <dl className="space-y-2.5 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="truncate text-right font-medium">{v}</dd></div>)}</dl>
    </Modal>
  );
}

function PreviewDialog({ file, onClose, onDownload }: { file: DriveFile; onClose: () => void; onDownload: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const m = file.mime_type;
  const isText = m.startsWith("text/") || /\.(md|txt|json|csv)$/i.test(file.name);
  useEffect(() => { api.signedUrl(file).then(async (u) => { setUrl(u); if (isText && file.size_bytes < 2_000_000) setText(await (await fetch(u)).text()); }).catch((e) => toast.error(e.message)); }, [file, isText]);
  return (
    <Modal title={file.name} onClose={onClose} wide>
      <div className="flex max-h-[70vh] min-h-64 items-center justify-center overflow-auto rounded-2xl bg-secondary/50">
        {!url ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          : m.startsWith("image/") ? <img src={url} alt={file.name} className="max-h-[70vh] object-contain" />
          : m.startsWith("video/") ? <video src={url} controls className="max-h-[70vh] w-full" />
          : m.startsWith("audio/") ? <audio src={url} controls className="w-full max-w-md" />
          : m === "application/pdf" ? <iframe src={url} title={file.name} className="h-[70vh] w-full" />
          : text !== null ? <pre className="h-full w-full whitespace-pre-wrap p-5 text-left text-xs">{text}</pre>
          : <div className="p-10 text-center text-sm text-muted-foreground"><FileIcon className="mx-auto mb-3 h-10 w-10" />Pré-visualização indisponível para este tipo de arquivo.</div>}
      </div>
      <div className="mt-4 flex justify-between text-sm text-muted-foreground"><span>{api.formatBytes(file.size_bytes)}</span>
        <button onClick={onDownload} className={`${primaryBtn} inline-flex items-center gap-2`}><Download className="h-4 w-4" />Baixar</button></div>
    </Modal>
  );
}

function UploadTray({ uploads, onClear }: { uploads: Upload[]; onClear: () => void }) {
  if (!uploads.length) return null;
  const pending = uploads.filter((u) => !u.done).length;
  return (
    <div className="animate-spring-in fixed bottom-4 right-4 z-40 w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-semibold">
        {pending ? `Enviando ${pending} item(ns)…` : "Uploads concluídos"}
        {!pending && <button onClick={onClear} aria-label="Fechar" className="text-muted-foreground"><X className="h-4 w-4" /></button>}
      </div>
      <div className="max-h-60 overflow-y-auto">
        {uploads.map((u) => (
          <div key={u.id} className="px-4 py-2.5 text-xs">
            <div className="flex items-center gap-2"><span className="flex-1 truncate">{u.name}</span>
              {u.error ? <span className="text-destructive">Erro</span> : u.done ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="text-muted-foreground">{Math.round(u.progress * 100)}%</span>}</div>
            {!u.done && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${u.progress * 100}%` }} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ view, onUpload }: { view: View; onUpload: () => void }) {
  const msg: Partial<Record<View, string>> = {
    home: "Seus arquivos recentes aparecem aqui.", drive: "Esta pasta está vazia. Arraste arquivos para cá ou use + Novo.",
    favorites: "Marque arquivos e pastas como favoritos para encontrá-los rápido.", recent: "Nada aberto recentemente.",
    shared: "Nada foi compartilhado com você ainda.", trash: "A lixeira está vazia.",
  };
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><HardDrive className="h-8 w-8" /></div>
      <p className="mt-4 max-w-sm text-sm text-muted-foreground">{msg[view] ?? "Nenhum resultado."}</p>
      {(view === "drive" || view === "home") && <button onClick={onUpload} className={`${primaryBtn} mt-5`}>Enviar arquivo</button>}
    </div>
  );
}

function SettingsPanel({ data, me, layout, setLayout }: { data: { files: DriveFile[] } | null; me: string; layout: string; setLayout: (l: "grid" | "list") => void }) {
  const used = (data?.files ?? []).filter((f) => f.owner_id === me).reduce((s, f) => s + Number(f.size_bytes), 0);
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-sm font-semibold">Armazenamento usado</div>
        <div className="mt-1 font-display text-3xl font-bold">{api.formatBytes(used)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{(data?.files ?? []).filter((f) => f.owner_id === me).length} arquivos</div>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-5">
        <div><div className="text-sm font-semibold">Visualização padrão</div><div className="text-xs text-muted-foreground">Grade ou lista</div></div>
        <select value={layout} onChange={(e) => setLayout(e.target.value as "grid" | "list")} className="rounded-xl border border-border bg-background px-3 py-2 text-sm"><option value="grid">Grade</option><option value="list">Lista</option></select>
      </div>
    </div>
  );
}

function HelpPanel() {
  const tips = [
    ["Enviar arquivos", "Use + Novo → Enviar arquivo, ou arraste arquivos direto para a tela."],
    ["Menu de ações", "Clique com o botão direito em qualquer item, ou no botão ⋮."],
    ["Compartilhar", "Compartilhe com qualquer conta da Furry's Life pelo e-mail e escolha a permissão."],
    ["Lixeira", "Itens excluídos ficam na Lixeira até você restaurá-los ou apagá-los de vez."],
  ];
  return <div className="grid max-w-3xl gap-3 sm:grid-cols-2">{tips.map(([t, d]) => <div key={t} className="rounded-2xl border border-border bg-card p-5"><div className="text-sm font-semibold">{t}</div><p className="mt-1 text-sm text-muted-foreground">{d}</p></div>)}</div>;
}

function DocsStrip({ me, folderId, q }: { me: string; folderId: string | null | undefined; q: string }) {
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  useEffect(() => {
    let qy = ddb.from("docs").select("id,owner_id,title,preview,folder_id,updated_at").is("trashed_at", null).order("updated_at", { ascending: false });
    if (folderId === undefined) qy = qy.limit(6); else qy = folderId ? qy.eq("folder_id", folderId) : qy.is("folder_id", null).eq("owner_id", me);
    qy.then(({ data }: { data: DocRow[] | null }) => setDocs(data ?? []));
  }, [folderId, me]);
  const list = (docs ?? []).filter((d) => d.title.toLowerCase().includes(q.toLowerCase()));
  if (!list.length) return null;
  return (
    <div className="mb-6">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{folderId === undefined ? "Documentos recentes do Life Docs" : "Documentos do Life Docs"}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {list.map((d) => (
          <Link key={d.id} to="/workspace/docs/$id" params={{ id: d.id }} className="group rounded-2xl border border-border bg-card p-3 transition hover:shadow-md">
            <div className="h-20 overflow-hidden rounded-lg bg-background p-2 text-[9px] leading-snug text-muted-foreground">{d.preview || "Documento vazio"}</div>
            <div className="mt-2 flex items-center gap-1.5 truncate text-sm font-medium"><FileText className="h-4 w-4 shrink-0 text-primary" />{d.title}</div>
            <div className="truncate text-[11px] text-muted-foreground">Life Docs · {d.owner_id === me ? "Você" : "Compartilhado"} · {fmtDocDate(d.updated_at)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
