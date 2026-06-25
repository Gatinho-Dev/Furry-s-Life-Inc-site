import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence,
} from "framer-motion";
import {
  Eye, EyeOff, ArrowUpRight, ArrowDownLeft, QrCode, Clock, History, Repeat, Send,
  CreditCard, Lock, ShieldCheck, BellRing, Smartphone, Fingerprint,
  Building2, Wallet, BarChart3, Receipt, Plus, MoreHorizontal, Search,
  Sparkles, X, Menu, ChevronRight, Check, Loader2, MessageCircle, Apple,
  TrendingUp, Coins, LineChart as LineIcon, Briefcase,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/lifepay/")({
  head: () => ({
    meta: [
      { title: "LifePay — Banco digital | Furry's Life Inc." },
      { name: "description", content: "LifePay é o banco digital fictício da Furry's Life Inc. — Pix, cartões premium, investimentos e PJ em uma única experiência." },
      { property: "og:title", content: "LifePay — O banco digital que acompanha sua vida" },
      { property: "og:description", content: "Projeto fictício da Furry's Life Inc. — fintech premium com Pix, cartões, investimentos e contas PJ." },
      { name: "theme-color", content: "#090909" },
    ],
  }),
  component: LifePayLanding,
});

// ────────────────────────────────────────────────────────────────────────────
// Tokens scoped to .lifepay-scope only — não vazam pro resto do site.
// ────────────────────────────────────────────────────────────────────────────
const SCOPED_CSS = `
.lifepay-scope {
  --lp-bg: #090909;
  --lp-bg-2: #111111;
  --lp-card: #171717;
  --lp-card-2: #1f1f1f;
  --lp-border: rgba(255,255,255,0.06);
  --lp-border-strong: rgba(255,255,255,0.12);
  --lp-primary: #FFD84D;
  --lp-primary-dim: #B89B2E;
  --lp-text: #FFFFFF;
  --lp-text-2: #9C9C9C;
  --lp-success: #20D97A;
  --lp-danger: #ff5c5c;

  background: var(--lp-bg);
  color: var(--lp-text);
  font-family: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-feature-settings: "cv11", "ss01", "ss03";
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.lifepay-scope * { box-sizing: border-box; }
.lifepay-scope .lp-card { background: var(--lp-card); border: 1px solid var(--lp-border); border-radius: 20px; }
.lifepay-scope .lp-card-2 { background: var(--lp-card-2); border: 1px solid var(--lp-border); border-radius: 16px; }
.lifepay-scope .lp-glass { background: color-mix(in oklab, var(--lp-card) 60%, transparent); backdrop-filter: blur(14px) saturate(140%); border: 1px solid var(--lp-border); }
.lifepay-scope .lp-divider { border-color: var(--lp-border); }
.lifepay-scope .lp-text-2 { color: var(--lp-text-2); }
.lifepay-scope .lp-primary { color: var(--lp-primary); }
.lifepay-scope .lp-success { color: var(--lp-success); }
.lifepay-scope .lp-grain::before {
  content: ""; position: absolute; inset: 0; pointer-events: none; opacity: 0.4;
  background-image: radial-gradient(circle at 20% 10%, rgba(255,216,77,0.10), transparent 50%),
                    radial-gradient(circle at 90% 0%, rgba(255,216,77,0.05), transparent 40%);
}
.lifepay-scope .lp-btn-primary {
  background: var(--lp-primary); color: #0a0a0a; border-radius: 999px;
  font-weight: 600; padding: 12px 22px; font-size: 14px; letter-spacing: -0.01em;
  display: inline-flex; align-items: center; gap: 8px;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
  box-shadow: 0 8px 30px -10px rgba(255,216,77,0.45);
}
.lifepay-scope .lp-btn-primary:hover { transform: translateY(-1px); background: #ffe06c; }
.lifepay-scope .lp-btn-ghost {
  background: transparent; color: var(--lp-text); border: 1px solid var(--lp-border-strong);
  border-radius: 999px; padding: 12px 20px; font-size: 14px; font-weight: 500;
  display: inline-flex; align-items: center; gap: 8px;
  transition: background .2s, border-color .2s;
}
.lifepay-scope .lp-btn-ghost:hover { background: rgba(255,255,255,0.04); border-color: var(--lp-border-strong); }
.lifepay-scope .lp-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px;
  background: rgba(255,216,77,0.10); color: var(--lp-primary); font-size: 12px; font-weight: 500;
  border: 1px solid rgba(255,216,77,0.20);
}
.lifepay-scope .lp-input {
  background: var(--lp-card-2); border: 1px solid var(--lp-border); border-radius: 14px;
  color: var(--lp-text); padding: 12px 16px; font-size: 14px; width: 100%; outline: none;
  transition: border-color .2s, background .2s;
}
.lifepay-scope .lp-input:focus { border-color: rgba(255,216,77,0.45); background: var(--lp-card); }
.lifepay-scope .lp-input::placeholder { color: var(--lp-text-2); }

.lifepay-scope ::selection { background: rgba(255,216,77,0.30); color: white; }

@keyframes lp-shimmer { 0% { background-position: -400px 0 } 100% { background-position: 400px 0 } }
.lifepay-scope .lp-skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);
  background-size: 800px 100%; animation: lp-shimmer 1.6s infinite linear;
  border-radius: 12px;
}

@keyframes lp-pulse-dot { 0%,100% { opacity:.4 } 50% { opacity:1 } }
.lifepay-scope .lp-live-dot::before {
  content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 999px;
  background: var(--lp-success); margin-right: 8px; vertical-align: middle;
  box-shadow: 0 0 0 4px rgba(32,217,122,0.15);
  animation: lp-pulse-dot 1.6s infinite ease-in-out;
}
`;

