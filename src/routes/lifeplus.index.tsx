import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartPulse, Stethoscope, Baby, Brain, Bone, Ambulance, Microscope, Phone, MapPin, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/lifeplus/")({
  head: () => ({
    meta: [
      { title: "Life+ · Hospital e saúde da Furry's Life" },
      { name: "description", content: "Life+: pronto-socorro 24h, especialidades médicas, exames e UTI do ecossistema Furry's Life." },
      { property: "og:title", content: "Life+ · Hospital e saúde" },
      { property: "og:description", content: "Pronto-socorro 24h, especialidades, exames e UTI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LifePlusHome,
});

const SPECIALTIES = [
  { icon: Ambulance, name: "Pronto-socorro 24h", d: "Atendimento de urgência com triagem por classificação de risco." },
  { icon: HeartPulse, name: "Cardiologia", d: "ECG, ecocardiograma, holter e acompanhamento contínuo." },
  { icon: Brain, name: "Neurologia", d: "Diagnóstico e tratamento de doenças do sistema nervoso." },
  { icon: Bone, name: "Ortopedia", d: "Traumas, fraturas e reabilitação." },
  { icon: Baby, name: "Pediatria", d: "Cuidado completo do recém-nascido ao adolescente." },
  { icon: Microscope, name: "Laboratório e imagem", d: "Hemograma, raio-X, tomografia e ressonância." },
];

function LifePlusHome() {
  return (
    <div className="min-h-screen bg-[#f4f8fc] text-[#0b2540]">
      <header className="sticky top-0 z-10 border-b border-[#0b2540]/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-semibold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0a6cff] text-white"><HeartPulse className="h-4 w-4" /></span>Life+</div>
          <Link to="/lifeplus/staff" className="rounded-full bg-[#0b2540] px-4 py-2 text-sm text-white hover:bg-[#0b2540]/90">Área da equipe</Link>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2 md:items-center">
        <div>
          <span className="rounded-full bg-[#0a6cff]/10 px-3 py-1 text-xs font-medium text-[#0a6cff]">Hospital Life+ · Furry's Life</span>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight">Cuidado de verdade, a qualquer hora.</h1>
          <p className="mt-5 text-lg text-[#0b2540]/70">Pronto-socorro 24h, UTI, especialidades e exames em um só lugar — com equipe dedicada e tecnologia a serviço do paciente.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#especialidades" className="inline-flex items-center gap-2 rounded-full bg-[#0a6cff] px-5 py-3 text-sm font-medium text-white hover:bg-[#0a6cff]/90">Especialidades <ArrowRight className="h-4 w-4" /></a>
            <a href="tel:192" className="inline-flex items-center gap-2 rounded-full border border-[#0b2540]/15 bg-white px-5 py-3 text-sm font-medium"><Phone className="h-4 w-4" /> Emergência 192</a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[["24h", "Pronto-socorro"], ["18", "Leitos ativos"], ["4", "Leitos de UTI"], ["6", "Especialidades"]].map(([n, l]) => (
            <div key={l} className="rounded-3xl border border-[#0b2540]/10 bg-white p-6 shadow-sm">
              <div className="text-4xl font-semibold text-[#0a6cff]">{n}</div><div className="mt-1 text-sm text-[#0b2540]/60">{l}</div>
            </div>
          ))}
        </div>
      </section>
      <section id="especialidades" className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-3xl font-semibold tracking-tight">Especialidades</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPECIALTIES.map((s) => (
            <div key={s.name} className="rounded-3xl border border-[#0b2540]/10 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <s.icon className="h-6 w-6 text-[#0a6cff]" /><div className="mt-4 font-semibold">{s.name}</div><p className="mt-1 text-sm text-[#0b2540]/60">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="border-t border-[#0b2540]/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 md:grid-cols-3">
          <div className="flex gap-3"><Stethoscope className="h-5 w-5 text-[#0a6cff]" /><div><div className="font-semibold">Consultas</div><p className="text-sm text-[#0b2540]/60">Agende com nossa equipe médica.</p></div></div>
          <div className="flex gap-3"><MapPin className="h-5 w-5 text-[#0a6cff]" /><div><div className="font-semibold">Unidade central</div><p className="text-sm text-[#0b2540]/60">Furry's Life · Complexo de saúde.</p></div></div>
          <div className="flex gap-3"><Phone className="h-5 w-5 text-[#0a6cff]" /><div><div className="font-semibold">Contato</div><p className="text-sm text-[#0b2540]/60">furryslifeinc@gmail.com</p></div></div>
        </div>
        <div className="pb-8 text-center text-xs text-[#0b2540]/50">Life+ é uma subsidiária da <Link to="/" className="underline">Furry's Life Inc.</Link></div>
      </section>
    </div>
  );
}
