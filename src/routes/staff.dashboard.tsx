import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Users, Building2, ShieldCheck, ArrowRight, Loader2, Check, Mail, Plus, Trash2, KeyRound, Inbox as InboxIcon, AlertCircle } from "lucide-react";
import { useAuth, type SubsidiaryKey } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { subsidiaries, SUBSIDIARY_LABELS, DISCORD_URL } from "@/lib/site-data";
import { adminCreateUser, adminDeleteUser, adminResetPassword } from "@/lib/admin-users.functions";
import symbol from "@/assets/fli-symbol.png.asset.json";

export const Route = createFileRoute("/staff/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Painel de Staff" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Dashboard,
});

const ALL_SUBS = subsidiaries.map((s) => s.key as SubsidiaryKey);

const SUB_ROLES: Record<string, string[]> = {
  agency: ["investigator", "analyst", "coordinator"],
  college: ["teacher", "coordinator", "secretary"],
  cond: ["doorman", "syndic", "maintenance"],
  aircare: ["technician", "engineer"],
  server: ["moderator", "admin"],
  studios: ["developer", "artist", "producer"],
  default: ["staff", "manager"],
};
const subRolesFor = (s: string) => SUB_ROLES[s] ?? SUB_ROLES.default;

type StaffRow = {
  id: string; full_name: string | null; email: string | null;
  role: "ceo" | "admin" | "staff"; access: SubsidiaryKey[];
  subRoles: { subsidiary: string; sub_role: string }[];
};

