import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, LayoutDashboard, Users, ShieldCheck, Package, AlertTriangle, Wrench, Bell, CalendarDays, LogIn, LogOut as Exit } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, KpiCard, type ShellTab } from "@/components/staff/StaffShell";

export const Route = createFileRoute("/cond/staff")({
  head: () => ({ meta: [{ title: "Painel Staff — Furry's Life Cond." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CondStaff,
});

type Resident = { id: string; full_name: string; unit: string; phone: string | null; notes: string | null };
type Visitor = { id: string; visitor_name: string; document: string | null; unit_visited: string; reason: string | null; entry_at: string; exit_at: string | null };
type TabKey = "dashboard" | "residents" | "visitors" | "packages" | "incidents" | "maintenance" | "reservations" | "notices";

const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function CondStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<TabKey>("dashboard");

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth", search: { redirect: "/cond/staff" } }); }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!auth.hasAccess("cond")) {
    return <div className="flex min-h-screen items-center justify-center px-4 text-center"><div>
      <div className="font-display text-xl font-semibold">Sem acesso a Life Cond.</div>
      <p className="mt-2 text-sm text-muted-foreground">Peça ao CEO/Admin para liberar acesso.</p>
      <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
    </div></div>;
  }

  const tabs: ShellTab<TabKey>[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "residents", label: "Moradores", icon: Users },
    { key: "visitors", label: "Portaria", icon: ShieldCheck },
    { key: "packages", label: "Encomendas", icon: Package },
    { key: "incidents", label: "Incidentes", icon: AlertTriangle },
    { key: "maintenance", label: "Manutenção", icon: Wrench },
    { key: "reservations", label: "Reservas", icon: CalendarDays },
    { key: "notices", label: "Avisos", icon: Bell },
  ];

  return (
    <StaffShell brand="Life Cond." subtitle="Gestão de condomínio" tabs={tabs} active={tab} onSelect={setTab}>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "residents" && <ResidentsTab uid={auth.user.id} />}
      {tab === "visitors" && <VisitorsTab uid={auth.user.id} />}
      {tab === "packages" && <PackagesTab uid={auth.user.id} />}
      {tab === "incidents" && <IncidentsTab uid={auth.user.id} />}
      {tab === "maintenance" && <MaintenanceTab uid={auth.user.id} />}
      {tab === "reservations" && <ReservationsTab uid={auth.user.id} />}
      {tab === "notices" && <NoticesTab uid={auth.user.id} />}
    </StaffShell>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState({ residents: 0, visitorsToday: 0, activeVisits: 0 });
  useEffect(() => {
    (async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const [r, today, active] = await Promise.all([
        supabase.from("residents").select("id", { count: "exact", head: true }),
        supabase.from("visitor_logs").select("id", { count: "exact", head: true }).gte("entry_at", start.toISOString()),
        supabase.from("visitor_logs").select("id", { count: "exact", head: true }).is("exit_at", null),
      ]);
      setStats({ residents: r.count ?? 0, visitorsToday: today.count ?? 0, activeVisits: active.count ?? 0 });
    })();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Painel do condomínio</h1>
        <p className="text-sm text-muted-foreground">Visão geral em tempo real.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Moradores" value={stats.residents} icon={Users} tone="primary" />
        <KpiCard label="Visitantes hoje" value={stats.visitorsToday} icon={ShieldCheck} tone="success" />
        <KpiCard label="Dentro agora" value={stats.activeVisits} icon={LogIn} tone="warning" />
        <KpiCard label="Incidentes abertos" value={0} hint="Em breve" icon={AlertTriangle} tone="danger" />
      </div>
    </div>
  );
}

function ResidentsTab({ uid }: { uid: string }) {
  const [list, setList] = useState<Resident[] | null>(null);
  const [form, setForm] = useState({ full_name: "", unit: "", phone: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("residents").select("id, full_name, unit, phone, notes").order("unit");
    if (error) setErr(error.message); else setList((data ?? []) as Resident[]);
  };
  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.unit) return;
    setSaving(true); setErr(null);
    const { error } = await supabase.from("residents").insert({ ...form, phone: form.phone || null, notes: form.notes || null, created_by: uid });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setForm({ full_name: "", unit: "", phone: "", notes: "" }); load();
  };
  const remove = async (id: string) => { if (confirm("Remover morador?")) { await supabase.from("residents").delete().eq("id", id); load(); } };
  const filtered = useMemo(() => (list ?? []).filter((r) => !q || r.full_name.toLowerCase().includes(q.toLowerCase()) || r.unit.toLowerCase().includes(q.toLowerCase())), [list, q]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Moradores <span className="text-sm font-normal text-muted-foreground">({list?.length ?? 0})</span></h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="rounded-xl border border-border bg-card px-3 py-2 text-sm" />
      </div>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
        <input required placeholder="Unidade (ex: Bloco A · 101)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={fld} />
        <input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fld} />
        <input placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fld} />
        <button disabled={saving} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          <Plus className="h-4 w-4" /> {saving ? "Salvando..." : "Adicionar morador"}
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>
      {list === null ? <Loader2 className="h-5 w-5 animate-spin" /> : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">Nenhum morador.</div>
      ) : (
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.unit}{r.phone ? ` · ${r.phone}` : ""}</div>
                {r.notes && <div className="mt-1 truncate text-xs text-muted-foreground">{r.notes}</div>}
              </div>
              <button onClick={() => remove(r.id)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VisitorsTab({ uid }: { uid: string }) {
  const [list, setList] = useState<Visitor[] | null>(null);
  const [form, setForm] = useState({ visitor_name: "", document: "", unit_visited: "", reason: "" });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("visitor_logs")
      .select("id, visitor_name, document, unit_visited, reason, entry_at, exit_at")
      .order("entry_at", { ascending: false }).limit(100);
    if (error) setErr(error.message); else setList((data ?? []) as Visitor[]);
  };
  useEffect(() => { load(); }, []);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.visitor_name || !form.unit_visited) return;
    setSaving(true); setErr(null);
    const { error } = await supabase.from("visitor_logs").insert({
      visitor_name: form.visitor_name, document: form.document || null,
      unit_visited: form.unit_visited, reason: form.reason || null, recorded_by: uid,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setForm({ visitor_name: "", document: "", unit_visited: "", reason: "" }); load();
  };
  const markExit = async (id: string) => { await supabase.from("visitor_logs").update({ exit_at: new Date().toISOString() }).eq("id", id); load(); };

  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">Portaria · Visitantes</h2>
      <form onSubmit={register} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Nome do visitante" value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} className={fld} />
        <input placeholder="Documento (RG/CPF)" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} className={fld} />
        <input required placeholder="Unidade visitada" value={form.unit_visited} onChange={(e) => setForm({ ...form, unit_visited: e.target.value })} className={fld} />
        <input placeholder="Motivo (entrega, visita...)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fld} />
        <button disabled={saving} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          <LogIn className="h-4 w-4" /> {saving ? "Registrando..." : "Registrar entrada"}
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>
      <div className="rounded-2xl border border-border bg-card">
        <div className="border-b border-border p-4 font-display font-semibold">Registros recentes ({list?.length ?? 0})</div>
        {list === null ? <div className="p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : list.length === 0 ? <div className="p-5 text-sm text-muted-foreground">Nenhum visitante registrado.</div>
          : <div className="divide-y divide-border">
              {list.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{v.visitor_name} <span className="text-xs text-muted-foreground">→ {v.unit_visited}</span></div>
                    <div className="truncate text-xs text-muted-foreground">
                      Entrada: {new Date(v.entry_at).toLocaleString("pt-BR")}
                      {v.exit_at && ` · Saída: ${new Date(v.exit_at).toLocaleString("pt-BR")}`}
                      {v.document && ` · Doc: ${v.document}`}
                    </div>
                    {v.reason && <div className="mt-1 truncate text-xs text-muted-foreground">{v.reason}</div>}
                  </div>
                  {!v.exit_at && (
                    <button onClick={() => markExit(v.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs hover:bg-secondary">
                      <Exit className="h-3.5 w-3.5" /> Saída
                    </button>
                  )}
                </div>
              ))}
            </div>}
      </div>
    </div>
  );
}