// ────────────────────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "inicio", label: "Início" },
  { id: "cartoes", label: "Cartões" },
  { id: "pix", label: "Pix" },
  { id: "investimentos", label: "Investimentos" },
  { id: "empresas", label: "Empresas" },
  { id: "seguranca", label: "Segurança" },
  { id: "sobre", label: "Sobre" },
];

const QUICK = [
  { id: "pix", label: "Pix", icon: ArrowUpRight },
  { id: "trans", label: "Transferir", icon: Send },
  { id: "pay", label: "Pagar", icon: Receipt },
  { id: "cards", label: "Cartões", icon: CreditCard },
  { id: "invest", label: "Investir", icon: TrendingUp },
  { id: "extrato", label: "Extrato", icon: History },
  { id: "cob", label: "Cobrar", icon: Wallet },
  { id: "mais", label: "Mais", icon: MoreHorizontal },
];

const RECORRENTES = [
  { name: "Netflix", desc: "Streaming · mensal", value: 39.9, next: "12/jul" },
  { name: "Spotify", desc: "Música · mensal", value: 21.9, next: "18/jul" },
  { name: "iCloud+", desc: "Armazenamento · mensal", value: 14.9, next: "22/jul" },
];

const LAST_PIX = [
  { who: "Ana Lima", when: "Hoje · 14:22", value: 80, kind: "out" },
  { who: "Bruno F.", when: "Hoje · 09:14", value: 240, kind: "in" },
  { who: "Mercado Central", when: "Ontem · 19:02", value: 156.7, kind: "out" },
];

const STATEMENT = [
  { date: "25/jun", type: "Pix recebido", who: "Bruno F.", value: 240 },
  { date: "25/jun", type: "Compra", who: "Mercado Central", value: -156.7 },
  { date: "24/jun", type: "Investimento", who: "Tesouro Selic", value: -800 },
  { date: "24/jun", type: "Cashback", who: "LifePay Black", value: 12.4 },
  { date: "23/jun", type: "Pix enviado", who: "Ana Lima", value: -80 },
  { date: "22/jun", type: "Salário", who: "Furry's Life Inc.", value: 8240 },
  { date: "21/jun", type: "Compra", who: "Posto Shell", value: -210 },
  { date: "20/jun", type: "Pix recebido", who: "Carla M.", value: 400 },
];

const INVEST_DATA = Array.from({ length: 24 }, (_, i) => {
  const base = 220000 + i * 1400;
  const noise = Math.sin(i * 0.7) * 4000 + Math.cos(i * 1.3) * 2200;
  return { m: `M${i + 1}`, v: Math.round(base + noise) };
});

const INVEST_CARDS = [
  { name: "Renda Fixa", rate: "+12,4% a.a.", value: "R$ 92.300", icon: Coins, tone: "primary" as const },
  { name: "Ações", rate: "+8,1% / 12m", value: "R$ 71.900", icon: LineIcon, tone: "primary" as const },
  { name: "Cripto", rate: "+34,2% / 12m", value: "R$ 41.200", icon: Sparkles, tone: "primary" as const, badge: "simulação" },
  { name: "Fundos", rate: "+6,7% a.a.", value: "R$ 54.600", icon: Briefcase, tone: "primary" as const },
];

const FEATURES_PJ = [
  { title: "Cobranças", desc: "Boletos, link de pagamento e Pix QR.", icon: Receipt },
  { title: "Gestão financeira", desc: "Fluxo de caixa em tempo real.", icon: BarChart3 },
  { title: "Folha de pagamento", desc: "Pagamentos em lote para sua equipe.", icon: Wallet },
  { title: "Controle de despesas", desc: "Cartões corporativos com limites.", icon: CreditCard },
  { title: "Dashboard empresarial", desc: "KPIs do seu negócio num só lugar.", icon: Building2 },
];

const SECURITY = [
  { title: "Login biométrico", desc: "Face ID e impressão digital nativos.", icon: Fingerprint },
  { title: "Criptografia ponta a ponta", desc: "Padrão bancário em todas as conexões.", icon: Lock },
  { title: "Aprovação por dispositivo", desc: "Você aprova toda nova entrada.", icon: Smartphone },
  { title: "Alertas em tempo real", desc: "Notificações de cada transação.", icon: BellRing },
];

const AI_PROMPTS = [
  "Quanto gastei este mês?",
  "Gerar relatório",
  "Criar meta de economia",
  "Como economizar R$ 500/mês?",
];

const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ────────────────────────────────────────────────────────────────────────────
function LifePayLanding() {
  return (
    <div className="lifepay-scope min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: SCOPED_CSS }} />
      <LpNavbar />
      <main className="pt-20">
        <HeroSection />
        <DashboardSection />
        <PixSection />
        <CardsSection />
        <InvestSection />
        <PjSection />
        <SecuritySection />
        <StatementSection />
        <CtaFooter />
      </main>
      <LpFooter />
      <BottomNav />
      <LifeAssistant />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function LpLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2" style={{ fontSize: size * 0.72 }}>
      <span
        aria-hidden
        style={{
          width: size, height: size, borderRadius: 8,
          background: "linear-gradient(135deg, #FFD84D 0%, #B89B2E 100%)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          color: "#0a0a0a", fontWeight: 800, fontSize: size * 0.55,
          boxShadow: "0 6px 22px -8px rgba(255,216,77,0.55)",
        }}
      >L</span>
      <span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
        Life<span style={{ color: "var(--lp-primary)" }}>Pay</span>
      </span>
    </span>
  );
}

function LpNavbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 8);
    f(); window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, []);
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6"
        style={{
          transition: "all .3s ease",
        }}
      >
        <nav
          className="mt-3 flex items-center justify-between rounded-full px-4 py-2.5 lp-glass"
          style={{
            borderColor: scrolled ? "var(--lp-border-strong)" : "var(--lp-border)",
            background: scrolled ? "color-mix(in oklab, var(--lp-bg-2) 70%, transparent)" : undefined,
          }}
        >
          <a href="#inicio" className="flex items-center"><LpLogo /></a>
          <div className="hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => (
              <a key={n.id} href={`#${n.id}`}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium text-white/75 transition-colors hover:bg-white/5 hover:text-white">
                {n.label}
              </a>
            ))}
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/auth" search={{ redirect: "/lifepay/staff" }} className="lp-btn-ghost">Entrar</Link>
            <a href="#dashboard" className="lp-btn-primary">Criar conta <ArrowUpRight className="h-4 w-4" /></a>
          </div>
          <button className="md:hidden rounded-full border border-white/10 p-2 text-white/80" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden" style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            onClick={() => setOpen(false)}
          >
            <motion.aside
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="absolute right-0 top-0 h-full w-[82%] max-w-sm p-6"
              style={{ background: "var(--lp-bg-2)", borderLeft: "1px solid var(--lp-border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <LpLogo />
                <button className="rounded-full border border-white/10 p-2" onClick={() => setOpen(false)} aria-label="Fechar"><X className="h-5 w-5" /></button>
              </div>
              <div className="mt-6 flex flex-col gap-1">
                {NAV.map((n) => (
                  <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-medium text-white/85 hover:bg-white/5">
                    {n.label}
                  </a>
                ))}
                <Link to="/auth" search={{ redirect: "/lifepay/staff" }} className="mt-3 lp-btn-ghost justify-center">Entrar</Link>
                <a href="#dashboard" onClick={() => setOpen(false)} className="mt-2 lp-btn-primary justify-center">Criar conta</a>
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function Disclaimer({ inline = false }: { inline?: boolean }) {
  return (
    <div className={`text-[11px] lp-text-2 ${inline ? "" : "mt-3"}`}>
      LifePay é um projeto fictício da Furry's Life Inc. Não realiza operações financeiras reais.
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -110]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const op = useTransform(scrollYProgress, [0, 0.8], [1, 0.4]);

  return (
    <section id="inicio" ref={ref} className="relative overflow-hidden">
      <div className="lp-grain absolute inset-0 -z-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(255,216,77,0.10), transparent 70%), radial-gradient(40% 30% at 50% 50%, rgba(255,216,77,0.05), transparent 70%)",
        }}
      />
      <div className="relative z-10 mx-auto max-w-7xl px-6 pt-12 pb-12 sm:pt-20 md:pt-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="lp-chip"><span className="lp-live-dot" />Novo · LifePay 2026</span>
          <h1 className="mt-6 font-bold tracking-tight" style={{ fontSize: "clamp(2.2rem, 5.5vw, 4.4rem)", lineHeight: 1.04, letterSpacing: "-0.03em" }}>
            O banco digital que <span style={{ background: "linear-gradient(180deg, #FFD84D 0%, #B89B2E 100%)", WebkitBackgroundClip: "text", color: "transparent" }}>acompanha sua vida</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg lp-text-2">
            Pagamentos, Pix, investimentos e controle financeiro em uma única experiência. Sem tarifas escondidas, sem complicação.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#dashboard" className="lp-btn-primary">Abrir conta <ArrowUpRight className="h-4 w-4" /></a>
            <a href="#cartoes" className="lp-btn-ghost">Explorar <ChevronRight className="h-4 w-4" /></a>
          </div>
        </motion.div>

        {/* Phones */}
        <motion.div style={{ opacity: op }} className="relative mx-auto mt-14 h-[560px] max-w-5xl sm:h-[640px]">
          <motion.div style={{ y: y2 }} className="absolute left-1/2 top-6 -translate-x-1/2 z-20">
            <PhoneMock variant="main" />
          </motion.div>
          <motion.div style={{ y: y1 }} className="absolute left-[12%] top-24 z-10 hidden sm:block" >
            <div style={{ transform: "rotate(-10deg)" }}><PhoneMock variant="card" /></div>
          </motion.div>
          <motion.div style={{ y: y3 }} className="absolute right-[12%] top-24 z-10 hidden sm:block">
            <div style={{ transform: "rotate(10deg)" }}><PhoneMock variant="invest" /></div>
          </motion.div>
        </motion.div>
        <div className="mx-auto max-w-3xl text-center"><Disclaimer /></div>
      </div>
    </section>
  );
}

function PhoneMock({ variant }: { variant: "main" | "card" | "invest" }) {
  return (
    <div
      style={{
        width: 280, height: 560, borderRadius: 44, padding: 10,
        background: "linear-gradient(180deg, #1c1c1c 0%, #0a0a0a 100%)",
        boxShadow: "0 50px 80px -30px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div style={{ width: "100%", height: "100%", borderRadius: 36, background: "var(--lp-bg-2)", overflow: "hidden", position: "relative" }}>
        {/* Notch */}
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 110, height: 26, borderRadius: 999, background: "#000", zIndex: 2 }} />
        <div className="relative h-full p-4 pt-10 text-[12px]">
          {variant === "main" && <PhoneMain />}
          {variant === "card" && <PhoneCard />}
          {variant === "invest" && <PhoneInvest />}
        </div>
      </div>
    </div>
  );
}

