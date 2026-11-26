import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Ambulance, ArrowRight, Baby, BedDouble, Brain, CalendarClock, ChevronRight, ClipboardList,
  FileText, FlaskConical, HeartPulse, MapPin, Microscope, Phone, Pill, ShieldCheck, Stethoscope, Users,
} from "lucide-react";

export const Route = createFileRoute("/lifeplus/")({
  head: () => ({
    meta: [
      { title: "Life+ · Hospital e saúde da Furry's Life" },
      { name: "description", content: "Life+: pronto-socorro 24h, especialidades médicas, exames, UTI e um sistema hospitalar completo no universo de roleplay da Furry's Life Inc." },
      { property: "og:title", content: "Life+ · Hospital e saúde" },
      { property: "og:description", content: "Pronto-socorro 24h, especialidades, exames, UTI e sistema hospitalar de roleplay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&display=swap" },
    ],
  }),
  component: LifePlusHome,
});

const SPECIALTIES = [
  { icon: Ambulance, name: "Pronto-socorro 24h", d: "Atendimento de urgência com triagem por classificação de risco." },
  { icon: HeartPulse, name: "Cardiologia", d: "ECG, ecocardiograma, holter e acompanhamento contínuo." },
  { icon: Brain, name: "Neurologia", d: "Investigação e acompanhamento de doenças do sistema nervoso." },
  { icon: Stethoscope, name: "Clínica médica", d: "Avaliação integral, diagnósticos e acompanhamento ambulatorial." },
  { icon: Baby, name: "Pediatria", d: "Cuidado do recém-nascido ao adolescente, com acolhimento." },
  { icon: Microscope, name: "Laboratório e imagem", d: "Análises clínicas, raio-X, tomografia e ressonância." },
];

const STRUCTURE = [
  { icon: BedDouble, title: "Leitos e UTI", text: "Enfermaria, emergência e quatro leitos de terapia intensiva, com mapa de ocupação em tempo real para a equipe." },
  { icon: FlaskConical, title: "Exames e laudos", text: "Solicitação, execução e laudo digital, com anexos de imagens e PDFs no prontuário do paciente." },
  { icon: ClipboardList, title: "Prontuário eletrônico", text: "Histórico clínico completo: anamnese, evoluções, diagnósticos, prescrições e documentos institucionais." },
];

const TEAM_FEATURES = [
  { icon: Users, label: "Pacientes e prontuários", to: "/lifeplus/staff" },
  { icon: CalendarClock, label: "Agenda e fila de atendimento", to: "/lifeplus/staff" },
  { icon: FileText, label: "Documentos, atestados e receitas", to: "/lifeplus/staff" },
  { icon: Pill, label: "Farmácia e estoque", to: "/lifeplus/staff" },
  { icon: BedDouble, label: "Internações e mapa de leitos", to: "/lifeplus/staff" },
  { icon: ShieldCheck, label: "Permissões e auditoria", to: "/lifeplus/staff" },
];

