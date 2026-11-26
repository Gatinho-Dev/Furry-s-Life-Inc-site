import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, LogIn, Play, CheckCircle2, XCircle, Clock } from "lucide-react";
import { hdb, APPT_STATUS, fDateTime, fTime, isToday, can, type Core, type Appointment, type RecordRow } from "./core";
import { PageHead, Modal, F, Empty, Badge, Card } from "./ui";

export function PatientPicker({ core, value, onChange }: { core: Core; value: string; onChange: (v: string) => void }) {
  return <select className="h-input" value={value} onChange={(e) => onChange(e.target.value)} required><option value="">Selecione o paciente…</option>{core.patients.filter((p) => !p.archived_at).map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.code}</option>)}</select>;
}
export function StaffPicker({ core, value, onChange, roles }: { core: Core; value: string; onChange: (v: string) => void; roles?: string[] }) {
  return <select className="h-input" value={value} onChange={(e) => onChange(e.target.value)}><option value="">Selecione o profissional…</option>{core.staff.filter((s) => s.status !== "inativo" && (!roles || roles.includes(s.role))).map((s) => <option key={s.id} value={s.id}>{s.full_name}{s.specialty ? ` · ${s.specialty}` : ""}</option>)}</select>;
}

/* ---------------- Prontuário ---------------- */
const REC_KIND: Record<string, string> = { anamnese: "Anamnese", evolucao: "Evolução clínica", sinais: "Sinais vitais", avaliacao: "Avaliação clínica", diagnostico: "Diagnóstico", conduta: "Conduta", observacao: "Observação", correcao: "Correção" };

