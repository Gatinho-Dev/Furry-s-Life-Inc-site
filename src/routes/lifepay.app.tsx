import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Copy, Eye, EyeOff, LogOut, Send, ShieldCheck,
  Wallet, Loader2, Check, CreditCard, Home as HomeIcon, Receipt, Menu as MenuIcon,
  Bell, Search, QrCode, KeyRound, HandCoins, X, ChevronRight, Plus,
  Gift, PiggyBank, Users, Zap, Settings, ArrowLeftRight, ChevronLeft,
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
type PixSheet = null | "send" | "receive" | "key" | "qr";
type Tab = "home" | "extrato" | "cartoes" | "menu";

const fmt = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (v: number) => v.toLocaleString("pt-BR");
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

// ────────────────────────────────────────────────────────────────────────────
function LifePayApp() {
  const nav = useNavigate();
  const [account, setAccount] = useState<Account | null>(null);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [names, setNames] = useState<Record<string, { name: string; pix: string }>>({});
  const [tab, setTab] = useState<Tab>("home");
  const [hide, setHide] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState<PixSheet>(null);

  const load = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) { nav({ to: "/auth", search: { redirect: "/lifepay/app" } }); return; }
    const uid = sess.session.user.id;
    await supabase.rpc("ensure_lifepay_account", { _user_id: uid });
    const { data: acc } = await supabase
      .from("lifepay_accounts").select("*").eq("user_id", uid).maybeSingle();
    setAccount(acc as Account | null);
    const { data: tx } = await supabase
      .from("lifepay_transactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80);
    setTxs((tx ?? []) as Tx[]);
    const ids = Array.from(new Set((tx ?? []).flatMap((t) => [t.from_user, t.to_user]).filter(Boolean) as string[]));
    if (ids.length) {
      const { data: people } = await supabase.from("lifepay_accounts").select("user_id, display_name, pix_key").in("user_id", ids);
      const m: Record<string, { name: string; pix: string }> = {};
      (people ?? []).forEach((p) => { m[p.user_id] = { name: p.display_name || p.pix_key, pix: p.pix_key }; });
      setNames(m);
    }
    setLoading(false);
  }, [nav]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return (
    <div className="lp min-h-screen bg-[#0a0a0a] text-white grid place-items-center">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Loader2 className="h-6 w-6 animate-spin text-[#ffd84d]" />
    </div>
  );
  if (!account) return null;

  return (
    <div className="lp min-h-screen bg-black text-white">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* Phone-sized centered container */}
      <div className="mx-auto min-h-screen w-full max-w-[440px] bg-[#0a0a0a] pb-28 sm:my-6 sm:min-h-0 sm:rounded-[36px] sm:shadow-2xl sm:ring-1 sm:ring-white/5">
        {tab === "home" && <HomeScreen account={account} txs={txs} names={names} hide={hide} setHide={setHide} openSheet={setSheet} />}
        {tab === "extrato" && <StatementScreen txs={txs} names={names} uid={account.user_id} />}
        {tab === "cartoes" && <CardsScreen account={account} />}
        {tab === "menu" && <MenuScreen account={account} reload={load} />}
      </div>

      <BottomNav tab={tab} setTab={setTab} onCenter={() => setSheet("send")} />

      {sheet && (
        <PixSheetView
          kind={sheet}
          onClose={() => setSheet(null)}
          account={account}
          txs={txs}
          names={names}
          reload={load}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HOME
function HomeScreen({ account, txs, names, hide, setHide, openSheet }: {
  account: Account; txs: Tx[]; names: Record<string, { name: string; pix: string }>;
  hide: boolean; setHide: (v: boolean) => void; openSheet: (s: PixSheet) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <div>
          <div className="text-sm text-white/60">{greeting()},</div>
          <div className="text-xl font-bold tracking-tight">{account.display_name}</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="lp-icon-btn relative" aria-label="Notificações">
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-black text-sm font-bold">
            {account.display_name.charAt(0).toUpperCase()}
          </div>
        </div>
      </header>

      {/* Balance cards carousel */}
      <div className="px-5">
        <div className="lp-scroll flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 snap-x snap-mandatory">
          <BalanceCard
            tone="green"
            label="Saldo"
            balance={account.balance}
            hide={hide}
            onToggleHide={() => setHide(!hide)}
          />
          <SecondaryCard label="Robux investidos" value={Math.floor(account.balance * 0.05)} hide={hide} tone="blue" />
          <SecondaryCard label="Cashback do mês" value={Math.floor(account.balance * 0.001)} hide={hide} tone="yellow" />
        </div>
      </div>

      {/* Quick actions grid */}
      <section className="mt-2 rounded-t-[28px] bg-white px-5 pt-5 pb-6 text-black">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/10" />
        <div className="grid grid-cols-4 gap-y-4 gap-x-1">
          {[
            { label: "Meus Limites", icon: Wallet },
            { label: "Investir", icon: PiggyBank },
            { label: "Empréstimos", icon: HandCoins },
            { label: "Recarga", icon: Zap },
            { label: "Cobrar", icon: Receipt, onClick: () => openSheet("receive") },
            { label: "Convidar", icon: Users },
            { label: "Doações", icon: Gift },
            { label: "Mais", icon: Plus },
          ].map((q, i) => (
            <button key={i} onClick={q.onClick} className="flex flex-col items-center gap-1.5">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-neutral-100">
                <q.icon className="h-5 w-5 text-neutral-700" />
              </div>
              <span className="text-[11px] leading-tight text-center text-neutral-700 max-w-[70px]">{q.label}</span>
            </button>
          ))}
        </div>

        {/* Para você banner */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Para você</div>
            <button className="text-xs text-neutral-500">Ver menos</button>
          </div>
          <div className="lp-scroll flex gap-3 overflow-x-auto -mx-5 px-5 pb-1 snap-x snap-mandatory">
            <PromoCard tone="red" title="Benefícios exclusivos" subtitle="para clientes LifePay" />
            <PromoCard tone="dark" title="Convide amigos" subtitle="ganhe 100 Robux por indicação" />
            <PromoCard tone="yellow" title="LifePay Black" subtitle="cashback dobrado" />
          </div>
        </div>

        {/* Pix block */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid h-5 w-5 place-items-center rounded-md bg-black text-[#ffd84d]">
              <ArrowLeftRight className="h-3 w-3" />
            </div>
            <div className="text-sm font-semibold">Pix</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <PixQuick label="Ler QR" icon={QrCode} onClick={() => openSheet("qr")} />
            <PixQuick label="Transferir" icon={Send} onClick={() => openSheet("send")} />
            <PixQuick label="Cobrar" icon={ArrowDownLeft} onClick={() => openSheet("receive")} />
            <PixQuick label="Minha chave" icon={KeyRound} onClick={() => openSheet("key")} />
          </div>
        </div>

        {/* Recent */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold">Últimas movimentações</div>
          </div>
          <ul className="divide-y divide-black/5">
            {txs.length === 0 && <li className="py-6 text-center text-sm text-neutral-500">Sem movimentações ainda.</li>}
            {txs.slice(0, 5).map((t) => <TxRowLight key={t.id} t={t} names={names} uid={account.user_id} />)}
          </ul>
        </div>
      </section>
    </div>
  );
}

function BalanceCard({ tone, label, balance, hide, onToggleHide }: any) {
  return (
    <div className="lp-bcard snap-start min-w-[86%] p-5 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`grid h-6 w-6 place-items-center rounded-full ${tone === "green" ? "bg-emerald-500/20 text-emerald-400" : "bg-white/10 text-white"}`}>
            <span className="text-[10px] font-bold">R$</span>
          </div>
          <div className="text-sm text-white/70">{label}</div>
        </div>
        <button onClick={onToggleHide} className="text-white/60 hover:text-white">
          {hide ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight">
        {hide ? "R$ ••••••" : fmt(balance)}
      </div>
      <div className="mt-1 text-[11px] text-white/40">Robux · atualizado agora</div>
      <button className="mt-4 flex items-center gap-1 text-xs font-medium text-white/80 hover:text-white">
        VER DETALHES <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function SecondaryCard({ label, value, hide, tone }: any) {
  const tones: Record<string, string> = {
    blue: "from-sky-500/20 to-sky-500/5 text-sky-400",
    yellow: "from-amber-400/20 to-amber-500/5 text-amber-400",
  };
  return (
    <div className={`lp-bcard snap-start min-w-[70%] p-5 bg-gradient-to-br ${tones[tone] ?? ""}`}>
      <div className="text-sm text-white/70">{label}</div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-white">
        {hide ? "R$ ••••••" : fmt(value)}
      </div>
      <div className="mt-1 text-[11px] text-white/40">Robux</div>
    </div>
  );
}

function PromoCard({ tone, title, subtitle }: any) {
  const bg: Record<string, string> = {
    red: "bg-gradient-to-br from-red-900 to-red-950 text-white",
    dark: "bg-gradient-to-br from-neutral-900 to-black text-white",
    yellow: "bg-gradient-to-br from-amber-300 to-amber-500 text-black",
  };
  return (
    <div className={`snap-start min-w-[85%] rounded-2xl p-5 relative ${bg[tone]}`}>
      <div className="text-sm font-semibold leading-tight max-w-[70%]">{title}</div>
      <div className="text-xs opacity-80 mt-1">{subtitle}</div>
      <div className="absolute right-4 bottom-4 grid h-8 w-8 place-items-center rounded-full bg-[#ffd84d] text-black">
        <ArrowUpRight className="h-4 w-4" />
      </div>
    </div>
  );
}

function PixQuick({ label, icon: Icon, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1.5">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[#ffd84d] text-black shadow-sm active:scale-95 transition">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-[11px] leading-tight text-neutral-700 text-center max-w-[70px]">{label}</span>
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function TxRowLight({ t, names, uid }: { t: Tx; names: Record<string, { name: string; pix: string }>; uid: string }) {
  const incoming = t.to_user === uid;
  const counter = incoming ? t.from_user : t.to_user;
  const who = names[counter ?? ""]?.name;
  const label = t.kind === "signup_bonus" ? "Bônus de cadastro"
    : t.kind === "admin_grant" ? (incoming ? "Crédito admin" : "Concessão admin")
    : t.kind === "admin_debit" ? "Débito admin"
    : incoming ? `Recebido${who ? ` de ${who}` : ""}` : `Enviado${who ? ` para ${who}` : ""}`;
  return (
    <li className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${incoming ? "bg-emerald-100 text-emerald-600" : "bg-red-50 text-red-500"}`}>
          {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-[11px] text-neutral-500 truncate">
            {new Date(t.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            {t.note ? ` · ${t.note}` : ""}
          </div>
        </div>
      </div>
      <div className={`text-sm font-semibold shrink-0 ml-3 ${incoming ? "text-emerald-600" : "text-neutral-900"}`}>
        {incoming ? "+" : "−"} {fmt(t.amount)}
      </div>
    </li>
  );
}

function TxRowDark({ t, names, uid }: { t: Tx; names: Record<string, { name: string; pix: string }>; uid: string }) {
  const incoming = t.to_user === uid;
  const counter = incoming ? t.from_user : t.to_user;
  const who = names[counter ?? ""]?.name;
  const label = t.kind === "signup_bonus" ? "Bônus de cadastro"
    : t.kind === "admin_grant" ? (incoming ? "Crédito admin" : "Concessão admin")
    : t.kind === "admin_debit" ? "Débito admin"
    : incoming ? `Recebido${who ? ` de ${who}` : ""}` : `Enviado${who ? ` para ${who}` : ""}`;
  return (
    <li className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${incoming ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
          {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{label}</div>
          <div className="text-[11px] text-white/40 truncate">
            {new Date(t.created_at).toLocaleString("pt-BR")}
            {t.note ? ` · ${t.note}` : ""}
          </div>
        </div>
      </div>
      <div className={`text-sm font-semibold shrink-0 ml-3 ${incoming ? "text-emerald-400" : "text-red-400"}`}>
        {incoming ? "+" : "−"} {fmt(t.amount)}
      </div>
    </li>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// STATEMENT
function StatementScreen({ txs, names, uid }: { txs: Tx[]; names: Record<string, { name: string; pix: string }>; uid: string }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Tx[]>();
    txs.forEach((t) => {
      const d = new Date(t.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(t);
    });
    return Array.from(map.entries());
  }, [txs]);
  return (
    <div className="px-5 pt-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="text-xl font-bold">Extrato</div>
      </div>
      {grouped.length === 0 && <div className="py-10 text-center text-sm text-white/40">Sem movimentações.</div>}
      {grouped.map(([day, items]) => (
        <div key={day} className="mb-5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-1">{day}</div>
          <ul className="divide-y divide-white/5">
            {items.map((t) => <TxRowDark key={t.id} t={t} names={names} uid={uid} />)}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// CARDS
function CardsScreen({ account }: { account: Account }) {
  return (
    <div className="px-5 pt-6 space-y-5">
      <div className="text-xl font-bold">Cartões</div>
      <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black ring-1 ring-white/10">
        <div className="text-[11px] uppercase tracking-widest text-[#ffd84d]">LifePay Black</div>
        <div className="mt-10 font-mono text-lg tracking-widest">•••• •••• •••• {account.user_id.slice(0, 4).toUpperCase()}</div>
        <div className="mt-3 flex items-end justify-between text-xs text-white/60">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Titular</div>
            <div className="text-sm font-semibold text-white">{account.display_name}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Limite</div>
            <div className="text-sm font-semibold text-white">{fmt(Math.min(account.balance, 999999999))}</div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-white/[0.03] p-5 text-sm text-white/60 ring-1 ring-white/5">
        Cartão fictício do universo LifePay — não gera cobranças reais.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// MENU
function MenuScreen({ account, reload }: { account: Account; reload: () => Promise<void> }) {
  const [openAdmin, setOpenAdmin] = useState(false);
  return (
    <div className="px-5 pt-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-black font-bold">
          {account.display_name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-base font-semibold">{account.display_name}</div>
          <div className="text-xs text-white/50 font-mono">{account.pix_key}</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input placeholder="Buscar no app" className="w-full rounded-full bg-white/[0.04] border border-white/10 py-3 pl-10 pr-4 text-sm outline-none focus:border-[#ffd84d]" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Meus dados", icon: Users },
          { label: "Segurança", icon: ShieldCheck },
          { label: "Configurações", icon: Settings },
          { label: "Ajuda", icon: Bell },
          { label: "Voltar ao site", icon: HomeIcon, href: "/" },
          { label: "Sair", icon: LogOut, onClick: async () => { await supabase.auth.signOut(); window.location.href = "/"; } },
        ].map((m, i) => {
          const Inner = (
            <>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.05]">
                <m.icon className="h-4 w-4 text-white/80" />
              </div>
              <span className="text-[11px] text-center text-white/70 leading-tight">{m.label}</span>
            </>
          );
          if (m.href) return <Link key={i} to={m.href} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.02] p-3 hover:bg-white/[0.05]">{Inner}</Link>;
          return <button key={i} onClick={m.onClick} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.02] p-3 hover:bg-white/[0.05]">{Inner}</button>;
        })}
      </div>

      {account.is_admin && (
        <div className="mt-4">
          <button onClick={() => setOpenAdmin(!openAdmin)} className="flex w-full items-center justify-between rounded-2xl bg-[#ffd84d]/10 border border-[#ffd84d]/30 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#ffd84d]">
              <ShieldCheck className="h-4 w-4" /> Painel Admin
            </div>
            <ChevronRight className={`h-4 w-4 text-[#ffd84d] transition ${openAdmin ? "rotate-90" : ""}`} />
          </button>
          {openAdmin && <AdminPanel reload={reload} />}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// BOTTOM NAV
function BottomNav({ tab, setTab, onCenter }: { tab: Tab; setTab: (t: Tab) => void; onCenter: () => void }) {
  const items: { id: Tab; label: string; icon: any }[] = [
    { id: "home", label: "Início", icon: HomeIcon },
    { id: "extrato", label: "Extrato", icon: Receipt },
  ];
  const items2: { id: Tab; label: string; icon: any }[] = [
    { id: "cartoes", label: "Cartões", icon: CreditCard },
    { id: "menu", label: "Menu", icon: MenuIcon },
  ];
  return (
    <nav className="fixed bottom-0 left-1/2 z-40 -translate-x-1/2 w-full max-w-[440px] px-3 pb-3">
      <div className="relative flex items-center justify-between rounded-3xl bg-[#111]/95 backdrop-blur border border-white/10 px-4 py-2.5">
        {items.map((it) => (
          <NavBtn key={it.id} it={it} active={tab === it.id} onClick={() => setTab(it.id)} />
        ))}
        {/* Center Pix button */}
        <button onClick={onCenter} className="grid h-14 w-14 -mt-8 shrink-0 place-items-center rounded-full bg-black text-white ring-4 ring-[#0a0a0a] shadow-lg active:scale-95 transition">
          <span className="text-[10px] font-bold tracking-widest">PIX</span>
        </button>
        {items2.map((it) => (
          <NavBtn key={it.id} it={it} active={tab === it.id} onClick={() => setTab(it.id)} />
        ))}
      </div>
    </nav>
  );
}

function NavBtn({ it, active, onClick }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 px-2 py-1">
      <it.icon className={`h-5 w-5 ${active ? "text-[#ffd84d]" : "text-white/60"}`} />
      <span className={`text-[10px] ${active ? "text-[#ffd84d] font-semibold" : "text-white/60"}`}>{it.label}</span>
      {active && <span className="mt-0.5 h-0.5 w-4 rounded-full bg-[#ffd84d]" />}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// PIX SHEETS
function PixSheetView({ kind, onClose, account, txs, names, reload }: {
  kind: Exclude<PixSheet, null>;
  onClose: () => void;
  account: Account;
  txs: Tx[];
  names: Record<string, { name: string; pix: string }>;
  reload: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#0f0f0f] border border-white/10 text-white animate-in slide-in-from-bottom"
      >
        <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <button onClick={onClose} className="lp-icon-btn"><ChevronLeft className="h-4 w-4" /></button>
          <div className="text-sm font-semibold">
            {kind === "send" ? "Transferir Pix" : kind === "receive" ? "Cobrar via Pix" : kind === "key" ? "Minha chave Pix" : "Ler QR Code"}
          </div>
          <button onClick={onClose} className="lp-icon-btn"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5">
          {kind === "send" && <SendPix account={account} txs={txs} names={names} reload={reload} onDone={onClose} />}
          {kind === "receive" && <ReceivePix account={account} />}
          {kind === "key" && <MyKey account={account} />}
          {kind === "qr" && <ReadQR account={account} txs={txs} names={names} reload={reload} onDone={onClose} />}
        </div>
      </div>
    </div>
  );
}

// ────── Send flow (contacts + quick amounts + confirm) ──────
function SendPix({ account, txs, names, reload, onDone }: {
  account: Account; txs: Tx[]; names: Record<string, { name: string; pix: string }>;
  reload: () => Promise<void>; onDone: () => void;
}) {
  const [pix, setPix] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "success" | "error">("form");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // recent unique contacts
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    const out: { uid: string; name: string; pix: string }[] = [];
    for (const t of txs) {
      const other = t.from_user === account.user_id ? t.to_user : t.to_user === account.user_id ? t.from_user : null;
      if (!other || seen.has(other) || other === account.user_id) continue;
      const info = names[other];
      if (!info) continue;
      seen.add(other);
      out.push({ uid: other, name: info.name, pix: info.pix });
      if (out.length >= 6) break;
    }
    return out;
  }, [txs, names, account.user_id]);

  const chips = [10, 50, 100, 500, 1000];

  const submit = async () => {
    if (!pix.trim() || !amount) return;
    setStep("confirm");
  };

  const confirm = async () => {
    setBusy(true); setErrMsg("");
    const { error } = await supabase.rpc("lifepay_transfer", { _to_pix: pix.trim(), _amount: amount, _note: note });
    setBusy(false);
    if (error) { setErrMsg(error.message); setStep("error"); return; }
    await reload();
    setStep("success");
  };

  if (step === "success") return (
    <div className="text-center py-10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/20 text-emerald-400">
        <Check className="h-8 w-8" />
      </div>
      <div className="mt-4 text-lg font-bold">Pix enviado!</div>
      <div className="mt-1 text-sm text-white/60">{fmt(amount)} para <span className="font-mono">{pix}</span></div>
      <button onClick={onDone} className="mt-6 lp-btn-primary w-full">Concluir</button>
    </div>
  );
  if (step === "error") return (
    <div className="text-center py-10">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-500/20 text-red-400">
        <X className="h-8 w-8" />
      </div>
      <div className="mt-4 text-lg font-bold">Não foi possível enviar</div>
      <div className="mt-1 text-sm text-white/60">{errMsg}</div>
      <button onClick={() => setStep("form")} className="mt-6 lp-btn-primary w-full">Tentar novamente</button>
    </div>
  );
  if (step === "confirm") return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <div className="text-xs text-white/50 uppercase tracking-widest">Você vai enviar</div>
        <div className="mt-2 text-3xl font-bold">{fmt(amount)}</div>
        <div className="mt-1 text-xs text-white/50">Robux</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
        <Row k="Para" v={names[Object.keys(names).find((k) => names[k].pix.toLowerCase() === pix.trim().toLowerCase()) ?? ""]?.name ?? pix} />
        <Row k="Chave Pix" v={<span className="font-mono text-xs">{pix}</span>} />
        {note && <Row k="Mensagem" v={note} />}
        <Row k="Saldo após" v={fmt(account.balance - amount)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setStep("form")} className="rounded-full border border-white/15 py-3 text-sm font-medium">Voltar</button>
        <button onClick={confirm} disabled={busy} className="lp-btn-primary">
          {busy ? "Enviando..." : "Confirmar Pix"}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {contacts.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Contatos recentes</div>
          <div className="flex gap-3 overflow-x-auto -mx-5 px-5 pb-1 lp-scroll">
            {contacts.map((c) => (
              <button key={c.uid} onClick={() => setPix(c.pix)}
                className="flex shrink-0 flex-col items-center gap-1.5 w-16">
                <div className={`grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-[#ffd84d] to-amber-600 text-black font-bold text-lg ${pix === c.pix ? "ring-2 ring-white" : ""}`}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-[10px] text-center text-white/70 truncate w-full">{c.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Chave Pix ou email</span>
        <div className="relative mt-1.5">
          <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input value={pix} onChange={(e) => setPix(e.target.value)}
            className="w-full rounded-2xl bg-white/[0.04] border border-white/10 py-3.5 pl-10 pr-4 text-sm outline-none focus:border-[#ffd84d]"
            placeholder="email@exemplo.com" />
        </div>
      </label>

      <div>
        <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">Valor</div>
        <div className="flex items-baseline gap-1 rounded-2xl bg-white/[0.04] border border-white/10 px-4 py-3">
          <span className="text-white/50 text-sm">R$</span>
          <input value={amount || ""} onChange={(e) => setAmount(Math.floor(Number(e.target.value.replace(/[^\d]/g, ""))) || 0)}
            inputMode="numeric" placeholder="0"
            className="flex-1 bg-transparent text-2xl font-bold outline-none" />
          <span className="text-[10px] text-white/40">Robux</span>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto lp-scroll">
          {chips.map((c) => (
            <button key={c} onClick={() => setAmount(c)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${amount === c ? "border-[#ffd84d] bg-[#ffd84d]/10 text-[#ffd84d]" : "border-white/10 text-white/70 hover:border-white/30"}`}>
              R$ {fmtInt(c)}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-white/40">Saldo disponível: <span className="text-white/80 font-semibold">{fmt(account.balance)}</span></div>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Mensagem (opcional)</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
          className="mt-1.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 py-3 px-4 text-sm outline-none focus:border-[#ffd84d]"
          placeholder="ex: jantar de ontem" />
      </label>

      <button onClick={submit} disabled={!pix.trim() || !amount} className="lp-btn-primary w-full">
        <Send className="h-4 w-4" /> Continuar
      </button>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/50">{k}</span>
      <span className="text-white font-medium text-right max-w-[60%] truncate">{v}</span>
    </div>
  );
}

// ────── Receive (cobrar) ──────
function ReceivePix({ account }: { account: Account }) {
  const [amount, setAmount] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/lifepay/app?pay=${encodeURIComponent(account.pix_key)}${amount ? `&amount=${amount}` : ""}`;
  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-5 text-center">
        <div className="text-xs text-white/50 uppercase tracking-widest">Valor a cobrar</div>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="text-white/50 text-sm">R$</span>
          <input value={amount || ""} onChange={(e) => setAmount(Math.floor(Number(e.target.value.replace(/[^\d]/g, ""))) || 0)}
            inputMode="numeric" placeholder="0"
            className="w-40 bg-transparent text-3xl font-bold text-center outline-none" />
        </div>
        <div className="text-[11px] text-white/40 mt-1">Robux · deixe 0 para cobrança aberta</div>
      </div>

      <div className="rounded-2xl border border-white/10 p-5 flex items-center justify-center bg-white">
        <QrPreview value={link} />
      </div>

      <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Link de pagamento</div>
        <div className="mt-1 font-mono text-xs text-white/80 break-all">{link}</div>
      </div>

      <button onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="lp-btn-primary w-full">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}

// ────── My key ──────
function MyKey({ account }: { account: Account }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#ffd84d]/20 bg-gradient-to-br from-[#ffd84d]/10 to-transparent p-5 text-center">
        <div className="text-xs text-[#ffd84d] uppercase tracking-widest font-semibold">Sua chave Pix</div>
        <div className="mt-3 font-mono text-lg break-all text-white">{account.pix_key}</div>
        <div className="mt-1 text-[11px] text-white/40">Compartilhe para receber Robux</div>
      </div>
      <div className="rounded-2xl border border-white/10 p-5 flex items-center justify-center bg-white">
        <QrPreview value={account.pix_key} />
      </div>
      <button onClick={async () => { await navigator.clipboard.writeText(account.pix_key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="lp-btn-primary w-full">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Chave copiada" : "Copiar chave"}
      </button>
    </div>
  );
}

// ────── Read QR (paste code fallback) ──────
function ReadQR({ account, txs, names, reload, onDone }: any) {
  const [code, setCode] = useState("");
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
        <QrCode className="mx-auto h-16 w-16 text-white/30" />
        <div className="mt-3 text-sm text-white/60">Câmera não disponível na versão web.</div>
        <div className="text-xs text-white/40 mt-1">Cole o código Pix abaixo para simular a leitura.</div>
      </div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-widest text-white/40">Código / chave</span>
        <input value={code} onChange={(e) => setCode(e.target.value)}
          className="mt-1.5 w-full rounded-2xl bg-white/[0.04] border border-white/10 py-3 px-4 text-sm font-mono outline-none focus:border-[#ffd84d]"
          placeholder="email@exemplo.com" />
      </label>
      {code && (
        <SendPix
          account={account} txs={txs} names={names} reload={reload} onDone={onDone}
          key={code}
        />
      )}
    </div>
  );
}

// Simple visual "QR" (not a real QR, decorative placeholder that reads as one)
function QrPreview({ value }: { value: string }) {
  // deterministic pseudo-pattern from string
  const size = 21;
  const cells: boolean[] = [];
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  for (let i = 0; i < size * size; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    cells.push((h & 0xff) > 128);
  }
  const isCorner = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${size}, 8px)`, gap: 0 }}>
      {Array.from({ length: size * size }).map((_, i) => {
        const r = Math.floor(i / size); const c = i % size;
        const corner = isCorner(r, c);
        const border = corner && (
          (r === 0 || r === 6 || r === size - 7 || r === size - 1 || c === 0 || c === 6 || c === size - 7 || c === size - 1) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4) ||
          (r >= 2 && r <= 4 && c >= size - 5 && c <= size - 3) ||
          (r >= size - 5 && r <= size - 3 && c >= 2 && c <= 4)
        );
        const filled = corner ? border : cells[i];
        return <div key={i} style={{ width: 8, height: 8, background: filled ? "#000" : "transparent" }} />;
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN (embedded in Menu)
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
    setMsg({ type: "ok", text: mode === "grant" ? `Creditado ${fmt(amt)} em ${target}` : `Debitado ${fmt(amt)} de ${target}` });
    setTarget(""); setAmount(""); setNote("");
    await reload();
    setBusy(false);
  };

  return (
    <form onSubmit={run} className="mt-3 space-y-3 rounded-2xl border border-[#ffd84d]/20 bg-black/40 p-4">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setMode("grant")}
          className={`rounded-xl py-2 text-xs font-semibold ${mode === "grant" ? "bg-[#ffd84d] text-black" : "bg-white/[0.05] text-white/70"}`}>+ Creditar</button>
        <button type="button" onClick={() => setMode("debit")}
          className={`rounded-xl py-2 text-xs font-semibold ${mode === "debit" ? "bg-[#ffd84d] text-black" : "bg-white/[0.05] text-white/70"}`}>− Debitar</button>
      </div>
      <input value={target} onChange={(e) => setTarget(e.target.value)} required placeholder="Chave Pix do alvo"
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-[#ffd84d]" />
      <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} required inputMode="numeric" placeholder="Valor (Robux)"
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-[#ffd84d]" />
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="Motivo (opcional)"
        className="w-full rounded-xl bg-white/[0.04] border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-[#ffd84d]" />
      {msg && (
        <div className={`rounded-xl px-3 py-2 text-xs ${msg.type === "ok" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>{msg.text}</div>
      )}
      <button disabled={busy} className="lp-btn-primary w-full">{busy ? "Executando..." : "Executar"}</button>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
const CSS = `
.lp { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif; letter-spacing: -0.01em; }
.lp .lp-icon-btn { display:grid; place-items:center; height: 36px; width: 36px; border-radius: 999px; background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.85); }
.lp .lp-icon-btn:hover { background: rgba(255,255,255,0.1); }
.lp .lp-bcard { border-radius: 20px; background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.08); }
.lp .lp-btn-primary { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding: 14px 18px; border-radius: 999px; background: #ffd84d; color: #0a0a0a; font-weight: 700; font-size: 14px; transition: opacity .15s, transform .1s; }
.lp .lp-btn-primary:hover { opacity: .92; }
.lp .lp-btn-primary:active { transform: scale(.98); }
.lp .lp-btn-primary:disabled { opacity: .4; cursor: not-allowed; }
.lp .lp-scroll::-webkit-scrollbar { display: none; }
.lp .lp-scroll { scrollbar-width: none; }
`;
