import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Mail, KeyRound, Link2, Banknote, Search, RefreshCw } from "lucide-react";
import {
  staffListWorkers, staffUpdateWorker, staffChangeEmail, staffUnifyPassword,
  staffSetLifepayPin, staffPaySalary, type WorkerRow,
} from "@/lib/staff-directory.functions";

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function useWorkers() {
  const listFn = useServerFn(staffListWorkers);
  const [rows, setRows] = React.useState<WorkerRow[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    setErr(null);
    try { setRows(await listFn({})); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha ao carregar."); }
  }, [listFn]);
  React.useEffect(() => { void load(); }, [load]);
  return { rows, err, load, setErr };
}

function Toolbar({ q, setQ, onReload }: { q: string; setQ: (v: string) => void; onReload: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[12rem]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou cargo"
          className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground" />
      </div>
      <button onClick={onReload} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary">
        <RefreshCw className="h-3.5 w-3.5" /> Atualizar
      </button>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";

/* ---------------- Trabalhadores (cargos + salários) ---------------- */
export function WorkersPanel() {
  const { rows, err, load, setErr } = useWorkers();
  const updateFn = useServerFn(staffUpdateWorker);
  const payFn = useServerFn(staffPaySalary);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<Record<string, Partial<WorkerRow>>>({});

  const filtered = (rows ?? []).filter((r) =>
    `${r.full_name ?? ""} ${r.email ?? ""} ${r.job_title ?? ""} ${r.department ?? ""}`.toLowerCase()
      .includes(q.toLowerCase()));

  const field = (r: WorkerRow, k: keyof WorkerRow) => (draft[r.id]?.[k] ?? r[k]) as any;
  const set = (id: string, k: keyof WorkerRow, v: unknown) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: v } }));

  const save = async (r: WorkerRow) => {
    setBusy(r.id); setErr(null); setMsg(null);
    try {
      await updateFn({ data: {
        user_id: r.id,
        full_name: String(field(r, "full_name") ?? ""),
        job_title: String(field(r, "job_title") ?? ""),
        department: String(field(r, "department") ?? ""),
        salary_cents: Math.round(Number(field(r, "salary_cents")) || 0),
        salary_day: Math.round(Number(field(r, "salary_day")) || 5),
      } });
      setDraft((d) => { const n = { ...d }; delete n[r.id]; return n; });
      setMsg("Dados do trabalhador atualizados.");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar."); }
    finally { setBusy(null); }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Trabalhadores</h2>
        <p className="text-sm text-muted-foreground">Cargo, setor e salário de cada pessoa da empresa. O salário é creditado no saldo LifePay.</p>
      </div>
      <Toolbar q={q} setQ={setQ} onReload={load} />
      {err && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
      {msg && <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{msg}</p>}
      {!rows ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display font-semibold">{r.full_name ?? r.email}</div>
                <div className="text-xs text-muted-foreground">{r.email} · {r.role}</div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="text-xs text-muted-foreground">Nome
                  <input className={`${inputCls} mt-1`} value={field(r, "full_name") ?? ""} onChange={(e) => set(r.id, "full_name", e.target.value)} />
                </label>
                <label className="text-xs text-muted-foreground">Cargo
                  <input className={`${inputCls} mt-1`} value={field(r, "job_title") ?? ""} onChange={(e) => set(r.id, "job_title", e.target.value)} placeholder="ex.: Porteiro" />
                </label>
                <label className="text-xs text-muted-foreground">Setor
                  <input className={`${inputCls} mt-1`} value={field(r, "department") ?? ""} onChange={(e) => set(r.id, "department", e.target.value)} placeholder="ex.: Life Cond" />
                </label>
                <label className="text-xs text-muted-foreground">Salário (R$)
                  <input type="number" min={0} step="0.01" className={`${inputCls} mt-1`}
                    value={(Number(field(r, "salary_cents")) || 0) / 100}
                    onChange={(e) => set(r.id, "salary_cents", Math.round(Number(e.target.value) * 100))} />
                </label>
                <label className="text-xs text-muted-foreground">Dia do pagamento
                  <input type="number" min={1} max={28} className={`${inputCls} mt-1`}
                    value={Number(field(r, "salary_day")) || 5}
                    onChange={(e) => set(r.id, "salary_day", Number(e.target.value))} />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={() => void save(r)} disabled={busy === r.id}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                  {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                </button>
                <button
                  onClick={async () => {
                    setBusy(r.id); setErr(null); setMsg(null);
                    try { await payFn({ data: { user_id: r.id } }); setMsg(`Salário de ${brl(r.salary_cents)} pago.`); await load(); }
                    catch (e) { setErr(e instanceof Error ? e.message : "Falha ao pagar."); }
                    finally { setBusy(null); }
                  }}
                  disabled={busy === r.id || !r.salary_cents}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
                  <Banknote className="h-3.5 w-3.5" /> Pagar salário agora
                </button>
                <span className="text-xs text-muted-foreground">
                  Salário atual: {brl(r.salary_cents)} · dia {r.salary_day} · LifePay: {r.lifepay_status ?? "sem conta"}
                </span>
              </div>
            </div>
          ))}
          {!filtered.length && <p className="text-sm text-muted-foreground">Nenhum trabalhador encontrado.</p>}
        </div>
      )}
    </section>
  );
}

