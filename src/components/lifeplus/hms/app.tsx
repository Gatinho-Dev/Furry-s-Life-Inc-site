import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity, ArrowUpRight, BarChart3, BedDouble, Bell, Building2, CalendarDays, ClipboardList, FileSignature,
  FileText, FlaskConical, Gamepad2, HeartPulse, LayoutDashboard, LayoutTemplate, ListOrdered, NotebookPen,
  Package, Pill, Plus, ScrollText, Server, Settings, Sparkles, Stethoscope, Users, UsersRound,
} from "lucide-react";
import { useHms, type ModuleKey } from "./data";
import { HmsShell, Page, Card, Kpi, Btn, Chip, Empty, Avatar, AreaLine, Bars, Donut, BarList, Disclaimer, type NavItem } from "./ui";
import { PatientsModule } from "./patients";
import { AppointmentsModule, QueueModule, APPT_STATUS } from "./appointments";
import { DiagnosesModule, ExamsModule, RecordsModule } from "./clinical";
import { AdmissionsModule, BedsModule, PharmacyModule } from "./operations";
import { AiModule, AuditModule, NotificationsModule, ReportsModule, SettingsModule, TeamModule } from "./admin";
import { DocumentStudio, DocumentsModule, DocumentList, TemplatesModule } from "./docs";
import { ShiftModule } from "./shift";
import { MaplePanel } from "../MaplePanel";
import { fDateTime, isToday, type Appointment } from "./core";

export function useNav(): NavItem[] {
  const { data, notifications, lowStock } = useHms();
  const pendingExams = data.exams.filter((e) => !["concluido", "laudo", "cancelado"].includes(e.status)).length;
  return [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Clínico" },
    { key: "patients", label: "Pacientes", icon: Users, group: "Clínico" },
    { key: "records", label: "Prontuários", icon: NotebookPen, group: "Clínico" },
    { key: "appointments", label: "Consultas", icon: CalendarDays, group: "Clínico" },
    { key: "queue", label: "Atendimentos", icon: ListOrdered, group: "Clínico", count: data.appointments.filter((a) => a.status === "aguardando" && isToday(a.starts_at)).length },
    { key: "diagnoses", label: "Diagnósticos", icon: Stethoscope, group: "Clínico" },
    { key: "exams", label: "Exames", icon: FlaskConical, group: "Clínico", count: pendingExams },
    { key: "prescriptions", label: "Receituário", icon: Pill, group: "Documentação" },
    { key: "certificates", label: "Atestados", icon: FileSignature, group: "Documentação" },
    { key: "documents", label: "Documentos", icon: FileText, group: "Documentação", count: data.docs.filter((d) => d.status === "rascunho").length },
    { key: "templates", label: "Modelos Life+", icon: LayoutTemplate, group: "Documentação" },
    { key: "admissions", label: "Internações", icon: BedDouble, group: "Hospital", count: data.admissions.filter((a) => !a.discharged_at).length },
    { key: "beds", label: "Leitos", icon: Building2, group: "Hospital" },
    { key: "pharmacy", label: "Farmácia", icon: Package, group: "Hospital", count: lowStock.length },
    { key: "team", label: "Equipe", icon: UsersRound, group: "Gestão" },
    { key: "reports", label: "Relatórios", icon: BarChart3, group: "Gestão" },
    { key: "notifications", label: "Notificações", icon: Bell, group: "Gestão", count: notifications.length },
    { key: "audit", label: "Auditoria", icon: ScrollText, group: "Gestão" },
    { key: "settings", label: "Configurações", icon: Settings, group: "Gestão" },
    { key: "ai", label: "Life+ AI", icon: Sparkles, group: "Roleplay" },
    { key: "shift", label: "Modo Plantão", icon: Gamepad2, group: "Roleplay" },
    { key: "maple", label: "Maple Hospital", icon: Server, group: "Roleplay" },
  ];
}

