import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Home, Send, ArrowDownLeft, KeyRound, Receipt, User, ShieldCheck, LifeBuoy,
  Eye, EyeOff, Copy, Check, Loader2, LogOut, Plus, Trash2, Power, RefreshCw,
  ArrowUpRight, Share2, Printer, CreditCard, AlertTriangle, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CardsTab, InvoicesTab } from "@/components/lifepay/cards-invoices";
import { FaceIdCard, FaceIdConfirm, useFaceId } from "@/components/lifepay/faceid";

import {
  LifePayTheme, LifePayMark, LpAlert, LpEmpty, LpSheet, LpSpinner, DISCLOSURE,
} from "@/components/lifepay/ui";
import { formatBRL, parseBRLToCents, passwordIssues, ACCOUNT_STATUS_LABEL } from "@/lib/lifepay-perms";
import {
  ensureAccount, loadAccount, loadKeys, loadTransactions, resolveKey, transfer,
  createRandomKey, updateKey, counterpartyNames, newIdempotencyKey,
  type LifePayAccount, type LifePayKey, type LifePayTx, type ResolvedKey,
} from "@/lib/lifepay-client";
import { lifepayFirstAccess, lifepaySetPin, lifepayTouchAccess, lifepayVerifySecret } from "@/lib/lifepay.functions";

