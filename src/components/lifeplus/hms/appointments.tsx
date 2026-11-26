import { useMemo, useState } from "react";
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isToday,
  startOfMonth, startOfWeek, subMonths, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock, LogIn, Play, RefreshCw,
  Stethoscope, Users, XCircle,
} from "lucide-react";
import { hdb, fDate, fDateTime, type Appointment, type Patient } from "./core";
import { useHms } from "./data";
import { PatientSelect, StaffSelect } from "./pickers";
import { Avatar, Banner, Btn, Card, Chip, Empty, Field, Kpi, Modal, Page, SearchInput, Table } from "./ui";

export const APPT_STATUS: Record<string, string> = {
  agendada: "Agendada", confirmada: "Confirmada", aguardando: "Aguardando", em_atendimento: "Em atendimento",
  concluida: "Concluída", cancelada: "Cancelada", nao_compareceu: "Não compareceu",
};
export const PRIORITY: Record<string, string> = { baixa: "Baixa", normal: "Normal", alta: "Alta", urgente: "Urgente" };
export function apptTone(s: string): "brand" | "ok" | "warn" | "vital" | "default" {
  return s === "concluida" ? "ok" : s === "cancelada" || s === "nao_compareceu" ? "vital" : s === "em_atendimento" ? "brand" : s === "aguardando" ? "warn" : "default";
}
const time = (s: string) => format(new Date(s), "HH:mm");
const waitTime = (s: string) => { const m = Math.max(0, Math.floor((Date.now() - +new Date(s)) / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}min` : ""}`; };

export function AppointmentForm({ presetPatientId, appointment, onClose }: { presetPatientId?: string; appointment?: Appointment | null; onClose: () => void }) {
  const { data, reload, me } = useHms();
  const [f, setF] = useState({
    patientId: appointment?.patient_id ?? presetPatientId ?? "",
    staffId: appointment?.staff_id ?? "",
    specialty: appointment?.specialty ?? "",
    date: appointment ? format(new Date(appointment.starts_at), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
    time: appointment ? format(new Date(appointment.starts_at), "HH:mm") : format(new Date(Date.now() + 30 * 60000), "HH:mm"),
    duration: String(appointment?.duration_min ?? 30),
    reason: appointment?.reason ?? "",
    priority: appointment?.priority ?? "normal",
    walkIn: false,
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const patient = data.patients.find((p) => p.id === f.patientId);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));

  const save = async () => {
    if (!f.patientId) { setErr("Selecione o paciente."); return; }
    if (!f.date || !f.time) { setErr("Informe data e horário."); return; }
    setBusy(true); setErr(null);
    const starts = new Date(`${f.date}T${f.time}:00`).toISOString();
    const payload = {
      patient_id: f.patientId, staff_id: f.staffId || null, specialty: f.specialty || null, starts_at: starts,
      duration_min: Number(f.duration) || 30, reason: f.reason || null, priority: f.priority,
      status: f.walkIn ? "aguardando" : "agendada", checked_in_at: f.walkIn ? new Date().toISOString() : null,
    };
    const res = appointment
      ? await hdb.from("lp_appointments").update(payload).eq("id", appointment.id)
      : await hdb.from("lp_appointments").insert({ ...payload, created_by: me?.user_id ?? null });
    if (!res.error && f.walkIn) await hdb.from("lp_patients").update({ status: "aguardando", triage: f.priority === "urgente" ? "laranja" : "verde", complaint: f.reason || null }).eq("id", f.patientId);
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); onClose();
  };

  return (
    <Modal title={appointment ? `Reagendar ${appointment.code}` : "Nova consulta"} sub={patient ? `${patient.full_name} · ${patient.code}` : "Selecione o paciente, o profissional e o horário."} onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Consultas geram código ATD- automático.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={CalendarPlus} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : appointment ? "Reagendar" : "Confirmar agendamento"}</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Paciente *" className="span-2"><PatientSelect patients={data.patients} value={f.patientId} onChange={(id) => set({ patientId: id })} /></Field>
        <Field label="Profissional"><StaffSelect staff={data.staff} value={f.staffId} onChange={(id) => { const s = data.staff.find((x) => x.id === id); set({ staffId: id, specialty: s?.specialty ?? f.specialty }); }} roles={["medico", "enfermeiro", "diretor"]} /></Field>
        <Field label="Especialidade"><input className="hms-input" value={f.specialty} onChange={(e) => set({ specialty: e.target.value })} placeholder="Clínica geral" /></Field>
        <Field label="Data"><input type="date" className="hms-input" value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Horário"><input type="time" className="hms-input" value={f.time} onChange={(e) => set({ time: e.target.value })} /></Field>
        <Field label="Duração (min)"><input type="number" min={5} step={5} className="hms-input" value={f.duration} onChange={(e) => set({ duration: e.target.value })} /></Field>
        <Field label="Prioridade"><select className="hms-select" value={f.priority} onChange={(e) => set({ priority: e.target.value })}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Motivo / queixa" className="span-2"><textarea className="hms-textarea" rows={2} value={f.reason} onChange={(e) => set({ reason: e.target.value })} placeholder="Queixa informada no agendamento" /></Field>
        {!appointment && <label className="hms-check span-2"><input type="checkbox" checked={f.walkIn} onChange={(e) => set({ walkIn: e.target.checked })} /><span><b>Encaixe imediato</b> — o paciente já chegou e entra direto na fila de atendimento de hoje.</span></label>}
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */

type ViewMode = "dia" | "semana" | "mes";

export function AppointmentsModule() {
  const { data, focus, patientById, staffById, go } = useHms();
  const [view, setView] = useState<ViewMode>("semana");
  const [cursor, setCursor] = useState(new Date());
  const [q, setQ] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [openForm, setOpenForm] = useState<{ appointment?: Appointment | null } | null>(focus.patientId ? { appointment: null } : null);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const list = useMemo(() => (data.appointments as Appointment[]).filter((a) => {
    if (staffFilter && a.staff_id !== staffFilter) return false;
    const p = patientById(a.patient_id);
    return !q.trim() || [p?.full_name, p?.code, a.code, a.specialty, a.reason].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  }), [data.appointments, q, staffFilter, patientById]);

  const byDay = (d: Date) => list.filter((a) => isSameDay(new Date(a.starts_at), d)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const monthStart = startOfMonth(cursor);
  const days = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 0 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }) });
  const weekDays = eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 0 }), end: endOfWeek(cursor, { weekStartsOn: 0 }) });

  const shift = (dir: number) => {
    if (view === "mes") setCursor((c) => (dir > 0 ? addMonths(c, 1) : subMonths(c, 1)));
    else if (view === "semana") setCursor((c) => (dir > 0 ? addWeeks(c, 1) : subWeeks(c, 1)));
    else setCursor((c) => addDays(c, dir));
  };

  const title = view === "mes" ? format(cursor, "MMMM 'de' yyyy", { locale: ptBR })
    : view === "semana" ? `${format(weekDays[0], "dd MMM", { locale: ptBR })} – ${format(weekDays[6], "dd MMM yyyy", { locale: ptBR })}`
      : format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR });

  const dayAgenda = (
    <div className="divide-y divide-[var(--h-line)]">
      {byDay(cursor).length === 0 && <Empty icon={CalendarDays} title="Agenda livre neste dia" children="Crie uma consulta ou navegue para outro dia." action={<Btn icon={CalendarPlus} onClick={() => setOpenForm({ appointment: null })}>Nova consulta</Btn>} />}
      {byDay(cursor).map((a) => <ApptRow key={a.id} appt={a} onOpen={() => setSelected(a)} />)}
    </div>
  );

  return (
    <Page eyebrow="Agenda clínica" title="Consultas" sub="Agendamento, confirmação, chegada, atendimento e conclusão — calendário diário, semanal e mensal."
      actions={<><Btn variant="ghost" icon={Users} onClick={() => go("queue")}>Fila de atendimento</Btn><Btn icon={CalendarPlus} onClick={() => setOpenForm({ appointment: null })}>Nova consulta</Btn></>}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Hoje" value={data.appointments.filter((a) => isToday(new Date(a.starts_at))).length} note="consultas do dia" icon={CalendarDays} tone="brand" />
        <Kpi label="Aguardando" value={data.appointments.filter((a) => a.status === "aguardando").length} note="na recepção" icon={Clock} tone="warn" />
        <Kpi label="Em atendimento" value={data.appointments.filter((a) => a.status === "em_atendimento").length} note="agora" icon={Stethoscope} tone="brand" />
        <Kpi label="Concluídas hoje" value={data.appointments.filter((a) => a.status === "concluida" && isToday(a.finished_at ?? a.starts_at)).length} note="atendimentos finalizados" icon={CheckCircle2} tone="ok" />
      </div>

      <Card noBody>
        <div className="hms-toolbar">
          <div className="flex items-center gap-1">
            <Btn variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Btn>
            <Btn variant="ghost" size="sm" onClick={() => setCursor(new Date())}>Hoje</Btn>
            <Btn variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></Btn>
          </div>
          <div className="text-[13px] font-semibold capitalize">{title}</div>
          <div className="push flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Paciente, código ou motivo…" />
            <select className="hms-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
              <option value="">Todos os profissionais</option>
              {data.staff.filter((s) => ["medico", "enfermeiro", "diretor"].includes(s.role)).map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
            </select>
            <div className="flex rounded-lg border border-[var(--h-line-strong)] p-0.5">
              {(["dia", "semana", "mes"] as const).map((v) => <button key={v} className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium capitalize ${view === v ? "bg-[var(--h-brand)] text-white" : "text-[var(--h-muted)]"}`} onClick={() => setView(v)}>{v === "mes" ? "mês" : v}</button>)}
            </div>
          </div>
        </div>

        {view === "mes" && (
          <div className="grid grid-cols-7 border-b border-[var(--h-line)] bg-[var(--h-panel-2)]">
            {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <div key={d} className="px-2 py-2 text-center text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--h-faint)]">{d}</div>)}
          </div>
        )}
        {view === "mes" && (
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const appts = byDay(d);
              const out = d.getMonth() !== cursor.getMonth();
              return (
                <button key={d.toISOString()} onClick={() => { setCursor(d); setView("dia"); }}
                  className={`min-h-[104px] border-b border-r border-[var(--h-line)] p-1.5 text-left align-top transition-colors hover:bg-[var(--h-soft)] ${out ? "opacity-45" : ""}`}>
                  <div className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${isToday(d) ? "bg-[var(--h-brand)] text-white" : ""}`}>{format(d, "d")}</div>
                  <div className="space-y-0.5">
                    {appts.slice(0, 3).map((a) => (
                      <div key={a.id} className="truncate rounded bg-[var(--h-brand-soft)] px-1 py-0.5 text-[9.5px] font-medium text-[var(--h-brand-ink)]">{time(a.starts_at)} {patientById(a.patient_id)?.full_name.split(" ")[0]}</div>
                    ))}
                    {appts.length > 3 && <div className="px-1 text-[9px] text-[var(--h-faint)]">+{appts.length - 3} consultas</div>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {view === "semana" && (
          <div className="grid grid-cols-1 divide-y divide-[var(--h-line)] md:grid-cols-7 md:divide-x md:divide-y-0">
            {weekDays.map((d) => (
              <div key={d.toISOString()} className={`min-h-[220px] p-2 ${isToday(d) ? "bg-[var(--h-brand-soft)]/40" : ""}`}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <div><div className="text-[9.5px] uppercase tracking-[0.1em] text-[var(--h-faint)]">{format(d, "EEE", { locale: ptBR })}</div><div className={`text-[15px] font-semibold ${isToday(d) ? "text-[var(--h-brand-ink)]" : ""}`}>{format(d, "dd")}</div></div>
                  <button className="text-[var(--h-faint)] hover:text-[var(--h-brand)]" onClick={() => { setCursor(d); setView("dia"); }}><ChevronRight className="h-3.5 w-3.5" /></button>
                </div>
                <div className="space-y-1">
                  {byDay(d).map((a) => (
                    <button key={a.id} onClick={() => setSelected(a)} className="w-full rounded-lg border border-[var(--h-line)] bg-[var(--h-panel)] px-1.5 py-1 text-left hover:border-[var(--h-brand)]">
                      <div className="flex items-center gap-1 text-[9.5px] font-semibold text-[var(--h-brand-ink)]"><Clock className="h-2.5 w-2.5" />{time(a.starts_at)}</div>
                      <div className="truncate text-[10.5px] font-medium">{patientById(a.patient_id)?.full_name}</div>
                      <div className="truncate text-[9px] text-[var(--h-faint)]">{a.specialty ?? "Clínica"}</div>
                    </button>
                  ))}
                  {!byDay(d).length && <div className="px-1 py-3 text-center text-[9.5px] text-[var(--h-faint)]">—</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "dia" && <div className="p-1">{dayAgenda}</div>}
      </Card>

      {openForm && <AppointmentForm presetPatientId={focus.patientId ?? (focus as { patientId?: string }).patientId} appointment={openForm.appointment} onClose={() => setOpenForm(null)} />}
      {selected && <AppointmentDrawer appt={selected} onClose={() => setSelected(null)} onReschedule={() => { setOpenForm({ appointment: selected }); setSelected(null); }} />}
      <div className="mt-3 text-[11px] text-[var(--h-muted)]">Consultas e horários fictícios, exclusivos do roleplay da Life+.</div>
    </Page>
  );
}

function ApptRow({ appt, onOpen }: { appt: Appointment; onOpen: () => void }) {
  const { patientById, staffById } = useHms();
  const p = patientById(appt.patient_id); const s = staffById(appt.staff_id ?? undefined);
  return (
    <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--h-soft)]" onClick={onOpen}>
      <div className="w-12 shrink-0 text-[12px] font-semibold tabular-nums">{time(appt.starts_at)}</div>
      <Avatar name={p?.full_name} url={p?.photo_url} size={30} />
      <div className="min-w-0 flex-1"><div className="truncate text-[12.5px] font-semibold">{p?.full_name ?? "Paciente"}</div><div className="hms-code truncate">{appt.code} · {appt.specialty ?? "Clínica"} · {s?.full_name ?? "sem profissional"}</div></div>
      {appt.priority !== "normal" && <Chip tone={appt.priority === "urgente" ? "vital" : "warn"}>{PRIORITY[appt.priority]}</Chip>}
      <Chip tone={apptTone(appt.status)}>{APPT_STATUS[appt.status]}</Chip>
    </button>
  );
}

function AppointmentDrawer({ appt, onClose, onReschedule }: { appt: Appointment; onClose: () => void; onReschedule: () => void }) {
  const { data, patientById, staffById, reload, go, me } = useHms();
  const [evolve, setEvolve] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = patientById(appt.patient_id); const s = staffById(appt.staff_id ?? undefined);
  const upd = async (patch: Record<string, unknown>) => { setBusy(true); await hdb.from("lp_appointments").update(patch).eq("id", appt.id); await reload(); setBusy(false); };
  const setStatus = async (status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "aguardando") { patch.checked_in_at = new Date().toISOString(); await hdb.from("lp_patients").update({ status: "aguardando", complaint: appt.reason ?? p?.complaint ?? null }).eq("id", appt.patient_id); }
    if (status === "em_atendimento") { patch.started_at = new Date().toISOString(); await hdb.from("lp_patients").update({ status: "ambulatorial" }).eq("id", appt.patient_id); }
    if (status === "nao_compareceu" || status === "cancelada") await hdb.from("lp_patients").update({ status: "ambulatorial" }).eq("id", appt.patient_id);
    await upd(patch);
  };
  return (
    <>
      <Modal title={`Consulta ${appt.code}`} sub={`${fDateTime(appt.starts_at)} · ${appt.duration_min} min · ${APPT_STATUS[appt.status]}`} onClose={onClose}
        footer={<><Chip tone={apptTone(appt.status)}>{APPT_STATUS[appt.status]}</Chip><div className="ml-auto flex flex-wrap gap-2">
          {appt.status === "agendada" && <Btn size="sm" variant="soft" icon={CheckCircle2} onClick={() => void setStatus("confirmada")}>Confirmar</Btn>}
          {["agendada", "confirmada"].includes(appt.status) && <Btn size="sm" icon={LogIn} onClick={() => void setStatus("aguardando")}>Registrar chegada</Btn>}
          {appt.status === "aguardando" && <Btn size="sm" icon={Play} onClick={() => void setStatus("em_atendimento")}>Iniciar atendimento</Btn>}
          {appt.status === "em_atendimento" && <Btn size="sm" variant="soft" icon={CheckCircle2} onClick={() => setEvolve(true)}>Finalizar atendimento</Btn>}
          {["agendada", "confirmada"].includes(appt.status) && <Btn size="sm" variant="ghost" icon={CalendarDays} onClick={onReschedule}>Reagendar</Btn>}
          {!["concluida", "cancelada", "nao_compareceu"].includes(appt.status) && <Btn size="sm" variant="danger-ghost" icon={XCircle} onClick={() => void setStatus("cancelada")}>Cancelar</Btn>}
          {appt.status === "confirmada" && <Btn size="sm" variant="ghost" icon={XCircle} onClick={() => void setStatus("nao_compareceu")}>Não compareceu</Btn>}
        </div></>}>
        <div className="hms-grid hms-cols-3 mb-4">
          <div><div className="hms-section-label">Paciente</div><div className="mt-1 flex items-center gap-2"><Avatar name={p?.full_name} size={28} /><div><div className="text-[13px] font-semibold">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code}</div></div></div></div>
          <div><div className="hms-section-label">Profissional</div><div className="mt-1 text-[13px] font-medium">{s?.full_name ?? "—"}</div><div className="text-[11px] text-[var(--h-muted)]">{s?.specialty ?? appt.specialty ?? "—"}</div></div>
          <div><div className="hms-section-label">Prioridade</div><div className="mt-1"><Chip tone={appt.priority === "urgente" ? "vital" : appt.priority === "alta" ? "warn" : "default"}>{PRIORITY[appt.priority]}</Chip></div></div>
        </div>
        <div className="hms-grid hms-cols-2 mb-4">
          <div className="rounded-xl bg-[var(--h-soft)] p-3"><div className="hms-section-label">Motivo</div><p className="mt-1 whitespace-pre-wrap text-[12.5px]">{appt.reason || "—"}</p></div>
          <div className="rounded-xl bg-[var(--h-soft)] p-3"><div className="hms-section-label">Linha do tempo</div>
            <div className="mt-1 space-y-1 text-[11.5px] text-[var(--h-muted)]">
              <div>Agendada: {fDateTime(appt.created_at)}</div>
              {appt.checked_in_at && <div>Chegada: {fDateTime(appt.checked_in_at)}</div>}
              {appt.started_at && <div>Início: {fDateTime(appt.started_at)}</div>}
              {appt.finished_at && <div>Fim: {fDateTime(appt.finished_at)}</div>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn size="sm" variant="ghost" icon={Stethoscope} onClick={() => go("patients", { patientId: appt.patient_id })}>Abrir prontuário</Btn>
          <Btn size="sm" variant="ghost" icon={CalendarPlus} onClick={() => go("documents", { patientId: appt.patient_id, docKind: appt.status === "concluida" ? "receita" : "declaracao" })}>Emitir documento</Btn>
        </div>
        {busy && <div className="mt-2 text-[11px] text-[var(--h-muted)]">Atualizando…</div>}
        {!data.staff.length && <div className="mt-3"><Banner tone="warn">Cadastre a equipe em <b>Equipe</b> para vincular profissionais às consultas.</Banner></div>}
        <span className="hidden">{me?.id ?? ""}</span>
      </Modal>
      {evolve && <FinalizeAppointment appt={appt} onClose={() => { setEvolve(false); onClose(); }} />}
    </>
  );
}

function FinalizeAppointment({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const { patientById, me, reload, role } = useHms();
  const clinical = !!role && ["administrador", "diretor", "medico", "enfermeiro", "tecnico"].includes(role);
  const p = patientById(appt.patient_id);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const finish = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    if (text.trim() && clinical) {
      await hdb.from("lp_records").insert({ patient_id: appt.patient_id, appointment_id: appt.id, staff_id: me?.id ?? null, kind: "evolucao", specialty: appt.specialty, body: text.trim(), data: {} });
    }
    await hdb.from("lp_appointments").update({ status: "concluida", finished_at: now }).eq("id", appt.id);
    await hdb.from("lp_patients").update({ status: "ambulatorial" }).eq("id", appt.patient_id);
    await reload(); setBusy(false); onClose();
  };
  return (
    <Modal slim title="Finalizar atendimento" sub={`${p?.full_name} · ${appt.code}`} onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">A evolução entra no prontuário.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={CheckCircle2} disabled={busy} onClick={() => void finish()}>{busy ? "Finalizando…" : "Concluir"}</Btn></div></>}>
      <Field label="Evolução do atendimento" hint={clinical ? "Opcional, mas recomendado. Fica registrado com data, hora e profissional." : "Seu cargo não permite registrar evolução clínica; o atendimento será apenas concluído."}>
        <textarea className="hms-textarea" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paciente avaliado, conduta adotada, orientações…" disabled={!clinical} />
      </Field>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */

export function QueueModule() {
  const { data, patientById, staffById, reload, go } = useHms();
  const [newWalkIn, setNewWalkIn] = useState(false);
  const [evolve, setEvolve] = useState<Appointment | null>(null);
  const active = data.appointments.filter((a) => ["agendada", "confirmada", "aguardando", "em_atendimento"].includes(a.status) && isToday(new Date(a.starts_at)));
  const columns = [
    { key: "aguardando", label: "Aguardando", tone: "warn" as const },
    { key: "em_atendimento", label: "Em atendimento", tone: "brand" as const },
    { key: "confirmada", label: "Confirmadas", tone: "default" as const },
    { key: "agendada", label: "Agendadas hoje", tone: "default" as const },
  ];
  const move = async (a: Appointment, status: string) => {
    const patch: Record<string, unknown> = { status };
    if (status === "em_atendimento") patch.started_at = new Date().toISOString();
    if (status === "aguardando") patch.checked_in_at = new Date().toISOString();
    await hdb.from("lp_appointments").update(patch).eq("id", a.id);
    await reload();
  };
  const triage = data.patients.filter((p) => p.status === "triagem" && !p.archived_at);

  return (
    <Page eyebrow="Tempo real" title="Atendimentos" sub="Fila viva da recepção ao consultório — quem chegou, quem espera e quem está em atendimento agora."
      actions={<Btn icon={CalendarPlus} onClick={() => setNewWalkIn(true)}>Encaixe / chegada</Btn>}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Na fila" value={active.filter((a) => a.status === "aguardando").length} note="aguardando chamada" icon={Users} tone="warn" />
        <Kpi label="Em atendimento" value={active.filter((a) => a.status === "em_atendimento").length} note="consultórios ocupados" icon={Stethoscope} tone="brand" />
        <Kpi label="Triagem pendente" value={triage.length} note="pacientes sem classificação" icon={Clock} tone={triage.length ? "vital" : "ok"} />
        <Kpi label="Concluídas hoje" value={data.appointments.filter((a) => a.status === "concluida" && isToday(a.finished_at ?? a.starts_at)).length} note="atendimentos finalizados" icon={CheckCircle2} tone="ok" />
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        {columns.map((c) => {
          const list = active.filter((a) => a.status === c.key).sort((a, b) => +new Date(a.checked_in_at ?? a.starts_at) - +new Date(b.checked_in_at ?? b.starts_at));
          return (
            <Card key={c.key} title={<span className="flex items-center gap-2">{c.label}<Chip tone={c.tone}>{list.length}</Chip></span>} noBody>
              <div className="min-h-[240px] space-y-2 p-2.5">
                {list.map((a) => {
                  const p = patientById(a.patient_id); const s = staffById(a.staff_id ?? undefined);
                  return (
                    <div key={a.id} className="rounded-xl border border-[var(--h-line)] bg-[var(--h-panel)] p-2.5">
                      <div className="flex items-start gap-2">
                        <Avatar name={p?.full_name} size={26} />
                        <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-semibold">{p?.full_name}</div><div className="hms-code">{time(a.starts_at)} · {a.code.slice(0, 8)}</div></div>
                        {a.priority === "urgente" && <Chip tone="vital">urgente</Chip>}
                      </div>
                      <div className="mt-1.5 truncate text-[10.5px] text-[var(--h-muted)]">{a.reason || a.specialty || "—"}</div>
                      <div className="mt-1 text-[10px] text-[var(--h-faint)]">{s?.full_name ?? "sem profissional"}{a.checked_in_at ? ` · espera ${waitTime(a.checked_in_at)}` : ""}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {c.key === "aguardando" && <Btn size="sm" icon={Play} onClick={() => void move(a, "em_atendimento")}>Chamar</Btn>}
                        {c.key === "em_atendimento" && <Btn size="sm" variant="soft" icon={CheckCircle2} onClick={() => setEvolve(a)}>Finalizar</Btn>}
                        {["agendada", "confirmada"].includes(c.key) && <Btn size="sm" variant="ghost" icon={LogIn} onClick={() => void move(a, "aguardando")}>Chegou</Btn>}
                        <Btn size="sm" variant="ghost" icon={RefreshCw} onClick={() => go("patients", { patientId: a.patient_id })}>Ficha</Btn>
                      </div>
                    </div>
                  );
                })}
                {!list.length && <div className="py-8 text-center text-[11px] text-[var(--h-faint)]">Nada por aqui.</div>}
              </div>
            </Card>
          );
        })}
      </div>

      {triage.length > 0 && (
        <Card className="mt-3" title="Triagem pendente" sub="Pacientes cadastrados sem classificação de risco" noBody>
          <Table head={<tr><th>Paciente</th><th>Queixa</th><th>Cadastro</th><th /></tr>}>
            {triage.map((p: Patient) => (
              <tr key={p.id}><td><b>{p.full_name}</b><div className="hms-code">{p.code}</div></td><td className="muted">{p.complaint ?? "—"}</td><td className="muted">{fDate(p.created_at)}</td><td><button className="hms-btn ghost sm" onClick={() => go("patients", { patientId: p.id })}>Classificar</button></td></tr>
            ))}
          </Table>
        </Card>
      )}

      {newWalkIn && <AppointmentForm onClose={() => setNewWalkIn(false)} />}
      {evolve && <FinalizeAppointment appt={evolve} onClose={() => setEvolve(null)} />}
    </Page>
  );
}
