import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LogOut, Users, Building2, ShieldCheck, ArrowRight, Loader2, Check } from "lucide-react";
import { useAuth, type SubsidiaryKey } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { subsidiaries, SUBSIDIARY_LABELS, DISCORD_URL } from "@/lib/site-data";
import symbol from "@/assets/fli-symbol.png.asset.json";

export const Route = createFileRoute("/staff/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Painel de Staff · Furry's Life Inc." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Dashboard,
});

const ALL_SUBS = subsidiaries.map((s) => s.key as SubsidiaryKey);

type StaffRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "ceo" | "admin" | "staff";
  access: SubsidiaryKey[];
};

function Dashboard() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<"home" | "users">("home");

  useEffect(() => {
    if (!auth.loading && !auth.user) nav({ to: "/auth" });
  }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const myRole = auth.roles[0] ?? "staff";
  const allowedSubs = auth.isCeoOrAdmin
    ? subsidiaries
    : subsidiaries.filter((s) => auth.access.includes(s.key as SubsidiaryKey));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={symbol.url} alt="" className="h-7 w-7" />
          <div>
            <div className="font-display text-sm font-semibold">FLI Console</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{auth.user.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline-flex">
            <ShieldCheck className="h-3 w-3" /> {myRole}
          </span>
          <Link to="/" className="hidden text-xs text-muted-foreground hover:text-foreground md:inline">Ir ao site</Link>
          <button onClick={async () => { await auth.signOut(); nav({ to: "/auth" }); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <div className="border-b border-border px-6">
        <nav className="flex gap-1">
          <TabBtn active={tab === "home"} onClick={() => setTab("home")} icon={<Building2 className="h-4 w-4" />} label="Mini-sites" />
          {auth.isCeoOrAdmin && (
            <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-4 w-4" />} label="Usuários & acessos" />
          )}
        </nav>
      </div>

      <main className="space-y-6 p-6">
        {tab === "home" && (
          <section>
            <h2 className="font-display text-lg font-semibold">Mini-sites com seu acesso</h2>
            <p className="text-sm text-muted-foreground">Clique em uma subsidiária para abrir o painel correspondente.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allowedSubs.map((s) => {
                const Icon = s.icon;
                const target = s.href ? `${s.href}/staff` : null;
                return (
                  <div key={s.key} className="glass-card flex flex-col rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-primary/5 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</div>
                        <div className="font-display font-semibold">{s.name}</div>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                    <div className="mt-4 flex items-center gap-2">
                      {target ? (
                        <Link to={target} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                          Abrir painel <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Em breve</span>
                      )}
                      {s.href && (
                        <Link to={s.href} className="text-xs text-muted-foreground hover:text-foreground">Landing pública</Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "users" && auth.isCeoOrAdmin && <UsersPanel />}

        <div className="mt-8 text-xs text-muted-foreground">
          Discord interno: <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{DISCORD_URL}</a>
        </div>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}>
      {icon} {label}
    </button>
  );
}

/* ---------- USERS PANEL ---------- */
function UsersPanel() {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setErr(null);
    const [{ data: profiles, error: e1 }, { data: roles, error: e2 }, { data: access, error: e3 }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_subsidiary_access").select("user_id, subsidiary"),
    ]);
    if (e1 || e2 || e3) { setErr((e1 ?? e2 ?? e3)?.message ?? "Erro ao carregar"); return; }
    const byUser = new Map<string, StaffRow>();
    for (const p of profiles ?? []) {
      byUser.set(p.id, { id: p.id, full_name: p.full_name, email: p.email, role: "staff", access: [] });
    }
    for (const r of roles ?? []) {
      const row = byUser.get(r.user_id);
      if (row) row.role = r.role as StaffRow["role"];
    }
    for (const a of access ?? []) {
      const row = byUser.get(a.user_id);
      if (row) row.access.push(a.subsidiary as SubsidiaryKey);
    }
    setRows(Array.from(byUser.values()).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")));
  };

  useEffect(() => { load(); }, []);

  const toggleAccess = async (userId: string, sub: SubsidiaryKey, on: boolean) => {
    if (on) {
      await supabase.from("user_subsidiary_access").insert({ user_id: userId, subsidiary: sub });
    } else {
      await supabase.from("user_subsidiary_access").delete().eq("user_id", userId).eq("subsidiary", sub);
    }
    load();
  };

  const setRole = async (userId: string, role: StaffRow["role"]) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role });
    load();
  };

  if (err) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{err}</div>;
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <section>
      <h2 className="font-display text-lg font-semibold">Usuários & acessos</h2>
      <p className="text-sm text-muted-foreground">
        Usuários se registram em <Link to="/auth" className="text-primary hover:underline">/auth</Link>. Aqui você define cargo e a quais mini-sites cada um tem acesso.
      </p>

      <div className="mt-5 space-y-4">
        {rows.map((u) => (
          <div key={u.id} className="glass-card rounded-2xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-medium">{u.full_name ?? u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <select value={u.role} onChange={(e) => setRole(u.id, e.target.value as StaffRow["role"])}
                className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <option value="ceo">CEO</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ALL_SUBS.map((sub) => {
                const checked = u.access.includes(sub);
                return (
                  <label key={sub} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
                    <input type="checkbox" checked={checked} onChange={(e) => toggleAccess(u.id, sub, e.target.checked)} className="sr-only" />
                    <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    <span className="truncate">{SUBSIDIARY_LABELS[sub] ?? sub}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