function PhoneMain() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between">
        <LpLogo size={20} />
        <Eye className="h-4 w-4 lp-text-2" />
      </div>
      <div className="mt-4 lp-card p-3">
        <div className="lp-text-2 text-[10px] uppercase tracking-wider">Saldo</div>
        <div className="mt-0.5 text-lg font-bold">R$ 16.460,00</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {QUICK.slice(0, 8).map((q) => (
          <div key={q.id} className="lp-card-2 flex flex-col items-center justify-center gap-1 p-2 text-[9px]">
            <q.icon className="h-3.5 w-3.5 lp-primary" />
            <span className="lp-text-2">{q.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 lp-card p-3">
        <div className="text-[10px] lp-text-2 uppercase tracking-wider">Últimos Pix</div>
        {LAST_PIX.slice(0, 3).map((p) => (
          <div key={p.who} className="mt-2 flex items-center justify-between text-[10px]">
            <span>{p.who}</span>
            <span style={{ color: p.kind === "in" ? "var(--lp-success)" : "white" }}>{p.kind === "in" ? "+" : "-"}{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhoneCard() {
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] lp-text-2 uppercase tracking-wider">Meu cartão</div>
      <div className="mt-3"><MiniCard /></div>
      <div className="mt-4 lp-card p-3">
        <div className="text-[10px] lp-text-2">Disponível</div>
        <div className="font-bold">R$ 18.400</div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
          <div className="h-full rounded-full" style={{ width: "73%", background: "var(--lp-primary)" }} />
        </div>
        <div className="mt-1 text-[9px] lp-text-2">de R$ 25.000 limite</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="lp-card-2 p-2 text-center">Bloquear</div>
        <div className="lp-card-2 p-2 text-center">Virtual</div>
        <div className="lp-card-2 p-2 text-center">Apple Pay</div>
        <div className="lp-card-2 p-2 text-center">Google Pay</div>
      </div>
    </div>
  );
}

function PhoneInvest() {
  return (
    <div className="flex h-full flex-col">
      <div className="text-[10px] lp-text-2 uppercase tracking-wider">Investido</div>
      <div className="text-lg font-bold">R$ 260.000</div>
      <div className="mt-1 text-[10px]" style={{ color: "var(--lp-success)" }}>+R$ 4.230 hoje</div>
      <div className="mt-3 h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={INVEST_DATA.slice(-12)}>
            <defs>
              <linearGradient id="lpMini" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFD84D" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#FFD84D" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="#FFD84D" strokeWidth={2} fill="url(#lpMini)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
        <div className="lp-card-2 p-2"><div className="lp-text-2 text-[9px]">Renda fixa</div><div>R$ 92.300</div></div>
        <div className="lp-card-2 p-2"><div className="lp-text-2 text-[9px]">Ações</div><div>R$ 71.900</div></div>
        <div className="lp-card-2 p-2"><div className="lp-text-2 text-[9px]">Cripto</div><div>R$ 41.200</div></div>
        <div className="lp-card-2 p-2"><div className="lp-text-2 text-[9px]">Fundos</div><div>R$ 54.600</div></div>
      </div>
    </div>
  );
}

function MiniCard() {
  return (
    <div
      style={{
        height: 120, borderRadius: 14, padding: 12,
        background: "linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 60%, #1a1a1a 100%)",
        border: "1px solid rgba(255,216,77,0.2)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(120% 80% at 0% 0%, rgba(255,216,77,0.18), transparent 50%)",
      }} />
      <div className="relative flex items-center justify-between text-[10px]">
        <span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>Life<span style={{ color: "#FFD84D" }}>Pay</span> Black</span>
        <span className="lp-text-2">VISA</span>
      </div>
      <div className="relative mt-6 text-[10px] tracking-[0.3em] lp-text-2">•••• •••• •••• 4242</div>
      <div className="relative mt-2 flex items-end justify-between text-[9px] lp-text-2">
        <span>FURRY LIFE</span><span>12/30</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function DashboardSection() {
  const [hide, setHide] = useState(false);
  return (
    <section id="dashboard" className="mx-auto mt-12 max-w-7xl px-6 sm:mt-24">
      <SectionHeader eyebrow="Dashboard" title="Tudo o que você precisa, em um lugar" sub="Experiência inspirada nos melhores bancos digitais — clean, rápida, sem ruído." />

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {/* Saldo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}
          className="lp-card relative overflow-hidden p-6 lg:col-span-2"
        >
          <div className="lp-grain absolute inset-0 -z-0" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="lp-text-2 text-xs uppercase tracking-widest">Saldo disponível</div>
              <button onClick={() => setHide((h) => !h)} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs lp-text-2 hover:bg-white/5">
                {hide ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {hide ? "Mostrar" : "Ocultar"}
              </button>
            </div>
            <div className="mt-2 font-bold tracking-tight" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              {hide ? "R$ ••••••" : "R$ 16.460,00"}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs lp-text-2">
              <span className="lp-success inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> +R$ 320,40 hoje</span>
              <span>·</span><span>Conta corrente 0001-3 · Ag. 0001</span>
            </div>

            <div className="mt-7 grid grid-cols-4 gap-3 sm:grid-cols-8">
              {QUICK.map((q) => (
                <motion.button
                  key={q.id} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                  className="lp-card-2 group flex flex-col items-center justify-center gap-2 rounded-2xl p-3 transition-colors hover:border-[rgba(255,216,77,0.35)]"
                  style={{ aspectRatio: "1/1" }}
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                    style={{ background: "rgba(255,216,77,0.12)", color: "var(--lp-primary)" }}>
                    <q.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-medium text-white/85">{q.label}</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Lateral — minha conta */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.1 }}
          className="lp-card p-6"
        >
          <div className="lp-text-2 text-xs uppercase tracking-widest">Cartão LifePay Black</div>
          <div className="mt-4"><MiniCard /></div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="lp-text-2 text-[10px] uppercase tracking-wider">Disponível</div>
              <div className="font-semibold">R$ 18.400</div>
            </div>
            <div>
              <div className="lp-text-2 text-[10px] uppercase tracking-wider">Fatura atual</div>
              <div className="font-semibold">R$ 6.600</div>
            </div>
          </div>
          <div className="mt-5 h-1.5 w-full rounded-full bg-white/5">
            <motion.div initial={{ width: 0 }} whileInView={{ width: "26%" }} viewport={{ once: true }} transition={{ duration: 0.9, ease: "easeOut" }}
              className="h-full rounded-full" style={{ background: "var(--lp-primary)" }} />
          </div>
          <a href="#cartoes" className="mt-5 inline-flex items-center gap-1.5 text-xs lp-primary hover:opacity-80">
            Ver cartão completo <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <Disclaimer />
        </motion.div>
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-3xl">
      <div className="lp-chip">{eyebrow}</div>
      <h2 className="mt-4 font-bold tracking-tight" style={{ fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)", lineHeight: 1.1, letterSpacing: "-0.02em" }}>{title}</h2>
      {sub && <p className="mt-3 lp-text-2">{sub}</p>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function PixSection() {
  const [key, setKey] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success">("idle");
  const send = () => {
    if (!key.trim()) return;
    setState("loading");
    setTimeout(() => setState("success"), 1100);
    setTimeout(() => { setState("idle"); setKey(""); }, 2900);
  };

  return (
    <section id="pix" className="mx-auto mt-24 max-w-7xl px-6">
      <SectionHeader eyebrow="Pix" title="Pix instantâneo, em segundos" sub="Envie, receba, programe e gere QR Code. Tudo num só lugar." />

      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        {/* Envio */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lp-card p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 lp-primary" />
            <h3 className="font-semibold">Área Pix</h3>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <input className="lp-input" placeholder="Digite CPF, chave ou código Pix Copia e Cola"
              value={key} onChange={(e) => setKey(e.target.value)} disabled={state !== "idle"} />
            <button
              onClick={send}
              disabled={state !== "idle" || !key.trim()}
              className="lp-btn-primary"
              style={{ opacity: state !== "idle" || !key.trim() ? 0.7 : 1, minWidth: 64, justifyContent: "center" }}
              aria-label="Enviar Pix"
            >
              {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "success" ? <Check className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
            </button>
          </div>

          <AnimatePresence>
            {state === "success" && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
                style={{ background: "rgba(32,217,122,0.12)", color: "var(--lp-success)", border: "1px solid rgba(32,217,122,0.25)" }}>
                <Check className="h-3.5 w-3.5" /> Pix enviado com sucesso (simulação)
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 grid grid-cols-3 gap-2 text-xs sm:grid-cols-6">
            {[
              { label: "Enviar", icon: ArrowUpRight }, { label: "Receber", icon: ArrowDownLeft },
              { label: "Copiar chave", icon: Repeat }, { label: "QR Code", icon: QrCode },
              { label: "Programado", icon: Clock }, { label: "Histórico", icon: History },
            ].map((b) => (
              <button key={b.label} className="lp-card-2 flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 hover:border-[rgba(255,216,77,0.35)]">
                <b.icon className="h-4 w-4 lp-primary" /><span>{b.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-6">
            <div className="lp-text-2 text-xs uppercase tracking-widest">Últimos Pix</div>
            <ul className="mt-3 divide-y" style={{ borderColor: "var(--lp-border)" }}>
              {LAST_PIX.map((p) => (
                <li key={p.who} className="flex items-center justify-between py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "var(--lp-card-2)" }}>
                      {p.kind === "in" ? <ArrowDownLeft className="h-4 w-4 lp-success" /> : <ArrowUpRight className="h-4 w-4 lp-primary" />}
                    </div>
                    <div>
                      <div>{p.who}</div>
                      <div className="text-xs lp-text-2">{p.when}</div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold" style={{ color: p.kind === "in" ? "var(--lp-success)" : "white" }}>
                    {p.kind === "in" ? "+" : "-"}{fmt(p.value)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <Disclaimer />
        </motion.div>

        {/* Pix recorrente */}
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="lp-card p-6">
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 lp-primary" />
            <h3 className="font-semibold">Pix recorrente</h3>
          </div>
          <ul className="mt-4 space-y-3">
            {RECORRENTES.map((r) => (
              <li key={r.name} className="lp-card-2 flex items-center justify-between rounded-xl p-3">
                <div>
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-[11px] lp-text-2">{r.desc} · próx. {r.next}</div>
                </div>
                <div className="text-sm font-semibold">{fmt(r.value)}</div>
              </li>
            ))}
          </ul>
          <button className="mt-4 lp-btn-ghost w-full justify-center"><Plus className="h-4 w-4" /> Programar novo Pix</button>
          <Disclaimer />
        </motion.div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function CardsSection() {
  return (
    <section id="cartoes" className="mx-auto mt-24 max-w-7xl px-6">
      <SectionHeader eyebrow="Cartões" title="LifePay Black" sub="Cartão metálico, cashback inteligente e benefícios de viagem." />
      <div className="mt-10 grid items-start gap-8 lg:grid-cols-2">
        <div className="flex justify-center"><BlackCard /></div>
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lp-card p-6">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="lp-text-2 text-xs uppercase tracking-widest">Limite</div>
              <div className="mt-1 text-2xl font-bold">R$ 25.000</div>
            </div>
            <div>
              <div className="lp-text-2 text-xs uppercase tracking-widest">Disponível</div>
              <div className="mt-1 text-2xl font-bold lp-success">R$ 18.400</div>
            </div>
          </div>
          <div className="mt-5 h-2 w-full rounded-full bg-white/5">
            <motion.div initial={{ width: 0 }} whileInView={{ width: "26%" }} viewport={{ once: true }} transition={{ duration: 0.9 }}
              className="h-full rounded-full" style={{ background: "linear-gradient(90deg, #FFD84D, #B89B2E)" }} />
          </div>
          <div className="mt-2 text-[11px] lp-text-2">26% da fatura usado · vence 05/jul</div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              { label: "Bloquear", icon: Lock }, { label: "Virtual", icon: CreditCard },
              { label: "Ajustar limite", icon: BarChart3 }, { label: "Apple Pay", icon: Apple },
              { label: "Google Pay", icon: Smartphone }, { label: "Detalhes", icon: ChevronRight },
            ].map((b) => (
              <button key={b.label} className="lp-card-2 inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs hover:border-[rgba(255,216,77,0.35)]">
                <b.icon className="h-3.5 w-3.5 lp-primary" /> {b.label}
              </button>
            ))}
          </div>
          <Disclaimer />
        </motion.div>
      </div>
    </section>
  );
}

function BlackCard() {
  const mx = useMotionValue(0); const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-50, 50], [10, -10]), { damping: 18, stiffness: 180 });
  const ry = useSpring(useTransform(mx, [-50, 50], [-12, 12]), { damping: 18, stiffness: 180 });
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - r.left - r.width / 2);
    my.set(e.clientY - r.top - r.height / 2);
  };
  const onLeave = () => { mx.set(0); my.set(0); };
  return (
    <motion.div
      onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1200 }}
      className="relative"
    >
      <div
        style={{
          width: 380, maxWidth: "100%", aspectRatio: "1.586 / 1", borderRadius: 22, padding: 22,
          background: "linear-gradient(135deg, #1a1a1a 0%, #050505 55%, #1a1a1a 100%)",
          border: "1px solid rgba(255,216,77,0.25)",
          boxShadow: "0 40px 80px -30px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.08)",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(120% 80% at 0% 0%, rgba(255,216,77,0.22), transparent 55%), radial-gradient(120% 80% at 100% 100%, rgba(255,216,77,0.06), transparent 55%)",
        }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)" }} />
        <div className="relative flex items-start justify-between">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>Life<span style={{ color: "var(--lp-primary)" }}>Pay</span> Black</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.25em] lp-text-2">Metal · Infinite</div>
          </div>
          <div className="text-right text-[10px] lp-text-2">VISA<br /><span style={{ fontWeight: 700, color: "var(--lp-primary)" }}>•••</span></div>
        </div>
        <div className="relative mt-12 text-base tracking-[0.32em] text-white/90">•••• •••• •••• 4242</div>
        <div className="relative mt-3 flex items-end justify-between text-[11px] lp-text-2">
          <div>
            <div className="uppercase tracking-wider">Titular</div>
            <div className="text-white">Furry Life</div>
          </div>
          <div>
            <div className="uppercase tracking-wider">Validade</div>
            <div className="text-white">12/30</div>
          </div>
          <div>
            <div className="uppercase tracking-wider">CVV</div>
            <div className="text-white">•••</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function InvestSection() {
  return (
    <section id="investimentos" className="mx-auto mt-24 max-w-7xl px-6">
      <SectionHeader eyebrow="Investimentos" title="Faça seu dinheiro trabalhar" sub="Renda fixa, ações, fundos e cripto simulado num só painel." />
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lp-card p-6 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="lp-text-2 text-xs uppercase tracking-widest">Saldo investido</div>
              <div className="mt-1 text-3xl font-bold">R$ 260.000</div>
              <div className="text-xs lp-success mt-1">+R$ 4.230 hoje · +18,4% em 12 meses</div>
            </div>
            <button className="lp-btn-primary"><TrendingUp className="h-4 w-4" /> Investir</button>
          </div>
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INVEST_DATA}>
                <defs>
                  <linearGradient id="lpArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFD84D" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FFD84D" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" hide />
                <YAxis hide domain={["dataMin - 4000", "dataMax + 4000"]} />
                <RTooltip
                  cursor={{ stroke: "rgba(255,216,77,0.25)" }}
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, color: "white", fontSize: 12 }}
                  formatter={(v: number) => [fmt(v), "Saldo"]}
                />
                <Area type="monotone" dataKey="v" stroke="#FFD84D" strokeWidth={2.5} fill="url(#lpArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <Disclaimer />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="space-y-3">
          {INVEST_CARDS.map((c) => (
            <div key={c.name} className="lp-card flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "rgba(255,216,77,0.10)", color: "var(--lp-primary)" }}>
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium flex items-center gap-2">{c.name}{c.badge && <span className="text-[9px] uppercase tracking-wider lp-text-2 border border-white/10 rounded-full px-1.5 py-0.5">{c.badge}</span>}</div>
                  <div className="text-[11px] lp-text-2">{c.rate}</div>
                </div>
              </div>
              <div className="text-sm font-semibold">{c.value}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function PjSection() {
  return (
    <section id="empresas" className="mx-auto mt-24 max-w-7xl px-6">
      <div className="lp-card relative overflow-hidden p-8 sm:p-12">
        <div className="lp-grain absolute inset-0" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="lp-chip">LifePay Empresas</span>
            <h2 className="mt-4 font-bold tracking-tight" style={{ fontSize: "clamp(1.6rem, 3vw, 2.4rem)", letterSpacing: "-0.02em" }}>
              A conta PJ que <span style={{ color: "var(--lp-primary)" }}>cresce com seu negócio</span>.
            </h2>
            <p className="mt-3 lp-text-2 max-w-lg">Cobranças, gestão financeira, folha de pagamento e dashboard estratégico — tudo integrado.</p>
            <div className="mt-6"><a href="#" className="lp-btn-primary">Abrir conta PJ <ArrowUpRight className="h-4 w-4" /></a></div>
            <Disclaimer />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FEATURES_PJ.map((f) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="lp-card-2 flex items-start gap-3 rounded-2xl p-4">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(255,216,77,0.10)", color: "var(--lp-primary)" }}>
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-xs lp-text-2 mt-0.5">{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function SecuritySection() {
  return (
    <section id="seguranca" className="mx-auto mt-24 max-w-7xl px-6">
      <SectionHeader eyebrow="Segurança" title="Padrão bancário, na palma da mão" sub="Protegemos cada centavo e cada toque." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECURITY.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ delay: i * 0.05 }}
            className="lp-card p-6">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(255,216,77,0.10)", color: "var(--lp-primary)" }}>
              <s.icon className="h-5 w-5" />
            </div>
            <div className="mt-4 font-semibold">{s.title}</div>
            <div className="mt-1 text-sm lp-text-2">{s.desc}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function StatementSection() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "in" | "out" | "invest">("all");
  const rows = useMemo(() => STATEMENT.filter((r) => {
    const matchesQ = !q || (r.who + r.type).toLowerCase().includes(q.toLowerCase());
    const matchesF = filter === "all"
      || (filter === "in" && r.value > 0)
      || (filter === "out" && r.value < 0 && !r.type.toLowerCase().includes("invest"))
      || (filter === "invest" && r.type.toLowerCase().includes("invest"));
    return matchesQ && matchesF;
  }), [q, filter]);

  return (
    <section id="sobre" className="mx-auto mt-24 max-w-7xl px-6">
      <SectionHeader eyebrow="Extrato" title="Cada movimento, com clareza" sub="Filtre, busque e acompanhe sua vida financeira em tempo real." />

      <div className="mt-10 lp-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-4" style={{ borderColor: "var(--lp-border)" }}>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 lp-text-2" />
            <input className="lp-input pl-9" placeholder="Buscar por descrição..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {([
              ["all", "Todos"], ["in", "Entradas"], ["out", "Saídas"], ["invest", "Investimentos"],
            ] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                style={{
                  background: filter === k ? "rgba(255,216,77,0.15)" : "transparent",
                  color: filter === k ? "var(--lp-primary)" : "var(--lp-text-2)",
                  border: `1px solid ${filter === k ? "rgba(255,216,77,0.35)" : "var(--lp-border)"}`,
                }}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr_auto] gap-3 px-4 py-3 text-[11px] uppercase tracking-widest lp-text-2 border-b" style={{ borderColor: "var(--lp-border)" }}>
          <div>Data</div><div>Descrição</div><div className="text-right">Valor</div>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm lp-text-2">Nada por aqui ainda.</div>
        ) : (
          <ul>
            {rows.map((r, i) => (
              <li key={i} className="grid grid-cols-[80px_1fr_auto] items-center gap-3 px-4 py-3.5 text-sm transition-colors hover:bg-white/[0.02]"
                  style={{ borderTop: i === 0 ? "none" : "1px solid var(--lp-border)" }}>
                <div className="lp-text-2 text-xs">{r.date}</div>
                <div>
                  <div className="font-medium">{r.who}</div>
                  <div className="text-[11px] lp-text-2">{r.type}</div>
                </div>
                <div className="text-right font-semibold" style={{ color: r.value > 0 ? "var(--lp-success)" : "var(--lp-text)" }}>
                  {r.value > 0 ? "+" : ""}{fmt(r.value)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Disclaimer />
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function CtaFooter() {
  return (
    <section className="mx-auto mt-24 max-w-7xl px-6">
      <div className="lp-card relative overflow-hidden p-10 text-center sm:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(70% 60% at 50% 0%, rgba(255,216,77,0.18), transparent 70%)" }} />
        <h2 className="relative font-bold tracking-tight" style={{ fontSize: "clamp(1.8rem, 3.4vw, 3rem)", letterSpacing: "-0.02em" }}>
          Sua vida financeira merece <span style={{ color: "var(--lp-primary)" }}>uma experiência premium</span>.
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl lp-text-2">Abra sua conta LifePay em menos de 3 minutos. Sem tarifas escondidas.</p>
        <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
          <a href="#dashboard" className="lp-btn-primary">Abrir conta agora <ArrowUpRight className="h-4 w-4" /></a>
          <Link to="/auth" search={{ redirect: "/lifepay/staff" }} className="lp-btn-ghost">Acesso staff</Link>
        </div>
        <div className="relative mt-4"><Disclaimer inline /></div>
      </div>
    </section>
  );
}

function LpFooter() {
  return (
    <footer className="mt-24 border-t" style={{ borderColor: "var(--lp-border)" }}>
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <LpLogo />
          <p className="mt-3 max-w-xs text-xs lp-text-2">
            LifePay é uma subsidiária fictícia da Furry's Life Inc. Nenhuma operação financeira real é processada.
          </p>
        </div>
        <FooterCol title="Produto" items={["Início", "Cartões", "Pix", "Investimentos"]} />
        <FooterCol title="Empresa" items={["Sobre", "Carreiras", "Imprensa", "Contato"]} />
        <FooterCol title="Legal" items={["Termos", "Privacidade", "Segurança", "Compliance"]} />
      </div>
      <div className="border-t px-6 py-5 text-center text-[11px] lp-text-2" style={{ borderColor: "var(--lp-border)" }}>
        © {new Date().getFullYear()} Furry's Life Inc. · LifePay é um projeto fictício sem operações financeiras reais.
        <div className="mt-1"><Link to="/" className="hover:text-white">← Voltar ao site da holding</Link></div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-widest lp-text-2">{title}</div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((i) => <li key={i}><a href="#" className="text-white/85 hover:text-white">{i}</a></li>)}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[92%] max-w-md items-center justify-around rounded-full px-3 py-2 lp-glass md:hidden"
      style={{ borderColor: "var(--lp-border-strong)" }}>
      {[
        { id: "inicio", label: "Início", icon: ArrowUpRight },
        { id: "pix", label: "Pix", icon: Send },
        { id: "cartoes", label: "Cartões", icon: CreditCard },
        { id: "investimentos", label: "Invest", icon: TrendingUp },
        { id: "sobre", label: "Extrato", icon: History },
      ].map((b) => (
        <a key={b.id} href={`#${b.id}`} className="flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] text-white/80">
          <b.icon className="h-4 w-4" />{b.label}
        </a>
      ))}
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function LifeAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Oi! Eu sou a Life Assistant ✨. Posso te ajudar a entender seus gastos, criar metas e encontrar formas de economizar. Tudo simulado, claro!" },
  ]);
  const [typing, setTyping] = useState(false);

  const ask = (q: string) => {
    setMessages((m) => [...m, { role: "user", text: q }]);
    setTyping(true);
    const ans = canned(q);
    setTimeout(() => { setMessages((m) => [...m, { role: "ai", text: ans }]); setTyping(false); }, 900);
  };

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-20 right-4 z-50 inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold md:bottom-6"
        style={{
          background: "linear-gradient(135deg, #FFD84D 0%, #B89B2E 100%)", color: "#0a0a0a",
          boxShadow: "0 14px 40px -10px rgba(255,216,77,0.55), 0 0 0 1px rgba(255,255,255,0.05)",
        }}
        aria-label="Life Assistant"
      >
        <Sparkles className="h-4 w-4" /> Life Assistant
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}
            className="lifepay-scope fixed bottom-36 right-4 z-50 w-[92vw] max-w-sm overflow-hidden rounded-3xl md:bottom-24"
            style={{ background: "var(--lp-bg-2)", border: "1px solid var(--lp-border-strong)", boxShadow: "0 30px 70px -20px rgba(0,0,0,0.7)" }}
          >
            <div className="flex items-center justify-between border-b p-4" style={{ borderColor: "var(--lp-border)" }}>
              <div className="flex items-center gap-2">
                <div className="inline-flex h-8 w-8 items-center justify-center rounded-full" style={{ background: "rgba(255,216,77,0.15)", color: "var(--lp-primary)" }}>
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Life Assistant</div>
                  <div className="text-[10px] lp-text-2"><span className="lp-live-dot" />online · resposta simulada</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full border border-white/10 p-1.5"><X className="h-4 w-4" /></button>
            </div>
            <div className="max-h-[50vh] space-y-2.5 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm"
                    style={m.role === "user"
                      ? { background: "var(--lp-primary)", color: "#0a0a0a" }
                      : { background: "var(--lp-card)", border: "1px solid var(--lp-border)" }}>
                    {m.text}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start"><div className="rounded-2xl px-3.5 py-2 text-sm" style={{ background: "var(--lp-card)" }}>
                  <span className="inline-flex gap-1">
                    <Dot delay={0} /><Dot delay={0.15} /><Dot delay={0.3} />
                  </span>
                </div></div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 border-t p-3" style={{ borderColor: "var(--lp-border)" }}>
              {AI_PROMPTS.map((p) => (
                <button key={p} onClick={() => ask(p)} className="rounded-full border px-3 py-1.5 text-[11px] text-white/85 hover:bg-white/5" style={{ borderColor: "var(--lp-border-strong)" }}>{p}</button>
              ))}
            </div>
            <div className="border-t px-4 py-2 text-[10px] lp-text-2" style={{ borderColor: "var(--lp-border)" }}>
              Respostas simuladas. Sem operação financeira real.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Dot({ delay }: { delay: number }) {
  return <motion.span className="inline-block h-1.5 w-1.5 rounded-full"
    style={{ background: "var(--lp-text-2)" }}
    animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
    transition={{ duration: 0.9, repeat: Infinity, delay }} />;
}

function canned(q: string): string {
  const s = q.toLowerCase();
  if (s.includes("gastei") || s.includes("mês")) return "Este mês você gastou R$ 4.230 — 28% em mercado, 19% em transporte e 14% em assinaturas. Seu padrão está 8% abaixo do mês passado. 👏";
  if (s.includes("relatório")) return "Pronto. Gerei um relatório com fluxo de caixa, top categorias e projeção para 30 dias. Quer que eu envie no seu email cadastrado?";
  if (s.includes("meta")) return "Boa! Sugestão: meta de R$ 1.500/mês com aporte automático toda sexta. Posso criar agora?";
  if (s.includes("econom")) return "Se cancelar 2 assinaturas pouco usadas e ajustar o limite do cartão Black, sobram ~R$ 480/mês para investir em Renda Fixa.";
  return "Boa pergunta — esse é um ambiente simulado, mas posso te mostrar como o LifePay responderia a partir do seu padrão financeiro.";
}
