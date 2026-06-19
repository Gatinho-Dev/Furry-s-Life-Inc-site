import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Search, ArrowLeft, LogOut, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/agency/staff")({
  head: () => ({ meta: [{ title: "Life Agency · OSINT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AgencyStaff,
});

type RobloxUser = {
  id: number; name: string; displayName: string; description: string; created: string; isBanned: boolean;
};

function AgencyStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<RobloxUser | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth" }); }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>;
  if (!auth.hasAccess("agency")) return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4 text-center text-white">
      <div>
        <div className="font-display text-xl font-semibold">Acesso negado</div>
        <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-red-400 hover:underline">Voltar</Link>
      </div>
    </div>
  );

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setLoading(true); setErr(null); setUser(null);
    try {
      // Roblox public API: username → user
      const res = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [q.trim()], excludeBannedUsers: false }),
      });
      const j = await res.json();
      const hit = j?.data?.[0];
      if (!hit) { setErr("Usuário não encontrado."); return; }
      const detail = await fetch(`https://users.roblox.com/v1/users/${hit.id}`).then((r) => r.json());
      setUser(detail);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Falha na busca");
    } finally { setLoading(false); }
  };

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
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">OSINT · Roblox Lookup</h1>
          <p className="text-sm text-white/60">Buscar usuário do Roblox por username (API pública).</p>
          <p className="mt-1 text-xs text-white/40">Busca avançada via Firecrawl (redes sociais, domínios) será habilitada após conexão do conector.</p>
        </div>

        <form onSubmit={search} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Username do Roblox"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-red-500/60" />
          </div>
          <button disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium hover:bg-red-500 disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </button>
        </form>

        {err && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{err}</div>}

        {user && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-white/40">Roblox ID {user.id}</div>
                <div className="mt-1 font-display text-xl font-semibold">{user.displayName}</div>
                <div className="text-sm text-white/60">@{user.name}{user.isBanned && <span className="ml-2 text-red-400">· BANIDO</span>}</div>
              </div>
              <a href={`https://www.roblox.com/users/${user.id}/profile`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10">
                Perfil <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-3 text-sm">
              <div className="text-white/40">Criado em</div>
              <div>{new Date(user.created).toLocaleDateString("pt-BR")}</div>
            </div>
            {user.description && (
              <div className="mt-3 text-sm">
                <div className="text-white/40">Descrição</div>
                <div className="whitespace-pre-wrap">{user.description}</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