function Dashboard() {
  const nav = useNavigate(); const auth = useAuth();
  const [tab, setTab] = useState<"home" | "users" | "inbox">("home");

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth", search: { redirect: undefined } }); }, [auth.loading, auth.user, nav]);
  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>;

  const myRole = auth.roles[0] ?? "staff";
  const allowedSubs = auth.isCeoOrAdmin ? subsidiaries : subsidiaries.filter((s) => auth.access.includes(s.key as SubsidiaryKey));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <img src={symbol.url} alt="" className="h-7 w-7" />
          <div><div className="font-display text-sm font-semibold">FLI Console</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{auth.user.email}</div></div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary sm:inline-flex"><ShieldCheck className="h-3 w-3"/>{myRole}</span>
          <Link to="/" className="hidden text-xs text-muted-foreground hover:text-foreground md:inline">Ir ao site</Link>
          <button onClick={async () => { await auth.signOut(); nav({ to: "/auth", search: { redirect: undefined } }); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-secondary"><LogOut className="h-4 w-4"/>Sair</button>
        </div>
      </header>

      <div className="border-b border-border px-6">
        <nav className="flex gap-1">
          <TabBtn active={tab==="home"} onClick={()=>setTab("home")} icon={<Building2 className="h-4 w-4"/>} label="Mini-sites"/>
          {auth.isCeoOrAdmin && <TabBtn active={tab==="users"} onClick={()=>setTab("users")} icon={<Users className="h-4 w-4"/>} label="Usuários & cargos"/>}
          {auth.isCeoOrAdmin && <TabBtn active={tab==="inbox"} onClick={()=>setTab("inbox")} icon={<InboxIcon className="h-4 w-4"/>} label="Inbox"/>}
        </nav>
      </div>

      <main className="space-y-6 p-6">
        {tab==="home" && (
          <section>
            <h2 className="font-display text-lg font-semibold">Mini-sites com seu acesso</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allowedSubs.map((s) => {
                const Icon = s.icon; const target = s.href ? `${s.href}/staff` : null;
                return (
                  <div key={s.key} className="glass-card flex flex-col rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-primary/5 text-primary"><Icon className="h-5 w-5"/></div>
                      <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</div><div className="font-display font-semibold">{s.name}</div></div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                    <div className="mt-4 flex items-center gap-2">
                      {target ? <Link to={target} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90">Abrir painel <ArrowRight className="h-3.5 w-3.5"/></Link>
                        : <span className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">Em breve</span>}
                      {s.href && <Link to={s.href} className="text-xs text-muted-foreground hover:text-foreground">Landing pública</Link>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {tab==="users" && auth.isCeoOrAdmin && <UsersPanel currentUserId={auth.user.id}/>}
        {tab==="inbox" && auth.isCeoOrAdmin && <InboxPanel/>}
        <div className="mt-8 text-xs text-muted-foreground">Discord interno: <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{DISCORD_URL}</a></div>
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: ()=>void; icon: React.ReactNode; label: string }) {
  return <button onClick={onClick} className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${active?"border-primary text-primary":"border-transparent text-muted-foreground hover:text-foreground"}`}>{icon}{label}</button>;
}

/* ---------------- USERS ---------------- */
function UsersPanel({ currentUserId }: { currentUserId: string }) {
  const [rows, setRows] = useState<StaffRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [q, setQ] = useState("");
  const [filterSub, setFilterSub] = useState<string>("");


  const createFn = useServerFn(adminCreateUser);
  const deleteFn = useServerFn(adminDeleteUser);
  const resetFn = useServerFn(adminResetPassword);

  const load = async () => {
    setErr(null);
    const [{ data: profiles, error: e1 }, { data: roles, error: e2 }, { data: access, error: e3 }, { data: sroles, error: e4 }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("user_subsidiary_access").select("user_id, subsidiary"),
      supabase.from("user_subsidiary_roles").select("user_id, subsidiary, sub_role"),
    ]);
    if (e1 || e2 || e3 || e4) { setErr((e1 ?? e2 ?? e3 ?? e4)?.message ?? "Erro"); return; }
    const byUser = new Map<string, StaffRow>();
    for (const p of profiles ?? []) byUser.set(p.id, { id: p.id, full_name: p.full_name, email: p.email, role: "staff", access: [], subRoles: [] });
    for (const r of roles ?? []) { const row = byUser.get(r.user_id); if (row) row.role = r.role as StaffRow["role"]; }
    for (const a of access ?? []) { const row = byUser.get(a.user_id); if (row) row.access.push(a.subsidiary as SubsidiaryKey); }
    for (const sr of sroles ?? []) { const row = byUser.get(sr.user_id); if (row) row.subRoles.push({ subsidiary: sr.subsidiary, sub_role: sr.sub_role }); }
    setRows(Array.from(byUser.values()).sort((a, b) => (a.email ?? "").localeCompare(b.email ?? "")));
  };
  useEffect(() => { load(); }, []);

  const toggleAccess = async (userId: string, sub: SubsidiaryKey, on: boolean) => {
    if (on) await supabase.from("user_subsidiary_access").insert({ user_id: userId, subsidiary: sub });
    else await supabase.from("user_subsidiary_access").delete().eq("user_id", userId).eq("subsidiary", sub);
    load();
  };
  const setRole = async (userId: string, role: StaffRow["role"]) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role });
    load();
  };
  const addSubRole = async (userId: string, sub: string, sub_role: string) => {
    await supabase.from("user_subsidiary_roles").insert({ user_id: userId, subsidiary: sub as any, sub_role });
    // ensure access too
    await supabase.from("user_subsidiary_access").upsert({ user_id: userId, subsidiary: sub as any }, { onConflict: "user_id,subsidiary" });
    load();
  };
  const removeSubRole = async (userId: string, sub: string, sub_role: string) => {
    await supabase.from("user_subsidiary_roles").delete().eq("user_id", userId).eq("subsidiary", sub as any).eq("sub_role", sub_role);
    load();
  };

  const onDelete = async (u: StaffRow) => {
    if (!confirm(`Excluir ${u.email}? Esta ação não pode ser desfeita.`)) return;
    try { await deleteFn({ data: { user_id: u.id } }); load(); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
  };
  const onReset = async (u: StaffRow) => {
    const p = prompt(`Nova senha para ${u.email} (mín 8):`); if (!p) return;
    try { await resetFn({ data: { user_id: u.id, new_password: p } }); alert("Senha alterada."); }
    catch (e) { alert(e instanceof Error ? e.message : "Falha"); }
  };

  if (err) return <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{err}</div>;
  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>;

  const filtered = (rows ?? []).filter((u) => {
    if (q && !((u.full_name ?? "") + " " + (u.email ?? "")).toLowerCase().includes(q.toLowerCase())) return false;
    if (filterSub && !u.access.includes(filterSub as SubsidiaryKey)) return false;
    return true;
  });

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-display text-lg font-semibold">Usuários & cargos</h2><p className="text-sm text-muted-foreground">Crie usuários, defina cargo global e cargos por subsidiária.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar nome/email..." className="rounded-xl border border-border bg-card px-3 py-2 text-sm" />
          <select value={filterSub} onChange={(e)=>setFilterSub(e.target.value)} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
            <option value="">Todas subsidiárias</option>
            {ALL_SUBS.map((s) => <option key={s} value={s}>{SUBSIDIARY_LABELS[s] ?? s}</option>)}
          </select>
          <button onClick={()=>setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4"/>Criar usuário</button>
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={()=>setShowCreate(false)} onCreate={async (d) => { await createFn({ data: d }); setShowCreate(false); load(); }} />}

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {filtered.map((u) => (
          <div key={u.id} className="rounded-2xl border border-border bg-card p-5">

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="font-medium">{u.full_name ?? u.email}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
              <div className="flex items-center gap-2">
                <select value={u.role} onChange={(e) => setRole(u.id, e.target.value as StaffRow["role"])} className="rounded-xl border border-border bg-card px-3 py-2 text-sm">
                  <option value="ceo">CEO</option><option value="admin">Admin</option><option value="staff">Staff</option>
                </select>
                <button onClick={()=>onReset(u)} title="Resetar senha" className="rounded-lg border border-border p-2 hover:bg-secondary"><KeyRound className="h-4 w-4"/></button>
                {u.id !== currentUserId && <button onClick={()=>onDelete(u)} title="Excluir" className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></button>}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Acesso aos mini-sites</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_SUBS.map((sub) => {
                  const checked = u.access.includes(sub);
                  return (
                    <label key={sub} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
                      <input type="checkbox" checked={checked} onChange={(e) => toggleAccess(u.id, sub, e.target.checked)} className="sr-only"/>
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${checked?"border-primary bg-primary text-primary-foreground":"border-border"}`}>{checked && <Check className="h-3 w-3"/>}</span>
                      <span className="truncate">{SUBSIDIARY_LABELS[sub] ?? sub}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cargos por subsidiária</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {u.subRoles.map((sr, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">
                    {SUBSIDIARY_LABELS[sr.subsidiary] ?? sr.subsidiary}: {sr.sub_role}
                    <button onClick={()=>removeSubRole(u.id, sr.subsidiary, sr.sub_role)}><X className="h-3 w-3"/></button>
                  </span>
                ))}
                <AddSubRoleInline onAdd={(sub, role) => addSubRole(u.id, sub, role)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AddSubRoleInline({ onAdd }: { onAdd: (sub: string, role: string) => void }) {
  const [sub, setSub] = useState("");
  const [role, setRole] = useState("");
  const roles = sub ? subRolesFor(sub) : [];
  return (
    <div className="inline-flex items-center gap-1">
      <select value={sub} onChange={(e)=>{ setSub(e.target.value); setRole(""); }} className="rounded-lg border border-border bg-card px-2 py-1 text-xs">
        <option value="">+ adicionar cargo</option>
        {ALL_SUBS.map((s) => <option key={s} value={s}>{SUBSIDIARY_LABELS[s] ?? s}</option>)}
      </select>
      {sub && (
        <>
          <select value={role} onChange={(e)=>setRole(e.target.value)} className="rounded-lg border border-border bg-card px-2 py-1 text-xs">
            <option value="">cargo...</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {role && <button onClick={()=>{ onAdd(sub, role); setSub(""); setRole(""); }} className="rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">ok</button>}
        </>
      )}
    </div>
  );
}

function X({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function CreateUserModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: { email: string; password: string; full_name?: string }) => Promise<void> }) {
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string|null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await onCreate({ email: form.email, password: form.password, full_name: form.full_name || undefined }); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha"); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e)=>e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-lg font-semibold">Novo usuário</h3>
        <input required type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
        <input placeholder="Nome completo (opcional)" value={form.full_name} onChange={(e)=>setForm({...form, full_name: e.target.value})} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
        <input required type="password" placeholder="Senha (mín 8)" minLength={8} value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"/>
        {err && <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive"><AlertCircle className="h-4 w-4"/>{err}</div>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-secondary">Cancelar</button>
          <button disabled={busy} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">{busy ? "Criando..." : "Criar"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------- INBOX ---------------- */
type InboxRow = { id: string; name: string; email: string; subject: string; body: string; status: string; created_at: string };

function InboxPanel() {
  const [rows, setRows] = useState<InboxRow[] | null>(null);
  const [open, setOpen] = useState<InboxRow | null>(null);
  const load = async () => {
    const { data } = await supabase.from("contact_inbox").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as InboxRow[]);
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id: string) => { await supabase.from("contact_inbox").update({ status: "read" }).eq("id", id); load(); };
  const del = async (id: string) => { if (!confirm("Excluir mensagem?")) return; await supabase.from("contact_inbox").delete().eq("id", id); setOpen(null); load(); };

  if (!rows) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>;
  return (
    <section>
      <h2 className="font-display text-lg font-semibold">Inbox · contatos do site</h2>
      <p className="text-sm text-muted-foreground">Mensagens enviadas pelo formulário público chegam aqui.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.5fr]">
        <div className="space-y-2">
          {rows.length === 0 && <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sem mensagens.</div>}
          {rows.map((r) => (
            <button key={r.id} onClick={()=>{ setOpen(r); if (r.status === "unread") markRead(r.id); }}
              className={`w-full rounded-xl border p-3 text-left text-sm hover:bg-secondary ${r.status==="unread"?"border-primary/40 bg-primary/5":"border-border bg-card"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{r.name}</span>
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
              </div>
              <div className="truncate text-xs text-muted-foreground">{r.subject}</div>
            </button>
          ))}
        </div>
        <div>
          {open ? (
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between gap-2">
                <div><div className="font-display text-lg font-semibold">{open.subject}</div>
                  <div className="text-xs text-muted-foreground"><Mail className="mr-1 inline h-3 w-3"/>{open.name} &lt;{open.email}&gt; · {new Date(open.created_at).toLocaleString("pt-BR")}</div></div>
                <button onClick={()=>del(open.id)} className="rounded-lg border border-destructive/40 p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4"/></button>
              </div>
              <pre className="mt-4 whitespace-pre-wrap rounded-xl border border-border bg-background p-4 text-sm">{open.body}</pre>
              <a href={`mailto:${open.email}?subject=Re:%20${encodeURIComponent(open.subject)}`} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Mail className="h-4 w-4"/>Responder por email</a>
            </div>
          ) : <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">Selecione uma mensagem para ler.</div>}
        </div>
      </div>
    </section>
  );
}