export function RecordsModule({ core, patientId, setPatient }: { core: Core; patientId: string; setPatient: (id: string) => void }) {
  const [recs, setRecs] = useState<RecordRow[] | null>(null);
  const [form, setForm] = useState<null | { kind: string; corrects?: RecordRow }>(null);
  const p = core.patients.find((x) => x.id === patientId);
  const load = async () => { if (!patientId) return; const { data } = await hdb.from("lp_records").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }); setRecs(data ?? []); };
  useEffect(() => { setRecs(null); load(); }, [patientId]); // eslint-disable-line
  const staff = (id: string | null) => core.staff.find((s) => s.id === id);
  return (
    <div>
      <PageHead title="Prontuário eletrônico" sub="Os registros não podem ser apagados; correções criam um novo registro vinculado." actions={patientId && can(core.role, ["diretor", "medico", "enfermeiro", "tecnico"]) && (
        <>{["anamnese", "evolucao", "sinais", "conduta"].map((k) => <button key={k} className={k === "evolucao" ? "h-btn" : "h-btn-ghost"} onClick={() => setForm({ kind: k })}><Plus className="h-4 w-4" />{REC_KIND[k]}</button>)}</>
      )} />
      <div className="mb-5 max-w-md"><PatientPicker core={core} value={patientId} onChange={setPatient} /></div>
      {!patientId ? <Empty text="Selecione um paciente para ver o prontuário." /> : !recs ? null : (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
          <Card title="Resumo clínico">
            <dl className="space-y-3 text-sm">{[["Código", p?.code], ["Alergias", p?.allergies], ["Condições", p?.conditions], ["Medicamentos em uso", p?.medications], ["Tipo sanguíneo", p?.blood_type], ["Queixa principal", p?.complaint]].map(([l, v]) => <div key={l}><dt className="h-muted text-xs">{l}</dt><dd>{v || "—"}</dd></div>)}</dl>
          </Card>
          <div className="space-y-3">
            {recs.length === 0 && <Empty text="Prontuário vazio. Adicione a primeira anamnese ou evolução." />}
            {recs.map((r) => { const s = staff(r.staff_id); return (
              <div key={r.id} className="h-panel p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs"><Badge>{REC_KIND[r.kind]}</Badge><span className="h-muted">{fDateTime(r.created_at)} · {s?.full_name ?? "Profissional não informado"}{r.specialty ? ` · ${r.specialty}` : ""}</span><span className="h-muted font-mono">#{r.id.slice(0, 8)}</span>
                  {r.corrects && <Badge tone="warn">corrige #{r.corrects.slice(0, 8)}</Badge>}
                  <button className="h-muted ml-auto underline" onClick={() => setForm({ kind: "correcao", corrects: r })}>Corrigir</button></div>
                {r.kind === "sinais" ? <div className="mt-2 flex flex-wrap gap-4 text-sm">{Object.entries(r.data).map(([k, v]) => <span key={k}><span className="h-muted">{k}:</span> {String(v)}</span>)}</div> : null}
                {r.kind === "diagnostico" && <div className="mt-2 text-sm"><b>{String(r.data.principal ?? "")}</b>{(r.data.secundarios as string[] | undefined)?.length ? <span className="h-muted"> · Secundários: {(r.data.secundarios as string[]).join(", ")}</span> : null}{r.data.hipoteses ? <div className="h-muted">Hipóteses: {String(r.data.hipoteses)}</div> : null}{r.data.sintomas ? <div className="h-muted">Sintomas: {String(r.data.sintomas)}</div> : null}</div>}
                {r.body && <p className="mt-2 whitespace-pre-wrap text-sm">{r.body}</p>}
              </div>); })}
          </div>
        </div>
      )}
      {form && <RecordForm core={core} patientId={patientId} kind={form.kind} corrects={form.corrects} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}

function RecordForm({ core, patientId, kind, corrects, onClose, onSaved }: { core: Core; patientId: string; kind: string; corrects?: RecordRow; onClose: () => void; onSaved: () => void }) {
  const [staffId, setStaff] = useState(core.me?.id ?? "");
  const [body, setBody] = useState(corrects?.body ?? "");
  const [v, setV] = useState({ PA: "", FC: "", Temp: "", SpO2: "", FR: "" });
  const [hda, setHda] = useState("");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = core.staff.find((x) => x.id === staffId);
    const data = kind === "sinais" ? Object.fromEntries(Object.entries(v).filter(([, x]) => x)) : kind === "anamnese" ? { hda } : corrects ? corrects.data : {};
    const { error } = await hdb.from("lp_records").insert({ patient_id: patientId, staff_id: staffId || null, kind, specialty: s?.specialty ?? null, body, data, corrects: corrects?.id ?? null });
    if (error) return toast.error("Sem permissão ou erro ao salvar: " + error.message);
    toast.success("Registro adicionado ao prontuário."); onSaved();
  };
  return (
    <Modal title={corrects ? "Correção de registro" : REC_KIND[kind]} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <F label="Profissional responsável"><StaffPicker core={core} value={staffId} onChange={setStaff} /></F>
        {kind === "sinais" && <div className="grid grid-cols-5 gap-2">{Object.keys(v).map((k) => <F key={k} label={k}><input className="h-input" value={v[k as keyof typeof v]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></F>)}</div>}
        {kind === "anamnese" && <F label="Histórico da doença atual"><textarea className="h-input" rows={3} value={hda} onChange={(e) => setHda(e.target.value)} /></F>}
        <F label={kind === "anamnese" ? "Queixa principal / avaliação" : "Descrição"}><textarea className="h-input" rows={6} value={body} onChange={(e) => setBody(e.target.value)} required={kind !== "sinais"} /></F>
        <div className="flex justify-end gap-2"><button type="button" className="h-btn-ghost" onClick={onClose}>Cancelar</button><button className="h-btn">Registrar</button></div>
      </form>
    </Modal>
  );
}

/* ---------------- Diagnósticos ---------------- */
export function DiagnosesModule({ core }: { core: Core }) {
  const [cat, setCat] = useState<{ id: string; code: string; name: string; category: string | null }[]>([]);
  const [list, setList] = useState<RecordRow[]>([]);
  const [f, setF] = useState({ patient: "", staff: core.me?.id ?? "", appt: "", principal: "", sec: [] as string[], hip: "", sint: "", body: "" });
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [nc, setNc] = useState({ code: "", name: "", category: "" });
  const [q, setQ] = useState("");
  const load = async () => {
    const [c, l] = await Promise.all([hdb.from("lp_diagnosis_catalog").select("*").order("code"), hdb.from("lp_records").select("*").eq("kind", "diagnostico").order("created_at", { ascending: false }).limit(100)]);
    setCat(c.data ?? []); setList(l.data ?? []);
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { if (f.patient) hdb.from("lp_appointments").select("*").eq("patient_id", f.patient).order("starts_at", { ascending: false }).limit(20).then(({ data }: { data: Appointment[] }) => setAppts(data ?? [])); }, [f.patient]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.patient || !f.principal) return toast.error("Informe paciente e diagnóstico principal.");
    const s = core.staff.find((x) => x.id === f.staff);
    const { error } = await hdb.from("lp_records").insert({ patient_id: f.patient, appointment_id: f.appt || null, staff_id: f.staff || null, specialty: s?.specialty ?? null, kind: "diagnostico", body: f.body, data: { principal: f.principal, secundarios: f.sec, hipoteses: f.hip, sintomas: f.sint } });
    if (error) return toast.error("Sem permissão: " + error.message);
    toast.success("Diagnóstico registrado no prontuário."); setF({ ...f, principal: "", sec: [], hip: "", sint: "", body: "" }); load();
  };
  const addCat = async () => { if (!nc.code || !nc.name) return; const { error } = await hdb.from("lp_diagnosis_catalog").insert(nc); if (error) return toast.error("Sem permissão."); setNc({ code: "", name: "", category: "" }); load(); };
  const label = (c: { code: string; name: string }) => `${c.code} — ${c.name}`;
  return (
    <div>
      <PageHead title="Diagnósticos" sub="Registre diagnósticos do RP; eles entram automaticamente no prontuário." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Novo diagnóstico">
          <form onSubmit={save} className="space-y-3">
            <PatientPicker core={core} value={f.patient} onChange={(v) => setF({ ...f, patient: v })} />
            <select className="h-input" value={f.appt} onChange={(e) => setF({ ...f, appt: e.target.value })}><option value="">Atendimento (opcional)</option>{appts.map((a) => <option key={a.id} value={a.id}>{a.code} · {fDateTime(a.starts_at)}</option>)}</select>
            <StaffPicker core={core} value={f.staff} onChange={(v) => setF({ ...f, staff: v })} />
            <F label="Diagnóstico principal"><input className="h-input" list="lp-dx" value={f.principal} onChange={(e) => setF({ ...f, principal: e.target.value })} /></F>
            <datalist id="lp-dx">{cat.map((c) => <option key={c.id} value={label(c)} />)}</datalist>
            <F label="Diagnósticos secundários"><div className="flex flex-wrap gap-1">{f.sec.map((s) => <button type="button" key={s} onClick={() => setF({ ...f, sec: f.sec.filter((x) => x !== s) })}><Badge>{s} ✕</Badge></button>)}</div>
              <select className="h-input mt-1" value="" onChange={(e) => e.target.value && setF({ ...f, sec: [...f.sec, e.target.value] })}><option value="">Adicionar…</option>{cat.map((c) => <option key={c.id}>{label(c)}</option>)}</select></F>
            <F label="Hipóteses"><input className="h-input" value={f.hip} onChange={(e) => setF({ ...f, hip: e.target.value })} /></F>
            <F label="Sintomas"><input className="h-input" value={f.sint} onChange={(e) => setF({ ...f, sint: e.target.value })} /></F>
            <F label="Descrição e observações"><textarea className="h-input" rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></F>
            <button className="h-btn">Registrar diagnóstico</button>
          </form>
        </Card>
        <div className="space-y-5">
          <Card title="Catálogo de diagnósticos do RP">
            <input className="h-input mb-3" placeholder="Pesquisar no catálogo" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="max-h-56 space-y-1 overflow-y-auto text-sm">{cat.filter((c) => label(c).toLowerCase().includes(q.toLowerCase())).map((c) => <div key={c.id} className="flex justify-between"><span><span className="font-mono text-xs">{c.code}</span> {c.name}</span><span className="h-muted text-xs">{c.category}</span></div>)}</div>
            <div className="mt-3 grid grid-cols-[90px_1fr_110px_auto] gap-2"><input className="h-input" placeholder="Código" value={nc.code} onChange={(e) => setNc({ ...nc, code: e.target.value })} /><input className="h-input" placeholder="Nome" value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} /><input className="h-input" placeholder="Categoria" value={nc.category} onChange={(e) => setNc({ ...nc, category: e.target.value })} /><button type="button" className="h-btn" onClick={addCat}>+</button></div>
          </Card>
          <Card title="Diagnósticos recentes">
            {list.length === 0 ? <Empty text="Nenhum diagnóstico registrado." /> : <div className="space-y-2 text-sm">{list.slice(0, 12).map((r) => <div key={r.id} className="flex justify-between gap-2"><span className="truncate"><b>{core.patients.find((p) => p.id === r.patient_id)?.full_name}</b> · {String(r.data.principal)}</span><span className="h-muted shrink-0 text-xs">{fDateTime(r.created_at)}</span></div>)}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Consultas ---------------- */
const tone = (s: string) => (s === "concluida" ? "ok" : s === "cancelada" || s === "nao_compareceu" ? "danger" : s === "em_atendimento" ? "warn" : "soft") as "ok";

export function useAppointments() {
  const [list, setList] = useState<Appointment[] | null>(null);
  const load = async () => { const { data } = await hdb.from("lp_appointments").select("*").order("starts_at"); setList(data ?? []); };
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, []);
  return { list, load };
}

export async function setApptStatus(a: Appointment, status: string) {
  const patch: Record<string, unknown> = { status };
  if (status === "aguardando") patch.checked_in_at = new Date().toISOString();
  if (status === "em_atendimento") patch.started_at = new Date().toISOString();
  if (status === "concluida") patch.finished_at = new Date().toISOString();
  const { error } = await hdb.from("lp_appointments").update(patch).eq("id", a.id);
  if (error) toast.error("Sem permissão."); else toast.success(`Consulta: ${APPT_STATUS[status]}`);
}

export function ApptForm({ core, initial, patientId, onClose, onSaved }: { core: Core; initial?: Appointment; patientId?: string; onClose: () => void; onSaved: () => void }) {
  const local = (iso?: string) => { const d = iso ? new Date(iso) : new Date(Date.now() + 3600e3); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const [f, setF] = useState({ patient_id: initial?.patient_id ?? patientId ?? "", staff_id: initial?.staff_id ?? "", specialty: initial?.specialty ?? core.settings.specialties[0], starts_at: local(initial?.starts_at), duration_min: String(initial?.duration_min ?? 30), reason: initial?.reason ?? "", priority: initial?.priority ?? "normal", status: initial?.status ?? "agendada" });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const row = { ...f, staff_id: f.staff_id || null, duration_min: Number(f.duration_min) || 30, starts_at: new Date(f.starts_at).toISOString() };
    const { error } = initial ? await hdb.from("lp_appointments").update(row).eq("id", initial.id) : await hdb.from("lp_appointments").insert(row);
    if (error) return toast.error("Não foi possível salvar: " + error.message);
    toast.success(initial ? "Consulta reagendada." : "Consulta agendada."); onSaved();
  };
  return (
    <Modal title={initial ? "Reagendar consulta" : "Agendar consulta"} onClose={onClose}>
      <form onSubmit={save} className="grid gap-3 md:grid-cols-2">
        <F label="Paciente" span><PatientPicker core={core} value={f.patient_id} onChange={(v) => setF({ ...f, patient_id: v })} /></F>
        <F label="Médico"><StaffPicker core={core} value={f.staff_id} onChange={(v) => { const s = core.staff.find((x) => x.id === v); setF({ ...f, staff_id: v, specialty: s?.specialty || f.specialty }); }} roles={["medico", "diretor", "administrador", "enfermeiro"]} /></F>
        <F label="Especialidade"><select className="h-input" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })}>{core.settings.specialties.map((s) => <option key={s}>{s}</option>)}</select></F>
        <F label="Data e horário"><input type="datetime-local" className="h-input" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} required /></F>
        <F label="Duração (min)"><select className="h-input" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: e.target.value })}>{[15, 20, 30, 45, 60, 90].map((n) => <option key={n}>{n}</option>)}</select></F>
        <F label="Prioridade"><select className="h-input" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })}><option value="baixa">Baixa</option><option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></F>
        <F label="Status"><select className="h-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="agendada">Agendada</option><option value="confirmada">Confirmada</option></select></F>
        <F label="Motivo" span><textarea className="h-input" rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></F>
        <div className="flex justify-end gap-2 md:col-span-2"><button type="button" className="h-btn-ghost" onClick={onClose}>Cancelar</button><button className="h-btn">Confirmar agendamento</button></div>
      </form>
    </Modal>
  );
}