const fldSm = "rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function CrudList<T extends { id: string }>({ rows, loading, empty, render, onDelete }: { rows: T[] | null; loading?: boolean; empty: string; render: (r: T) => React.ReactNode; onDelete?: (id: string) => void }) {
  if (rows === null || loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (rows.length === 0) return <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">{empty}</div>;
  return (
    <div className="divide-y divide-border rounded-2xl border border-border bg-card">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">{render(r)}</div>
          {onDelete && (
            <button onClick={() => { if (confirm("Remover este item?")) onDelete(r.id); }} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

type Pkg = { id: string; recipient: string; unit: string; carrier: string | null; tracking_code: string | null; received_at: string; picked_up_at: string | null; notes: string | null };
function PackagesTab({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Pkg[] | null>(null);
  const [f, setF] = useState({ recipient: "", unit: "", carrier: "", tracking_code: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
  const load = async () => { const { data, error } = await supabase.from("cond_packages").select("*").order("received_at", { ascending: false }).limit(200); if (error) setErr(error.message); else setRows((data ?? []) as Pkg[]); };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!f.recipient || !f.unit) return; const { error } = await supabase.from("cond_packages").insert({ ...f, carrier: f.carrier || null, tracking_code: f.tracking_code || null, notes: f.notes || null, created_by: uid }); if (error) { setErr(error.message); return; } setF({ recipient: "", unit: "", carrier: "", tracking_code: "", notes: "" }); load(); };
  const pickup = async (id: string) => { await supabase.from("cond_packages").update({ picked_up_at: new Date().toISOString() }).eq("id", id); load(); };
  const del = async (id: string) => { await supabase.from("cond_packages").delete().eq("id", id); load(); };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Encomendas <span className="text-sm font-normal text-muted-foreground">({rows?.length ?? 0})</span></h2>
      </div>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Destinatário" value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} className={fld} />
        <input required placeholder="Unidade (ex: Bl A · 101)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={fld} />
        <input placeholder="Transportadora" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} className={fld} />
        <input placeholder="Código de rastreio" value={f.tracking_code} onChange={(e) => setF({ ...f, tracking_code: e.target.value })} className={fld} />
        <input placeholder="Observações" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${fld} sm:col-span-2`} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Registrar encomenda</button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>
      <CrudList rows={rows} empty="Nenhuma encomenda registrada." onDelete={del} render={(r) => (
        <div>
          <div className="font-medium">{r.recipient} <span className="text-xs text-muted-foreground">→ {r.unit}</span></div>
          <div className="text-xs text-muted-foreground">Recebido: {new Date(r.received_at).toLocaleString("pt-BR")}{r.carrier ? ` · ${r.carrier}` : ""}{r.tracking_code ? ` · ${r.tracking_code}` : ""}</div>
          {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
          <div className="mt-2">
            {r.picked_up_at ? <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">Retirado · {new Date(r.picked_up_at).toLocaleDateString("pt-BR")}</span>
              : <button onClick={() => pickup(r.id)} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-secondary">Marcar como retirado</button>}
          </div>
        </div>
      )} />
    </div>
  );
}

type Inc = { id: string; title: string; description: string | null; unit: string | null; severity: string; status: string; occurred_at: string; resolved_at: string | null };
function IncidentsTab({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Inc[] | null>(null);
  const [f, setF] = useState({ title: "", description: "", unit: "", severity: "medium" });
  const load = async () => { const { data } = await supabase.from("cond_incidents").select("*").order("occurred_at", { ascending: false }).limit(200); setRows((data ?? []) as Inc[]); };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!f.title) return; await supabase.from("cond_incidents").insert({ ...f, description: f.description || null, unit: f.unit || null, created_by: uid }); setF({ title: "", description: "", unit: "", severity: "medium" }); load(); };
  const resolve = async (id: string) => { await supabase.from("cond_incidents").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id); load(); };
  const del = async (id: string) => { await supabase.from("cond_incidents").delete().eq("id", id); load(); };
  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">Incidentes <span className="text-sm font-normal text-muted-foreground">({rows?.length ?? 0})</span></h2>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={fld} />
        <input placeholder="Unidade" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={fld} />
        <select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={fld}>
          <option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="critical">Crítica</option>
        </select>
        <textarea placeholder="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`${fld} sm:col-span-2`} rows={3} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Registrar incidente</button>
      </form>
      <CrudList rows={rows} empty="Nenhum incidente registrado." onDelete={del} render={(r) => {
        const tone = r.severity === "critical" ? "text-rose-400 bg-rose-500/10" : r.severity === "high" ? "text-orange-400 bg-orange-500/10" : r.severity === "medium" ? "text-amber-400 bg-amber-500/10" : "text-muted-foreground bg-secondary";
        return (
          <div>
            <div className="flex items-center gap-2"><span className="font-medium">{r.title}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>{r.severity}</span>{r.unit && <span className="text-xs text-muted-foreground">· {r.unit}</span>}</div>
            <div className="text-xs text-muted-foreground">{new Date(r.occurred_at).toLocaleString("pt-BR")}</div>
            {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
            <div className="mt-2">{r.status === "resolved" ? <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">Resolvido</span> : <button onClick={() => resolve(r.id)} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-secondary">Marcar como resolvido</button>}</div>
          </div>
        );
      }} />
    </div>
  );
}

type Mnt = { id: string; title: string; description: string | null; unit: string | null; assignee: string | null; status: string; priority: string; scheduled_for: string | null; completed_at: string | null };
function MaintenanceTab({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Mnt[] | null>(null);
  const [f, setF] = useState({ title: "", description: "", unit: "", assignee: "", priority: "normal", scheduled_for: "" });
  const load = async () => { const { data } = await supabase.from("cond_maintenance").select("*").order("created_at", { ascending: false }).limit(200); setRows((data ?? []) as Mnt[]); };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!f.title) return; await supabase.from("cond_maintenance").insert({ title: f.title, description: f.description || null, unit: f.unit || null, assignee: f.assignee || null, priority: f.priority, scheduled_for: f.scheduled_for || null, created_by: uid }); setF({ title: "", description: "", unit: "", assignee: "", priority: "normal", scheduled_for: "" }); load(); };
  const done = async (id: string) => { await supabase.from("cond_maintenance").update({ status: "done", completed_at: new Date().toISOString() }).eq("id", id); load(); };
  const del = async (id: string) => { await supabase.from("cond_maintenance").delete().eq("id", id); load(); };
  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">Manutenção <span className="text-sm font-normal text-muted-foreground">({rows?.length ?? 0})</span></h2>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Título do chamado" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={fld} />
        <input placeholder="Unidade" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={fld} />
        <input placeholder="Responsável" value={f.assignee} onChange={(e) => setF({ ...f, assignee: e.target.value })} className={fld} />
        <select value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} className={fld}>
          <option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
        </select>
        <input type="datetime-local" value={f.scheduled_for} onChange={(e) => setF({ ...f, scheduled_for: e.target.value })} className={fld} />
        <textarea placeholder="Descrição" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={`${fld} sm:col-span-2`} rows={3} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Abrir chamado</button>
      </form>
      <CrudList rows={rows} empty="Nenhum chamado aberto." onDelete={del} render={(r) => (
        <div>
          <div className="flex items-center gap-2"><span className="font-medium">{r.title}</span><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">{r.priority}</span>{r.unit && <span className="text-xs text-muted-foreground">· {r.unit}</span>}</div>
          {r.assignee && <div className="text-xs text-muted-foreground">Responsável: {r.assignee}</div>}
          {r.scheduled_for && <div className="text-xs text-muted-foreground">Agendado: {new Date(r.scheduled_for).toLocaleString("pt-BR")}</div>}
          {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
          <div className="mt-2">{r.status === "done" ? <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-400">Concluído</span> : <button onClick={() => done(r.id)} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-secondary">Concluir</button>}</div>
        </div>
      )} />
    </div>
  );
}

type Rsv = { id: string; area: string; unit: string; resident_name: string; starts_at: string; ends_at: string; status: string; notes: string | null };
function ReservationsTab({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Rsv[] | null>(null);
  const [f, setF] = useState({ area: "Salão de festas", unit: "", resident_name: "", starts_at: "", ends_at: "", notes: "" });
  const load = async () => { const { data } = await supabase.from("cond_reservations").select("*").order("starts_at", { ascending: false }).limit(200); setRows((data ?? []) as Rsv[]); };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!f.unit || !f.resident_name || !f.starts_at || !f.ends_at) return; await supabase.from("cond_reservations").insert({ area: f.area, unit: f.unit, resident_name: f.resident_name, starts_at: f.starts_at, ends_at: f.ends_at, notes: f.notes || null, created_by: uid }); setF({ area: "Salão de festas", unit: "", resident_name: "", starts_at: "", ends_at: "", notes: "" }); load(); };
  const cancel = async (id: string) => { await supabase.from("cond_reservations").update({ status: "cancelled" }).eq("id", id); load(); };
  const del = async (id: string) => { await supabase.from("cond_reservations").delete().eq("id", id); load(); };
  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">Reservas de áreas comuns <span className="text-sm font-normal text-muted-foreground">({rows?.length ?? 0})</span></h2>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className={fld}>
          {["Salão de festas", "Churrasqueira", "Piscina", "Quadra", "Espaço gourmet"].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input required placeholder="Unidade" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={fld} />
        <input required placeholder="Nome do morador" value={f.resident_name} onChange={(e) => setF({ ...f, resident_name: e.target.value })} className={`${fld} sm:col-span-2`} />
        <input required type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} className={fld} />
        <input required type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} className={fld} />
        <input placeholder="Observações" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={`${fld} sm:col-span-2`} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Criar reserva</button>
      </form>
      <CrudList rows={rows} empty="Nenhuma reserva." onDelete={del} render={(r) => (
        <div>
          <div className="flex items-center gap-2"><span className="font-medium">{r.area}</span><span className="text-xs text-muted-foreground">· {r.unit} · {r.resident_name}</span></div>
          <div className="text-xs text-muted-foreground">{new Date(r.starts_at).toLocaleString("pt-BR")} → {new Date(r.ends_at).toLocaleString("pt-BR")}</div>
          {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
          <div className="mt-2">{r.status === "cancelled" ? <span className="inline-flex items-center rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-400">Cancelada</span> : <button onClick={() => cancel(r.id)} className="rounded-lg border border-border bg-card px-3 py-1 text-xs hover:bg-secondary">Cancelar</button>}</div>
        </div>
      )} />
    </div>
  );
}

type Ntc = { id: string; title: string; body: string; pinned: boolean; created_at: string };
function NoticesTab({ uid }: { uid: string }) {
  const [rows, setRows] = useState<Ntc[] | null>(null);
  const [f, setF] = useState({ title: "", body: "", pinned: false });
  const load = async () => { const { data } = await supabase.from("cond_notices").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(200); setRows((data ?? []) as Ntc[]); };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => { e.preventDefault(); if (!f.title) return; await supabase.from("cond_notices").insert({ ...f, created_by: uid }); setF({ title: "", body: "", pinned: false }); load(); };
  const del = async (id: string) => { await supabase.from("cond_notices").delete().eq("id", id); load(); };
  return (
    <div className="space-y-5">
      <h2 className="font-display text-xl font-bold">Avisos do condomínio <span className="text-sm font-normal text-muted-foreground">({rows?.length ?? 0})</span></h2>
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5">
        <input required placeholder="Título" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={fld} />
        <textarea placeholder="Mensagem" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} className={fld} rows={4} />
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} className="h-4 w-4" /> Fixar no topo</label>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" /> Publicar aviso</button>
      </form>
      <CrudList rows={rows} empty="Nenhum aviso publicado." onDelete={del} render={(r) => (
        <div>
          <div className="flex items-center gap-2"><span className="font-medium">{r.title}</span>{r.pinned && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Fixado</span>}</div>
          <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")}</div>
          {r.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{r.body}</p>}
        </div>
      )} />
    </div>
  );
}
