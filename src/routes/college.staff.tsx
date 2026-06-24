import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, LayoutDashboard, GraduationCap, Users, BookOpen, CalendarDays, Bell } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { StaffShell, KpiCard, type ShellTab } from "@/components/staff/StaffShell";

export const Route = createFileRoute("/college/staff")({
  head: () => ({ meta: [{ title: "Painel Staff — Life College" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CollegeStaff,
});

type Student = { id: string; full_name: string; enrollment: string; course: string | null };
type Teacher = { id: string; full_name: string; email: string | null; department: string | null; bio: string | null };
type Klass = { id: string; name: string; teacher_id: string | null; schedule: string | null; room: string | null };
type TabKey = "dashboard" | "students" | "teachers" | "classes" | "calendar" | "notices";

const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function CollegeStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<TabKey>("dashboard");

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth", search: { redirect: "/college/staff" } }); }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!auth.hasAccess("college")) return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <div className="font-display text-xl font-semibold">Sem acesso a Life College</div>
        <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
      </div>
    </div>
  );

  const tabs: ShellTab<TabKey>[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "students", label: "Alunos", icon: GraduationCap },
    { key: "teachers", label: "Professores", icon: Users },
    { key: "classes", label: "Turmas", icon: BookOpen },
    { key: "calendar", label: "Calendário", icon: CalendarDays },
    { key: "notices", label: "Avisos", icon: Bell },
  ];

  return (
    <StaffShell brand="Life College" subtitle="Gestão acadêmica" tabs={tabs} active={tab} onSelect={setTab}>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "students" && <StudentsTab />}
      {tab === "teachers" && <TeachersTab />}
      {tab === "classes" && <ClassesTab />}
      {tab === "calendar" && <Placeholder title="Calendário acadêmico" hint="Eventos, provas e feriados aparecerão aqui." />}
      {tab === "notices" && <Placeholder title="Avisos" hint="Comunicados internos para professores e alunos." />}
    </StaffShell>
  );
}

function DashboardTab() {
  const [counts, setCounts] = useState({ students: 0, teachers: 0, classes: 0 });
  useEffect(() => {
    (async () => {
      const [s, t, c] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("teachers").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }),
      ]);
      setCounts({ students: s.count ?? 0, teachers: t.count ?? 0, classes: c.count ?? 0 });
    })();
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Bem-vindo ao Life College</h1>
        <p className="text-sm text-muted-foreground">Visão geral da instituição.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Alunos" value={counts.students} icon={GraduationCap} tone="primary" />
        <KpiCard label="Professores" value={counts.teachers} icon={Users} tone="success" />
        <KpiCard label="Turmas" value={counts.classes} icon={BookOpen} tone="warning" />
        <KpiCard label="Eventos" value={0} hint="Em breve" icon={CalendarDays} tone="danger" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="font-display text-lg font-semibold">Próximos passos</div>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>• Cadastre seus alunos e professores nas abas correspondentes.</li>
          <li>• Crie turmas associando professores.</li>
          <li>• Em breve: notas, frequência, mensalidades e calendário acadêmico.</li>
        </ul>
      </div>
    </div>
  );
}

function StudentsTab() {
  const [list, setList] = useState<Student[] | null>(null);
  const [form, setForm] = useState({ full_name: "", enrollment: "", course: "" });
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const load = async () => {
    const { data, error } = await supabase.from("students").select("id, full_name, enrollment, course").order("full_name");
    if (error) setErr(error.message); else setList((data ?? []) as Student[]);
  };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const { error } = await supabase.from("students").insert({ full_name: form.full_name, enrollment: form.enrollment, course: form.course || null });
    if (error) { setErr(error.message); return; }
    setForm({ full_name: "", enrollment: "", course: "" }); load();
  };
  const remove = async (id: string) => { if (confirm("Remover aluno?")) { await supabase.from("students").delete().eq("id", id); load(); } };
  const filtered = useMemo(() => (list ?? []).filter((s) => !q || s.full_name.toLowerCase().includes(q.toLowerCase()) || s.enrollment.includes(q)), [list, q]);
  return (
    <div className="space-y-5">
      <SectionHeader title="Alunos" count={list?.length} search={q} onSearch={setQ} />
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-3">
        <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
        <input required placeholder="Matrícula" value={form.enrollment} onChange={(e) => setForm({ ...form, enrollment: e.target.value })} className={fld} />
        <input placeholder="Curso" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className={fld} />
        <button className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Adicionar aluno
        </button>
        {err && <div className="sm:col-span-3 text-sm text-destructive">{err}</div>}
      </form>
      <ListCard count={filtered.length} empty="Nenhum aluno.">
        {filtered.map((s) => (
          <Row key={s.id} title={s.full_name} subtitle={`Matrícula ${s.enrollment}${s.course ? ` · ${s.course}` : ""}`} onRemove={() => remove(s.id)} />
        ))}
      </ListCard>
    </div>
  );
}

