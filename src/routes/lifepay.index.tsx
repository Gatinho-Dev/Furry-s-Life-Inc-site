import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, ShieldCheck, Zap, KeyRound, CreditCard, PieChart, Receipt,
  Layers, Headphones, Lock, Smartphone, ChevronDown, Check,
} from "lucide-react";
import { LifePayTheme, LifePayMark, DISCLOSURE } from "@/components/lifepay/ui";

export const Route = createFileRoute("/lifepay/")({
  head: () => ({
    meta: [
      { title: "LifePay — Plataforma financeira interna da Furry's Life Inc." },
      { name: "description", content: "LifePay é a plataforma financeira interna da Furry's Life Inc.: transferências entre usuários, chaves LifePay, cartão virtual, faturas e controle de gastos em um só lugar." },
      { property: "og:title", content: "LifePay — sua conta financeira da Furry's Life Inc." },
      { property: "og:description", content: "Transferências instantâneas, chaves LifePay, cartão virtual, parcelamento, faturas e extrato completo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0A0B0D" },
    ],
  }),
  component: LifePayPublic,
});

const BENEFITS = [
  { icon: Zap, title: "Transferências rápidas", text: "Envie e receba valores entre usuários LifePay em segundos, com comprovante na hora." },
  { icon: KeyRound, title: "Chaves LifePay", text: "Use seu e-mail como chave ou gere chaves aleatórias para receber sem expor seus dados." },
  { icon: CreditCard, title: "Cartão virtual", text: "Cartão para compras internas do ecossistema, com limite, fatura e bloqueio imediato." },
  { icon: PieChart, title: "Controle financeiro", text: "Saldo, limite disponível e histórico organizados por categoria e período." },
  { icon: ShieldCheck, title: "Segurança", text: "Confirmação por senha, PIN ou biometria do seu dispositivo em toda operação sensível." },
  { icon: Layers, title: "Parcelamento", text: "Divida compras internas em até 12 vezes e acompanhe cada parcela na fatura certa." },
  { icon: Receipt, title: "Histórico completo", text: "Extrato filtrável com saldo anterior, saldo posterior e comprovante de cada movimentação." },
  { icon: Smartphone, title: "Fácil de usar", text: "Interface pensada para o celular, funcionando igualmente bem no computador." },
  { icon: Headphones, title: "Atendimento", text: "Suporte interno pelo canal da Furry's Life Inc., com histórico de acessos à vista." },
];

const FAQ = [
  { q: "Quem pode ter uma conta LifePay?", a: "As contas são criadas exclusivamente por administradores autorizados no painel staff da Furry's Life Inc. Não há cadastro público." },
  { q: "Como funciona a transferência?", a: "Você informa o e-mail ou a chave aleatória do destinatário, revisa o resumo da operação e confirma com senha, PIN ou biometria. O comprovante é gerado imediatamente." },
  { q: "O que é uma chave LifePay?", a: "É o identificador usado para receber valores. Sua conta já nasce com a chave de e-mail e você pode gerar chaves aleatórias adicionais." },
  { q: "O cartão LifePay serve para quê?", a: "Para compras internas do ecossistema, com limite próprio, parcelamento e fatura mensal paga com o saldo da conta." },
  { q: "Preciso usar reconhecimento facial?", a: "Não. A biometria é opcional: a senha continua funcionando como forma principal de confirmação." },
  { q: "Meus dados ficam visíveis para outros usuários?", a: "Não. Cada conta enxerga apenas o próprio saldo, chaves e movimentações. Destinatários veem somente o nome de exibição." },
];