export const Route = createFileRoute("/lifepay/app")({
  head: () => ({
    meta: [
      { title: "Minha conta — LifePay" },
      { name: "description", content: "Painel da sua conta LifePay: saldo, transferências, chaves, extrato e segurança." },
      { property: "og:title", content: "Minha conta LifePay" },
      { property: "og:description", content: "Painel financeiro interno da Furry's Life Inc." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  ssr: false,
  component: LifePayApp,
});

type TabKey = "home" | "send" | "receive" | "keys" | "cards" | "invoices" | "statement" | "profile" | "security" | "support";

const TABS: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: "home", label: "Início", icon: Home },
  { key: "send", label: "Transferências", icon: Send },
  { key: "receive", label: "Receber", icon: ArrowDownLeft },
  { key: "keys", label: "Chaves LifePay", icon: KeyRound },
  { key: "cards", label: "Cartões", icon: CreditCard },
  { key: "invoices", label: "Faturas", icon: FileText },
  { key: "statement", label: "Extrato", icon: Receipt },
  { key: "profile", label: "Perfil", icon: User },
  { key: "security", label: "Segurança", icon: ShieldCheck },
  { key: "support", label: "Suporte", icon: LifeBuoy },
];

const KIND_LABEL: Record<string, string> = {
  transfer: "Transferência",
  admin_grant: "Ajuste administrativo",
  admin_debit: "Ajuste administrativo",
  signup_bonus: "Abertura de conta",
  purchase: "Compra",
  invoice_payment: "Pagamento de fatura",
  refund: "Estorno",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/* ================================================================== */

function LifePayApp() {
  const nav = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [account, setAccount] = useState<LifePayAccount | null>(null);
  const [keys, setKeys] = useState<LifePayKey[]>([]);
  const [txs, setTxs] = useState<LifePayTx[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [tab, setTab] = useState<TabKey>("home");
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const touch = useServerFn(lifepayTouchAccess);

  const refresh = useCallback(async (uid: string) => {
    const [acc, k, t, n] = await Promise.all([
      loadAccount(uid), loadKeys(uid), loadTransactions(uid, { limit: 100 }), counterpartyNames(),
    ]);
    setAccount(acc); setKeys(k); setTxs(t); setNames(n);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) { nav({ to: "/lifepay/entrar" }); return; }

      // "Manter conectado" desmarcado: encerra a sessão em uma nova aba/janela.
      if (localStorage.getItem("lp_session_only") === "1" && sessionStorage.getItem("lp_session_alive") !== "1") {
        localStorage.removeItem("lp_session_only");
        await supabase.auth.signOut();
        nav({ to: "/lifepay/entrar" });
        return;
      }

      const uid = session.user.id;
      if (cancelled) return;
      setUserId(uid);
      try {
        await ensureAccount(uid);
        await refresh(uid);
        touch({}).catch(() => {});
      } catch (e) {
        setFatal(e instanceof Error ? e.message : "Não foi possível carregar sua conta.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [nav, refresh, touch]);

  const signOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/lifepay/entrar", replace: true });
  };

  if (loading) return <LifePayTheme><div className="flex min-h-screen items-center justify-center"><LpSpinner label="Carregando sua conta..." /></div></LifePayTheme>;

  if (fatal || !account || !userId) {
    return (
      <LifePayTheme>
        <div className="flex min-h-screen items-center justify-center px-5">
          <div className="w-full max-w-md space-y-4">
            <LpAlert>{fatal ?? "Conta LifePay indisponível."}</LpAlert>
            <button onClick={signOut} className="lp-btn lp-btn-ghost w-full">Sair</button>
          </div>
        </div>
      </LifePayTheme>
    );
  }

  if (account.status !== "active") {
    return (
      <LifePayTheme>
        <div className="flex min-h-screen items-center justify-center px-5 text-center">
          <div className="lp-card max-w-md p-8">
            <AlertTriangle className="mx-auto h-7 w-7" style={{ color: "var(--lp-warn)" }} />
            <h1 className="mt-4 text-lg font-semibold">Conta {ACCOUNT_STATUS_LABEL[account.status]?.toLowerCase()}</h1>
            <p className="mt-2 text-sm lp-muted">
              Sua conta LifePay está indisponível no momento. Fale com um administrador autorizado para regularizar o acesso.
            </p>
            <button onClick={signOut} className="lp-btn lp-btn-ghost mt-6">Sair</button>
          </div>
        </div>
      </LifePayTheme>
    );
  }

  if (!account.first_access_done || account.must_change_password) {
    return <FirstAccess onDone={async () => { await refresh(userId); }} />;
  }

  const ctx = { userId, account, keys, txs, names, refresh: () => refresh(userId), setTab };

  return (
    <LifePayTheme>
      <div className="flex min-h-screen flex-col pb-20 md:flex-row md:pb-0">
        {/* Sidebar desktop */}
        <aside className="hidden w-60 shrink-0 flex-col border-r p-4 lp-divide md:flex" style={{ background: "var(--lp-bg-2)" }}>
          <div className="px-2 py-3"><LifePayMark /></div>
          <nav className="mt-4 flex-1 space-y-1">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors"
                style={tab === t.key
                  ? { background: "rgba(47,227,194,.12)", color: "var(--lp-accent)", fontWeight: 600 }
                  : { color: "var(--lp-fg-2)" }}>
                <t.icon className="h-4 w-4" /> {t.label}
              </button>
            ))}
          </nav>
          <button onClick={signOut} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm lp-muted hover:text-white">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-5 py-3 lp-divide md:hidden"
            style={{ background: "rgba(10,11,13,.9)", backdropFilter: "blur(12px)" }}>
            <LifePayMark size={24} />
            <button onClick={signOut} className="lp-btn lp-btn-ghost px-3 py-1.5 text-xs"><LogOut className="h-3.5 w-3.5" /> Sair</button>
          </header>

          <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6">
            {tab === "home" && <HomeTab {...ctx} />}
            {tab === "send" && <SendTab {...ctx} />}
            {tab === "receive" && <ReceiveTab {...ctx} />}
            {tab === "keys" && <KeysTab {...ctx} />}
            {tab === "cards" && <CardsTab userId={ctx.userId} account={ctx.account} refresh={ctx.refresh} />}
            {tab === "invoices" && <InvoicesTab userId={ctx.userId} account={ctx.account} refresh={ctx.refresh} />}
            {tab === "statement" && <StatementTab {...ctx} />}
            {tab === "profile" && <ProfileTab {...ctx} />}
            {tab === "security" && <SecurityTab {...ctx} />}
            {tab === "support" && <SupportTab />}
          </main>
        </div>

        {/* Bottom nav mobile */}
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t px-1 py-1.5 lp-divide md:hidden"
          style={{ background: "rgba(10,11,13,.95)", backdropFilter: "blur(12px)" }}>
          {(["home", "send", "receive", "statement", "security"] as TabKey[]).map((k) => {
            const t = TABS.find((x) => x.key === k)!;
            return (
              <button key={k} onClick={() => setTab(k)} className="flex flex-col items-center gap-1 py-1.5 text-[10px]"
                style={{ color: tab === k ? "var(--lp-accent)" : "var(--lp-fg-2)" }}>
                <t.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                {t.label.split(" ")[0]}
              </button>
            );
          })}
        </nav>
      </div>
    </LifePayTheme>
  );
}

/* ================================================================== *
 * Primeiro acesso                                                     *
 * ================================================================== */

function FirstAccess({ onDone }: { onDone: () => Promise<void> }) {
  const run = useServerFn(lifepayFirstAccess);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pin, setPin] = useState("");
  const [terms, setTerms] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const issues = next ? passwordIssues(next) : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (next !== confirm) { setErr("A confirmação da nova senha não confere."); return; }
    setBusy(true);
    try {
      await run({ data: { currentPassword: current, newPassword: next, pin: pin || undefined, acceptTerms: terms } });
      await onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally { setBusy(false); }
  };

  return (
    <LifePayTheme>
      <div className="lp-grid-bg flex min-h-screen items-center justify-center px-5 py-10">
        <div className="lp-card w-full max-w-md p-7">
          <LifePayMark />
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Primeiro acesso</h1>
          <p className="mt-1 text-sm lp-muted">Confirme a senha inicial e defina suas credenciais de acesso.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="lp-label">Senha inicial</label>
              <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="lp-input" autoComplete="current-password" />
            </div>
            <div>
              <label className="lp-label">Nova senha</label>
              <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className="lp-input" autoComplete="new-password" />
              {issues.length > 0 && <p className="mt-1 text-[11px]" style={{ color: "var(--lp-warn)" }}>Requisitos: {issues.join(", ")}.</p>}
            </div>
            <div>
              <label className="lp-label">Confirmar nova senha</label>
              <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="lp-input" autoComplete="new-password" />
            </div>
            <div>
              <label className="lp-label">PIN de operações (opcional, 4 a 8 dígitos)</label>
              <input inputMode="numeric" pattern="\d*" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} className="lp-input" placeholder="••••" />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-xs lp-muted">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-[color:var(--lp-accent)]" />
              <span>Li e aceito os <Link to="/lifepay/termos" className="lp-accent underline">termos de uso</Link> e a <Link to="/lifepay/privacidade" className="lp-accent underline">política de privacidade</Link>.</span>
            </label>
            {err && <LpAlert>{err}</LpAlert>}
            <button type="submit" disabled={busy} className="lp-btn lp-btn-primary w-full py-3">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Concluindo...</> : "Concluir e entrar"}
            </button>
            <p className="text-center text-[11px] lp-muted">O reconhecimento facial pode ser ativado depois, em Segurança.</p>
          </form>
        </div>
      </div>
    </LifePayTheme>
  );
}

