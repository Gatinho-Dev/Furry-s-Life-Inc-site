import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Loader2, Users, ShieldCheck, ScrollText, Search, RefreshCw, Plus, Wallet, KeyRound, Lock, Unlock,
} from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { StaffShell, KpiCard, type ShellTab } from "@/components/staff/StaffShell";
import { LpAlert, LpSheet, LIFEPAY_CSS } from "@/components/lifepay/ui";
import { LIFEPAY_PERMISSIONS, ACCOUNT_TYPES, ACCOUNT_STATUS_LABEL, formatBRL, parseBRLToCents } from "@/lib/lifepay-perms";
import {
  lifepayAdminMyPerms, lifepayAdminListAccounts, lifepayAdminCreateAccount, lifepayAdminUpdateAccount,
  lifepayAdminAdjustBalance, lifepayAdminResetPassword, lifepayAdminAccountDetail,
  lifepayAdminSetPermissions, lifepayAdminAudit,
} from "@/lib/lifepay.functions";

export const Route = createFileRoute("/lifepay/staff")({
  head: () => ({ meta: [{ title: "Console LifePay — Staff" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LifePayStaff,
});

type TabKey = "accounts" | "permissions" | "audit";
type Account = Awaited<ReturnType<typeof lifepayAdminListAccounts>>[number];

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("pt-BR") : "—");

function LifePayStaff() {
  const nav = useNavigate();
  const auth = useAuth();
  const [tab, setTab] = useState<TabKey>("accounts");

  const myPermsFn = useServerFn(lifepayAdminMyPerms);
  const listFn = useServerFn(lifepayAdminListAccounts);

  const [perms, setPerms] = useState<{ isCeoOrAdmin: boolean; permissions: string[] } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.loading && !auth.user) nav({ to: "/auth", search: { redirect: "/lifepay/staff" } });
  }, [auth.loading, auth.user, nav]);

  const can = useCallback(
    (p: string) => !!perms && (perms.isCeoOrAdmin || perms.permissions.includes(p)),
    [perms],
  );

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const mp = await myPermsFn({});
      setPerms(mp);
      if (mp.isCeoOrAdmin || mp.permissions.includes("view")) setAccounts(await listFn({}));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao carregar o console.");
    } finally { setLoading(false); }
  }, [myPermsFn, listFn]);

  useEffect(() => { if (auth.user) void reload(); }, [auth.user, reload]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return accounts;
    return accounts.filter((a) =>
      [a.full_name, a.display_name, a.email, a.pix_key].some((v) => (v ?? "").toLowerCase().includes(t)));
  }, [accounts, q]);

  const totals = useMemo(() => ({
    count: accounts.length,
    active: accounts.filter((a) => a.status === "active").length,
    blocked: accounts.filter((a) => a.status === "blocked").length,
    balance: accounts.reduce((s, a) => s + (a.balance ?? 0), 0),
  }), [accounts]);

  if (auth.loading || !auth.user) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (!auth.hasAccess("lifepay")) {
    return <div className="flex min-h-screen items-center justify-center px-4 text-center"><div>
      <div className="font-display text-xl font-semibold">Sem acesso ao LifePay</div>
      <p className="mt-2 text-sm text-muted-foreground">Peça ao CEO/Admin para liberar acesso.</p>
      <Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-primary hover:underline">Voltar ao painel</Link>
    </div></div>;
  }

  const tabs: ShellTab<TabKey>[] = [
    { key: "accounts", label: "Contas", icon: Users },
    { key: "permissions", label: "Permissões", icon: ShieldCheck },
    { key: "audit", label: "Auditoria", icon: ScrollText },
  ];

  return (
    <StaffShell brand="LifePay" subtitle="Console administrativo" tabs={tabs} active={tab} onSelect={setTab}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold">Console LifePay</h1>
            <p className="text-sm text-muted-foreground">
              {perms?.isCeoOrAdmin ? "Acesso total (CEO/Admin)" : `Permissões: ${perms?.permissions.join(", ") || "nenhuma"}`}
            </p>
          </div>
          <button onClick={() => { setLoading(true); void reload(); }} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm hover:bg-secondary">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
        </div>

        {err && <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{err}</div>}
        {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>}

        {!loading && perms && !can("view") && (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-sm text-muted-foreground">
            Você tem acesso ao LifePay, mas nenhuma permissão administrativa foi concedida. Peça ao CEO/Admin.
          </div>
        )}

        {!loading && can("view") && tab === "accounts" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Contas" value={totals.count} icon={Users} tone="primary" />
              <KpiCard label="Ativas" value={totals.active} icon={ShieldCheck} tone="success" />
              <KpiCard label="Bloqueadas" value={totals.blocked} icon={Lock} tone="danger" />
              <KpiCard label="Saldo total" value={formatBRL(totals.balance)} icon={Wallet} tone="warning" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou chave"
                  className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
              </div>
              {can("create") && (
                <button onClick={() => setOpenCreate(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                  <Plus className="h-4 w-4" /> Nova conta
                </button>
              )}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Titular</th>
                    <th className="px-4 py-3">Chave</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-right">Limite</th>
                    <th className="px-4 py-3">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a) => (
                    <tr key={a.user_id} onClick={() => setSelected(a.user_id)}
                      className="cursor-pointer border-t border-border hover:bg-secondary/40">
                      <td className="px-4 py-3">
                        <div className="font-medium">{a.full_name ?? a.display_name}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.pix_key}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${a.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                          {ACCOUNT_STATUS_LABEL[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatBRL(a.balance)}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{formatBRL(a.credit_limit)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(a.last_access_at)}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhuma conta encontrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && tab === "permissions" && (
          <PermissionsPanel accounts={accounts} isCeoOrAdmin={!!perms?.isCeoOrAdmin} />
        )}

        {!loading && tab === "audit" && <AuditPanel canAudit={can("audit")} />}
      </div>

      <div className="lp-root" style={{ minHeight: 0, background: "transparent" }}>
        <style dangerouslySetInnerHTML={{ __html: LIFEPAY_CSS }} />
        <CreateAccountSheet open={openCreate} onClose={() => setOpenCreate(false)} onDone={reload} />
        <AccountSheet userId={selected} can={can} onClose={() => setSelected(null)} onDone={reload} />
      </div>

    </StaffShell>
  );
}

/* ------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function CreateAccountSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const create = useServerFn(lifepayAdminCreateAccount);
  const [f, setF] = useState({
    full_name: "", email: "", password: "", confirm: "", status: "active", account_type: "standard",
    balance: "", credit_limit: "", closing_day: "5", due_day: "15", admin_notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await create({ data: {
        full_name: f.full_name, email: f.email, password: f.password, confirm: f.confirm,
        status: f.status, account_type: f.account_type,
        balance: f.balance ? parseBRLToCents(f.balance) : 0,
        credit_limit: f.credit_limit ? parseBRLToCents(f.credit_limit) : 0,
        closing_day: Number(f.closing_day), due_day: Number(f.due_day),
        admin_notes: f.admin_notes || undefined,
      } });
      await onDone(); onClose();
      setF({ full_name: "", email: "", password: "", confirm: "", status: "active", account_type: "standard",
        balance: "", credit_limit: "", closing_day: "5", due_day: "15", admin_notes: "" });
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao criar a conta."); }
    finally { setBusy(false); }
  };

  return (
    <LpSheet open={open} onClose={onClose} title="Nova conta LifePay">
      <form onSubmit={submit} className="space-y-3">
        <Field label="Nome completo"><input className={inputCls} value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
        <Field label="E-mail"><input className={inputCls} type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Senha inicial"><input className={inputCls} type="password" value={f.password} onChange={(e) => set("password", e.target.value)} /></Field>
          <Field label="Confirmar senha"><input className={inputCls} type="password" value={f.confirm} onChange={(e) => set("confirm", e.target.value)} /></Field>
          <Field label="Saldo inicial (R$)"><input className={inputCls} value={f.balance} onChange={(e) => set("balance", e.target.value)} placeholder="0,00" /></Field>
          <Field label="Limite de crédito (R$)"><input className={inputCls} value={f.credit_limit} onChange={(e) => set("credit_limit", e.target.value)} placeholder="0,00" /></Field>
          <Field label="Fechamento (dia)"><input className={inputCls} inputMode="numeric" value={f.closing_day} onChange={(e) => set("closing_day", e.target.value)} /></Field>
          <Field label="Vencimento (dia)"><input className={inputCls} inputMode="numeric" value={f.due_day} onChange={(e) => set("due_day", e.target.value)} /></Field>
          <Field label="Tipo de conta">
            <select className={inputCls} value={f.account_type} onChange={(e) => set("account_type", e.target.value)}>
              {ACCOUNT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Ativa</option><option value="blocked">Bloqueada</option>
            </select>
          </Field>
        </div>
        <Field label="Observações internas"><textarea className={inputCls} rows={2} value={f.admin_notes} onChange={(e) => set("admin_notes", e.target.value)} /></Field>
        {err && <LpAlert>{err}</LpAlert>}
        <button type="submit" disabled={busy} className="lp-btn lp-btn-primary w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar conta"}
        </button>
      </form>
    </LpSheet>
  );
}

function AccountSheet({ userId, can, onClose, onDone }: {
  userId: string | null; can: (p: string) => boolean; onClose: () => void; onDone: () => Promise<void>;
}) {
  const detailFn = useServerFn(lifepayAdminAccountDetail);
  const updateFn = useServerFn(lifepayAdminUpdateAccount);
  const adjustFn = useServerFn(lifepayAdminAdjustBalance);
  const resetFn = useServerFn(lifepayAdminResetPassword);

  const [detail, setDetail] = useState<Awaited<ReturnType<typeof lifepayAdminAccountDetail>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adjust, setAdjust] = useState({ amount: "", reason: "" });
  const [pw, setPw] = useState("");
  const [limit, setLimit] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setErr(null); setDetail(null);
    try {
      const d = await detailFn({ data: { user_id: userId } });
      setDetail(d); setLimit(d.account ? String(((d.account as any).credit_limit ?? 0) / 100) : "");
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao carregar a conta."); }
  }, [userId, detailFn]);

  useEffect(() => { void load(); }, [load]);

  const acc = detail?.account as any;
  const run = async (fn: () => Promise<void>, ok: string) => {
    setErr(null); setMsg(null); setBusy(true);
    try { await fn(); setMsg(ok); await load(); await onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Operação não concluída."); }
    finally { setBusy(false); }
  };

  return (
    <LpSheet open={!!userId} onClose={onClose} title={acc ? (acc.full_name ?? acc.display_name) : "Conta LifePay"}>
      {!detail ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
      ) : (
        <div className="space-y-4">
          {err && <LpAlert>{err}</LpAlert>}
          {msg && <LpAlert tone="success">{msg}</LpAlert>}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-xs text-muted-foreground">Saldo</div><div className="font-semibold">{formatBRL(acc?.balance)}</div></div>
            <div><div className="text-xs text-muted-foreground">Limite</div><div className="font-semibold">{formatBRL(acc?.credit_limit)}</div></div>
            <div><div className="text-xs text-muted-foreground">Status</div><div>{ACCOUNT_STATUS_LABEL[acc?.status] ?? acc?.status}</div></div>
            <div><div className="text-xs text-muted-foreground">Último acesso</div><div>{fmtDate(acc?.last_access_at)}</div></div>
          </div>

          {can("block") && (
            <button disabled={busy} className="lp-btn lp-btn-soft w-full"
              onClick={() => run(async () => { await updateFn({ data: { user_id: userId!, patch: { status: acc.status === "active" ? "blocked" : "active" } } }); },
                acc.status === "active" ? "Conta bloqueada." : "Conta desbloqueada.")}>
              {acc?.status === "active" ? <><Lock className="h-4 w-4" /> Bloquear conta</> : <><Unlock className="h-4 w-4" /> Desbloquear conta</>}
            </button>
          )}

          {can("balance") && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-sm font-semibold">Ajustar saldo</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={inputCls} placeholder="Valor (use - para debitar)" value={adjust.amount} onChange={(e) => setAdjust((s) => ({ ...s, amount: e.target.value }))} />
                <input className={inputCls} placeholder="Motivo" value={adjust.reason} onChange={(e) => setAdjust((s) => ({ ...s, reason: e.target.value }))} />
              </div>
              <button disabled={busy || !adjust.amount || !adjust.reason} className="lp-btn lp-btn-primary mt-2 w-full"
                onClick={() => run(async () => {
                  const neg = adjust.amount.trim().startsWith("-");
                  const cents = parseBRLToCents(adjust.amount.replace("-", ""));
                  await adjustFn({ data: { user_id: userId!, amount: neg ? -cents : cents, reason: adjust.reason } });
                  setAdjust({ amount: "", reason: "" });
                }, "Saldo ajustado.")}>
                <Wallet className="h-4 w-4" /> Aplicar ajuste
              </button>
            </div>
          )}

          {can("limit") && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-sm font-semibold">Limite de crédito</div>
              <input className={inputCls} value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="0,00" />
              <button disabled={busy} className="lp-btn lp-btn-soft mt-2 w-full"
                onClick={() => run(async () => { await updateFn({ data: { user_id: userId!, patch: { credit_limit: parseBRLToCents(limit) } } }); }, "Limite atualizado.")}>
                Salvar limite
              </button>
            </div>
          )}

          {can("edit") && (
            <div className="rounded-xl border border-border p-3">
              <div className="mb-2 text-sm font-semibold">Redefinir senha</div>
              <input className={inputCls} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Nova senha inicial" />
              <button disabled={busy || pw.length < 8} className="lp-btn lp-btn-soft mt-2 w-full"
                onClick={() => run(async () => { await resetFn({ data: { user_id: userId!, new_password: pw, force_change: true } }); setPw(""); }, "Senha redefinida. O titular deverá trocá-la no próximo acesso.")}>
                <KeyRound className="h-4 w-4" /> Redefinir
              </button>
            </div>
          )}

          <div>
            <div className="mb-2 text-sm font-semibold">Chaves</div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {detail.keys.map((k: any) => <li key={k.id}>{k.key_type} — {k.key_value} ({k.status})</li>)}
              {!detail.keys.length && <li>Nenhuma chave ativa.</li>}
            </ul>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Últimas transações</div>
            <ul className="space-y-1 text-xs">
              {detail.transactions.slice(0, 15).map((t: any) => (
                <li key={t.id} className="flex justify-between gap-2 border-b border-border/60 py-1">
                  <span className="truncate text-muted-foreground">{fmtDate(t.created_at)} · {t.kind}</span>
                  <span className={t.to_user === userId ? "text-emerald-400" : "text-destructive"}>
                    {t.to_user === userId ? "+" : "−"}{formatBRL(t.amount)}
                  </span>
                </li>
              ))}
              {!detail.transactions.length && <li className="text-muted-foreground">Sem movimentações.</li>}
            </ul>
          </div>
        </div>
      )}
    </LpSheet>
  );
}

function PermissionsPanel({ accounts, isCeoOrAdmin }: { accounts: Account[]; isCeoOrAdmin: boolean }) {
  const setPermsFn = useServerFn(lifepayAdminSetPermissions);
  const [target, setTarget] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isCeoOrAdmin) {
    return <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-sm text-muted-foreground">
      Somente CEO/Admin pode conceder permissões administrativas do LifePay.
    </div>;
  }

  const toggle = (k: string) => setChosen((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const save = async () => {
    setErr(null); setMsg(null); setBusy(true);
    try { await setPermsFn({ data: { user_id: target, permissions: chosen } }); setMsg("Permissões atualizadas."); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar permissões."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border p-4">
        <Field label="Colaborador">
          <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Selecione uma conta…</option>
            {accounts.map((a) => <option key={a.user_id} value={a.user_id}>{a.full_name ?? a.display_name} — {a.email}</option>)}
          </select>
        </Field>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LIFEPAY_PERMISSIONS.map((p) => (
            <label key={p.key} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={chosen.includes(p.key)} onChange={() => toggle(p.key)} />
              {p.label}
            </label>
          ))}
        </div>
        {err && <div className="mt-3"><LpAlert>{err}</LpAlert></div>}
        {msg && <div className="mt-3"><LpAlert tone="success">{msg}</LpAlert></div>}
        <button disabled={busy || !target} onClick={save} className="lp-btn lp-btn-primary mt-4">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Salvar permissões
        </button>
        <p className="mt-2 text-xs text-muted-foreground">As permissões substituem as anteriores do colaborador selecionado.</p>
      </div>
    </div>
  );
}

function AuditPanel({ canAudit }: { canAudit: boolean }) {
  const auditFn = useServerFn(lifepayAdminAudit);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!canAudit) { setLoading(false); return; }
    auditFn({}).then((d) => setRows(d as any[]))
      .catch((e) => setErr(e instanceof Error ? e.message : "Falha ao carregar auditoria."))
      .finally(() => setLoading(false));
  }, [auditFn, canAudit]);

  if (!canAudit) {
    return <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-sm text-muted-foreground">
      Você não tem permissão de auditoria no LifePay.
    </div>;
  }
  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  if (err) return <LpAlert>{err}</LpAlert>;

  const filtered = rows.filter((r) => !q.trim() || JSON.stringify(r).toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar eventos"
          className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="px-4 py-3">Quando</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Método</th><th className="px-4 py-3">Detalhes</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                <td className="px-4 py-3 font-medium">{r.action}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.auth_method ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {r.reason ? <div>{r.reason}</div> : null}
                  {r.after_data ? <code className="break-all">{JSON.stringify(r.after_data)}</code> : null}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum evento.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