function LifePayPublic() {
  return (
    <LifePayTheme>
      <header className="sticky top-0 z-30 border-b lp-divide" style={{ background: "rgba(10,11,13,.82)", backdropFilter: "blur(14px)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <LifePayMark />
          <nav className="hidden items-center gap-6 text-sm lp-muted md:flex">
            <a href="#beneficios" className="hover:text-white">Benefícios</a>
            <a href="#cartao" className="hover:text-white">Cartão</a>
            <a href="#seguranca" className="hover:text-white">Segurança</a>
            <a href="#faq" className="hover:text-white">Dúvidas</a>
          </nav>
          <Link to="/lifepay/entrar" className="lp-btn lp-btn-primary">Entrar na sua conta</Link>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="lp-grid-bg border-b lp-divide">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
            <div className="lp-fade">
              <span className="lp-chip lp-chip-ok">Ecossistema Furry's Life Inc.</span>
              <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight md:text-6xl">
                Sua vida financeira interna, <span className="lp-accent">organizada</span>.
              </h1>
              <p className="mt-5 max-w-lg text-base lp-muted">
                O LifePay reúne saldo, transferências entre usuários, chaves, cartão virtual, faturas e extrato
                em uma única conta — simples de usar e segura em cada operação.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/lifepay/entrar" className="lp-btn lp-btn-primary px-6 py-3">
                  Entrar na sua conta <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#beneficios" className="lp-btn lp-btn-ghost px-6 py-3">Conheça o LifePay</a>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-xs lp-muted">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Contas criadas pelo painel staff</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> Confirmação por senha, PIN ou biometria</span>
              </div>
            </div>
            <PhoneMock />
          </div>
        </section>

        {/* BENEFÍCIOS */}
        <section id="beneficios" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Tudo o que a sua conta faz</h2>
          <p className="mt-3 max-w-2xl text-sm lp-muted">
            Recursos pensados para o dia a dia dentro da Furry's Life Inc., sem burocracia e sem etapas desnecessárias.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="lp-card p-6">
                <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: "rgba(47,227,194,.12)" }}>
                  <b.icon className="h-5 w-5 lp-accent" />
                </div>
                <div className="mt-4 font-semibold">{b.title}</div>
                <p className="mt-1.5 text-sm lp-muted">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CARTÃO */}
        <section id="cartao" className="border-y lp-divide" style={{ background: "var(--lp-bg-2)" }}>
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:py-20">
            <CardMock />
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Cartão LifePay virtual</h2>
              <p className="mt-3 text-sm lp-muted">
                Um cartão para as compras internas do ecossistema, com limite próprio, fatura mensal e controle total nas suas mãos.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Limite total, limite disponível e valor utilizado sempre visíveis",
                  "Compras à vista ou parceladas em até 12 vezes",
                  "Fatura com fechamento e vencimento definidos na sua conta",
                  "Dados completos exibidos só após confirmação de identidade",
                  "Bloqueio e desbloqueio imediatos",
                ].map((t) => (
                  <li key={t} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 lp-accent" /><span className="lp-muted">{t}</span></li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* SEGURANÇA */}
        <section id="seguranca" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="grid gap-10 md:grid-cols-[1fr_1.2fr]">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Segurança em cada etapa</h2>
              <p className="mt-3 text-sm lp-muted">
                Toda operação é validada no servidor. A interface nunca decide sozinha se uma transferência pode acontecer.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { icon: Lock, t: "Confirmação obrigatória", d: "Senha, PIN ou biometria antes de transferir, pagar fatura ou ver o cartão." },
                { icon: ShieldCheck, t: "Conta isolada", d: "Cada usuário acessa apenas os próprios dados — sem exceções por URL ou requisição." },
                { icon: Receipt, t: "Operações atômicas", d: "Ou tudo é registrado corretamente, ou nada é alterado. Sem cobrança duplicada." },
                { icon: KeyRound, t: "Chaves sob controle", d: "Desative ou remova uma chave e ela para de funcionar imediatamente." },
              ].map((i) => (
                <div key={i.t} className="lp-card-2 p-5">
                  <i.icon className="h-5 w-5 lp-accent" />
                  <div className="mt-3 text-sm font-semibold">{i.t}</div>
                  <p className="mt-1 text-xs lp-muted">{i.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t lp-divide">
          <div className="mx-auto max-w-3xl px-5 py-16 md:py-20">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Perguntas frequentes</h2>
            <div className="mt-8 space-y-3">
              {FAQ.map((f) => <FaqItem key={f.q} {...f} />)}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t lp-divide lp-grid-bg">
          <div className="mx-auto max-w-3xl px-5 py-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Pronto para entrar?</h2>
            <p className="mt-3 text-sm lp-muted">Use o e-mail e a senha definidos pelo administrador da sua conta.</p>
            <Link to="/lifepay/entrar" className="lp-btn lp-btn-primary mt-6 px-7 py-3">Entrar na sua conta</Link>
          </div>
        </section>
      </main>

      <footer className="border-t lp-divide" style={{ background: "var(--lp-bg-2)" }}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-start md:justify-between">
          <div>
            <LifePayMark />
            <p className="mt-3 max-w-md text-xs lp-muted">{DISCLOSURE}</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider lp-muted">LifePay</div>
              <Link to="/lifepay/sobre" className="block lp-muted hover:text-white">Sobre o LifePay</Link>
              <Link to="/lifepay/entrar" className="block lp-muted hover:text-white">Entrar</Link>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider lp-muted">Legal</div>
              <Link to="/lifepay/termos" className="block lp-muted hover:text-white">Termos de uso</Link>
              <Link to="/lifepay/privacidade" className="block lp-muted hover:text-white">Política de privacidade</Link>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider lp-muted">Empresa</div>
              <Link to="/" className="block lp-muted hover:text-white">Furry's Life Inc.</Link>
            </div>
          </div>
        </div>
        <div className="border-t px-5 py-5 text-center text-[11px] lp-divide lp-muted">
          © {new Date().getFullYear()} Furry's Life Inc. — LifePay
        </div>
      </footer>
    </LifePayTheme>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lp-card overflow-hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium">
        {q}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-5 text-sm lp-muted">{a}</div>}
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="lp-fade mx-auto w-full max-w-[300px]">
      <div className="rounded-[38px] border p-3" style={{ borderColor: "var(--lp-line-2)", background: "var(--lp-bg-2)" }}>
        <div className="overflow-hidden rounded-[28px]" style={{ background: "var(--lp-surface)" }}>
          <div className="px-5 pb-4 pt-6">
            <div className="text-xs lp-muted">Olá, Alex</div>
            <div className="mt-1 text-[11px] uppercase tracking-wider lp-muted">Saldo disponível</div>
            <div className="text-2xl font-black">R$ 4.820,50</div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-[10px]">
              {["Transferir", "Receber", "Cartão", "Fatura"].map((t) => (
                <div key={t} className="rounded-xl px-1 py-2 text-center" style={{ background: "var(--lp-surface-2)" }}>{t}</div>
              ))}
            </div>
          </div>
          <div className="space-y-2 px-5 pb-6">
            {[["Transferência enviada", "-R$ 120,00"], ["Transferência recebida", "+R$ 340,90"], ["Compra parcelada", "-R$ 89,90"]].map(([a, b]) => (
              <div key={a} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[11px]" style={{ background: "var(--lp-surface-2)" }}>
                <span className="lp-muted">{a}</span><span className="font-semibold">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardMock() {
  return (
    <div className="lp-fade mx-auto w-full max-w-sm">
      <div className="aspect-[1.586] rounded-3xl p-6"
        style={{ background: "linear-gradient(140deg,#1D2229 0%,#0D0F12 60%,#123B33 100%)", border: "1px solid var(--lp-line-2)", boxShadow: "0 30px 60px -35px rgba(47,227,194,.5)" }}>
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <LifePayMark size={24} />
            <span className="text-[10px] uppercase tracking-widest lp-muted">Virtual</span>
          </div>
          <div>
            <div className="font-mono text-lg tracking-[0.18em]">•••• •••• •••• 4192</div>
            <div className="mt-3 flex items-end justify-between text-[11px] lp-muted">
              <span>TITULAR LIFEPAY</span><span>••/••</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
