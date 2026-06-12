import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, Bell, LogOut, Building2, Activity,
  Search, Settings, MessageCircle, Plus, Pencil, Trash2, X, Check,
} from "lucide-react";
import { subsidiaries, DISCORD_URL } from "@/lib/site-data";
import symbol from "@/assets/fli-symbol.png.asset.json";

export const Route = createFileRoute("/staff/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Painel de Staff · Furry's Life Inc." },
      { name: "description", content: "Painel interno da Furry's Life Inc." },
    ],
  }),
  component: Dashboard,
});

type Status = "online" | "offline";
type Admin = { id: string; name: string; role: string; status: Status };
type Notice = { id: string; date: string; title: string; body: string };

const ADMINS_KEY = "fli_admins_v1";
const NOTICES_KEY = "fli_notices_v1";
const PROFILE_KEY = "fli_profile_v1";

type Profile = { displayName: string; theme: "light"; notify: boolean };

function loadJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function saveJSON<T>(key: string, value: T) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}
const uid = () => Math.random().toString(36).slice(2, 10);
const todayBR = () =>
  new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");

type Section = "overview" | "admins" | "notices" | "subs" | "settings";

function Dashboard() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [section, setSection] = useState<Section>("overview");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [profile, setProfile] = useState<Profile>({ displayName: "Gatinho_Dev", theme: "light", notify: true });
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("fli_staff") !== "1") {
      nav({ to: "/staff" });
      return;
    }
    setAdmins(loadJSON<Admin[]>(ADMINS_KEY, []));
    setNotices(loadJSON<Notice[]>(NOTICES_KEY, []));
    setProfile(loadJSON<Profile>(PROFILE_KEY, { displayName: "Gatinho_Dev", theme: "light", notify: true }));
    setReady(true);
  }, [nav]);

  useEffect(() => { if (ready) saveJSON(ADMINS_KEY, admins); }, [admins, ready]);
  useEffect(() => { if (ready) saveJSON(NOTICES_KEY, notices); }, [notices, ready]);
  useEffect(() => { if (ready) saveJSON(PROFILE_KEY, profile); }, [profile, ready]);

  const logout = () => { sessionStorage.removeItem("fli_staff"); nav({ to: "/staff" }); };

  if (!ready) return null;

  const onlineCount = admins.filter((a) => a.status === "online").length;
  const navItems: { key: Section; icon: typeof LayoutDashboard; label: string }[] = [
    { key: "overview", icon: LayoutDashboard, label: "Visão Geral" },
    { key: "admins", icon: Users, label: "Administradores" },
    { key: "notices", icon: Bell, label: "Avisos" },
    { key: "subs", icon: Building2, label: "Subsidiárias" },
    { key: "settings", icon: Settings, label: "Configurações" },
  ];

  const filteredAdmins = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter((a) => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
  }, [admins, search]);

  return (
    <div className="min-h-screen">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="hidden border-r border-border bg-card md:flex md:flex-col">
          <div className="flex items-center gap-2.5 border-b border-border p-5">
            <img src={symbol.url} alt="" className="h-7 w-7" />
            <div>
              <div className="font-display text-sm font-semibold">FLI Console</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Painel de Staff</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {navItems.map((n) => (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  section === n.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}>
                <n.icon className="h-4 w-4" /> {n.label}
              </button>
            ))}
          </nav>
          <div className="space-y-1 border-t border-border p-3">
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-secondary">
              <MessageCircle className="h-4 w-4 text-[color:var(--color-discord)]" /> Discord da empresa
            </a>
            <button onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/85 px-6 py-4 backdrop-blur">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Painel de Staff</div>
              <h1 className="font-display text-xl font-semibold capitalize">
                {navItems.find((n) => n.key === section)?.label}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {section === "admins" && (
                <div className="hidden items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 md:flex">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar administrador..."
                    className="w-56 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60" />
                </div>
              )}
              <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
                className="hidden items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary sm:inline-flex">
                <MessageCircle className="h-4 w-4 text-[color:var(--color-discord)]" /> Discord
              </a>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                <span className="text-lg">🐺</span>
                <div className="leading-tight">
                  <div className="font-medium">{profile.displayName}</div>
                  <div className="text-[10px] uppercase tracking-wider text-success">Online</div>
                </div>
              </div>
              <Link to="/" className="hidden text-xs text-muted-foreground hover:text-foreground md:inline">Ir ao site</Link>
            </div>
          </header>

          <main className="flex-1 space-y-6 p-6">
            {section === "overview" && (
              <Overview
                adminsCount={admins.length}
                onlineCount={onlineCount}
                noticesCount={notices.length}
                subsCount={subsidiaries.length}
                latestNotices={notices.slice(0, 3)}
                latestAdmins={admins.slice(0, 4)}
                goAdmins={() => setSection("admins")}
                goNotices={() => setSection("notices")}
              />
            )}
            {section === "admins" && (
              <AdminsPanel admins={filteredAdmins} setAdmins={setAdmins} totalCount={admins.length} />
            )}
            {section === "notices" && (
              <NoticesPanel notices={notices} setNotices={setNotices} />
            )}
            {section === "subs" && <SubsPanel />}
            {section === "settings" && (
              <SettingsPanel profile={profile} setProfile={setProfile} onLogout={logout} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

/* ---------- OVERVIEW ---------- */
function Overview(props: {
  adminsCount: number; onlineCount: number; noticesCount: number; subsCount: number;
  latestNotices: Notice[]; latestAdmins: Admin[];
  goAdmins: () => void; goNotices: () => void;
}) {
  const metrics = [
    { label: "Administradores", value: props.adminsCount, icon: Users, tone: "text-primary", bg: "bg-primary/10" },
    { label: "Admins online", value: props.onlineCount, icon: Activity, tone: "text-success", bg: "bg-success/10" },
    { label: "Avisos internos", value: props.noticesCount, icon: Bell, tone: "text-foreground", bg: "bg-secondary" },
    { label: "Subsidiárias", value: props.subsCount, icon: Building2, tone: "text-[color:var(--color-discord)]", bg: "bg-[color:var(--color-discord)]/10" },
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="glass-card flex items-center justify-between rounded-2xl p-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{m.label}</div>
              <div className="mt-1 font-display text-3xl font-bold">{m.value}</div>
            </div>
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${m.bg} ${m.tone}`}>
              <m.icon className="h-5 w-5" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-2xl">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-lg font-semibold">Administradores recentes</h2>
            <button onClick={props.goAdmins} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          {props.latestAdmins.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum administrador ainda"
              body="Comece adicionando o primeiro administrador da sua equipe."
              actionLabel="Ir para administradores"
              onAction={props.goAdmins}
            />
          ) : (
            <div className="divide-y divide-border">
              {props.latestAdmins.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.role}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card rounded-2xl">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-lg font-semibold">Últimos avisos</h2>
            <button onClick={props.goNotices} className="text-xs text-primary hover:underline">Ver todos</button>
          </div>
          {props.latestNotices.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nenhum aviso publicado"
              body="Os avisos internos da diretoria aparecerão aqui."
              actionLabel="Criar aviso"
              onAction={props.goNotices}
            />
          ) : (
            <div className="space-y-3 p-5">
              {props.latestNotices.map((n) => (
                <div key={n.id} className="rounded-xl border border-border bg-secondary/40 p-4">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{n.date}</div>
                  <div className="mt-1 text-sm font-semibold">{n.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------- ADMINS ---------- */
function AdminsPanel({
  admins, setAdmins, totalCount,
}: { admins: Admin[]; setAdmins: React.Dispatch<React.SetStateAction<Admin[]>>; totalCount: number }) {
  const [editing, setEditing] = useState<Admin | null>(null);
  const [open, setOpen] = useState(false);

  const startCreate = () => { setEditing({ id: "", name: "", role: "", status: "online" }); setOpen(true); };
  const startEdit = (a: Admin) => { setEditing(a); setOpen(true); };
  const remove = (id: string) => {
    if (confirm("Remover este administrador?")) setAdmins((prev) => prev.filter((a) => a.id !== id));
  };
  const toggleStatus = (id: string) =>
    setAdmins((prev) => prev.map((a) => a.id === id ? { ...a, status: a.status === "online" ? "offline" : "online" } : a));
  const save = (form: Omit<Admin, "id"> & { id?: string }) => {
    if (!form.name.trim() || !form.role.trim()) return;
    if (form.id) {
      setAdmins((prev) => prev.map((a) => a.id === form.id ? { ...a, name: form.name, role: form.role, status: form.status } : a));
    } else {
      setAdmins((prev) => [{ id: uid(), name: form.name, role: form.role, status: form.status }, ...prev]);
    }
    setOpen(false); setEditing(null);
  };

  return (
    <div className="glass-card rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Administradores</h2>
          <p className="text-xs text-muted-foreground">
            {totalCount === 0 ? "Crie o primeiro administrador da equipe" : `${totalCount} administrador(es) cadastrado(s)`}
          </p>
        </div>
        <button onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo administrador
        </button>
      </div>

      {admins.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sem administradores ainda"
          body="Adicione membros da sua equipe — você pode definir nome, cargo e status."
          actionLabel="Adicionar administrador"
          onAction={startCreate}
        />
      ) : (
        <div className="divide-y divide-border">
          {admins.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                  {a.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleStatus(a.id)} title="Alternar status">
                  <StatusBadge status={a.status} interactive />
                </button>
                <button onClick={() => startEdit(a)} title="Editar"
                  className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(a.id)} title="Remover"
                  className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && editing && (
        <Modal onClose={() => { setOpen(false); setEditing(null); }}
          title={editing.id ? "Editar administrador" : "Novo administrador"}>
          <AdminForm initial={editing} onCancel={() => { setOpen(false); setEditing(null); }} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function AdminForm({
  initial, onCancel, onSave,
}: { initial: Admin; onCancel: () => void; onSave: (a: Omit<Admin, "id"> & { id?: string }) => void }) {
  const [name, setName] = useState(initial.name);
  const [role, setRole] = useState(initial.role);
  const [status, setStatus] = useState<Status>(initial.status);
  const field = "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ id: initial.id || undefined, name, role, status }); }}
      className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Ana Silva" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Cargo</span>
        <input required value={role} onChange={(e) => setRole(e.target.value)} placeholder="Ex: Diretora de Operações" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={field}>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary">Cancelar</button>
        <button type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Check className="h-4 w-4" /> Salvar
        </button>
      </div>
    </form>
  );
}

/* ---------- NOTICES ---------- */
function NoticesPanel({
  notices, setNotices,
}: { notices: Notice[]; setNotices: React.Dispatch<React.SetStateAction<Notice[]>> }) {
  const [editing, setEditing] = useState<Notice | null>(null);
  const [open, setOpen] = useState(false);

  const startCreate = () => { setEditing({ id: "", date: todayBR(), title: "", body: "" }); setOpen(true); };
  const startEdit = (n: Notice) => { setEditing(n); setOpen(true); };
  const remove = (id: string) => {
    if (confirm("Remover este aviso?")) setNotices((prev) => prev.filter((n) => n.id !== id));
  };
  const save = (form: Omit<Notice, "id"> & { id?: string }) => {
    if (!form.title.trim()) return;
    if (form.id) {
      setNotices((prev) => prev.map((n) => n.id === form.id ? { ...n, ...form, id: form.id! } : n));
    } else {
      setNotices((prev) => [{ id: uid(), date: form.date || todayBR(), title: form.title, body: form.body }, ...prev]);
    }
    setOpen(false); setEditing(null);
  };

  return (
    <div className="glass-card rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Avisos internos</h2>
          <p className="text-xs text-muted-foreground">Publique comunicados para a equipe</p>
        </div>
        <button onClick={startCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Novo aviso
        </button>
      </div>

      {notices.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nenhum aviso publicado"
          body="Crie o primeiro comunicado interno da empresa."
          actionLabel="Criar aviso"
          onAction={startCreate}
        />
      ) : (
        <div className="space-y-3 p-5">
          {notices.map((n) => (
            <div key={n.id} className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{n.date}</div>
                  <div className="mt-1 text-sm font-semibold">{n.title}</div>
                  {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => startEdit(n)} title="Editar"
                    className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(n.id)} title="Remover"
                    className="rounded-lg border border-border bg-card p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && editing && (
        <Modal onClose={() => { setOpen(false); setEditing(null); }}
          title={editing.id ? "Editar aviso" : "Novo aviso"}>
          <NoticeForm initial={editing} onCancel={() => { setOpen(false); setEditing(null); }} onSave={save} />
        </Modal>
      )}
    </div>
  );
}

function NoticeForm({
  initial, onCancel, onSave,
}: { initial: Notice; onCancel: () => void; onSave: (n: Omit<Notice, "id"> & { id?: string }) => void }) {
  const [date, setDate] = useState(initial.date);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const field = "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ id: initial.id || undefined, date, title, body }); }}
      className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Data</span>
        <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="Ex: 10 Jun 2026" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Título</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do aviso" className={field} />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Mensagem</span>
        <textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Conteúdo do aviso..." className={field} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary">Cancelar</button>
        <button type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Check className="h-4 w-4" /> Salvar
        </button>
      </div>
    </form>
  );
}

/* ---------- SUBS ---------- */
function SubsPanel() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {subsidiaries.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.name} className="glass-card rounded-2xl p-5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.category}</div>
            <div className="mt-1 font-display text-base font-semibold">{s.name}</div>
            <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- SETTINGS ---------- */
function SettingsPanel({
  profile, setProfile, onLogout,
}: { profile: Profile; setProfile: (p: Profile) => void; onLogout: () => void }) {
  const [name, setName] = useState(profile.displayName);
  const [notify, setNotify] = useState(profile.notify);
  const [saved, setSaved] = useState(false);
  const apply = () => {
    setProfile({ ...profile, displayName: name.trim() || "Gatinho_Dev", notify });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const field = "w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Perfil</h2>
        <p className="text-xs text-muted-foreground">Personalize como você aparece no painel</p>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Nome de exibição</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div>
              <div className="text-sm font-medium">Notificações internas</div>
              <div className="text-xs text-muted-foreground">Mostrar novos avisos no topo</div>
            </div>
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)}
              className="h-4 w-4 accent-[color:var(--color-primary)]" />
          </label>
          <button onClick={apply}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Check className="h-4 w-4" /> {saved ? "Salvo!" : "Salvar alterações"}
          </button>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Conta</h2>
        <p className="text-xs text-muted-foreground">Ações da sua sessão</p>
        <div className="mt-5 space-y-3">
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-4 w-4 text-[color:var(--color-discord)]" />
              <div>
                <div className="text-sm font-medium">Discord da empresa</div>
                <div className="text-xs text-muted-foreground">Acessar servidor oficial</div>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">→</span>
          </a>
          <button onClick={onLogout}
            className="flex w-full items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:bg-destructive/10">
            <div className="flex items-center gap-3">
              <LogOut className="h-4 w-4 text-destructive" />
              <div>
                <div className="text-sm font-medium text-destructive">Sair do painel</div>
                <div className="text-xs text-muted-foreground">Encerrar sessão atual</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
function StatusBadge({ status, interactive = false }: { status: Status; interactive?: boolean }) {
  const cls = status === "online"
    ? "bg-success/10 text-success border-success/30"
    : "bg-secondary text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${cls} ${interactive ? "cursor-pointer hover:opacity-80" : ""}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "online" ? "bg-success animate-pulse-dot" : "bg-muted-foreground"}`} />
      {status === "online" ? "Online" : "Offline"}
    </span>
  );
}

function EmptyState({
  icon: Icon, title, body, actionLabel, onAction,
}: { icon: typeof Users; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {actionLabel && onAction && (
        <button onClick={onAction}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> {actionLabel}
        </button>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          <button onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