export function HmsApp() {
  const { mod, go, can, role } = useHms();
  const nav = useNav();
  const items = nav.filter((n) => can(n.key));

  useEffect(() => {
    if (role && !can(mod)) go("dashboard");
  }, [role, mod, can, go]);

  if (!role) {
    return (
      <HmsShell items={[]}>
        <Page eyebrow="Life+ · acesso" title="Cargo ainda não configurado" sub="Sua conta tem acesso ao hospital, mas ainda não possui um cargo na equipe Life+.">
          <Card>
            <Empty icon={UsersRound} title="Nenhum cargo atribuído"
              children="Peça a um administrador para cadastrar seu perfil em Equipe e vincular o ID da sua conta. Enquanto isso, as permissões clínicas permanecem bloqueadas."
              action={<Btn onClick={() => window.location.reload()}>Recarregar</Btn>} />
          </Card>
        </Page>
      </HmsShell>
    );
  }

  return (
    <HmsShell items={items}>
      {mod === "dashboard" && <Dashboard />}
      {mod === "patients" && <PatientsModule />}
      {mod === "records" && <RecordsModule />}
      {mod === "appointments" && <AppointmentsModule />}
      {mod === "queue" && <QueueModule />}
      {mod === "diagnoses" && <DiagnosesModule />}
      {mod === "exams" && <ExamsModule />}
      {mod === "prescriptions" && <PrescriptionModule />}
      {mod === "certificates" && <CertificateModule />}
      {mod === "documents" && <DocumentsModule />}
      {mod === "templates" && <TemplatesModule />}
      {mod === "admissions" && <AdmissionsModule />}
      {mod === "beds" && <BedsModule />}
      {mod === "pharmacy" && <PharmacyModule />}
      {mod === "team" && <TeamModule />}
      {mod === "reports" && <ReportsModule />}
      {mod === "notifications" && <NotificationsModule />}
      {mod === "audit" && <AuditModule />}
      {mod === "settings" && <SettingsModule />}
      {mod === "ai" && <AiModule />}
      {mod === "shift" && <Page eyebrow="Roleplay" title="Modo Plantão" sub="Minigame de plantão hospitalar — pacientes simulados, tarefas cronometradas e pontuação."><ShiftModule /></Page>}
      {mod === "maple" && <Page eyebrow="Integração" title="Maple Hospital" sub="Painel legado da unidade Maple, preservado do sistema original."><MaplePanel /></Page>}
    </HmsShell>
  );
}

function PrescriptionModule() {
  const { data, focus } = useHms();
  return (
    <Page eyebrow="Receituário médico" title="Receituário" sub="Prescrições com medicamentos da farmácia Life+, posologia, orientações e PDF em papel timbrado."
      actions={<Chip tone="outline">A4 · documento fictício</Chip>}>
      <div className="mb-3"><DocumentStudio presetKind="receita" presetPatientId={focus.patientId} /></div>
      <div className="mt-4"><div className="mb-2 text-[13px] font-semibold">Receitas recentes</div><DocumentList kinds={["receita"]} limit={8} /></div>
      {!data.meds.length && <div className="mt-3 text-[11.5px] text-[var(--h-muted)]">Cadastre medicamentos na <b>Farmácia</b> para agilizar a prescrição.</div>}
    </Page>
  );
}

function CertificateModule() {
  const { focus } = useHms();
  return (
    <Page eyebrow="Atestados e declarações" title="Atestados" sub="Atestado médico, afastamento, comparecimento e acompanhamento — com dias, período e pré-visualização em tempo real."
      actions={<Chip tone="outline">A4 · documento fictício</Chip>}>
      <div className="mb-3"><DocumentStudio presetKind="atestado" presetPatientId={focus.patientId} /></div>
      <div className="mt-4"><div className="mb-2 text-[13px] font-semibold">Atestados e declarações recentes</div><DocumentList kinds={["atestado", "afastamento", "declaracao", "acompanhamento"]} limit={8} /></div>
    </Page>
  );
}

/* ============================ DASHBOARD ============================ */

