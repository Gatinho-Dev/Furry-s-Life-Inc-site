import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, ArrowLeft, LogOut, FolderOpen, Plus, Trash2, Network, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { osintSearch, osintScrape, osintMap } from "@/lib/osint.functions";
import { supabase } from "@/integrations/supabase/client";
import { ReactFlow, Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, addEdge, applyNodeChanges, applyEdgeChanges, type Node, type Edge, type Connection, type NodeChange, type EdgeChange } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export const Route = createFileRoute("/agency/staff")({
  head: () => ({ meta: [{ title: "Life Agency · OSINT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AgencyStaff,
});

type Tab = "search" | "cases";

function AgencyStaff() {
  const nav = useNavigate(); const auth = useAuth();
  const [tab, setTab] = useState<Tab>("search");

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>;
  if (!auth.user) { nav({ to: "/auth" }); return null; }
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

/* ---------------- CASES + MIND MAP ---------------- */
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
    const title = prompt("Nome do caso:"); if (!title) return;
    const { data, error } = await supabase.from("osint_investigations").insert({ title, target: title, target_type: "case", status: "open" }).select().single();
    if (error) { alert(error.message); return; }
    setList((l) => [data as Investigation, ...(l ?? [])]);
    setActive(data as Investigation);
  };
  const del = async (id: string) => {
    if (!confirm("Excluir caso e todo o mapa?")) return;
    await supabase.from("osint_investigations").delete().eq("id", id);
    if (active?.id === id) setActive(null);
    load();
  };

  if (err) return <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{err}</div>;
  if (active) return <CaseMindMap inv={active} onBack={()=>setActive(null)} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Casos</h2>
        <button onClick={create} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-medium hover:bg-red-500"><Plus className="h-4 w-4"/>Novo caso</button>
      </div>
      {!list ? <Loader2 className="h-5 w-5 animate-spin text-white/60"/> : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-white/50">Nenhum caso ainda. Clique em "Novo caso".</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
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

const NODE_TYPES = [
  { value: "email", label: "Email", color: "#fbbf24" },
  { value: "phone", label: "Telefone", color: "#34d399" },
  { value: "name", label: "Nome", color: "#60a5fa" },
  { value: "ip", label: "IP", color: "#a78bfa" },
  { value: "url", label: "URL", color: "#f472b6" },
  { value: "user", label: "Usuário", color: "#fb7185" },
  { value: "location", label: "Local", color: "#22d3ee" },
  { value: "note", label: "Nota", color: "#e5e7eb" },
];

function CaseMindMap({ inv, onBack }: { inv: Investigation; onBack: ()=>void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white"><ArrowLeft className="h-4 w-4"/>Voltar aos casos</button>
        <div className="flex items-center gap-2 text-sm"><Network className="h-4 w-4 text-red-400"/><span className="font-display font-semibold">{inv.title}</span></div>
      </div>
      <ReactFlowProvider>
        <MindMapEditor investigationId={inv.id} />
      </ReactFlowProvider>
    </div>
  );
}

function MindMapEditor({ investigationId }: { investigationId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const rf = useReactFlow();

  // Load existing
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [n, e] = await Promise.all([
        supabase.from("osint_case_nodes").select("*").eq("investigation_id", investigationId),
        supabase.from("osint_case_edges").select("*").eq("investigation_id", investigationId),
      ]);
      const colorOf = (t:string) => NODE_TYPES.find(x=>x.value===t)?.color ?? "#999";
      setNodes((n.data ?? []).map((r:any) => ({
        id: r.id, position: { x: r.pos_x, y: r.pos_y },
        data: { label: `${NODE_TYPES.find(x=>x.value===r.node_type)?.label ?? r.node_type}: ${r.label}`, kind: r.node_type, raw: r.label },
        style: { background: colorOf(r.node_type), color: "#0a0a0a", border: "2px solid #000", borderRadius: 12, padding: 8, fontSize: 12, fontWeight: 600 },
      })));
      setEdges((e.data ?? []).map((r:any) => ({ id: r.id, source: r.source_node, target: r.target_node, label: r.label ?? "", animated: true })));
      setLoading(false);
    })();
  }, [investigationId]);

  const onNodesChange = useCallback(async (changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    for (const c of changes) {
      if (c.type === "position" && !c.dragging && c.position) {
        await supabase.from("osint_case_nodes").update({ pos_x: c.position.x, pos_y: c.position.y }).eq("id", c.id);
      }
      if (c.type === "remove") {
        await supabase.from("osint_case_nodes").delete().eq("id", c.id);
      }
    }
  }, []);

  const onEdgesChange = useCallback(async (changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    for (const c of changes) {
      if (c.type === "remove") await supabase.from("osint_case_edges").delete().eq("id", c.id);
    }
  }, []);

  const onConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target) return;
    const { data, error } = await supabase.from("osint_case_edges").insert({ investigation_id: investigationId, source_node: conn.source, target_node: conn.target }).select().single();
    if (error) { alert(error.message); return; }
    setEdges((eds) => addEdge({ ...conn, id: data.id, animated: true }, eds));
  }, [investigationId]);

  const addNode = async (kind: string, label: string) => {
    const pos = rf.screenToFlowPosition({ x: 300, y: 200 });
    const { data, error } = await supabase.from("osint_case_nodes").insert({
      investigation_id: investigationId, node_type: kind, label, pos_x: pos.x, pos_y: pos.y,
    }).select().single();
    if (error) { alert(error.message); return; }
    const color = NODE_TYPES.find(x=>x.value===kind)?.color ?? "#999";
    setNodes((nds) => [...nds, {
      id: data.id, position: { x: data.pos_x, y: data.pos_y },
      data: { label: `${NODE_TYPES.find(x=>x.value===kind)?.label}: ${label}`, kind, raw: label },
      style: { background: color, color: "#0a0a0a", border: "2px solid #000", borderRadius: 12, padding: 8, fontSize: 12, fontWeight: 600 },
    }]);
  };

  if (loading) return <div className="flex h-[600px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/60"/></div>;

  return (
    <div className="relative h-[640px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="absolute right-3 top-3 z-10 flex flex-wrap gap-1">
        {NODE_TYPES.map((t) => (
          <button key={t.value} onClick={()=>{
            const v = prompt(`Conteúdo da bolha (${t.label}):`);
            if (v) addNode(t.value, v);
          }} className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-black" style={{ background: t.color }}>+ {t.label}</button>
        ))}
      </div>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView>
        <Background color="#333" />
        <MiniMap pannable zoomable className="!bg-black/60" />
        <Controls className="!bg-white/10 !border-white/10" />
      </ReactFlow>
      <p className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/70 px-3 py-1.5 text-[11px] text-white/70">Arraste das laterais das bolhas para conectar · clique para deletar (Backspace).</p>
    </div>
  );
}