export function AppointmentsModule({ core, patientId }: { core: Core; patientId?: string }) {
  const { list, load } = useAppointments();
  const [form, setForm] = useState<null | { initial?: Appointment }>(patientId ? {} : null);
  const [view, setView] = useState<"dia" | "semana" | "mes">("semana");
  const [ref, setRef] = useState(() => new Date());
  const [status, setStatus] = useState("");
  const pName = (id: string) => core.patients.find((p) => p.id === id)?.full_name ?? "—";
  const sName = (id: string | null) => core.staff.find((s) => s.id === id)?.full_name ?? "Sem médico";
  const days = useMemo(() => {
    const d = new Date(ref); d.setHours(0, 0, 0, 0);
    if (view === "dia") return [d];
    if (view === "semana") { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); return Array.from({ length: 7 }, (_, i) => new Date(s.getTime() + i * 864e5)); }
    const s = new Date(d.getFullYear(), d.getMonth(), 1); s.setDate(1 - s.getDay()); return Array.from({ length: 42 }, (_, i) => new Date(s.getTime() + i * 864e5));
  }, [ref, view]);
  const shift = (n: number) => { const d = new Date(ref); if (view === "dia") d.setDate(d.getDate() + n); else if (view === "semana") d.setDate(d.getDate() + 7 * n); else d.setMonth(d.getMonth() + n); setRef(d); };
  const same = (a: Date, iso: string) => { const b = new Date(iso); return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); };
  const items = (list ?? []).filter((a) => !status || a.status === status);
  return (
    <div>
      <PageHead title="Consultas" sub="Agenda do hospital" actions={<button className="h-btn" onClick={() => setForm({})}><Plus className="h-4 w-4" /> Agendar consulta</button>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["dia", "semana", "mes"] as const).map((v) => <button key={v} className={view === v ? "h-btn" : "h-btn-ghost"} onClick={() => setView(v)}>{v === "dia" ? "Diário" : v === "semana" ? "Semanal" : "Mensal"}</button>)}
        <button className="h-btn-ghost" onClick={() => shift(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></button>
        <button className="h-btn-ghost" onClick={() => setRef(new Date())}>Hoje</button>
        <button className="h-btn-ghost" onClick={() => shift(1)} aria-label="Próximo"><ChevronRight className="h-4 w-4" /></button>
        <span className="font-medium capitalize">{ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
        <select className="h-input ml-auto" style={{ width: 190 }} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <div className={`grid gap-2 ${view === "dia" ? "grid-cols-1" : "grid-cols-7"}`}>
        {view !== "dia" && ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="h-muted text-center text-xs">{d}</div>)}
        {days.map((d) => { const day = items.filter((a) => same(d, a.starts_at)); const out = view === "mes" && d.getMonth() !== ref.getMonth(); return (
          <div key={d.toISOString()} className={`h-panel p-2 ${view === "mes" ? "min-h-24" : "min-h-64"}`} style={{ opacity: out ? 0.45 : 1 }}>
            <div className={`mb-1 text-xs font-semibold ${isToday(d.toISOString()) ? "h-accent" : ""}`}>{d.getDate()}</div>
            <div className="space-y-1">{day.map((a) => (
              <button key={a.id} onClick={() => setForm({ initial: a })} className="h-accent-soft block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px]" title={`${pName(a.patient_id)} — ${APPT_STATUS[a.status]}`} style={{ textDecoration: a.status === "cancelada" ? "line-through" : undefined }}>
                {fTime(a.starts_at)} {pName(a.patient_id)}{view === "dia" && ` · ${a.specialty} · ${sName(a.staff_id)} · ${APPT_STATUS[a.status]}`}
              </button>))}</div>
          </div>); })}
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Lista</h2>
      {items.length === 0 ? <Empty text="Nenhuma consulta." /> : (
        <div className="h-panel overflow-x-auto"><table className="h-table"><thead><tr><th>Data</th><th>Paciente</th><th>Médico</th><th>Especialidade</th><th>Prioridade</th><th>Status</th><th /></tr></thead><tbody>
          {items.slice().reverse().slice(0, 100).map((a) => (
            <tr key={a.id}><td className="whitespace-nowrap text-xs">{fDateTime(a.starts_at)}</td><td>{pName(a.patient_id)}</td><td>{sName(a.staff_id)}</td><td>{a.specialty}</td><td>{a.priority}</td><td><Badge tone={tone(a.status)}>{APPT_STATUS[a.status]}</Badge></td>
              <td className="whitespace-nowrap text-right">
                {["agendada", "confirmada"].includes(a.status) && <><button className="h-muted mr-2 text-xs underline" onClick={async () => { await setApptStatus(a, "confirmada"); load(); }}>Confirmar</button><button className="h-muted mr-2 text-xs underline" onClick={() => setForm({ initial: a })}>Reagendar</button><button className="h-danger mr-2 text-xs underline" onClick={async () => { await setApptStatus(a, "cancelada"); load(); }}>Cancelar</button><button className="h-muted text-xs underline" onClick={async () => { await setApptStatus(a, "nao_compareceu"); load(); }}>Faltou</button></>}
              </td></tr>))}
        </tbody></table></div>
      )}
      {form && <ApptForm core={core} initial={form.initial} patientId={patientId} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} />}
    </div>
  );
}