function Dashboard() {
  const { data, go, patientById, lowStock } = useHms();
  const [clock, setClock] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setClock(new Date()), 30000); return () => clearInterval(t); }, []);

  const appts = data.appointments as Appointment[];
  const todayAppts = appts.filter((a) => isToday(a.starts_at));
  const concludedToday = todayAppts.filter((a) => a.status === "concluida");
  const waiting = data.appointments.filter((a) => a.status === "aguardando");
  const inCare = data.appointments.filter((a) => a.status === "em_atendimento");
  const scheduled = data.appointments.filter((a) => ["agendada", "confirmada"].includes(a.status) && +new Date(a.starts_at) >= Date.now());
  const doctors = data.staff.filter((s) => s.role === "medico" && s.status === "ativo");
  const activeAdm = data.admissions.filter((a) => !a.discharged_at);
  const pendingExams = data.exams.filter((e) => !["concluido", "laudo", "cancelado"].includes(e.status));
  const recipes = data.docs.filter((d) => d.kind === "receita");
  const certs = data.docs.filter((d) => ["atestado", "afastamento", "declaracao", "acompanhamento"].includes(d.kind));

  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d; });
  const dayCounts = days.map((d) => appts.filter((a) => new Date(a.starts_at).toDateString() === d.toDateString()).length);
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i), 1); return d; });
  const monthCounts = months.map((m) => appts.filter((a) => { const d = new Date(a.starts_at); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).length);
  const insurances = ["Life+", "Sanklech", "Santa Tereza", "Nenhum"].map((i) => ({ label: i, value: data.patients.filter((p) => (p.insurance || "Nenhum") === i).length }));
  const specialties = useMemo(() => {
    const map = new Map<string, number>();
    appts.forEach((a) => { const k = a.specialty || "Clínica geral"; map.set(k, (map.get(k) ?? 0) + 1); });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  }, [appts]);
  const docDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const docCounts = docDays.map((d) => data.docs.filter((x) => new Date(x.created_at).toDateString() === d.toDateString()).length);
  const admMonths = months.map((m) => data.admissions.filter((a) => { const d = new Date(a.admitted_at); return d.getMonth() === m.getMonth() && d.getFullYear() === m.getFullYear(); }).length);
  const occupied = new Set([...activeAdm.filter((a) => a.bed_id).map((a) => a.bed_id), ...data.patients.filter((p) => p.bed_id && !["alta", "obito"].includes(p.status)).map((p) => p.bed_id)]).size;
  const occupancy = Math.round((occupied / Math.max(data.beds.length, 1)) * 100);

  const activities = useMemo(() => {
    const rows = [
      ...data.records.slice(0, 8).map((r) => ({ at: r.created_at, kind: "Prontuário", title: `${patientById(r.patient_id)?.full_name ?? "Paciente"} · ${r.kind}`, detail: r.body.slice(0, 100), module: "records" as ModuleKey })),
      ...data.docs.slice(0, 8).map((d) => ({ at: d.created_at, kind: "Documento", title: `${d.title} · ${d.code}`, detail: patientById(d.patient_id ?? undefined)?.full_name ?? "", module: "documents" as ModuleKey })),
      ...data.exams.slice(0, 6).map((e) => ({ at: e.requested_at, kind: "Exame", title: `${e.kind} · ${e.status}`, detail: patientById(e.patient_id)?.full_name ?? "", module: "exams" as ModuleKey })),
      ...data.admissions.slice(0, 5).map((a) => ({ at: a.admitted_at, kind: "Internação", title: `${patientById(a.patient_id)?.full_name ?? "Paciente"} · ${a.sector ?? ""}`, detail: a.reason ?? "", module: "admissions" as ModuleKey })),
    ];
    return rows.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 9);
  }, [data.records, data.docs, data.exams, data.admissions, patientById]);

  const hour = clock.getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <Page eyebrow={`${data.settings.name} · painel assistencial`} title={`${greeting}, equipe Life+`} sub={`${format(clock, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} · ${format(clock, "HH:mm")} · indicadores atualizados em tempo real.`}
      actions={<><Btn variant="ghost" icon={CalendarDays} onClick={() => go("appointments")}>Agenda</Btn><Btn variant="ghost" icon={BedDouble} onClick={() => go("admissions")}>Internar</Btn><Btn icon={FileText} onClick={() => go("documents", { docKind: "atestado" })}>Emitir documento</Btn></>}>

      <div className="hms-card mb-4 overflow-hidden">
        <div className="flex flex-wrap items-stretch gap-0">
          <div className="min-w-[240px] flex-1 border-b border-[var(--h-line)] p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.16em] text-[var(--h-brand)]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--h-brand)]" />Turno atual</div>
            <div className="mt-2 flex items-end gap-3">
              <div className="font-[var(--h-serif)] text-[42px] leading-none tracking-[-0.03em]">{todayAppts.length}</div>
              <div className="pb-1 text-[12px] text-[var(--h-muted)]">atendimentos hoje</div>
            </div>
            <svg className="mt-3 h-9 w-full" viewBox="0 0 320 36" preserveAspectRatio="none" aria-hidden>
              <path d="M0 24 H72 l4 -3 3 6 5 -18 5 27 6 -12 H160 l5 0 5 -8 4 12 4 -4 H240 l5 0 5 -9 4 14 4 -5 H320" fill="none" stroke="var(--h-vital)" strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
            </svg>
          </div>
          <div className="grid min-w-[280px] flex-[1.4] grid-cols-2 divide-[var(--h-line)] sm:grid-cols-4">
            {[
              { l: "Aguardando", v: waiting.length, note: "na recepção", tone: "warn" },
              { l: "Em atendimento", v: inCare.length, note: "agora", tone: "brand" },
              { l: "Leitos", v: `${occupied}/${data.beds.length}`, note: `${occupancy}% ocupados`, tone: "brand" },
              { l: "Exames pendentes", v: pendingExams.length, note: "a processar", tone: "vital" },
            ].map((s) => (
              <div key={s.l} className="border-b border-r border-[var(--h-line)] p-4 last:border-r-0 sm:border-b-0">
                <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--h-muted)]">{s.l}</div>
                <div className={`mt-1.5 font-[var(--h-serif)] text-[26px] leading-none ${s.tone === "vital" ? "text-[var(--h-vital)]" : s.tone === "warn" ? "text-[var(--h-warn)]" : "text-[var(--h-fg)]"}`}>{s.v}</div>
                <div className="mt-1 text-[10.5px] text-[var(--h-faint)]">{s.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Pacientes cadastrados" value={data.patients.filter((p) => !p.archived_at).length} note={`${data.patients.filter((p) => isToday(p.created_at)).length} novos hoje`} icon={Users} tone="brand" />
        <Kpi label="Atendidos hoje" value={concludedToday.length} note="consultas concluídas" icon={Activity} tone="ok" />
        <Kpi label="Consultas agendadas" value={scheduled.length} note="próximos horários" icon={CalendarDays} />
        <Kpi label="Médicos disponíveis" value={doctors.length} note={`${data.staff.filter((s) => s.status === "ativo").length} funcionários ativos`} icon={Stethoscope} tone="brand" />
      </div>
      <div className="hms-cols-4 hms-grid mb-4">
        <Kpi label="Internações atuais" value={activeAdm.length} note={`${data.admissions.filter((a) => a.discharged_at).length} altas registradas`} icon={BedDouble} tone="vital" />
        <Kpi label="Exames solicitados" value={data.exams.length} note={`${pendingExams.length} pendentes`} icon={FlaskConical} tone="warn" />
        <Kpi label="Receitas emitidas" value={recipes.length} note={`${recipes.filter((r) => r.status === "finalizado").length} finalizadas`} icon={Pill} />
        <Kpi label="Atestados emitidos" value={certs.length} note={`${certs.filter((r) => r.status === "finalizado").length} finalizados`} icon={FileSignature} tone="ok" />
      </div>

      <div className="hms-split mb-3">
        <Card title="Atendimentos por dia" sub="Últimos 14 dias" actions={<Chip tone="outline">{dayCounts.reduce((a, b) => a + b, 0)} no período</Chip>}>
          <AreaLine points={dayCounts} labels={days.map((d) => format(d, "dd/MM"))} height={170} />
        </Card>
        <Card title="Pacientes por convênio" sub="Distribuição atual da base">
          <Donut data={insurances} label="Pacientes por convênio" />
        </Card>
      </div>

      <div className="hms-grid hms-cols-3 mb-3">
        <Card title="Consultas por especialidade">
          {specialties.length ? <BarList rows={specialties} /> : <div className="py-6 text-center text-[11.5px] text-[var(--h-muted)]">Sem consultas registradas.</div>}
        </Card>
        <Card title="Ocupação dos leitos" sub={`${occupied} de ${data.beds.length} leitos`}>
          <div className="flex items-end gap-2"><div className="font-[var(--h-serif)] text-[34px] leading-none">{occupancy}%</div><div className="pb-1 text-[11px] text-[var(--h-muted)]">ocupação</div></div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--h-soft-2)]"><div className="h-full rounded-full" style={{ width: `${Math.min(occupancy, 100)}%`, background: occupancy > 85 ? "var(--h-vital)" : occupancy > 60 ? "var(--h-warn)" : "var(--h-brand)" }} /></div>
          <div className="mt-4 space-y-1.5 text-[11.5px]">
            {Array.from(new Set(data.beds.map((b) => b.ward))).map((w) => {
              const total = data.beds.filter((b) => b.ward === w).length;
              const occW = data.beds.filter((b) => b.ward === w).filter((b) => data.admissions.some((a) => !a.discharged_at && a.bed_id === b.id) || data.patients.some((p) => p.bed_id === b.id && !["alta", "obito"].includes(p.status))).length;
              return <div key={w} className="flex items-center justify-between"><span className="text-[var(--h-muted)]">{w}</span><b>{occW}/{total}</b></div>;
            })}
          </div>
          <button className="mt-3 text-[11px] text-[var(--h-brand)] hover:underline" onClick={() => go("beds")}>Abrir mapa de leitos →</button>
        </Card>
        <Card title="Documentos emitidos" sub="Últimos 7 dias">
          <Bars data={docDays.map((d, i) => ({ label: format(d, "dd"), value: docCounts[i] }))} height={150} />
        </Card>
      </div>

      <div className="hms-split">
        <Card title="Atividades recentes" sub="Prontuário, documentos, exames e internações" actions={<Btn size="sm" variant="ghost" icon={ArrowUpRight} onClick={() => go("audit")}>Auditoria</Btn>} noBody>
          <div className="max-h-[420px] overflow-y-auto p-4">
            {activities.length ? (
              <div className="hms-timeline">
                {activities.map((a, i) => (
                  <button key={i} className="hms-tl-item is-record text-left" onClick={() => go(a.module)}>
                    <div className="hms-tl-meta"><span>{fDateTime(a.at)}</span><span>·</span><span className="hms-chip outline">{a.kind}</span></div>
                    <div className="hms-tl-title hover:text-[var(--h-brand)]">{a.title}</div>
                    {a.detail && <div className="hms-tl-body line-clamp-2">{a.detail}</div>}
                  </button>
                ))}
              </div>
            ) : <Empty icon={Activity} title="Sem atividades ainda" children="As ações da equipe aparecem aqui em tempo real." />}
          </div>
        </Card>
        <div className="hms-stack">
          <Card title="Fila agora" actions={<Btn size="sm" variant="ghost" icon={ArrowUpRight} onClick={() => go("queue")}>Abrir</Btn>} noBody>
            <div className="divide-y divide-[var(--h-line)]">
              {waiting.slice(0, 5).map((a) => {
                const p = patientById(a.patient_id);
                return (
                  <button key={a.id} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[var(--h-soft)]" onClick={() => go("queue")}>
                    <Avatar name={p?.full_name} size={28} />
                    <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{p?.full_name}</div><div className="hms-code">{a.code.slice(0, 9)} · {a.specialty ?? "Clínica"}</div></div>
                    <Chip tone="warn">{APPT_STATUS[a.status]}</Chip>
                  </button>
                );
              })}
              {!waiting.length && <div className="px-4 py-7 text-center text-[11.5px] text-[var(--h-muted)]">Fila vazia neste momento.</div>}
            </div>
          </Card>
          <Card title="Triagem e estoque" sub="Pontos de atenção">
            <div className="space-y-2">
              {data.patients.filter((p) => p.status === "triagem" && !p.archived_at).slice(0, 3).map((p) => (
                <button key={p.id} className="flex w-full items-center gap-2 rounded-lg border border-[var(--h-line)] px-2.5 py-2 text-left hover:border-[var(--h-brand)]" onClick={() => go("patients", { patientId: p.id })}>
                  <Chip tone="warn">triagem</Chip><span className="min-w-0 flex-1 truncate text-[12px]">{p.full_name}</span><span className="hms-code">{p.code}</span>
                </button>
              ))}
              {lowStock.slice(0, 3).map((m) => (
                <button key={m.id} className="flex w-full items-center gap-2 rounded-lg border border-[var(--h-line)] px-2.5 py-2 text-left hover:border-[var(--h-brand)]" onClick={() => go("pharmacy")}>
                  <Chip tone="vital">estoque</Chip><span className="min-w-0 flex-1 truncate text-[12px]">{m.name}</span><b className="text-[11px]">{m.stock}</b>
                </button>
              ))}
              {!data.patients.some((p) => p.status === "triagem" && !p.archived_at) && !lowStock.length && <div className="py-3 text-center text-[11.5px] text-[var(--h-muted)]">Nenhum ponto crítico.</div>}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Btn size="sm" variant="ghost" icon={Plus} onClick={() => go("documents", { docKind: "receita" })}>Receita</Btn>
              <Btn size="sm" variant="ghost" icon={Plus} onClick={() => go("documents", { docKind: "atestado" })}>Atestado</Btn>
              <Btn size="sm" variant="ghost" icon={Plus} onClick={() => go("ai")}>Life+ AI</Btn>
            </div>
          </Card>
          <div className="flex items-center justify-between px-1"><Chip tone="outline">Internações por mês</Chip><span className="hms-code">{admMonths.reduce((a, b) => a + b, 0)}</span></div>
          <Bars data={months.map((m, i) => ({ label: format(m, "MMM", { locale: ptBR }), value: admMonths[i] }))} height={110} />
          <div className="pt-1"><Disclaimer /></div>
        </div>
      </div>
    </Page>
  );
}

