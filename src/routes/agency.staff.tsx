import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, ArrowLeft, LogOut, ExternalLink, Globe, FileSearch, Map as MapIcon } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { osintSearch, osintScrape, osintMap } from "@/lib/osint.functions";

export const Route = createFileRoute("/agency/staff")({
  head: () => ({ meta: [{ title: "Life Agency · OSINT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AgencyStaff,
});

type RobloxUser = { id: number; name: string; displayName: string; description: string; created: string; isBanned: boolean };
type Tab = "roblox" | "search" | "scrape" | "map";

function AgencyStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>("search");

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>;
  if (!auth.user) { nav({ to: "/auth" }); return null; }
  if (!auth.hasAccess("agency")) return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center text-white">
      <div>
        <div className="font-display text-xl font-semibold">Acesso negado</div>
        <p className="mt-2 text-sm text-white/60">Você não tem permissão para Life Agency. Peça ao CEO/Admin.</p>
        <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-red-400 hover:underline">Voltar</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Painel central
        </Link>
        <button onClick={async () => { await auth.signOut(); nav({ to: "/auth" }); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Life Agency · OSINT</h1>
          <p className="text-sm text-white/60">Inteligência aberta via Firecrawl + APIs públicas.</p>
        </div>

        <nav className="flex flex-wrap gap-1 border-b border-white/10">
          <TabBtn active={tab==="search"} onClick={()=>setTab("search")} icon={<Search className="h-4 w-4" />} label="Web Search" />
          <TabBtn active={tab==="scrape"} onClick={()=>setTab("scrape")} icon={<FileSearch className="h-4 w-4" />} label="Scrape URL" />
          <TabBtn active={tab==="map"} onClick={()=>setTab("map")} icon={<MapIcon className="h-4 w-4" />} label="Site Map" />
          <TabBtn active={tab==="roblox"} onClick={()=>setTab("roblox")} icon={<Globe className="h-4 w-4" />} label="Roblox" />
        </nav>

        {tab==="search" && <SearchPanel />}
        {tab==="scrape" && <ScrapePanel />}
        {tab==="map" && <MapPanel />}
        {tab==="roblox" && <RobloxPanel />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: ()=>void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm ${active?"border-red-500 text-red-400":"border-transparent text-white/60 hover:text-white"}`}>
      {icon}{label}
    </button>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{msg}</div>;
}

function SearchPanel() {
  const run = useServerFn(osintSearch);
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [results, setResults] = useState<{ url: string; title: string; description: string }[]>([]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!q.trim()) return;
    setBusy(true); setErr(null); setResults([]);
    try { const r = await run({ data: { query: q.trim(), limit: 10 } }); setResults(r.results); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder='ex: "site:linkedin.com furry games SP"'
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-red-500/60" />
        <button disabled={busy} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium hover:bg-red-500 disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:"Buscar"}</button>
      </form>
      {err && <ErrorBox msg={err} />}
      <div className="space-y-2">
        {results.map((r, i)=>(
          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10">
            <div className="text-sm font-semibold">{r.title}</div>
            <div className="mt-0.5 truncate text-xs text-red-400">{r.url}</div>
            {r.description && <div className="mt-1 text-xs text-white/60">{r.description}</div>}
          </a>
        ))}
      </div>
    </div>
  );
}

function ScrapePanel() {
  const run = useServerFn(osintScrape);
  const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null);
  const [data, setData] = useState<{ title: string; summary: string; markdown: string; links: string[] } | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!url.trim()) return;
    setBusy(true); setErr(null); setData(null);
    try { const r = await run({ data: { url: url.trim() } }); setData(r); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://exemplo.com/pagina" type="url"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-red-500/60" />
        <button disabled={busy} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium hover:bg-red-500 disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:"Scrape"}</button>
      </form>
      {err && <ErrorBox msg={err} />}
      {data && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
          {data.title && <div className="font-display text-lg font-semibold">{data.title}</div>}
          {data.summary && <div className="rounded-lg bg-black/30 p-3 text-sm text-white/80">{data.summary}</div>}
          {data.markdown && <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs text-white/70">{data.markdown}</pre>}
          {data.links.length>0 && (
            <details><summary className="cursor-pointer text-xs text-white/60">{data.links.length} links</summary>
              <ul className="mt-2 space-y-1 text-xs">{data.links.map((l,i)=>(<li key={i}><a href={l} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{l}</a></li>))}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function MapPanel() {
  const run = useServerFn(osintMap);
  const [url, setUrl] = useState(""); const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string|null>(null);
  const [links, setLinks] = useState<string[]>([]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!url.trim()) return;
    setBusy(true); setErr(null); setLinks([]);
    try { const r = await run({ data: { url: url.trim(), search: search.trim() || undefined, limit: 200 } }); setLinks(r.links); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
        <input value={url} onChange={(e)=>setUrl(e.target.value)} placeholder="https://exemplo.com" type="url"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-red-500/60" />
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="filtro (ex: blog)"
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-red-500/60" />
        <button disabled={busy} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium hover:bg-red-500 disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:"Mapear"}</button>
      </form>
      {err && <ErrorBox msg={err} />}
      {links.length>0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
          <div className="mb-2 text-white/60">{links.length} URLs descobertas</div>
          <ul className="max-h-96 space-y-1 overflow-auto">{links.map((l,i)=>(<li key={i}><a href={l} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:underline">{l}</a></li>))}</ul>
        </div>
      )}
    </div>
  );
}

function RobloxPanel() {
  const [q, setQ] = useState(""); const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string|null>(null); const [user, setUser] = useState<RobloxUser|null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!q.trim()) return;
    setBusy(true); setErr(null); setUser(null);
    try {
      const res = await fetch("https://users.roblox.com/v1/usernames/users", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ usernames:[q.trim()], excludeBannedUsers:false }),
      });
      const j = await res.json(); const hit = j?.data?.[0];
      if (!hit) { setErr("Usuário não encontrado."); return; }
      const detail = await fetch(`https://users.roblox.com/v1/users/${hit.id}`).then(r=>r.json());
      setUser(detail);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex gap-2">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Username do Roblox"
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-red-500/60" />
        <button disabled={busy} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-medium hover:bg-red-500 disabled:opacity-60">{busy?<Loader2 className="h-4 w-4 animate-spin"/>:"Buscar"}</button>
      </form>
      {err && <ErrorBox msg={err} />}
      {user && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-white/40">Roblox ID {user.id}</div>
              <div className="mt-1 font-display text-xl font-semibold">{user.displayName}</div>
              <div className="text-sm text-white/60">@{user.name}{user.isBanned && <span className="ml-2 text-red-400">· BANIDO</span>}</div>
            </div>
            <a href={`https://www.roblox.com/users/${user.id}/profile`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">Perfil <ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
          <div className="mt-3 text-sm"><div className="text-white/40">Criado</div><div>{new Date(user.created).toLocaleDateString("pt-BR")}</div></div>
          {user.description && <div className="mt-3 text-sm"><div className="text-white/40">Descrição</div><div className="whitespace-pre-wrap">{user.description}</div></div>}
        </div>
      )}
    </div>
  );
}
