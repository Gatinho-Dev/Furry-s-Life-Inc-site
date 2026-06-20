import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, LogOut, ArrowLeft, LogIn, LogOut as Exit } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/cond/staff")({
  head: () => ({ meta: [{ title: "Painel Staff — Furry's Life Cond." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CondStaff,
});

type Resident = { id: string; full_name: string; unit: string; phone: string | null; notes: string | null };
type Visitor = { id: string; visitor_name: string; document: string | null; unit_visited: string; reason: string | null; entry_at: string; exit_at: string | null };

const fld = "rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const Center = ({ children }: { children: React.ReactNode }) => <div className="flex min-h-screen items-center justify-center px-4">{children}</div>;

function CondStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<"residents" | "visitors">("residents");

  useEffect(() => { if (!auth.loading && !auth.user) nav({ to: "/auth" }); }, [auth.loading, auth.user, nav]);

  if (auth.loading || !auth.user) return <Center><Loader2 className="h-6 w-6 animate-spin" /></Center>;
  if (!auth.hasAccess("cond")) {
    return <Center><div className="text-center">
      <div className="font-display text-xl font-semibold">Sem acesso</div>
      <p className="mt-2 text-sm text-muted-foreground">Peça ao CEO/Admin para liberar acesso a esta subsidiária.</p>
      <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
    </div></Center>;
  }

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
          <h1 className="font-display text-2xl font-bold">Furry's Life Cond.</h1>
          <p className="text-sm text-muted-foreground">Gestão de moradores e portaria.</p>
        </div>

        <div className="flex gap-2 border-b border-border">
          {(["residents","visitors"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "residents" ? "Moradores" : "Portaria · Visitantes"}
            </button>
          ))}
        </div>

        {tab === "residents" ? <ResidentsTab uid={auth.user.id} /> : <VisitorsTab uid={auth.user.id} />}
      </main>
    </div>
  );
}

function ResidentsTab({ uid }: { uid: string }) {
  const [list, setList] = useState<Resident[] | null>(null);
  const [form, setForm] = useState({ full_name: "", unit: "", phone: "", notes: "" });
  const [err, setErr] = useState<string | null>(null);
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

  return (
    <>
      <form onSubmit={add} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
        <input required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={fld} />
        <input required placeholder="Unidade (ex: Bloco A · 101)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={fld} />
        <input placeholder="Telefone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={fld} />
        <input placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fld} />
        <button disabled={saving} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          <Plus className="h-4 w-4" /> {saving ? "Salvando..." : "Adicionar morador"}
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>

      <div className="glass-card rounded-2xl">
        <div className="border-b border-border p-5 font-display font-semibold">Moradores ({list?.length ?? 0})</div>
        {list === null ? <div className="p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : list.length === 0 ? <div className="p-5 text-sm text-muted-foreground">Nenhum morador cadastrado.</div>
          : <div className="divide-y divide-border">
              {list.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <div className="font-medium">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.unit}{r.phone ? ` · ${r.phone}` : ""}</div>
                    {r.notes && <div className="mt-1 text-xs text-muted-foreground">{r.notes}</div>}
                  </div>
                  <button onClick={() => remove(r.id)} className="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>}
      </div>
    </>
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
    <>
      <form onSubmit={register} className="glass-card grid gap-3 rounded-2xl p-5 sm:grid-cols-2">
        <input required placeholder="Nome do visitante" value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} className={fld} />
        <input placeholder="Documento (RG/CPF)" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} className={fld} />
        <input required placeholder="Unidade visitada" value={form.unit_visited} onChange={(e) => setForm({ ...form, unit_visited: e.target.value })} className={fld} />
        <input placeholder="Motivo (entrega, visita...)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={fld} />
        <button disabled={saving} className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-70">
          <LogIn className="h-4 w-4" /> {saving ? "Registrando..." : "Registrar entrada"}
        </button>
        {err && <div className="sm:col-span-2 text-sm text-destructive">{err}</div>}
      </form>

      <div className="glass-card rounded-2xl">
        <div className="border-b border-border p-5 font-display font-semibold">Registros recentes ({list?.length ?? 0})</div>
        {list === null ? <div className="p-5"><Loader2 className="h-5 w-5 animate-spin" /></div>
          : list.length === 0 ? <div className="p-5 text-sm text-muted-foreground">Nenhum visitante registrado.</div>
          : <div className="divide-y divide-border">
              {list.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-medium">{v.visitor_name} <span className="text-xs text-muted-foreground">→ {v.unit_visited}</span></div>
                    <div className="text-xs text-muted-foreground">
                      Entrada: {new Date(v.entry_at).toLocaleString("pt-BR")}
                      {v.exit_at && ` · Saída: ${new Date(v.exit_at).toLocaleString("pt-BR")}`}
                      {v.document && ` · Doc: ${v.document}`}
                    </div>
                    {v.reason && <div className="mt-1 text-xs text-muted-foreground">{v.reason}</div>}
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
    </>
  );
}