/* ================================================================== *
 * Contexto comum                                                      *
 * ================================================================== */

type Ctx = {
  userId: string;
  account: LifePayAccount;
  keys: LifePayKey[];
  txs: LifePayTx[];
  names: Map<string, string>;
  refresh: () => Promise<void>;
  setTab: (t: TabKey) => void;
};

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, id = text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* clipboard indisponível */ }
  };
  return { copied, copy };
}

/* ================================================================== *
 * Início                                                              *
 * ================================================================== */

function HomeTab({ account, txs, names, userId, setTab, keys }: Ctx) {
  const [hidden, setHidden] = useState(false);
  const firstName = (account.full_name ?? account.display_name).split(" ")[0];
  const emailKey = keys.find((k) => k.key_type === "email")?.key_value ?? account.pix_key;
  const { copied, copy } = useCopy();

  const shortcuts: { label: string; icon: typeof Send; onClick: () => void }[] = [
    { label: "Transferir", icon: Send, onClick: () => setTab("send") },
    { label: "Receber", icon: ArrowDownLeft, onClick: () => setTab("receive") },
    { label: "Copiar chave", icon: Copy, onClick: () => copy(emailKey, "home-key") },
    { label: "Extrato", icon: Receipt, onClick: () => setTab("statement") },
    { label: "Chaves", icon: KeyRound, onClick: () => setTab("keys") },
    { label: "Segurança", icon: ShieldCheck, onClick: () => setTab("security") },
    { label: "Perfil", icon: User, onClick: () => setTab("profile") },
    { label: "Suporte", icon: LifeBuoy, onClick: () => setTab("support") },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm lp-muted">Olá, {firstName}</div>
        <h1 className="text-2xl font-bold tracking-tight">Sua conta LifePay</h1>
      </div>

      <div className="lp-card p-6">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider lp-muted">Saldo disponível</span>
          <button onClick={() => setHidden(!hidden)} aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"} className="lp-muted hover:text-white">
            {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-1 text-3xl font-black tabular-nums">
          {hidden ? "R$ ••••••" : formatBRL(account.balance)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
          <div className="lp-card-2 p-3">
            <div className="lp-muted">Limite do cartão</div>
            <div className="mt-0.5 font-semibold">{hidden ? "••••" : formatBRL(account.credit_limit)}</div>
          </div>
          <div className="lp-card-2 p-3">
            <div className="lp-muted">Fatura atual</div>
            <div className="mt-0.5 font-semibold">Disponível na etapa de cartão</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] lp-muted">
          <span className="lp-chip">Fechamento dia {account.closing_day}</span>
          <span className="lp-chip">Vencimento dia {account.due_day}</span>
          <span className="lp-chip lp-chip-ok">{ACCOUNT_STATUS_LABEL[account.status]}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {shortcuts.map((s) => (
          <button key={s.label} onClick={s.onClick} className="lp-card-2 flex flex-col items-center gap-1.5 px-1 py-3 text-[10px] transition-colors hover:brightness-125">
            <s.icon className="h-4 w-4 lp-accent" />
            <span className="text-center leading-tight">{s.label === "Copiar chave" && copied === "home-key" ? "Copiado!" : s.label}</span>
          </button>
        ))}
      </div>

      <div className="lp-card p-5">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Últimas movimentações</div>
          <button onClick={() => setTab("statement")} className="text-xs lp-accent hover:underline">Ver extrato</button>
        </div>
        <div className="mt-3">
          {txs.length === 0
            ? <p className="py-6 text-center text-xs lp-muted">Nenhuma movimentação por enquanto.</p>
            : <TxList txs={txs.slice(0, 6)} userId={userId} names={names} />}
        </div>
      </div>

      <div className="lp-card-2 flex items-start gap-3 p-4 text-xs lp-muted">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 lp-accent" />
        <div>
          Nunca compartilhe sua senha ou PIN. O LifePay pede confirmação apenas dentro do próprio aplicativo.
          {account.last_access_at && <> Último acesso: {fmtDate(account.last_access_at)}.</>}
        </div>
      </div>
    </div>
  );
}

/* ================================================================== *
 * Lista de movimentações + detalhe                                    *
 * ================================================================== */

function TxList({ txs, userId, names }: { txs: LifePayTx[]; userId: string; names: Map<string, string> }) {
  const [open, setOpen] = useState<LifePayTx | null>(null);
  return (
    <>
      <ul className="divide-y lp-divide">
        {txs.map((t) => {
          const out = t.from_user === userId;
          const other = out ? t.to_user : t.from_user;
          const label = KIND_LABEL[t.kind] ?? t.kind;
          const who = other ? names.get(other) ?? "Conta LifePay" : "LifePay";
          return (
            <li key={t.id}>
              <button onClick={() => setOpen(t)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--lp-surface-2)" }}>
                  {out ? <ArrowUpRight className="h-4 w-4" style={{ color: "var(--lp-danger)" }} />
                       : <ArrowDownLeft className="h-4 w-4 lp-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{label} · {who}</span>
                  <span className="block text-[11px] lp-muted">{fmtDate(t.created_at)}{t.note ? ` · ${t.note}` : ""}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: out ? "var(--lp-fg)" : "var(--lp-accent)" }}>
                  {out ? "-" : "+"}{formatBRL(t.amount)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <LpSheet open={!!open} onClose={() => setOpen(null)} title="Detalhes da movimentação">
        {open && <Receipt2 tx={open} userId={userId} names={names} />}
      </LpSheet>
    </>
  );
}

function Receipt2({ tx, userId, names }: { tx: LifePayTx; userId: string; names: Map<string, string> }) {
  const out = tx.from_user === userId;
  const { copied, copy } = useCopy();
  const lines = [
    ["Operação", KIND_LABEL[tx.kind] ?? tx.kind],
    ["Status", tx.status === "completed" ? "Concluída" : tx.status],
    ["De", tx.from_user ? (tx.from_user === userId ? "Você" : names.get(tx.from_user) ?? "Conta LifePay") : "LifePay"],
    ["Para", tx.to_user ? (tx.to_user === userId ? "Você" : names.get(tx.to_user) ?? "Conta LifePay") : "LifePay"],
    ["Chave utilizada", tx.key_used ?? "—"],
    ["Valor", formatBRL(tx.amount)],
    ["Descrição", tx.note ?? "—"],
    ["Data", fmtDate(tx.created_at)],
    ["Autenticação", tx.auth_method ?? "—"],
    ["Saldo anterior", out ? (tx.from_balance_before != null ? formatBRL(tx.from_balance_before) : "—") : (tx.to_balance_before != null ? formatBRL(tx.to_balance_before) : "—")],
    ["Saldo posterior", out ? (tx.from_balance_after != null ? formatBRL(tx.from_balance_after) : "—") : (tx.to_balance_after != null ? formatBRL(tx.to_balance_after) : "—")],
    ["Identificador", tx.receipt_code ?? tx.id.slice(0, 8).toUpperCase()],
  ] as [string, string][];

  const text = `LifePay — comprovante\n` + lines.map(([k, v]) => `${k}: ${v}`).join("\n");

  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Comprovante LifePay", text }); return; } catch { /* cancelado */ } }
    copy(text, "receipt");
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <LifePayMark size={24} />
        <span className="lp-chip lp-chip-ok">Comprovante</span>
      </div>
      <dl className="divide-y lp-divide text-sm">
        {lines.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 py-2.5">
            <dt className="lp-muted">{k}</dt>
            <dd className="max-w-[60%] break-words text-right font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => copy(text, "receipt")} className="lp-btn lp-btn-soft">
          {copied === "receipt" ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
        </button>
        <button onClick={share} className="lp-btn lp-btn-soft"><Share2 className="h-4 w-4" /> Compartilhar</button>
        <button onClick={() => window.print()} className="lp-btn lp-btn-soft"><Printer className="h-4 w-4" /> Salvar PDF</button>
      </div>
      <p className="mt-4 text-[11px] lp-muted">Comprovantes concluídos não podem ser alterados.</p>
    </div>
  );
}

/* ================================================================== *
 * Transferir                                                          *
 * ================================================================== */

type Step = "key" | "amount" | "review" | "done";
const STEP_ORDER: Step[] = ["key", "amount", "review", "done"];

function SendTab({ account, userId, names, txs, refresh }: Ctx) {
  const verify = useServerFn(lifepayVerifySecret);
  const [step, setStep] = useState<Step>("key");
  const [dir, setDir] = useState<1 | -1>(1);
  const [keyInput, setKeyInput] = useState("");
  const [target, setTarget] = useState<ResolvedKey | null>(null);
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [secret, setSecret] = useState("");
  const [method, setMethod] = useState<"password" | "pin" | "biometric">("password");
  const face = useFaceId();
  const [faceOpen, setFaceOpen] = useState(false);

  // Origem do dinheiro: saldo em conta ou cartão de crédito (parcelável).
  const [source, setSource] = useState<"balance" | "credit">("balance");
  const [cards, setCards] = useState<LifePayCard[]>([]);
  const [cardId, setCardId] = useState<string>("");
  const [installments, setInstallments] = useState(1);

  const [result, setResult] = useState<LifePayTx | null>(null);
  const idem = useRef<string>(newIdempotencyKey());

  const amount = useMemo(() => parseBRLToCents(amountText), [amountText]);

  useEffect(() => {
    loadCards(userId)
      .then((c) => {
        const usable = c.filter((x) => x.status === "active");
        setCards(usable);
        setCardId((prev) => prev || usable[0]?.id || "");
      })
      .catch(() => {});
  }, [userId]);

  const go = (s: Step) => {
    setDir(STEP_ORDER.indexOf(s) >= STEP_ORDER.indexOf(step) ? 1 : -1);
    setErr(null);
    setStep(s);
  };
  const anim = dir === 1 ? "lp-step-in" : "lp-step-back";

  const recents = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of txs) {
      if (t.kind !== "transfer") continue;
      const other = t.from_user === userId ? t.to_user : t.from_user;
      if (other && other !== userId && !seen.has(other)) seen.set(other, names.get(other) ?? "Conta LifePay");
    }
    return Array.from(seen.entries()).slice(0, 4);
  }, [txs, userId, names]);

  const lookup = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await resolveKey(keyInput.trim());
      if (!r) throw new Error("Chave LifePay não encontrada ou inativa.");
      if (r.user_id === userId) throw new Error("Não é possível transferir para a própria conta.");
      if (r.status !== "active") throw new Error("A conta do destinatário está bloqueada.");
      setTarget(r); go("amount");
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha na consulta."); }
    finally { setBusy(false); }
  };

  const selectedCard = cards.find((c) => c.id === cardId) ?? null;

  const goReview = () => {
    setErr(null);
    if (!Number.isFinite(amount) || amount <= 0) { setErr("Informe um valor maior que zero."); return; }
    if (source === "balance" && amount > account.balance) { setErr("Saldo insuficiente para esta transferência."); return; }
    if (source === "credit") {
      if (!selectedCard) { setErr("Selecione um cartão de crédito ativo."); return; }
      if (amount > selectedCard.card_limit) { setErr("Valor acima do limite do cartão selecionado."); return; }
    }
    go("review");
  };

  const confirmTransfer = async () => {
    setErr(null); setBusy(true);
    try {
      if (method !== "biometric") await verify({ data: { method, value: secret } });
      const tx = await transferV3({
        key: target!.key_value, amount, note: note.trim() || undefined,
        authMethod: method, idempotencyKey: idem.current,
        source, cardId: source === "credit" ? cardId : null,
        installments: source === "credit" ? installments : 1,
      });

      setResult(tx); setConfirmOpen(false); setDir(1); setStep("done"); setSecret("");
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível concluir a transferência.");
    } finally { setBusy(false); }
  };

  const restart = () => {
    idem.current = newIdempotencyKey();
    setDir(-1);
    setStep("key"); setKeyInput(""); setTarget(null); setAmountText(""); setNote("");
    setResult(null); setErr(null); setSource("balance"); setInstallments(1);
  };

  if (step === "done" && result) {
    return (
      <div className="space-y-4">
        <div className="lp-card lp-pop p-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full lp-pop" style={{ background: "rgba(47,227,194,.15)" }}>
            <Check className="h-7 w-7 lp-accent" />
          </div>
          <h2 className="mt-3 text-lg font-semibold">Transferência concluída</h2>
          <p className="mt-1 text-sm lp-muted">{formatBRL(result.amount)} para {target?.display_name}</p>
          {source === "credit" && (
            <p className="mt-1 text-xs lp-muted">
              Paga no crédito {installments > 1 ? `em ${installments}x de ${formatBRL(Math.floor(amount / installments))}` : "à vista"}.
            </p>
          )}
        </div>
        <div className="lp-card lp-fade p-5"><Receipt2 tx={result} userId={userId} names={new Map([[target!.user_id, target!.display_name]])} /></div>
        <button onClick={restart} className="lp-btn lp-btn-ghost w-full">Fazer outra transferência</button>
      </div>
    );
  }

  const installmentValue = installments > 0 ? Math.floor(amount / installments) : amount;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transferência LifePay</h1>
        <p className="mt-1 text-sm lp-muted">Envie valores usando e-mail ou chave aleatória — pelo saldo ou no crédito.</p>
      </div>

      <div className="lp-card overflow-hidden p-5">
        <div className="mb-4 flex items-center gap-2 text-[11px] lp-muted">
          {["Destinatário", "Valor", "Revisão"].map((s, i) => {
            const active = i === ["key", "amount", "review"].indexOf(step);
            const done = i < ["key", "amount", "review"].indexOf(step);
            return (
              <span key={s} className="lp-chip lp-press"
                style={active ? { color: "var(--lp-accent)", borderColor: "rgba(47,227,194,.45)", background: "rgba(47,227,194,.08)" }
                  : done ? { color: "var(--lp-fg)" } : undefined}>
                {done ? <Check className="h-3 w-3" /> : `${i + 1}.`} {s}
              </span>
            );
          })}
        </div>

        {step === "key" && (
          <div key="key" className={`space-y-4 ${anim}`}>
            <div>
              <label className="lp-label">E-mail ou chave aleatória</label>
              <input value={keyInput} onChange={(e) => setKeyInput(e.target.value)} className="lp-input"
                placeholder="destinatario@empresa.com"
                onKeyDown={(e) => { if (e.key === "Enter" && keyInput.trim()) void lookup(); }} />
            </div>
            {recents.length > 0 && (
              <div>
                <div className="lp-label">Contatos recentes</div>
                <div className="flex flex-wrap gap-2">
                  {recents.map(([id, name]) => (
                    <span key={id} className="lp-chip">{name}</span>
                  ))}
                </div>
              </div>
            )}
            {err && <LpAlert>{err}</LpAlert>}
            <button onClick={lookup} disabled={busy || !keyInput.trim()} className="lp-btn lp-btn-primary w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Localizar destinatário"}
            </button>
          </div>
        )}

        {step === "amount" && target && (
          <div key="amount" className={`space-y-4 ${anim}`}>
            <div className="lp-card-2 p-4">
              <div className="text-[11px] uppercase tracking-wider lp-muted">Destinatário</div>
              <div className="mt-0.5 font-semibold">{target.display_name}</div>
              <div className="text-xs lp-muted">{target.key_value}</div>
            </div>

            <div className="text-center">
              <label className="lp-label text-center">Valor</label>
              <input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)}
                className="lp-input text-center text-3xl font-black tabular-nums" placeholder="0,00"
                style={{ letterSpacing: "-0.02em" }} />
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {[1000, 2500, 5000, 10000].map((c) => (
                  <button key={c} onClick={() => setAmountText((c / 100).toFixed(2).replace(".", ","))} className="lp-chip lp-press hover:text-white">
                    {formatBRL(c)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="lp-label">Pagar com</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setSource("balance")}
                  className={`lp-card-2 lp-press p-3 text-left ${source === "balance" ? "" : "opacity-60"}`}
                  style={source === "balance" ? { borderColor: "var(--lp-accent)", background: "rgba(47,227,194,.08)" } : undefined}>
                  <div className="flex items-center gap-2 text-sm font-semibold"><Wallet2 /> Saldo</div>
                  <div className="mt-0.5 text-[11px] lp-muted">{formatBRL(account.balance)} disponível</div>
                </button>
                <button onClick={() => setSource("credit")} disabled={!cards.length}
                  className={`lp-card-2 lp-press p-3 text-left ${source === "credit" ? "" : "opacity-60"}`}
                  style={source === "credit" ? { borderColor: "var(--lp-accent)", background: "rgba(47,227,194,.08)" } : undefined}>
                  <div className="flex items-center gap-2 text-sm font-semibold"><CreditCard className="h-4 w-4" /> Crédito</div>
                  <div className="mt-0.5 text-[11px] lp-muted">
                    {cards.length ? "Parcele em até 12x" : "Nenhum cartão ativo"}
                  </div>
                </button>
              </div>
            </div>

            {source === "credit" && cards.length > 0 && (
              <div className="lp-card-2 space-y-3 p-4 lp-fade">
                <div>
                  <label className="lp-label">Cartão</label>
                  <select value={cardId} onChange={(e) => setCardId(e.target.value)} className="lp-input">
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>{c.label} · •••• {c.last4} · limite {formatBRL(c.card_limit)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="lp-label">Parcelamento</label>
                  <div className="flex flex-wrap gap-2">
                    {INSTALLMENT_OPTIONS.map((n) => (
                      <button key={n} onClick={() => setInstallments(n)}
                        className={`lp-btn lp-press px-3 py-1.5 text-xs ${installments === n ? "lp-btn-primary" : "lp-btn-soft"}`}>
                        {n}x
                      </button>
                    ))}
                  </div>
                  {Number.isFinite(amount) && amount > 0 && (
                    <p className="mt-2 text-xs lp-muted">
                      {installments}x de {formatBRL(installmentValue)} · total {formatBRL(amount)} · sem juros
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="lp-label">Descrição (opcional)</label>
              <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} className="lp-input" placeholder="Ex.: reembolso" />
            </div>
            {err && <LpAlert>{err}</LpAlert>}
            <div className="flex gap-2">
              <button onClick={() => go("key")} className="lp-btn lp-btn-ghost flex-1">Voltar</button>
              <button onClick={goReview} className="lp-btn lp-btn-primary flex-1">Continuar</button>
            </div>
          </div>
        )}

        {step === "review" && target && (
          <div key="review" className={`space-y-4 ${anim}`}>
            <dl className="divide-y lp-divide text-sm">
              {([
                ["Destinatário", target.display_name],
                ["Chave utilizada", target.key_value],
                ["Valor", formatBRL(amount)],
                ["Forma de pagamento", source === "balance"
                  ? "Saldo em conta"
                  : `Crédito · ${selectedCard?.label} •••• ${selectedCard?.last4}`],
                ...(source === "credit"
                  ? [["Parcelamento", `${installments}x de ${formatBRL(installmentValue)}`] as [string, string]]
                  : []),
                ["Descrição", note.trim() || "—"],
                ["Data", new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })],
                ["Saldo após a operação", formatBRL(source === "balance" ? account.balance - amount : account.balance)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="lp-muted">{k}</dt><dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {err && <LpAlert>{err}</LpAlert>}
            <div className="flex gap-2">
              <button onClick={() => go("amount")} className="lp-btn lp-btn-ghost flex-1">Voltar</button>
              <button onClick={() => { setErr(null); setConfirmOpen(true); }} className="lp-btn lp-btn-primary flex-1">Confirmar</button>
            </div>
          </div>
        )}
      </div>

      <LpSheet open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title="Confirmar operação">
        <div className="space-y-4">
          <p className="text-sm lp-muted">Confirme {formatBRL(amount)} para {target?.display_name}.</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMethod("password")} className={`lp-btn flex-1 ${method === "password" ? "lp-btn-primary" : "lp-btn-soft"}`}>Senha</button>
            <button onClick={() => setMethod("pin")} className={`lp-btn flex-1 ${method === "pin" ? "lp-btn-primary" : "lp-btn-soft"}`}>PIN</button>
            {face.enrolled && !face.status?.stale && (
              <button onClick={() => { setMethod("biometric"); setSecret(""); }}
                className={`lp-btn flex-1 ${method === "biometric" ? "lp-btn-primary" : "lp-btn-soft"}`}>Face ID</button>
            )}
          </div>
          {method === "biometric" ? (
            <p className="text-sm lp-muted">Ao confirmar, a câmera fará o reconhecimento facial do LifePay.</p>
          ) : (
            <div>
              <label className="lp-label">{method === "password" ? "Sua senha" : "Seu PIN"}</label>
              <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} className="lp-input"
                inputMode={method === "pin" ? "numeric" : undefined} autoComplete="off" />
            </div>
          )}
          {err && <LpAlert>{err}</LpAlert>}
          <button onClick={() => { if (method === "biometric") { setErr(null); setFaceOpen(true); } else void confirmTransfer(); }} disabled={busy || (method !== "biometric" && !secret)} className="lp-btn lp-btn-primary w-full py-3">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</> : "Confirmar transferência"}
          </button>
          <p className="text-center text-[11px] lp-muted">A operação só é executada após a confirmação de identidade.</p>
        </div>
      </LpSheet>

      <FaceIdConfirm open={faceOpen} purpose="transfer"
        onCancel={() => setFaceOpen(false)}
        onSuccess={() => { setFaceOpen(false); void confirmTransfer(); }} />
    </div>
  );
}

function Wallet2() {
  return <Receipt className="h-4 w-4" />;
}


/* ================================================================== *
 * Receber                                                             *
 * ================================================================== */

function ReceiveTab({ account, keys, setTab }: Ctx) {
  const { copied, copy } = useCopy();
  const active = keys.filter((k) => k.status === "active");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Receber</h1>
        <p className="mt-1 text-sm lp-muted">Compartilhe uma das suas chaves para receber valores.</p>
      </div>
      {active.length === 0 ? (
        <LpEmpty icon={<KeyRound className="h-5 w-5 lp-accent" />} title="Nenhuma chave ativa"
          hint="Ative ou crie uma chave para poder receber."
          action={<button onClick={() => setTab("keys")} className="lp-btn lp-btn-primary">Gerenciar chaves</button>} />
      ) : (
        <div className="space-y-3">
          {active.map((k) => (
            <div key={k.id} className="lp-card flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider lp-muted">{k.key_type === "email" ? "Chave de e-mail" : "Chave aleatória"}</div>
                <div className="mt-0.5 truncate font-mono text-sm">{k.key_value}</div>
              </div>
              <button onClick={() => copy(k.key_value, k.id)} className="lp-btn lp-btn-soft shrink-0">
                {copied === k.id ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="lp-card-2 p-4 text-xs lp-muted">
        Titular: {account.full_name ?? account.display_name}. Quem transferir para você verá apenas o seu nome de exibição.
      </div>
    </div>
  );
}

/* ================================================================== *
 * Chaves                                                              *
 * ================================================================== */

function KeysTab({ keys, refresh }: Ctx) {
  const { copied, copy } = useCopy();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null); setBusy(true);
    try { await fn(); await refresh(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Falha na operação."); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chaves LifePay</h1>
          <p className="mt-1 text-sm lp-muted">Sua chave de e-mail é permanente. Você pode ter até 5 chaves aleatórias.</p>
        </div>
        <button onClick={() => act(createRandomKey)} disabled={busy} className="lp-btn lp-btn-primary shrink-0">
          <Plus className="h-4 w-4" /> Nova chave
        </button>
      </div>

      {err && <LpAlert>{err}</LpAlert>}

      <div className="space-y-3">
        {keys.map((k) => (
          <div key={k.id} className="lp-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-wider lp-muted">{k.key_type === "email" ? "E-mail" : "Aleatória"}</span>
                  <span className={`lp-chip ${k.status === "active" ? "lp-chip-ok" : ""}`}>{k.status === "active" ? "Ativa" : "Inativa"}</span>
                </div>
                <div className="mt-1 truncate font-mono text-sm">{k.key_value}</div>
                <div className="text-[11px] lp-muted">Criada em {fmtDate(k.created_at)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => copy(k.key_value, k.id)} className="lp-btn lp-btn-soft px-3 py-2 text-xs">
                  {copied === k.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar
                </button>
                <button onClick={() => act(() => updateKey(k.id, k.status === "active" ? "deactivate" : "activate"))}
                  disabled={busy} className="lp-btn lp-btn-soft px-3 py-2 text-xs">
                  <Power className="h-3.5 w-3.5" /> {k.status === "active" ? "Desativar" : "Ativar"}
                </button>
                {k.key_type === "random" && (
                  <button onClick={() => { if (confirm("Remover esta chave? Ela deixa de funcionar imediatamente.")) act(() => updateKey(k.id, "delete")); }}
                    disabled={busy} className="lp-btn lp-btn-danger px-3 py-2 text-xs"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Extrato                                                             *
 * ================================================================== */

function StatementTab({ userId, names }: Ctx) {
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<LifePayTx[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null); setRows(null);
    try {
      setRows(await loadTransactions(userId, {
        direction, kind,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
        limit: 200,
      }));
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao carregar."); setRows([]); }
  }, [userId, direction, kind, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Extrato</h1>
        <p className="mt-1 text-sm lp-muted">Toda movimentação com saldo anterior, saldo posterior e comprovante.</p>
      </div>

      <div className="lp-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {([["all", "Tudo"], ["in", "Entradas"], ["out", "Saídas"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setDirection(k)} className={`lp-btn px-3 py-1.5 text-xs ${direction === k ? "lp-btn-primary" : "lp-btn-soft"}`}>{l}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="lp-label">Tipo</label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="lp-input">
              <option value="all">Todos</option>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </div>
          <div><label className="lp-label">De</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="lp-input" /></div>
          <div><label className="lp-label">Até</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="lp-input" /></div>
        </div>
      </div>

      {err && <LpAlert>{err}</LpAlert>}
      {rows === null ? <LpSpinner label="Carregando movimentações..." />
        : rows.length === 0
          ? <LpEmpty icon={<Receipt className="h-5 w-5 lp-accent" />} title="Nenhuma movimentação no período" hint="Ajuste os filtros para ver outros períodos." />
          : <div className="lp-card px-5"><TxList txs={rows} userId={userId} names={names} /></div>}
    </div>
  );
}

/* ================================================================== *
 * Perfil                                                              *
 * ================================================================== */

function ProfileTab({ account }: Ctx) {
  const rows: [string, string][] = [
    ["Nome completo", account.full_name ?? account.display_name],
    ["E-mail", account.email ?? "—"],
    ["Tipo de conta", account.account_type],
    ["Status", ACCOUNT_STATUS_LABEL[account.status] ?? account.status],
    ["Fechamento da fatura", `Dia ${account.closing_day}`],
    ["Vencimento da fatura", `Dia ${account.due_day}`],
    ["Conta criada em", fmtDate(account.created_at)],
    ["Último acesso", account.last_access_at ? fmtDate(account.last_access_at) : "—"],
  ];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
      <div className="lp-card p-5">
        <dl className="divide-y lp-divide text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="lp-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
      </div>
      <p className="text-xs lp-muted">
        Alterações de dados cadastrais são feitas por um administrador autorizado da Furry's Life Inc.
      </p>
    </div>
  );
}

/* ================================================================== *
 * Segurança                                                           *
 * ================================================================== */

function SecurityTab({ account }: Ctx) {
  const setPinFn = useServerFn(lifepaySetPin);
  const [pin, setPin] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  const savePin = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setMsg(null); setBusy(true);
    try {
      await setPinFn({ data: { pin, password: pw } });
      setMsg("PIN atualizado."); setPin(""); setPw("");
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha ao salvar o PIN."); }
    finally { setBusy(false); }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg(null); setErr(null);
    const issues = passwordIssues(newPw);
    if (issues.length) { setErr(`A senha precisa de ${issues.join(", ")}.`); return; }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) setErr(error.message);
    else { setPwMsg("Senha alterada com sucesso."); setNewPw(""); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Segurança e acesso</h1>
        <p className="mt-1 text-sm lp-muted">Gerencie a confirmação das suas operações.</p>
      </div>

      {err && <LpAlert>{err}</LpAlert>}

      <form onSubmit={changePassword} className="lp-card space-y-3 p-5">
        <div className="text-sm font-semibold">Alterar senha</div>
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="lp-input" placeholder="Nova senha" autoComplete="new-password" />
        {pwMsg && <LpAlert tone="success">{pwMsg}</LpAlert>}
        <button type="submit" disabled={!newPw} className="lp-btn lp-btn-primary">Salvar nova senha</button>
      </form>

      <form onSubmit={savePin} className="lp-card space-y-3 p-5">
        <div className="text-sm font-semibold">PIN de operações</div>
        <p className="text-xs lp-muted">Use um PIN de 4 a 8 dígitos para confirmar transferências sem digitar a senha.</p>
        <input inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} className="lp-input" placeholder="Novo PIN" />
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className="lp-input" placeholder="Sua senha atual" autoComplete="current-password" />
        {msg && <LpAlert tone="success">{msg}</LpAlert>}
        <button type="submit" disabled={busy || !pin || !pw} className="lp-btn lp-btn-primary">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar PIN"}
        </button>
      </form>

      <FaceIdCard />


      <div className="lp-card-2 p-4 text-xs lp-muted">
        Último acesso: {account.last_access_at ? fmtDate(account.last_access_at) : "—"}
      </div>
    </div>
  );
}

/* ================================================================== *
 * Suporte                                                             *
 * ================================================================== */

function SupportTab() {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Suporte</h1>
      <div className="lp-card space-y-3 p-5 text-sm lp-muted">
        <p>Precisa de ajuda com sua conta LifePay? Fale com um administrador autorizado da Furry's Life Inc.</p>
        <p>Para questões de acesso, bloqueio de conta ou ajustes, o atendimento é feito pelos canais internos da empresa.</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link to="/" hash="contato" className="lp-btn lp-btn-soft">Falar com a empresa</Link>
          <Link to="/lifepay/sobre" className="lp-btn lp-btn-ghost">Sobre o LifePay</Link>
        </div>
      </div>
      <div className="lp-card-2 flex items-start gap-2 p-4 text-[11px] lp-muted">
        <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {DISCLOSURE}
      </div>
    </div>
  );
}
