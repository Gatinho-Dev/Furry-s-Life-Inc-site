import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, ArrowLeft, LogOut, FolderOpen, Plus, Trash2, Network, X, Download, FileJson, Image as ImageIcon, Clock, Mail, Phone, User as UserIcon, Globe, Building2, MapPin, AtSign, Server as ServerIcon, Share2, Hash } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { osintSearch, osintScrape, osintMap } from "@/lib/osint.functions";
import { supabase } from "@/integrations/supabase/client";
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, addEdge, applyNodeChanges, applyEdgeChanges, Handle, Position, type Node, type Edge, type Connection, type NodeChange, type EdgeChange, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";


export const Route = createFileRoute("/agency/staff")({
  head: () => ({ meta: [{ title: "Life Agency · OSINT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AgencyStaff,
});

type Tab = "search" | "cases";

function AgencyStaff() {
  const nav = useNavigate(); const auth = useAuth();
  const [tab, setTab] = useState<Tab>("search");

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>;
  if (!auth.user) { nav({ to: "/auth", search: { redirect: "/agency/staff" } }); return null; }
  if (!auth.hasAccess("agency")) return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center text-white">
      <div><div className="font-display text-xl font-semibold">Acesso negado</div><p className="mt-2 text-sm text-white/60">Sem permissão para Life Agency.</p>
        <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-red-400 hover:underline">Voltar</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4" /> Painel central</Link>
        <button onClick={async () => { await auth.signOut(); nav({ to: "/auth" }); }} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"><LogOut className="h-4 w-4" /> Sair</button>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Life Agency · OSINT</h1>
          <p className="text-sm text-white/60">Busca inteligente + Casos com mapa mental.</p>
        </div>
        <nav className="flex flex-wrap gap-1 border-b border-white/10">
          <TabBtn active={tab==="search"} onClick={()=>setTab("search")} icon={<Search className="h-4 w-4"/>} label="Buscar"/>
          <TabBtn active={tab==="cases"} onClick={()=>setTab("cases")} icon={<FolderOpen className="h-4 w-4"/>} label="Casos & Mapa Mental"/>
        </nav>
        {tab==="search" && <UnifiedSearch />}
        {tab==="cases" && <CasesTab />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: ()=>void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${active?"border-red-500 text-red-400":"border-transparent text-white/60 hover:text-white"}`}>{icon}{label}</button>;
}

/* ---------------- UNIFIED SEARCH ---------------- */
type SearchKind = "auto" | "web" | "scrape" | "map" | "ip" | "phone" | "roblox";

function detectKind(q: string): Exclude<SearchKind, "auto"> {
  const t = q.trim();
  if (/^https?:\/\//i.test(t)) return "scrape";
  if (/^[\d.:a-f]+$/i.test(t) && /^(\d{1,3}\.){3}\d{1,3}$/.test(t)) return "ip";
  if (/^\+?\d[\d\s().-]{6,}$/.test(t)) return "phone";
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(t) && !t.includes(" ")) return "map";
  if (/^[a-z0-9_]{3,20}$/i.test(t)) return "roblox";
  return "web";
}

function UnifiedSearch() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<SearchKind>("auto");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [result, setResult] = useState<any>(null);

  const runWeb = useServerFn(osintSearch);
  const runScrape = useServerFn(osintScrape);
  const runMap = useServerFn(osintMap);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!q.trim()) return;
    const k = kind === "auto" ? detectKind(q) : kind;
    setBusy(true); setErr(null); setResult(null);
    try {
      if (k === "web") setResult({ kind: "web", data: await runWeb({ data: { query: q.trim(), limit: 10 } }) });
      else if (k === "scrape") setResult({ kind: "scrape", data: await runScrape({ data: { url: q.trim() } }) });
      else if (k === "map") {
        const url = q.startsWith("http") ? q : `https://${q}`;
        setResult({ kind: "map", data: await runMap({ data: { url, limit: 200 } }) });
      } else if (k === "ip") {
        const r = await fetch(`https://api.ipquery.io/${encodeURIComponent(q.trim())}`).then(r=>r.json());
        setResult({ kind: "ip", data: r });
      } else if (k === "phone") {
        const r = await fetch(`https://api.veriphone.io/v2/verify?phone=${encodeURIComponent(q.trim())}&key=2ED65D6587CB4A81A09F6693054EBB8E`).then(r=>r.json());
        setResult({ kind: "phone", data: r });
      } else if (k === "roblox") {
        const res = await fetch("https://users.roblox.com/v1/usernames/users", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ usernames:[q.trim()], excludeBannedUsers:false }) }).then(r=>r.json());
        const hit = res?.data?.[0];
        if (!hit) throw new Error("Usuário não encontrado.");
        const detail = await fetch(`https://users.roblox.com/v1/users/${hit.id}`).then(r=>r.json());
        setResult({ kind: "roblox", data: detail });
      }
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-wrap gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Email, telefone, IP, URL, domínio, usuário ou texto livre" className="flex-1 min-w-[280px] rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-red-500/60"/>
        <select value={kind} onChange={(e)=>setKind(e.target.value as SearchKind)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm">
          <option value="auto">Detectar</option>
          <option value="web">Web</option>
          <option value="scrape">Scrape URL</option>
          <option value="map">Mapear site</option>
          <option value="ip">IP</option>
          <option value="phone">Telefone</option>
          <option value="roblox">Roblox</option>
        </select>
        <button disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold hover:bg-red-500 disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:"Buscar"}</button>
      </form>
      <p className="text-xs text-white/40">A busca detecta automaticamente o tipo — ou escolha manualmente acima.</p>
      {err && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>}
      {result && <SearchResult result={result} />}
    </div>
  );
}