/* ---------------- E-mails e credenciais ---------------- */
export function EmailsPanel() {
  const { rows, err, load, setErr } = useWorkers();
  const emailFn = useServerFn(staffChangeEmail);
  const unifyFn = useServerFn(staffUnifyPassword);
  const pinFn = useServerFn(staffSetLifepayPin);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [emailDraft, setEmailDraft] = React.useState<Record<string, string>>({});
  const [pwDraft, setPwDraft] = React.useState<Record<string, string>>({});
  const [pinDraft, setPinDraft] = React.useState<Record<string, string>>({});

  const filtered = (rows ?? []).filter((r) =>
    `${r.full_name ?? ""} ${r.email ?? ""} ${r.department ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  const run = async (id: string, fn: () => Promise<void>, ok: string) => {
    setBusy(id); setErr(null); setMsg(null);
    try { await fn(); setMsg(ok); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha na operação."); }
    finally { setBusy(null); }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">E-mails & credenciais</h2>
        <p className="text-sm text-muted-foreground">
          Todos os e-mails criados nas subsidiárias. Troque o e-mail de acesso, unifique a senha do site com a do
          LifePay ou redefina apenas o PIN do LifePay.
        </p>
      </div>
      <Toolbar q={q} setQ={setQ} onReload={load} />
      {err && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{err}</p>}
      {msg && <p className="rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm text-primary">{msg}</p>}
      {!rows ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="glass-card rounded-2xl p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display font-semibold">{r.email}</div>
                <div className="text-xs text-muted-foreground">
                  {r.department ?? "sem setor"} · {r.job_title ?? "sem cargo"} · PIN LifePay: {r.has_pin ? "definido" : "não definido"}
                  {r.lifepay_email && r.lifepay_email !== r.email ? " · LifePay com e-mail diferente" : ""}
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Novo e-mail de acesso (site + LifePay)</label>
                  <input className={inputCls} placeholder={r.email ?? ""} value={emailDraft[r.id] ?? ""}
                    onChange={(e) => setEmailDraft((d) => ({ ...d, [r.id]: e.target.value }))} />
                  <button disabled={busy === r.id || !emailDraft[r.id]}
                    onClick={() => void run(r.id, async () => { await emailFn({ data: { user_id: r.id, email: emailDraft[r.id]! } }); setEmailDraft((d) => ({ ...d, [r.id]: "" })); }, "E-mail atualizado em todos os sistemas.")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
                    <Mail className="h-3.5 w-3.5" /> Trocar e-mail
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Senha unificada (site, staff e LifePay)</label>
                  <input type="password" className={inputCls} placeholder="8+ caracteres, letra e número"
                    value={pwDraft[r.id] ?? ""} onChange={(e) => setPwDraft((d) => ({ ...d, [r.id]: e.target.value }))} />
                  <button disabled={busy === r.id || !pwDraft[r.id]}
                    onClick={() => void run(r.id, async () => { await unifyFn({ data: { user_id: r.id, password: pwDraft[r.id]! } }); setPwDraft((d) => ({ ...d, [r.id]: "" })); }, "Senha unificada aplicada (PIN antigo do LifePay removido).")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                    <Link2 className="h-3.5 w-3.5" /> Unificar senha
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">PIN do LifePay (4–8 dígitos)</label>
                  <input inputMode="numeric" className={inputCls} placeholder="ex.: 1234"
                    value={pinDraft[r.id] ?? ""} onChange={(e) => setPinDraft((d) => ({ ...d, [r.id]: e.target.value }))} />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy === r.id || !pinDraft[r.id]}
                      onClick={() => void run(r.id, async () => { await pinFn({ data: { user_id: r.id, pin: pinDraft[r.id]! } }); setPinDraft((d) => ({ ...d, [r.id]: "" })); }, "PIN do LifePay definido.")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
                      <KeyRound className="h-3.5 w-3.5" /> Definir PIN
                    </button>
                    <button disabled={busy === r.id || !r.has_pin}
                      onClick={() => void run(r.id, async () => { await pinFn({ data: { user_id: r.id, pin: null } }); }, "PIN do LifePay removido.")}
                      className="rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium hover:bg-secondary disabled:opacity-50">
                      Remover PIN
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {!filtered.length && <p className="text-sm text-muted-foreground">Nenhum e-mail encontrado.</p>}
        </div>
      )}
    </section>
  );
}
