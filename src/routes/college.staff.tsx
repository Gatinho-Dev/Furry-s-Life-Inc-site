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

function CollegeStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [students, setStudents] = useState<Student[] | null>(null);
  const [form, setForm] = useState({ full_name: "", enrollment: "", course: "" });
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth" }); }, [auth.loading, auth.user, nav]);

  const load = async () => {
    const { data, error } = await supabase.from("students").select("id, full_name, enrollment, course").order("full_name");
    if (error) setErr(error.message); else setStudents((data ?? []) as Student[]);
  };
  useEffect(() => { if (auth.user) load(); }, [auth.user]);

  if (auth.loading || !auth.user) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!auth.hasAccess("college")) return (
    <div className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <div className="font-display text-xl font-semibold">Sem acesso</div>
        <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
      </div>
    </div>
  );

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await supabase.from("students").insert({
      full_name: form.full_name, enrollment: form.enrollment,
      course: form.course || null,
    });
    if (error) { setErr(error.message); return; }
    setForm({ full_name: "", enrollment: "", course: "" });
    load();
  };
  const remove = async (id: string) => { if (confirm("Remover aluno?")) { await supabase.from("students").delete().eq("id", id); load(); } };

  const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

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
          <h1 className="font-display text-2xl font-bold">Life College · Alunos</h1>
          <p className="text-sm text-muted-foreground">Gerencie matrículas e cursos.</p>
        </div>
        <form onSubmit={add} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-3">
          <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
          <input required placeholder="Matrícula" value={form.enrollment} onChange={(e) => setForm({ ...form, enrollment: e.target.value })} className={fld} />
          <input placeholder="Curso" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} className={fld} />
          <button className="sm:col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Adicionar aluno
          </button>
          {err && <div className="sm:col-span-3 text-sm text-destructive">{err}</div>}
        </form>
        <div className="glass-card rounded-2xl">
          <div className="border-b border-border p-5 font-display font-semibold">Alunos ({students?.length ?? 0})</div>
          {students === null ? <div className="p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
            : students.length === 0 ? <div className="p-5 text-sm text-muted-foreground">Nenhum aluno cadastrado.</div>
            : <div className="divide-y divide-border">
                {students.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{s.full_name}</div>
                      <div className="text-xs text-muted-foreground">Matrícula {s.enrollment}{s.course ? ` · ${s.course}` : ""}</div>
                    </div>
                    <button onClick={() => remove(s.id)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>}
        </div>
      </main>
    </div>
  );
}