function SearchResult({ result }: { result: any }) {
  if (result.kind === "web") return (
    <div className="space-y-2">{(result.data.results ?? []).map((r:any,i:number)=>(
      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
        <div className="text-sm font-semibold">{r.title}</div><div className="mt-0.5 truncate text-xs text-red-400">{r.url}</div>
        {r.description && <div className="mt-1 text-xs text-white/60">{r.description}</div>}
      </a>))}</div>
  );
  if (result.kind === "scrape") return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      {result.data.title && <div className="font-display text-lg font-semibold">{result.data.title}</div>}
      {result.data.summary && <div className="rounded-lg bg-black/30 p-3 text-sm text-white/80">{result.data.summary}</div>}
      {result.data.markdown && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-white/70">{result.data.markdown}</pre>}
    </div>
  );
  if (result.kind === "map") return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
      <div className="mb-2 text-white/60">{result.data.links?.length ?? 0} URLs descobertas</div>
      <ul className="max-h-96 space-y-1 overflow-auto">{(result.data.links ?? []).map((l:string,i:number)=>(
        <li key={i}><a href={l} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{l}</a></li>))}</ul>
    </div>
  );
  if (result.kind === "ip") return <pre className="overflow-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">{JSON.stringify(result.data, null, 2)}</pre>;
  if (result.kind === "phone") return <pre className="overflow-auto rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/80">{JSON.stringify(result.data, null, 2)}</pre>;
  if (result.kind === "roblox") return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-xs text-white/40">Roblox ID {result.data.id}</div>
      <div className="mt-1 font-display text-xl font-semibold">{result.data.displayName}</div>
      <div className="text-sm text-white/60">@{result.data.name}{result.data.isBanned && <span className="ml-2 text-red-400">· BANIDO</span>}</div>
      {result.data.description && <p className="mt-3 whitespace-pre-wrap text-sm text-white/80">{result.data.description}</p>}
      <a href={`https://www.roblox.com/users/${result.data.id}/profile`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs text-red-400 hover:underline">Abrir perfil →</a>
    </div>
  );
  return null;
}




/* ============ MALTEGO-STYLE MIND MAP ============ */

type EntityKind = "person" | "email" | "phone" | "domain" | "company" | "location" | "user" | "ip" | "social" | "url" | "note";

const ENTITY: Record<EntityKind, { label: string; color: string; ring: string; icon: typeof Mail }> = {
  person:   { label: "Pessoa",      color: "#e5e7eb", ring: "#94a3b8", icon: UserIcon },
  email:    { label: "Email",       color: "#3b82f6", ring: "#60a5fa", icon: Mail },
  phone:    { label: "Telefone",    color: "#10b981", ring: "#34d399", icon: Phone },
  domain:   { label: "Domínio",     color: "#ef4444", ring: "#f87171", icon: Globe },
  company:  { label: "Empresa",     color: "#eab308", ring: "#facc15", icon: Building2 },
  location: { label: "Localização", color: "#f97316", ring: "#fb923c", icon: MapPin },
  user:     { label: "Usuário",     color: "#06b6d4", ring: "#22d3ee", icon: AtSign },
  ip:       { label: "IP / Host",   color: "#0ea5e9", ring: "#38bdf8", icon: ServerIcon },
  social:   { label: "Rede social", color: "#a855f7", ring: "#c084fc", icon: Share2 },
  url:      { label: "URL",         color: "#ec4899", ring: "#f472b6", icon: Hash },
  note:     { label: "Nota",        color: "#64748b", ring: "#94a3b8", icon: FileJson },
};

