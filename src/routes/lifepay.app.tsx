import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Copy, Eye, EyeOff, LogOut, Send, ShieldCheck,
  Sparkles, Wallet, History, Settings, Loader2, Check, CreditCard, PieChart, KeyRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/lifepay/app")({
  head: () => ({ meta: [
    { title: "LifePay — sua conta" },
    { name: "robots", content: "noindex, nofollow" },
  ]}),
  component: LifePayApp,
});

// ────────────────────────────────────────────────────────────────────────────
type Account = {
  user_id: string;
  pix_key: string;
  display_name: string;
  balance: number;
  is_admin: boolean;
};
type Tx = {
  id: string;
  from_user: string | null;
  to_user: string | null;
  amount: number;
  note: string | null;
  kind: "transfer" | "admin_grant" | "admin_debit" | "signup_bonus";
  created_at: string;
};

const fmtRbx = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

// ────────────────────────────────────────────────────────────────────────────
function LifePayApp() {
  const nav = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"home" | "pix" | "extrato" | "cartoes" | "config" | "admin">("home");
  const [hide, setHide] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { nav({ to: "/auth", search: { redirect: "/lifepay/app" } }); return; }
    const uid = sess.session.user.id;
    // Ensure account exists
    await supabase.rpc("ensure_lifepay_account", { _user_id: uid });
    const { data: acc } = await supabase
      .from("lifepay_accounts").select("*").eq("user_id", uid).maybeSingle();
    setAccount(acc as Account | null);
    const { data: tx } = await supabase
      .from("lifepay_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setTxs((tx ?? []) as Tx[]);
    const ids = Array.from(new Set((tx ?? []).flatMap((t) => [t.from_user, t.to_user]).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: people } = await supabase.from("lifepay_accounts").select("user_id, display_name, pix_key").in("user_id", ids);
      const m: Record<string, string> = {};
      (people ?? []).forEach((p) => { m[p.user_id] = p.display_name || p.pix_key; });
      setNames(m);
    }
    setLoading(false);
  }, [nav]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div className="lp-app flex min-h-screen items-center justify-center bg-[#0a0a0a] text-white">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
  if (!account) return null;

  return (
    <div className="lp-app min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif)" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 lg:flex-row lg:py-10">
        <Sidebar tab={tab} setTab={setTab} isAdmin={account.is_admin} />
        <main className="flex-1 space-y-5">
          <Topbar name={account.display_name} isAdmin={account.is_admin} />
          {tab === "home" && <Home account={account} txs={txs} names={names} hide={hide} setHide={setHide} setTab={setTab} />}
          {tab === "pix" && <PixPanel account={account} reload={load} />}
          {tab === "extrato" && <Statement txs={txs} names={names} uid={account.user_id} />}
          {tab === "cartoes" && <CardsPanel account={account} />}
          {tab === "config" && <ConfigPanel account={account} reload={load} />}
          {tab === "admin" && account.is_admin && <AdminPanel reload={load} />}
        </main>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function Sidebar({ tab, setTab, isAdmin }: { tab: string; setTab: (t: any) => void; isAdmin: boolean }) {
  const items = [
    { id: "home", label: "Início", icon: Wallet },
    { id: "pix", label: "Pix", icon: Send },
    { id: "extrato", label: "Extrato", icon: History },
    { id: "cartoes", label: "Cartões", icon: CreditCard },
    { id: "config", label: "Configurações", icon: Settings },
  ] as const;
  return (
    <aside className="lp-sidebar lg:w-60 lg:shrink-0">
      <div className="flex items-center gap-2 px-2 pb-4">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#ffd84d] text-black font-black">L</div>
        <div>
          <div className="text-sm font-bold tracking-tight">LifePay</div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">conta digital</div>
        </div>
      </div>
      <nav className="space-y-1">
        {items.map((it) => (
          <button key={it.id} onClick={() => setTab(it.id)}
            className={`lp-nav-item ${tab === it.id ? "lp-nav-active" : ""}`}>
            <it.icon className="h-4 w-4" /> {it.label}
          </button>
        ))}
        {isAdmin && (
          <button onClick={() => setTab("admin")} className={`lp-nav-item ${tab === "admin" ? "lp-nav-active" : ""}`}>
            <ShieldCheck className="h-4 w-4" /> Admin
          </button>
        )}
      </nav>
      <div className="mt-6 border-t border-white/5 pt-4">
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="lp-nav-item text-white/60 hover:text-white">
          <LogOut className="h-4 w-4" /> Sair
        </button>
        <Link to="/" className="lp-nav-item text-white/40 hover:text-white/80 text-xs">← Voltar ao site</Link>
      </div>
    </aside>
  );
}

function Topbar({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  return (
    <header className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-[#ffd84d] to-[#ff9a3c] text-sm font-black text-black">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold">Olá, {name}</div>
          <div className="text-[11px] text-white/40">Bem-vindo de volta ao LifePay</div>
        </div>
      </div>
      {isAdmin && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ffd84d]/15 px-3 py-1 text-xs font-semibold text-[#ffd84d]">
          <ShieldCheck className="h-3.5 w-3.5" /> Admin
        </span>
      )}
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function Home({ account, txs, names, hide, setHide, setTab }: any) {
  const recent = txs.slice(0, 6);
  const monthIn = useMemo(() => {
    const now = new Date();
    return (txs as Tx[]).filter((t) =>
      t.to_user === account.user_id &&
      new Date(t.created_at).getMonth() === now.getMonth()
    ).reduce((s, t) => s + t.amount, 0);
  }, [txs, account]);
  const monthOut = useMemo(() => {
    const now = new Date();
    return (txs as Tx[]).filter((t) =>
      t.from_user === account.user_id &&
      new Date(t.created_at).getMonth() === now.getMonth()
    ).reduce((s, t) => s + t.amount, 0);
  }, [txs, account]);

  return (
    <div className="space-y-5">
      <div className="lp-card-hero p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/50">Saldo disponível</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-xs font-semibold text-[#ffd84d]">R$</span>
              <span className="text-4xl font-black tracking-tight">{hide ? "•••••••" : fmtRbx(account.balance)}</span>
              <span className="ml-1 text-xs text-white/40">Robux</span>
            </div>
            <div className="mt-1 text-[11px] text-white/40">Atualizado agora · conta verificada</div>
          </div>
          <button onClick={() => setHide(!hide)} className="lp-icon-btn">
            {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-6 grid grid-cols-4 gap-2">
          {[
            { id: "pix", label: "Pix", icon: Send },
            { id: "extrato", label: "Extrato", icon: History },
            { id: "cartoes", label: "Cartões", icon: CreditCard },
            { id: "config", label: "Mais", icon: Sparkles },
          ].map((q) => (
            <button key={q.id} onClick={() => setTab(q.id)} className="lp-quick">
              <q.icon className="h-4 w-4" /> <span>{q.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard icon={ArrowDownLeft} label="Entradas no mês" value={monthIn} tone="green" />
        <StatCard icon={ArrowUpRight} label="Saídas no mês" value={monthOut} tone="red" />
      </div>

      <div className="lp-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">Movimentações recentes</div>
          <button onClick={() => setTab("extrato")} className="text-xs text-[#ffd84d] hover:underline">Ver tudo</button>
        </div>
        <ul className="divide-y divide-white/5">
          {recent.length === 0 && <li className="py-6 text-center text-sm text-white/40">Sem movimentações ainda.</li>}
          {recent.map((t: Tx) => <TxRow key={t.id} t={t} names={names} uid={account.user_id} />)}
        </ul>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const color = tone === "green" ? "#22c55e" : "#ef4444";
  return (
    <div className="lp-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-white/40">{label}</div>
        <div className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-bold">R$ {fmtRbx(value)} <span className="text-xs font-normal text-white/40">Robux</span></div>
    </div>
  );
}

function TxRow({ t, names, uid }: { t: Tx; names: Record<string, string>; uid: string }) {
  const incoming = t.to_user === uid;
  const counter = incoming ? t.from_user : t.to_user;
  const label = t.kind === "signup_bonus" ? "Bônus de cadastro"
    : t.kind === "admin_grant" ? (incoming ? "Crédito admin" : "Concessão admin")
    : t.kind === "admin_debit" ? "Débito admin"
    : incoming ? `Recebido de ${names[counter ?? ""] || "Usuário"}` : `Enviado para ${names[counter ?? ""] || "Usuário"}`;
  return (
    <li className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className={`grid h-9 w-9 place-items-center rounded-full ${incoming ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
          {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-[11px] text-white/40">
            {new Date(t.created_at).toLocaleString("pt-BR")}{t.note ? ` · ${t.note}` : ""}
          </div>
        </div>
      </div>
      <div className={`text-sm font-semibold ${incoming ? "text-green-400" : "text-red-400"}`}>
        {incoming ? "+" : "−"} R$ {fmtRbx(t.amount)}
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function PixPanel({ account, reload }: { account: Account; reload: () => Promise<void> }) {
  const [pix, setPix] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setBusy(true);
    const amt = Math.floor(Number(amount.replace(/[^\d]/g, "")));
    if (!amt || amt <= 0) { setMsg({ type: "err", text: "Valor inválido" }); setBusy(false); return; }
    const { data, error } = await supabase.rpc("lifepay_transfer", { _to_pix: pix.trim(), _amount: amt, _note: note });
    if (error) { setMsg({ type: "err", text: error.message }); setBusy(false); return; }
    setMsg({ type: "ok", text: `Pix de R$ ${fmtRbx(amt)} enviado!` });
    setPix(""); setAmount(""); setNote("");
    await reload();
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="lp-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-white/40">Sua chave Pix</div>
            <div className="mt-1 font-mono text-sm">{account.pix_key}</div>
            <div className="mt-1 text-[11px] text-white/40">Compartilhe esta chave para receber Robux.</div>
          </div>
          <button onClick={async () => { await navigator.clipboard.writeText(account.pix_key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="lp-btn-soft">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copiado" : "Copiar chave"}
          </button>
        </div>
      </div>

      <form onSubmit={send} className="lp-card p-5 space-y-4">
        <div className="text-sm font-semibold">Enviar Pix</div>
        <Field label="Chave Pix do destinatário" icon={KeyRound}>
          <input value={pix} onChange={(e) => setPix(e.target.value)} required
            className="lp-input" placeholder="email@exemplo.com ou chave gerada" />
        </Field>
        <Field label="Valor (Robux)" icon={Wallet}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} required inputMode="numeric"
            className="lp-input" placeholder="100" />
        </Field>
        <Field label="Mensagem (opcional)" icon={Sparkles}>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
            className="lp-input" placeholder="ex: jantar de ontem" />
        </Field>
        {msg && (
          <div className={`rounded-xl px-3 py-2 text-sm ${msg.type === "ok" ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
            {msg.text}
          </div>
        )}
        <button disabled={busy} className="lp-btn-primary w-full">
          {busy ? "Enviando..." : (<><Send className="h-4 w-4" /> Enviar Pix</>)}
        </button>
        <div className="text-[11px] text-white/40">
          Saldo disponível: <strong className="text-white/80">R$ {fmtRbx(account.balance)} Robux</strong>
        </div>
      </form>
    </div>
  );
}

function Field({ label, icon: Icon, children }: any) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest text-white/40">{label}</span>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <div className="[&_input]:pl-10">{children}</div>
      </div>
    </label>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function Statement({ txs, names, uid }: { txs: Tx[]; names: Record<string, string>; uid: string }) {
  return (
    <div className="lp-card p-5">
      <div className="mb-3 text-sm font-semibold">Extrato completo</div>
      <ul className="divide-y divide-white/5">
        {txs.length === 0 && <li className="py-6 text-center text-sm text-white/40">Sem movimentações.</li>}
        {txs.map((t) => <TxRow key={t.id} t={t} names={names} uid={uid} />)}
      </ul>
    </div>
  );
}

function CardsPanel({ account }: { account: Account }) {
  return (
    <div className="space-y-5">
      <div className="lp-card-hero relative overflow-hidden p-6">
        <div className="text-[11px] uppercase tracking-widest text-white/50">LifePay Black</div>
        <div className="mt-10 font-mono text-lg tracking-widest">•••• •••• •••• {account.user_id.slice(0, 4).toUpperCase()}</div>
        <div className="mt-3 flex items-end justify-between text-xs text-white/60">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Titular</div>
            <div className="text-sm font-semibold text-white">{account.display_name}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Limite</div>
            <div className="text-sm font-semibold text-white">R$ {fmtRbx(Math.min(account.balance, 999999999))}</div>
          </div>
        </div>
      </div>
      <div className="lp-card p-5 text-sm text-white/60 flex items-start gap-3">
        <PieChart className="h-5 w-5 text-[#ffd84d]" />
        Cartão fictício para o universo LifePay. As compras não geram cobranças reais.
      </div>
    </div>
  );
}

function ConfigPanel({ account, reload }: { account: Account; reload: () => Promise<void> }) {
  const [name, setName] = useState(account.display_name);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const save = async () => {
    setBusy(true);
    await supabase.from("lifepay_accounts").update({ display_name: name }).eq("user_id", account.user_id);
    await reload();
    setOk(true); setBusy(false); setTimeout(() => setOk(false), 1500);
  };
  return (
    <div className="lp-card p-5 space-y-4">
      <div className="text-sm font-semibold">Perfil</div>
      <Field label="Nome de exibição" icon={Sparkles}>
        <input value={name} onChange={(e) => setName(e.target.value)} className="lp-input" />
      </Field>
      <div className="text-[11px] text-white/40">Sua chave Pix é fixa: <span className="font-mono text-white/80">{account.pix_key}</span></div>
      <button onClick={save} disabled={busy} className="lp-btn-primary">
        {ok ? <Check className="h-4 w-4" /> : null} {busy ? "Salvando..." : ok ? "Salvo" : "Salvar"}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function AdminPanel({ reload }: { reload: () => Promise<void> }) {
  const [target, setTarget] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"grant" | "debit">("grant");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setBusy(true);
    const amt = Math.floor(Number(amount.replace(/[^\d]/g, "")));
    if (!amt || amt <= 0) { setMsg({ type: "err", text: "Valor inválido" }); setBusy(false); return; }
    const signed = mode === "grant" ? amt : -amt;
    const { error } = await supabase.rpc("lifepay_admin_adjust", { _target_pix: target.trim(), _amount: signed, _note: note });
    if (error) { setMsg({ type: "err", text: error.message }); setBusy(false); return; }
    setMsg({ type: "ok", text: mode === "grant" ? `Creditado R$ ${fmtRbx(amt)} em ${target}` : `Debitado R$ ${fmtRbx(amt)} de ${target}` });
    setTarget(""); setAmount(""); setNote("");
    await reload();
    setBusy(false);
  };

  return (
    <div className="space-y-5">
      <div className="lp-card p-5 border-[#ffd84d]/30">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-[#ffd84d]" /> Painel Admin
        </div>
        <p className="mt-1 text-xs text-white/50">Conceda ou retire Robux de qualquer conta pela chave Pix.</p>

        <form onSubmit={run} className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode("grant")}
              className={`lp-toggle ${mode === "grant" ? "lp-toggle-active" : ""}`}>+ Creditar</button>
            <button type="button" onClick={() => setMode("debit")}
              className={`lp-toggle ${mode === "debit" ? "lp-toggle-active" : ""}`}>− Debitar</button>
          </div>
          <Field label="Chave Pix do alvo" icon={KeyRound}>
            <input value={target} onChange={(e) => setTarget(e.target.value)} required className="lp-input" placeholder="email@exemplo.com" />
          </Field>
          <Field label="Valor (Robux)" icon={Wallet}>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} required inputMode="numeric" className="lp-input" placeholder="1000" />
          </Field>
          <Field label="Motivo (opcional)" icon={Sparkles}>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} className="lp-input" placeholder="ex: bônus de evento" />
          </Field>
          {msg && (
            <div className={`rounded-xl px-3 py-2 text-sm ${msg.type === "ok" ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>{msg.text}</div>
          )}
          <button disabled={busy} className="lp-btn-primary w-full">{busy ? "Executando..." : "Executar"}</button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
const CSS = `
.lp-app input { color: #fff; }
.lp-sidebar { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 18px; height: fit-content; }
.lp-nav-item { display:flex; align-items:center; gap:10px; width:100%; padding: 10px 12px; border-radius: 12px; font-size: 13px; color: rgba(255,255,255,0.7); transition: all .15s; }
.lp-nav-item:hover { background: rgba(255,255,255,0.04); color: #fff; }
.lp-nav-active { background: rgba(255,216,77,0.10); color: #ffd84d !important; }
.lp-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; }
.lp-card-hero { position: relative; background: radial-gradient(120% 120% at 0% 0%, rgba(255,216,77,0.18) 0%, rgba(255,154,60,0.05) 30%, rgba(255,255,255,0.02) 60%); border: 1px solid rgba(255,216,77,0.18); border-radius: 24px; }
.lp-icon-btn { display:grid; place-items:center; height: 36px; width: 36px; border-radius: 10px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); }
.lp-icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
.lp-quick { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding: 14px 6px; border-radius: 14px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.85); font-size: 12px; }
.lp-quick:hover { background: rgba(255,216,77,0.10); color: #ffd84d; }
.lp-input { width:100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 14px; color: #fff; font-size: 14px; outline: none; transition: border .15s; }
.lp-input:focus { border-color: #ffd84d; box-shadow: 0 0 0 3px rgba(255,216,77,0.15); }
.lp-btn-primary { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding: 12px 18px; border-radius: 12px; background: #ffd84d; color: #0a0a0a; font-weight: 700; font-size: 13px; transition: opacity .15s; }
.lp-btn-primary:hover { opacity: .9; }
.lp-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
.lp-btn-soft { display:inline-flex; align-items:center; gap:8px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,0.05); color: #fff; font-size: 13px; }
.lp-btn-soft:hover { background: rgba(255,255,255,0.1); }
.lp-toggle { padding: 10px; border-radius: 12px; background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.6); font-size: 13px; font-weight: 600; }
.lp-toggle-active { background: rgba(255,216,77,0.15); color: #ffd84d; }
`;