/* ---------------- Atendimentos (fila em tempo real) ---------------- */
export function QueueModule({ core, openRecord }: { core: Core; openRecord: (patientId: string) => void }) {
  const { list, load } = useAppointments();
  const today = (list ?? []).filter((a) => isToday(a.starts_at) || ["aguardando", "em_atendimento"].includes(a.status));
  const pr = { urgente: 0, alta: 1, normal: 2, baixa: 3 } as Record<string, number>;
  const col = (s: string[]) => today.filter((a) => s.includes(a.status)).sort((a, b) => (pr[a.priority] - pr[b.priority]) || a.starts_at.localeCompare(b.starts_at));
  const pName = (id: string) => core.patients.find((p) => p.id === id);
  const act = async (a: Appointment, s: string) => { await setApptStatus(a, s); load(); };
  const cols: { t: string; s: string[]; icon: typeof Clock; next?: { s: string; l: string; i: typeof Play } }[] = [
    { t: "Agendados hoje", s: ["agendada", "confirmada"], icon: Clock, next: { s: "aguardando", l: "Registrar chegada", i: LogIn } },
    { t: "Aguardando", s: ["aguardando"], icon: LogIn, next: { s: "em_atendimento", l: "Iniciar atendimento", i: Play } },
    { t: "Em atendimento", s: ["em_atendimento"], icon: Play, next: { s: "concluida", l: "Finalizar", i: CheckCircle2 } },
    { t: "Concluídos hoje", s: ["concluida"], icon: CheckCircle2 },
  ];
  return (
    <div>
      <PageHead title="Atendimentos" sub="Fila em tempo real (atualiza a cada 20 segundos)" />
      <div className="grid gap-4 lg:grid-cols-4">
        {cols.map((c) => (
          <div key={c.t} className="h-panel p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><c.icon className="h-4 w-4 h-accent" />{c.t}<span className="h-muted ml-auto">{col(c.s).length}</span></div>
            <div className="space-y-2">{col(c.s).map((a) => { const p = pName(a.patient_id); return (
              <div key={a.id} className="h-soft rounded-xl p-3 text-sm">
                <div className="flex items-center justify-between"><b className="truncate">{p?.full_name}</b>{a.priority !== "normal" && <Badge tone={a.priority === "urgente" ? "danger" : a.priority === "alta" ? "warn" : "muted"}>{a.priority}</Badge>}</div>
                <div className="h-muted text-xs">{fTime(a.starts_at)} · {a.specialty} · {p?.code}</div>
                {a.reason && <div className="h-muted mt-1 line-clamp-2 text-xs">{a.reason}</div>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.next && <button className="h-btn" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => act(a, c.next!.s)}><c.next.i className="h-3.5 w-3.5" />{c.next.l}</button>}
                  {a.status === "em_atendimento" && <button className="h-btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openRecord(a.patient_id)}>Prontuário</button>}
                  {["agendada", "confirmada"].includes(a.status) && <button className="h-btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => act(a, "nao_compareceu")} aria-label="Não compareceu"><XCircle className="h-3.5 w-3.5" /></button>}
                </div>
              </div>); })}
              {col(c.s).length === 0 && <div className="h-muted py-6 text-center text-xs">Vazio</div>}</div>
          </div>))}
      </div>
    </div>
  );
}