function detectEntityKind(value: string): EntityKind {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return "url";
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(v)) return "email";
  if (/^\+?\d[\d\s().-]{6,}$/.test(v)) return "phone";
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return "ip";
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(v) && !v.includes(" ")) return "domain";
  if (/^@[\w._-]{2,}$/i.test(v)) return "social";
  if (/^[\w._-]{3,20}$/.test(v)) return "user";
  return "person";
}

/* ---- Custom node renderer ---- */
function EntityNode({ data, selected }: NodeProps) {
  const kind = (data as { kind: EntityKind }).kind;
  const label = (data as { label: string }).label;
  const def = ENTITY[kind] ?? ENTITY.note;
  const Icon = def.icon;
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 90 }}>
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-white/30" />
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform"
        style={{
          background: def.color,
          boxShadow: selected ? `0 0 0 3px ${def.ring}, 0 0 18px ${def.ring}80` : `0 0 0 2px ${def.ring}40`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color: "#0a0a0a" }} />
      </div>
      <div className="max-w-[140px] truncate rounded-md border border-white/10 bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white">
        {label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-white/30" />
    </div>
  );
}
const NODE_TYPES_RF = { entity: EntityNode };

/* ---- Cases list ---- */
type Investigation = { id: string; title: string; target: string; status: string; created_at: string };