function LifePlusHome() {
  return (
    <div className="hms min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--h-line)] bg-[color-mix(in_srgb,var(--h-panel)_86%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <Link to="/lifeplus" className="flex items-center gap-2.5">
            <span className="hms-brand-mark !h-9 !w-9 !rounded-[11px]"><HeartPulse className="h-5 w-5" /></span>
            <span className="leading-tight">
              <span className="block text-[15px] font-bold tracking-[-0.02em]">Life+</span>
              <span className="block text-[9px] uppercase tracking-[0.18em] text-[var(--h-faint)]">Hospital · Furry&apos;s Life</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[12.5px] text-[var(--h-muted)] md:flex">
            <a href="#estrutura" className="hover:text-[var(--h-fg)]">Estrutura</a>
            <a href="#especialidades" className="hover:text-[var(--h-fg)]">Especialidades</a>
            <a href="#equipe" className="hover:text-[var(--h-fg)]">Equipe</a>
            <a href="#contato" className="hover:text-[var(--h-fg)]">Contato</a>
          </nav>
          <Link to="/lifeplus/staff" className="hms-btn">Área da equipe <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-24">
        <div>
          <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--h-brand)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--h-brand)]" />
            Hospital Life+ · rede Furry&apos;s Life
          </div>
          <h1 className="mt-4 font-[var(--h-serif)] text-[44px] leading-[1.03] tracking-[-0.03em] text-[var(--h-fg)] sm:text-[58px]">
            Medicina com padrão de hospital de verdade.
          </h1>
          <p className="mt-5 max-w-[52ch] text-[15px] leading-relaxed text-[var(--h-muted)]">
            Pronto-socorro 24 horas, especialidades, UTI, exames e um sistema de gestão hospitalar completo — construído
            para o universo de roleplay da Furry&apos;s Life Inc.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-2.5">
            <a href="#especialidades" className="hms-btn">Conhecer especialidades <ArrowRight className="h-3.5 w-3.5" /></a>
            <Link to="/lifeplus/staff" className="hms-btn ghost">Portal da equipe <ChevronRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-[var(--h-line)] pt-5">
            {[["24h", "Pronto-socorro"], ["18", "Leitos"], ["4", "Leitos de UTI"]].map(([n, l]) => (
              <div key={l}>
                <div className="font-[var(--h-serif)] text-[28px] leading-none tracking-[-0.02em]">{n}</div>
                <div className="mt-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--h-faint)]">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="hms-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--h-line)] px-5 py-3.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--h-muted)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--h-ok)]" />Central de atendimento
              </div>
              <span className="hms-chip ok">aberto 24h</span>
            </div>
            <div className="bg-[var(--h-petrol)] px-5 pb-2 pt-5 text-white">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Sinais vitais · monitor</div>
              <svg className="mt-2 h-20 w-full" viewBox="0 0 340 80" preserveAspectRatio="none" aria-hidden>
                <path d="M0 52 H60 l4 -4 3 8 5 -26 5 38 6 -16 H160 l5 0 5 -12 4 18 5 -6 H250 l5 0 5 -14 4 20 5 -6 H340" fill="none" stroke="#5aa0ff" strokeWidth="2" strokeLinecap="round" />
                <path d="M0 52 H60 l4 -4 3 8 5 -26 5 38 6 -16 H160 l5 0 5 -12 4 18 5 -6 H250 l5 0 5 -14 4 20 5 -6 H340" fill="none" stroke="#5aa0ff" strokeWidth="8" strokeLinecap="round" opacity="0.14" />
              </svg>
              <div className="mt-1 flex items-end justify-between pb-3">
                <div><div className="text-[9px] uppercase tracking-[0.14em] text-white/40">Frequência</div><div className="text-xl font-semibold">78 <span className="text-[11px] font-normal text-white/50">bpm</span></div></div>
                <div><div className="text-[9px] uppercase tracking-[0.14em] text-white/40">Saturação</div><div className="text-xl font-semibold">98 <span className="text-[11px] font-normal text-white/50">%</span></div></div>
                <div><div className="text-[9px] uppercase tracking-[0.14em] text-white/40">Pressão</div><div className="text-xl font-semibold">120/80</div></div>
              </div>
            </div>
            <div className="divide-y divide-[var(--h-line)]">
              {[
                { t: "Pronto-socorro", s: "Triagem por risco", v: "24h" },
                { t: "UTI adulto", s: "4 leitos monitorados", v: "4" },
                { t: "Laboratório", s: "Coleta e laudo digital", v: "12" },
              ].map((r) => (
                <div key={r.t} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1"><div className="text-[12.5px] font-semibold">{r.t}</div><div className="text-[11px] text-[var(--h-muted)]">{r.s}</div></div>
                  <div className="font-[var(--h-serif)] text-[18px] text-[var(--h-brand-ink)]">{r.v}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-4 -left-4 hidden rounded-xl border border-[var(--h-line)] bg-[var(--h-panel)] px-3.5 py-2.5 shadow-[var(--h-shadow)] sm:block">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--h-muted)]"><ShieldCheck className="h-3.5 w-3.5 text-[var(--h-ok)]" />Dados fictícios de roleplay</div>
          </div>
        </div>
      </section>

      <section id="estrutura" className="border-y border-[var(--h-line)] bg-[var(--h-panel)]">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-2xl">
            <div className="hms-eyebrow">Estrutura assistencial</div>
            <h2 className="font-[var(--h-serif)] text-[32px] leading-tight tracking-[-0.025em] sm:text-[38px]">Um hospital inteiro, do primeiro contato à alta.</h2>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--h-muted)]">Cada etapa do cuidado tem um módulo próprio — a mesma informação acompanha o paciente do acolhimento ao documento final.</p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STRUCTURE.map((s) => (
              <div key={s.title} className="hms-card p-6">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--h-brand-soft)] text-[var(--h-brand)]"><s.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em]">{s.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--h-muted)]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="especialidades" className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="hms-eyebrow">Especialidades</div>
            <h2 className="font-[var(--h-serif)] text-[32px] leading-tight tracking-[-0.025em] sm:text-[38px]">Cuidado para cada história.</h2>
          </div>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-[var(--h-muted)]">Atendimento ambulatorial e de urgência com equipe multidisciplinar fictícia do universo Life+ RP.</p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SPECIALTIES.map((s) => (
            <div key={s.name} className="group hms-card p-5 transition hover:-translate-y-0.5 hover:border-[var(--h-line-strong)]">
              <div className="flex items-start justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--h-soft)] text-[var(--h-muted)] transition group-hover:bg-[var(--h-brand-soft)] group-hover:text-[var(--h-brand)]"><s.icon className="h-4 w-4" /></span>
                <ChevronRight className="h-4 w-4 text-[var(--h-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--h-brand)]" />
              </div>
              <div className="mt-3.5 text-[13.5px] font-semibold">{s.name}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--h-muted)]">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="equipe" className="bg-[var(--h-petrol)] text-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1fr_1.1fr] md:items-center">
          <div>
            <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-white/45">Portal da equipe</div>
            <h2 className="mt-3 font-[var(--h-serif)] text-[32px] leading-tight tracking-[-0.025em] sm:text-[38px]">O sistema hospitalar da Life+, em um só lugar.</h2>
            <p className="mt-3 max-w-[46ch] text-[13px] leading-relaxed text-white/60">
              Acesso restrito à equipe autorizada. Pacientes, prontuários, agenda, documentos com PDF, leitos, farmácia,
              relatórios e auditoria — com permissões por cargo.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Link to="/lifeplus/staff" className="hms-btn invert">Entrar no sistema <ArrowRight className="h-3.5 w-3.5" /></Link>
              <Link to="/staff/dashboard" className="hms-btn on-dark">Painel FLI</Link>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {TEAM_FEATURES.map((f) => (
              <Link key={f.label} to={f.to} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition hover:border-white/25 hover:bg-white/[0.07]">
                <f.icon className="h-4 w-4 shrink-0 text-[#5aa0ff]" />
                <span className="text-[12px] font-medium text-white/85">{f.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer id="contato" className="border-t border-[var(--h-line)] bg-[var(--h-panel)]">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="hms-brand-mark !h-8 !w-8 !rounded-lg"><HeartPulse className="h-4 w-4" /></span>
                <span className="text-[14px] font-bold">Life+</span>
              </div>
              <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-[var(--h-muted)]">Hospital fictício da Furry&apos;s Life Inc. Todo o conteúdo, incluindo documentos e dados clínicos, pertence ao universo de roleplay e não tem validade médica ou legal.</p>
            </div>
            <div>
              <div className="hms-section-label">Unidade central</div>
              <p className="mt-2 flex items-start gap-2 text-[12px] text-[var(--h-muted)]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />Av. Life+, 1000 — Centro Médico, Cidade RP</p>
            </div>
            <div>
              <div className="hms-section-label">Contato</div>
              <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--h-muted)]"><Phone className="h-3.5 w-3.5" />(00) 0000-0000</p>
              <a href="mailto:furryslifeinc@gmail.com" className="mt-1.5 block text-[12px] text-[var(--h-muted)] hover:text-[var(--h-brand)]">furryslifeinc@gmail.com</a>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--h-line)] pt-5 text-[10.5px] text-[var(--h-faint)]">
            <span>© {new Date().getFullYear()} Life+ · subsidiária da <Link to="/" className="underline hover:text-[var(--h-fg)]">Furry&apos;s Life Inc.</Link></span>
            <span className="uppercase tracking-[0.12em]">Documento fictício — roleplay — sem validade médica ou legal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
