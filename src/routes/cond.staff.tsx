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
      {tab === "notices" && <NoticesTab uid={auth.user.id} />
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

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
      <div className="font-display text-xl font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      <p className="mt-1 text-xs text-muted-foreground">Esta seção será ativada em breve.</p>
    </div>
  );
}