function TeachersTab() {
  const [list, setList] = useState<Teacher[] | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", department: "", bio: "" });
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    const { data, error } = await supabase.from("teachers").select("id, full_name, email, department, bio").order("full_name");
    if (error) setErr(error.message); else setList((data ?? []) as Teacher[]);
  };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const { error } = await supabase.from("teachers").insert({
      full_name: form.full_name, email: form.email || null,
      department: form.department || null, bio: form.bio || null,
    });
    if (error) { setErr(error.message); return; }
    setForm({ full_name: "", email: "", department: "", bio: "" }); load();
  };
  const remove = async (id: string) => { if (confirm("Remover professor?")) { await supabase.from("teachers").delete().eq("id", id); load(); } };
  return (
    <div className="space-y-5">
      <SectionHeader title="Professores" count={list?.length} />
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fld} />
        <input placeholder="Departamento" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={fld} />
        <input placeholder="Bio curta" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={fld} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Adicionar professor
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>
      <ListCard count={list?.length} empty="Nenhum professor.">
        {list?.map((t) => (
          <Row key={t.id} title={t.full_name} subtitle={[t.department, t.email].filter(Boolean).join(" · ") || "—"} onRemove={() => remove(t.id)} />
        ))}
      </ListCard>
    </div>
  );
}

function ClassesTab() {
  const [list, setList] = useState<(Klass & { teacher: { full_name: string } | null })[] | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [form, setForm] = useState({ name: "", teacher_id: "", schedule: "", room: "" });
  const [err, setErr] = useState<string | null>(null);
  const load = async () => {
    const { data, error } = await supabase.from("classes")
      .select("id, name, teacher_id, schedule, room, teacher:teachers(full_name)")
      .order("name");
    if (error) setErr(error.message); else setList((data ?? []) as unknown as (Klass & { teacher: { full_name: string } | null })[]);
    const { data: ts } = await supabase.from("teachers").select("id, full_name, email, department, bio").order("full_name");
    setTeachers((ts ?? []) as Teacher[]);
  };
  useEffect(() => { load(); }, []);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const { error } = await supabase.from("classes").insert({
      name: form.name, teacher_id: form.teacher_id || null,
      schedule: form.schedule || null, room: form.room || null,
    });
    if (error) { setErr(error.message); return; }
    setForm({ name: "", teacher_id: "", schedule: "", room: "" }); load();
  };
  const remove = async (id: string) => { if (confirm("Remover turma?")) { await supabase.from("classes").delete().eq("id", id); load(); } };
  return (
    <div className="space-y-5">
      <SectionHeader title="Turmas" count={list?.length} />
      <form onSubmit={add} className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
        <input required placeholder="Nome da turma" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fld} />
        <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })} className={fld}>
          <option value="">— Professor —</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
        </select>
        <input placeholder="Horário (ex: Seg/Qua 14h)" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} className={fld} />
        <input placeholder="Sala" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={fld} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Adicionar turma
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>
      <ListCard count={list?.length} empty="Nenhuma turma.">
        {list?.map((c) => (
          <Row key={c.id} title={c.name}
            subtitle={[c.teacher?.full_name, c.schedule, c.room && `Sala ${c.room}`].filter(Boolean).join(" · ") || "—"}
            onRemove={() => remove(c.id)} />
        ))}
      </ListCard>
    </div>
  );
}

function SectionHeader({ title, count, search, onSearch }: { title: string; count?: number; search?: string; onSearch?: (s: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-display text-xl font-bold">{title} {count !== undefined && <span className="text-sm font-normal text-muted-foreground">({count})</span>}</h2>
      {onSearch && <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar..." className="rounded-xl border border-border bg-card px-3 py-2 text-sm" />}
    </div>
  );
}

function ListCard({ count, children, empty }: { count?: number; children: React.ReactNode; empty: string }) {
  if (count === undefined) return <div className="rounded-2xl border border-border bg-card p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (count === 0) return <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">{empty}</div>;
  return <div className="divide-y divide-border rounded-2xl border border-border bg-card">{children}</div>;
}

function Row({ title, subtitle, onRemove }: { title: string; subtitle: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div className="min-w-0">
        <div className="truncate font-medium">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <button onClick={onRemove} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
      <div className="font-display text-xl font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}