function CasesTab() {
  const [list, setList] = useState<Investigation[] | null>(null);
  const [active, setActive] = useState<Investigation | null>(null);
  const [err, setErr] = useState<string|null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("osint_investigations").select("*").order("created_at", { ascending: false });
    if (error) setErr(error.message); else setList(data as Investigation[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const title = prompt("Nome da investigação:"); if (!title) return;
    const { data, error } = await supabase.from("osint_investigations").insert({ title, target: title, target_type: "case", status: "open" }).select().single();
    if (error) { alert(error.message); return; }
    setList((l) => [data as Investigation, ...(l ?? [])]);
    setActive(data as Investigation);
  };
  const del = async (id: string) => {
    if (!confirm("Excluir investigação e todo o mapa?")) return;
    await supabase.from("osint_investigations").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    load();
  };

  if (err) return <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>;
  if (active) return <CaseMindMap inv={active} onBack={()=>setActive(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Investigações</h2>
        <button onClick={create} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500"><Plus className="h-4 w-4"/>Nova investigação</button>
      </div>
      {!list ? <Loader2 className="h-5 w-5 animate-spin text-white/60"/> : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">Nenhuma investigação ainda. Clique em "Nova investigação".</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
              <button onClick={()=>setActive(c)} className="flex-1 text-left">
                <div className="font-display font-semibold">{c.title}</div>
                <div className="text-xs text-white/50">{new Date(c.created_at).toLocaleString("pt-BR")}</div>
              </button>
              <button onClick={()=>del(c.id)} className="rounded-lg p-2 text-white/40 hover:bg-red-500/20 hover:text-red-300"><Trash2 className="h-4 w-4"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CaseMindMap({ inv, onBack }: { inv: Investigation; onBack: ()=>void }) {
  return (
    <ReactFlowProvider>
      <MindMapEditor inv={inv} onBack={onBack} />
    </ReactFlowProvider>
  );
}

type NodeData = { label: string; kind: EntityKind; meta?: Record<string, unknown>; notes?: string; tags?: string[]; createdAt?: string };

function MindMapEditor({ inv, onBack }: { inv: Investigation; onBack: ()=>void }) {
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<"graph" | "timeline">("graph");
  const [quickAdd, setQuickAdd] = useState("");
  const rf = useReactFlow();
  const flowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [n, e] = await Promise.all([
        supabase.from("osint_case_nodes").select("*").eq("investigation_id", inv.id),
        supabase.from("osint_case_edges").select("*").eq("investigation_id", inv.id),
      ]);
      setNodes((n.data ?? []).map((r) => {
        const row = r as { id: string; pos_x: number; pos_y: number; node_type: string; label: string; data: Record<string, unknown>; created_at: string };
        const kind = (row.node_type as EntityKind) in ENTITY ? (row.node_type as EntityKind) : "note";
        return {
          id: row.id,
          type: "entity",
          position: { x: row.pos_x, y: row.pos_y },
          data: {
            label: row.label,
            kind,
            meta: (row.data?.meta as Record<string, unknown>) ?? {},
            notes: (row.data?.notes as string) ?? "",
            tags: (row.data?.tags as string[]) ?? [],
            createdAt: row.created_at,
          },
        };
      }));
      setEdges((e.data ?? []).map((r) => {
        const row = r as { id: string; source_node: string; target_node: string; label: string | null };
        return { id: row.id, source: row.source_node, target: row.target_node, label: row.label ?? "", animated: true, style: { stroke: "#64748b", strokeWidth: 1.5 } };
      }));
      setLoading(false);
    })();
  }, [inv.id]);

  const onNodesChange = useCallback(async (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds) as Node<NodeData>[]);
    for (const c of changes) {
      if (c.type === "position" && !c.dragging && c.position) {
        await supabase.from("osint_case_nodes").update({ pos_x: c.position.x, pos_y: c.position.y }).eq("id", c.id);
      }
      if (c.type === "remove") await supabase.from("osint_case_nodes").delete().eq("id", c.id);
    }
  }, []);


  const onEdgesChange = useCallback(async (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    for (const c of changes) if (c.type === "remove") await supabase.from("osint_case_edges").delete().eq("id", c.id);
  }, []);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const { data, error } = await supabase.from("osint_case_edges").insert({ investigation_id: inv.id, source_node: conn.source, target_node: conn.target }).select().single();
    if (error) { alert(error.message); return; }
    setEdges((eds) => addEdge({ ...conn, id: data.id, animated: true, style: { stroke: "#64748b", strokeWidth: 1.5 } }, eds));
  }, [inv.id]);

  const addBubble = useCallback(async (kind: EntityKind, label: string, near?: { x: number; y: number }) => {
    const center = near ?? rf.screenToFlowPosition({ x: window.innerWidth / 2 - 200, y: 280 });
    const jitter = () => (Math.random() - 0.5) * 120;
    const pos = { x: center.x + jitter(), y: center.y + jitter() };
    const { data, error } = await supabase.from("osint_case_nodes").insert({
      investigation_id: inv.id, node_type: kind, label, pos_x: pos.x, pos_y: pos.y, data: { meta: {}, notes: "", tags: [] },
    }).select().single();
    if (error) { alert(error.message); return null; }
    const newNode: Node<NodeData> = {
      id: data.id, type: "entity",
      position: { x: data.pos_x, y: data.pos_y },
      data: { label, kind, meta: {}, notes: "", tags: [], createdAt: data.created_at },
    };
    setNodes((nds) => [...nds, newNode]);
    return data.id as string;
  }, [inv.id, rf]);

  const onQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = quickAdd.trim(); if (!v) return;
    const kind = detectEntityKind(v);
    await addBubble(kind, v);
    setQuickAdd("");
  };

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selected) ?? null, [nodes, selected]);

  const updateSelectedData = async (patch: Partial<NodeData>) => {
    if (!selectedNode) return;
    const next = { ...selectedNode.data, ...patch } as NodeData;
    setNodes((nds) => nds.map((n) => n.id === selectedNode.id ? { ...n, data: next } : n));
    await supabase.from("osint_case_nodes").update({
      label: next.label,
      data: { meta: next.meta ?? {}, notes: next.notes ?? "", tags: next.tags ?? [] },
    }).eq("id", selectedNode.id);
  };

  const exportJson = () => {
    const payload = { investigation: inv, nodes: nodes.map((n) => ({ id: n.id, kind: n.data.kind, label: n.data.label, position: n.position, data: n.data })), edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${inv.title}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const exportPng = async () => {
    if (!flowRef.current) return;
    const viewport = flowRef.current.querySelector(".react-flow__viewport") as HTMLElement | null;
    const target = viewport ?? flowRef.current;
    try {
      const dataUrl = await toPng(target, { backgroundColor: "#0a0a0a", pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a"); a.href = dataUrl; a.download = `${inv.title}.png`; a.click();
    } catch (err) { alert("Falha ao exportar PNG: " + (err instanceof Error ? err.message : String(err))); }
  };

  if (loading) return <div className="flex h-[600px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/60"/></div>;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-2">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-white/60 hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4"/></button>
        <div className="hidden md:flex items-center gap-1.5 border-l border-white/10 pl-2"><Network className="h-4 w-4 text-red-400"/><span className="font-display text-sm font-semibold">{inv.title}</span></div>
        <form onSubmit={onQuickAdd} className="flex flex-1 min-w-[260px] items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5">
          <Search className="h-4 w-4 text-white/40"/>
          <input value={quickAdd} onChange={(e)=>setQuickAdd(e.target.value)} placeholder="Buscar / adicionar bolha (email, telefone, IP, @user, domínio, nome...)" className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"/>
          {quickAdd && <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/60">{ENTITY[detectEntityKind(quickAdd)].label}</span>}
          <button className="rounded-md bg-red-600 px-3 py-1 text-xs font-semibold hover:bg-red-500">Adicionar</button>
        </form>
        <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5 text-xs">
          <button onClick={()=>setMode("graph")} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${mode==="graph"?"bg-white/10 text-white":"text-white/60"}`}><Network className="h-3.5 w-3.5"/>Grafo</button>
          <button onClick={()=>setMode("timeline")} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 ${mode==="timeline"?"bg-white/10 text-white":"text-white/60"}`}><Clock className="h-3.5 w-3.5"/>Timeline</button>
        </div>
        <button onClick={exportPng} title="Exportar PNG" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><ImageIcon className="h-3.5 w-3.5"/>PNG</button>
        <button onClick={exportJson} title="Exportar JSON" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"><FileJson className="h-3.5 w-3.5"/>JSON</button>
      </div>

      {/* Workspace */}
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {mode === "graph" ? (
            <div className="relative h-[640px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]" ref={flowRef}>
              {/* Add palette */}
              <div className="absolute left-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/70 p-1.5 backdrop-blur">
                {(Object.entries(ENTITY) as [EntityKind, typeof ENTITY[EntityKind]][]).map(([k, def]) => {
                  const Icon = def.icon;
                  return (
                    <button
                      key={k}
                      onClick={() => {
                        const v = prompt(`Conteúdo (${def.label}):`); if (v) addBubble(k, v);
                      }}
                      title={`Adicionar ${def.label}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg transition-transform hover:scale-110"
                      style={{ background: def.color }}
                    >
                      <Icon className="h-4 w-4" style={{ color: "#0a0a0a" }}/>
                    </button>
                  );
                })}
              </div>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES_RF}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_e, n) => setSelected(n.id)}
                onPaneClick={() => setSelected(null)}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#1f2937" gap={24} />
                <MiniMap pannable zoomable className="!bg-black/60" maskColor="rgba(0,0,0,0.6)" />
                <Controls className="!bg-white/5 !border-white/10" />
              </ReactFlow>
              {/* Legend */}
              <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-black/70 px-3 py-2 text-[10px] backdrop-blur">
                {(Object.entries(ENTITY) as [EntityKind, typeof ENTITY[EntityKind]][]).map(([k, def]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 text-white/70">
                    <span className="h-2 w-2 rounded-full" style={{ background: def.color }}/>{def.label}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <TimelineView nodes={nodes} edges={edges} onSelect={setSelected} selected={selected} />
          )}
        </div>

        {/* Detail side panel */}
        <DetailPanel node={selectedNode} edges={edges} onChange={updateSelectedData} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

function DetailPanel({ node, edges, onChange, onClose }: { node: Node<NodeData> | null; edges: Edge[]; onChange: (p: Partial<NodeData>) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"resumo" | "detalhes" | "atividades">("resumo");
  const [tagInput, setTagInput] = useState("");
  if (!node) return (
    <aside className="h-[640px] rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
      <Search className="mx-auto mb-3 h-8 w-8 text-white/20"/>
      Selecione uma bolha no grafo para ver os detalhes.
    </aside>
  );
  const def = ENTITY[node.data.kind];
  const Icon = def.icon;
  const related = edges.filter((e) => e.source === node.id || e.target === node.id).length;
  return (
    <aside className="flex h-[640px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a]">
      <div className="flex items-start justify-between gap-2 border-b border-white/10 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: def.color }}><Icon className="h-5 w-5" style={{ color: "#0a0a0a" }}/></div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-white/40">{def.label}</div>
            <input value={node.data.label} onChange={(e) => onChange({ label: e.target.value })} className="w-full bg-transparent font-display text-base font-semibold text-white outline-none"/>
          </div>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4"/></button>
      </div>
      <div className="flex gap-1 border-b border-white/10 px-2">
        {(["resumo","detalhes","atividades"] as const).map((t) => (
          <button key={t} onClick={()=>setTab(t)} className={`flex-1 border-b-2 px-2 py-2 text-xs capitalize ${tab===t?"border-red-500 text-red-400":"border-transparent text-white/50 hover:text-white"}`}>{t}</button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 text-sm">
        {tab === "resumo" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Tipo" value={def.label}/>
              <Info label="Conexões" value={String(related)}/>
              <Info label="Criado em" value={node.data.createdAt ? new Date(node.data.createdAt).toLocaleString("pt-BR") : "—"}/>
              <Info label="ID" value={node.id.slice(0, 8)}/>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {(node.data.tags ?? []).map((t, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px]">
                    {t}
                    <button onClick={() => onChange({ tags: (node.data.tags ?? []).filter((_, idx) => idx !== i) })}><X className="h-2.5 w-2.5"/></button>
                  </span>
                ))}
                <input value={tagInput} onChange={(e)=>setTagInput(e.target.value)} onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) { e.preventDefault(); onChange({ tags: [...(node.data.tags ?? []), tagInput.trim()] }); setTagInput(""); }
                }} placeholder="+ tag" className="w-20 rounded-full border border-white/10 bg-transparent px-2 py-0.5 text-[11px] outline-none placeholder:text-white/30"/>
              </div>
            </div>
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Notas</div>
              <textarea value={node.data.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} rows={5} placeholder="Anotações sobre esta entidade..." className="w-full resize-none rounded-lg border border-white/10 bg-black/40 p-2 text-xs outline-none focus:border-red-500/60"/>
            </div>
          </div>
        )}
        {tab === "detalhes" && (
          <pre className="overflow-auto rounded-lg bg-black/40 p-2 text-[11px] text-white/70">{JSON.stringify(node.data.meta ?? {}, null, 2)}</pre>
        )}
        {tab === "atividades" && (
          <div className="text-xs text-white/60">
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-[10px] uppercase tracking-wider text-white/40">Criada</div>
              <div>{node.data.createdAt ? new Date(node.data.createdAt).toLocaleString("pt-BR") : "—"}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="truncate text-white">{value}</div>
    </div>
  );
}

function TimelineView({ nodes, onSelect, selected }: { nodes: Node<NodeData>[]; edges: Edge[]; onSelect: (id: string) => void; selected: string | null }) {
  const sorted = [...nodes].sort((a, b) => (a.data.createdAt ?? "").localeCompare(b.data.createdAt ?? ""));
  return (
    <div className="h-[640px] overflow-auto rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
      <div className="relative border-l border-white/10 pl-6">
        {sorted.length === 0 && <div className="text-sm text-white/40">Nenhuma entidade ainda.</div>}
        {sorted.map((n) => {
          const def = ENTITY[n.data.kind]; const Icon = def.icon;
          return (
            <button key={n.id} onClick={()=>onSelect(n.id)}
              className={`mb-4 block w-full text-left transition ${selected===n.id?"opacity-100":"opacity-80 hover:opacity-100"}`}>
              <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: def.color }}>
                <Icon className="h-3 w-3" style={{ color: "#0a0a0a" }}/>
              </span>
              <div className={`rounded-xl border p-3 ${selected===n.id?"border-red-500/60 bg-red-500/5":"border-white/10 bg-white/[0.03]"}`}>
                <div className="text-[10px] uppercase tracking-wider text-white/40">{def.label} · {n.data.createdAt ? new Date(n.data.createdAt).toLocaleString("pt-BR") : "—"}</div>
                <div className="font-medium">{n.data.label}</div>
                {n.data.notes && <div className="mt-1 text-xs text-white/60 line-clamp-2">{n.data.notes}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

