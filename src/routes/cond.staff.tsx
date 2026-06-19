import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, LogOut, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cond/staff")({
  head: () => ({ meta: [{ title: "Painel Staff — Furry's Life Cond." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CondStaff,
});

type Resident = { id: string; full_name: string; unit: string; contact: string | null; notes: string | null };

function CondStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [residents, setResidents] = useState<Resident[] | null>(null);
  const [form, setForm] = useState({ full_name: "", unit: "", contact: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth" }); }, [auth.loading, auth.user, nav]);

  const load = async () => {
    const { data, error } = await supabase.from("residents").select("id, full_name, unit, contact, notes").order("unit");
    if (error) setErr(error.message); else setResidents((data ?? []) as Resident[]);
  };
  useEffect(() => { if (auth.user) load(); }, [auth.user]);

  if (auth.loading || !auth.user) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;
  if (!auth.hasAccess("cond")) {
    return <Center><div className="text-center">
      <div className="font-display text-xl font-semibold">Sem acesso</div>
      <p className="mt-2 text-sm text-muted-foreground">Peça ao CEO/Admin para liberar acesso a esta subsidiária.</p>
      <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
    </div></Center>;
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.unit) return;
    setSaving(true); setErr(null);
    const { error } = await supabase.from("residents").insert({
      full_name: form.full_name, unit: form.unit,
      contact: form.contact || null, notes: form.notes || null,
      created_by: auth.user!.id,
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setForm({ full_name: "", unit: "", contact: "", notes: "" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Remover morador?")) return;
    await supabase.from("residents").delete().eq("id", id);
    load();
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Painel central
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{auth.user.email}</span>
          <button onClick={async () => { await auth.signOut(); nav({ to: "/auth" }); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Furry's Life Cond. · Moradores</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie os moradores do condomínio.</p>
        </div>

        <form onSubmit={add} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
          <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
          <input required placeholder="Unidade (ex: Bloco A · 101)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={fld} />
          <input placeholder="Contato" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className={fld} />
          <input placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fld} />
          <button disabled={saving} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
            <Plus className="h-4 w-4" /> {saving ? "Salvando..." : "Adicionar morador"}
          </button>
          {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
        </form>

        <div className="glass-card rounded-2xl">
          <div className="border-b border-border p-5 font-display font-semibold">
            Moradores ({residents?.length ?? 0})
          </div>
          {residents === null ? <div className="p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
            : residents.length === 0 ? <div className="p-5 text-sm text-muted-foreground">Nenhum morador cadastrado.</div>
            : <div className="divide-y divide-border">
                {residents.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                    <div>
                      <div className="font-medium">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">{r.unit}{r.contact ? ` · ${r.contact}` : ""}</div>
                      {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
                    </div>
                    <button onClick={() => remove(r.id)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
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

const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;
