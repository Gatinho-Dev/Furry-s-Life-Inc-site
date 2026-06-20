import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, LogOut, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/college/staff")({
  head: () => ({ meta: [{ title: "Painel Staff — Life College" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CollegeStaff,
});

type Student = { id: string; full_name: string; enrollment: string; course: string | null };
type Teacher = { id: string; full_name: string; email: string | null; department: string | null; bio: string | null };
type Klass = { id: string; name: string; teacher_id: string | null; schedule: string | null; room: string | null };

const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function CollegeStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<"students" | "teachers" | "classes">("students");

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth" }); }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!auth.hasAccess("college")) return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <div className="font-display text-xl font-semibold">Sem acesso</div>
        <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Painel central
        </Link>
        <button onClick={async () => { await auth.signOut(); nav({ to: "/auth" }); }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Life College</h1>
          <p className="text-sm text-muted-foreground">Gestão acadêmica.</p>
        </div>

        <div className="flex gap-2 border-b border-border">
          {(["students","teachers","classes"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "students" ? "Alunos" : t === "teachers" ? "Professores" : "Turmas"}
            </button>
          ))}
        </div>

        {tab === "students" && <StudentsTab />}
        {tab === "teachers" && <TeachersTab />}
        {tab === "classes" && <ClassesTab />}
      </main>
    </div>
  );
}

function StudentsTab() {
  const [list, setList] = useState<Student[] | null>(null);
  const [form, setForm] = useState({ full_name: "", enrollment: "", course: "" });
  const [err, setErr] = useState<string | null>(null);
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
  return (
    <>
      <form onSubmit={add} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-3">
        <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
        <input required placeholder="Matrícula" value={form.enrollment} onChange={(e) => setForm({ ...form, enrollment: e.target.value })} className={fld} />
        <input placeholder="Curso" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className={fld} />
        <button className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Adicionar aluno
        </button>
        {err && <div className="sm:col-span-3 text-sm text-destructive">{err}</div>}
      </form>
      <ListCard title="Alunos" count={list?.length}>
        {list?.map((s) => (
          <Row key={s.id} title={s.full_name} subtitle={`Matrícula ${s.enrollment}${s.course ? ` · ${s.course}` : ""}`} onRemove={() => remove(s.id)} />
        ))}
      </ListCard>
    </>
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
    <>
      <form onSubmit={add} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
        <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fld} />
        <input placeholder="Departamento" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={fld} />
        <input placeholder="Bio curta" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} className={fld} />
        <button className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> Adicionar professor
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>
      <ListCard title="Professores" count={list?.length}>
        {list?.map((t) => (
          <Row key={t.id} title={t.full_name} subtitle={[t.department, t.email].filter(Boolean).join(" · ") || "—"} onRemove={() => remove(t.id)} />
        ))}
      </ListCard>
    </>
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
    <>
      <form onSubmit={add} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
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
      <ListCard title="Turmas" count={list?.length}>
        {list?.map((c) => (
          <Row key={c.id} title={c.name}
            subtitle={[c.teacher?.full_name, c.schedule, c.room && `Sala ${c.room}`].filter(Boolean).join(" · ") || "—"}
            onRemove={() => remove(c.id)} />
        ))}
      </ListCard>
    </>
  );
}

function ListCard({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="glass-card mt-6 rounded-2xl">
      <div className="border-b border-border p-5 font-display font-semibold">{title} ({count ?? 0})</div>
      {count === undefined ? <div className="p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
        : count === 0 ? <div className="p-5 text-sm text-muted-foreground">Nada cadastrado ainda.</div>
        : <div className="divide-y divide-border">{children}</div>}
    </div>
  );
}

function Row({ title, subtitle, onRemove }: { title: string; subtitle: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between p-4">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <button onClick={onRemove} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
