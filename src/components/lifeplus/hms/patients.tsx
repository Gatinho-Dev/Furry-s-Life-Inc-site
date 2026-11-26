import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Archive, CalendarClock, Droplets, FileText, FlaskConical,
  HeartPulse, NotebookPen, Pencil, Plus, ShieldPlus, Trash2, UserRoundPlus, Users,
} from "lucide-react";
import { hdb, ageOf, fDate, fDateTime, INSURANCES, BLOOD, type Patient, type RecordRow } from "./core";
import { useHms } from "./data";
import { PatientSelect, StaffSelect } from "./pickers";
import { Avatar, Banner, Btn, Card, Chip, Empty, Field, Info, Modal, Page, SearchInput, Table, Tabs } from "./ui";

export const PATIENT_STATUS: Record<string, string> = {
  triagem: "Em triagem", ambulatorial: "Ambulatorial", aguardando: "Aguardando", internado: "Internado", uti: "UTI", alta: "Alta", obito: "Óbito",
};
export const TRIAGE_LABEL: Record<string, string> = { vermelho: "Vermelho", laranja: "Laranja", amarelo: "Amarelo", verde: "Verde", azul: "Azul" };
export function triageTone(t: string): "vital" | "warn" | "ok" | "brand" | "default" {
  return t === "vermelho" ? "vital" : t === "laranja" ? "vital" : t === "amarelo" ? "warn" : t === "verde" ? "ok" : t === "azul" ? "brand" : "default";
}
export function statusTone(s: string): "vital" | "warn" | "ok" | "brand" | "default" {
  return ["obito"].includes(s) ? "vital" : ["internado", "uti"].includes(s) ? "brand" : s === "alta" ? "ok" : ["triagem", "aguardando"].includes(s) ? "warn" : "default";
}

const EMPTY_PATIENT: Partial<Patient> = {
  full_name: "", photo_url: null, nickname: null, birth_date: null, sex: null, phone: null, email: null, address: null,
  blood_type: null, allergies: null, conditions: null, medications: null, medical_notes: null, insurance: "Nenhum",
  status: "ambulatorial", triage: "verde",
};

export function PatientForm({ patient, onClose, onSaved }: { patient?: Patient | null; onClose: () => void; onSaved?: (p: Patient) => void }) {
  const { reload } = useHms();
  const [f, setF] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    Object.entries(patient ?? EMPTY_PATIENT).forEach(([k, v]) => { base[k] = v == null ? "" : String(v); });
    return base;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (patch: Record<string, string>) => setF((x) => ({ ...x, ...patch }));
  const age = ageOf(f.birth_date || null);

  const submit = async () => {
    if (!f.full_name.trim()) { setErr("O nome completo é obrigatório."); return; }
    setBusy(true); setErr(null);
    const allowed = ["full_name", "photo_url", "nickname", "birth_date", "sex", "phone", "email", "address", "blood_type", "allergies", "conditions", "medications", "medical_notes", "insurance", "status", "triage"];
    const payload: Record<string, string | null> = {};
    for (const k of allowed) payload[k] = f[k]?.trim() ? f[k].trim() : null;
    payload.full_name = f.full_name.trim();
    payload.insurance = f.insurance || "Nenhum";
    payload.triage = f.triage || "verde";
    payload.status = f.status || "ambulatorial";
    const res = patient?.id
      ? await hdb.from("lp_patients").update(payload).eq("id", patient.id).select("*").single()
      : await hdb.from("lp_patients").insert(payload).select("*").single();
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); onSaved?.(res.data as Patient); onClose();
  };

  return (
    <Modal wide title={patient ? `Editar ${patient.full_name}` : "Novo paciente"} sub="Cadastro de roleplay. Não são solicitados CPF, RG, carteirinha ou contato de emergência." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">O código LIFE- é gerado automaticamente.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={ShieldPlus} disabled={busy} onClick={() => void submit()}>{busy ? "Salvando…" : patient ? "Salvar alterações" : "Cadastrar paciente"}</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <div className="span-2 hms-section-label">Informações pessoais</div>
        <Field label="Nome completo *" className="span-2"><input className="hms-input" value={f.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="Nome do personagem" /></Field>
        <Field label="Foto de perfil (URL opcional)"><input className="hms-input" value={f.photo_url} onChange={(e) => set({ photo_url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Nome de usuário / apelido no RP"><input className="hms-input" value={f.nickname} onChange={(e) => set({ nickname: e.target.value })} placeholder="@apelido" /></Field>
        <Field label="Data de nascimento" hint={age != null ? `Idade calculada: ${age} anos` : "Idade é calculada automaticamente quando informada."}><input type="date" className="hms-input" value={f.birth_date} onChange={(e) => set({ birth_date: e.target.value })} /></Field>
        <Field label="Sexo"><select className="hms-select" value={f.sex} onChange={(e) => set({ sex: e.target.value })}><option value="">Não informar</option><option value="Feminino">Feminino</option><option value="Masculino">Masculino</option><option value="Outro">Outro</option></select></Field>
        <Field label="Telefone (opcional)"><input className="hms-input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="(00) 00000-0000" /></Field>
        <Field label="E-mail (opcional)"><input type="email" className="hms-input" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="paciente@rp.local" /></Field>
        <Field label="Endereço (opcional)" className="span-2"><input className="hms-input" value={f.address} onChange={(e) => set({ address: e.target.value })} placeholder="Bairro, cidade fictícia" /></Field>

        <div className="span-2 hms-section-label mt-1">Informações médicas</div>
        <Field label="Tipo sanguíneo (opcional)"><select className="hms-select" value={f.blood_type} onChange={(e) => set({ blood_type: e.target.value })}><option value="">Não informado</option>{BLOOD.map((b) => <option key={b} value={b}>{b}</option>)}</select></Field>
        <Field label="Convênio médico"><select className="hms-select" value={f.insurance} onChange={(e) => set({ insurance: e.target.value })}>{INSURANCES.map((i) => <option key={i} value={i}>{i}</option>)}</select></Field>
        <Field label="Alergias (opcional)" className="span-2"><input className="hms-input" value={f.allergies} onChange={(e) => set({ allergies: e.target.value })} placeholder="Ex.: dipirona, látex" /></Field>
        <Field label="Condições preexistentes (opcional)" className="span-2"><textarea className="hms-textarea" rows={2} value={f.conditions} onChange={(e) => set({ conditions: e.target.value })} placeholder="Hipertensão, asma…" /></Field>
        <Field label="Medicamentos em uso (opcional)" className="span-2"><textarea className="hms-textarea" rows={2} value={f.medications} onChange={(e) => set({ medications: e.target.value })} placeholder="Uso contínuo…" /></Field>
        <Field label="Observações médicas (opcional)" className="span-2"><textarea className="hms-textarea" rows={3} value={f.medical_notes} onChange={(e) => set({ medical_notes: e.target.value })} /></Field>

        <Field label="Situação"><select className="hms-select" value={f.status} onChange={(e) => set({ status: e.target.value })}>{Object.entries(PATIENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Classificação de risco"><select className="hms-select" value={f.triage} onChange={(e) => set({ triage: e.target.value })}>{Object.entries(TRIAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- */

export function PatientsModule() {
  const { data, focus, go, patientById, isAdmin, reload } = useHms();
  const [q, setQ] = useState("");
  const [insurance, setInsurance] = useState("");
  const [status, setStatus] = useState("ativos");
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState<{ open: boolean; patient?: Patient | null }>({ open: false });
  const [confirmDel, setConfirmDel] = useState<Patient | null>(null);

  if (focus.patientId && patientById(focus.patientId)) return <PatientPage id={focus.patientId} />;

  const list = (data.patients as Patient[]).filter((p) => {
    if (!showArchived && p.archived_at) return false;
    if (insurance && (p.insurance || "Nenhum") !== insurance) return false;
    if (status === "ativos" && ["alta", "obito"].includes(p.status)) return false;
    if (status !== "ativos" && status !== "todos" && p.status !== status) return false;
    return !q.trim() || [p.full_name, p.code, p.nickname, p.phone, p.email].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  });

  const archive = async (p: Patient, on: boolean) => {
    await hdb.from("lp_patients").update({ archived_at: on ? new Date().toISOString() : null }).eq("id", p.id);
    await reload();
  };
  const remove = async (p: Patient) => {
    const res = await hdb.from("lp_patients").delete().eq("id", p.id);
    if (res.error) alert(res.error.message); else await reload();
    setConfirmDel(null);
  };

  return (
    <Page eyebrow="Gestão de pacientes" title="Pacientes" sub={`${data.patients.filter((p) => !p.archived_at).length} cadastros no universo Life+ · cada paciente recebe um código exclusivo.`}
      actions={<Btn icon={UserRoundPlus} onClick={() => setForm({ open: true, patient: null })}>Novo paciente</Btn>}>
      <Card noBody>
        <div className="hms-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Nome, código LIFE-, apelido, telefone…" />
          <select className="hms-select" value={insurance} onChange={(e) => setInsurance(e.target.value)}><option value="">Todos os convênios</option>{INSURANCES.map((i) => <option key={i} value={i}>{i}</option>)}</select>
          <select className="hms-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ativos">Ativos</option><option value="todos">Todos</option>{Object.entries(PATIENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="hms-check"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Arquivados</label>
          <span className="push hms-code">{list.length} resultados</span>
        </div>
        {list.length === 0 ? <Empty icon={Users} title="Nenhum paciente encontrado" children="Ajuste os filtros ou cadastre o primeiro paciente da Life+." action={<Btn icon={Plus} onClick={() => setForm({ open: true })}>Novo paciente</Btn>} /> : (
          <Table head={<tr><th>Paciente</th><th>Idade</th><th>Convênio</th><th>Risco</th><th>Situação</th><th>Cadastro</th><th /></tr>}>
            {list.map((p) => (
              <tr key={p.id} className="is-clickable" onClick={() => go("patients", { patientId: p.id })}>
                <td><div className="flex items-center gap-2.5"><Avatar name={p.full_name} url={p.photo_url} size={30} /><div className="min-w-0"><div className="strong truncate">{p.full_name}{p.archived_at && <span className="ml-1.5 hms-chip outline">arquivado</span>}</div><div className="hms-code">{p.code}{p.nickname ? ` · ${p.nickname}` : ""}</div></div></div></td>
                <td className="muted">{ageOf(p.birth_date) != null ? `${ageOf(p.birth_date)} anos` : "—"}</td>
                <td className="muted">{p.insurance || "Nenhum"}</td>
                <td><Chip tone={triageTone(p.triage)}>{TRIAGE_LABEL[p.triage] ?? p.triage}</Chip></td>
                <td><Chip tone={statusTone(p.status)}>{PATIENT_STATUS[p.status] ?? p.status}</Chip></td>
                <td className="muted">{fDate(p.created_at)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1">
                    <button className="hms-btn ghost sm" title="Editar" onClick={() => setForm({ open: true, patient: p })}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="hms-btn ghost sm" title={p.archived_at ? "Restaurar" : "Arquivar"} onClick={() => void archive(p, !p.archived_at)}><Archive className="h-3.5 w-3.5" /></button>
                    {isAdmin && <button className="hms-btn danger-ghost sm" title="Excluir" onClick={() => setConfirmDel(p)}><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {form.open && <PatientForm patient={form.patient} onClose={() => setForm({ open: false })} onSaved={(p) => go("patients", { patientId: p.id })} />}
      {confirmDel && (
        <Modal slim title="Excluir paciente" onClose={() => setConfirmDel(null)}
          footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={() => setConfirmDel(null)}>Cancelar</Btn><Btn variant="danger" icon={Trash2} onClick={() => void remove(confirmDel)}>Excluir definitivamente</Btn></div></>}>
          <Banner tone="error"><b>Ação irreversível.</b> Exclui {confirmDel.full_name} ({confirmDel.code}) e todo o prontuário, documentos, exames e internações vinculados. Prefira arquivar para preservar o histórico.</Banner>
        </Modal>
      )}
    </Page>
  );
}

/* ---------------------------------------------------------------- */

type TimelineItem = { at: string; kind: "record" | "doc" | "exam" | "admission" | "appointment"; title: string; body?: string; meta?: string; module?: "records" | "documents" | "exams" | "admissions" | "appointments" };

export function PatientPage({ id }: { id: string }) {
  const { data, patientById, staffById, bedById, go, reload, isAdmin, me } = useHms();
  const [tab, setTab] = useState<"geral" | "prontuario" | "consultas" | "documentos" | "exames" | "internacoes">("geral");
  const [edit, setEdit] = useState(false);
  const patient = patientById(id);
  const records = useMemo(() => (data.records as RecordRow[]).filter((r) => r.patient_id === id), [data.records, id]);
  const docs = useMemo(() => data.docs.filter((d) => d.patient_id === id), [data.docs, id]);
  const exams = useMemo(() => data.exams.filter((e) => e.patient_id === id), [data.exams, id]);
  const adm = useMemo(() => data.admissions.filter((a) => a.patient_id === id), [data.admissions, id]);
  const appts = useMemo(() => data.appointments.filter((a) => a.patient_id === id), [data.appointments, id]);
  const notes = data.notes.filter((n) => n.patient_id === id);
  const vitals = data.vitals.filter((v) => v.patient_id === id);
  if (!patient) return <Empty icon={Users} title="Paciente não encontrado" action={<Btn onClick={() => go("patients")}>Voltar para pacientes</Btn>} />;

  const age = ageOf(patient.birth_date);
  const bed = bedById(patient.bed_id);
  const timeline: TimelineItem[] = [
    ...records.map((r) => ({ at: r.created_at, kind: "record" as const, title: labelRecord(r.kind), body: r.body, meta: `${staffById(r.staff_id ?? undefined)?.full_name ?? "Equipe"}${r.specialty ? ` · ${r.specialty}` : ""}`, module: "records" as const })),
    ...docs.map((d) => ({ at: d.finalized_at ?? d.created_at, kind: "doc" as const, title: `${d.title}`, body: `${d.code} · ${d.status}`, meta: staffById(d.staff_id ?? undefined)?.full_name ?? "", module: "documents" as const })),
    ...exams.map((e) => ({ at: e.requested_at, kind: "exam" as const, title: `Exame · ${e.kind}`, body: e.result ?? undefined, meta: e.status, module: "exams" as const })),
    ...adm.map((a) => ({ at: a.admitted_at, kind: "admission" as const, title: a.discharged_at ? "Alta hospitalar" : "Internação", body: a.reason ?? undefined, meta: `${a.sector ?? ""}${a.discharged_at ? ` · alta ${fDate(a.discharged_at)}` : ""}`, module: "admissions" as const })),
    ...appts.map((a) => ({ at: a.starts_at, kind: "appointment" as const, title: `Consulta · ${a.specialty ?? "Clínica"}`, body: a.reason ?? undefined, meta: a.status, module: "appointments" as const })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  const archive = async () => {
    await hdb.from("lp_patients").update({ archived_at: patient.archived_at ? null : new Date().toISOString() }).eq("id", id);
    await reload();
  };

  return (
    <div className="hms-rise">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button className="hms-btn ghost sm" onClick={() => go("patients")}>← Pacientes</button>
        <span className="hms-code">Prontuário {patient.code}</span>
      </div>

      <Card className="mb-3">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={patient.full_name} url={patient.photo_url} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[23px] font-semibold tracking-[-0.025em]">{patient.full_name}</h1>
              <Chip tone="brand">{patient.code}</Chip>
              <Chip tone={statusTone(patient.status)}>{PATIENT_STATUS[patient.status] ?? patient.status}</Chip>
              {patient.archived_at && <Chip tone="outline">arquivado</Chip>}
            </div>
            <div className="hms-sub">{age != null ? `${age} anos` : "idade não informada"}{patient.sex ? ` · ${patient.sex}` : ""} · Convênio {patient.insurance || "Nenhum"}{patient.nickname ? ` · ${patient.nickname}` : ""}{bed ? ` · Leito ${bed.code}` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {patient.allergies && <Chip tone="vital"><AlertTriangle />Alergias: {patient.allergies}</Chip>}
              {patient.blood_type && <Chip tone="brand"><Droplets />Sangue {patient.blood_type}</Chip>}
              {patient.conditions && <Chip tone="warn">{patient.conditions}</Chip>}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Btn size="sm" icon={CalendarClock} onClick={() => go("appointments", { patientId: id })}>Agendar</Btn>
            <Btn size="sm" variant="soft" icon={FileText} onClick={() => go("documents", { patientId: id, docKind: "atestado" })}>Documento</Btn>
            <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn>
            {isAdmin && <Btn size="sm" variant="ghost" icon={Archive} onClick={() => void archive()}>{patient.archived_at ? "Restaurar" : "Arquivar"}</Btn>}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[var(--h-line)] pt-3 sm:grid-cols-3 lg:grid-cols-6">
          <Info label="Código" value={<span className="hms-code text-[13px]">{patient.code}</span>} />
          <Info label="Idade" value={age != null ? `${age} anos` : "—"} />
          <Info label="Convênio" value={patient.insurance || "Nenhum"} />
          <Info label="Tipo sanguíneo" value={patient.blood_type || "—"} />
          <Info label="Telefone" value={patient.phone || "—"} />
          <Info label="E-mail" value={patient.email || "—"} />
          <Info label="Nascimento" value={patient.birth_date ? fDate(patient.birth_date) : "—"} />
          <Info label="Endereço" value={patient.address || "—"} />
          <Info label="Consultas" value={appts.length} />
          <Info label="Documentos" value={docs.length} />
          <Info label="Exames" value={exams.length} />
          <Info label="Internações" value={adm.length} />
        </div>
      </Card>

      <div className="mb-3"><Tabs items={[
        { key: "geral", label: "Visão geral" }, { key: "prontuario", label: "Prontuário", count: records.length },
        { key: "consultas", label: "Consultas", count: appts.length }, { key: "documentos", label: "Documentos", count: docs.length },
        { key: "exames", label: "Exames", count: exams.length }, { key: "internacoes", label: "Internações", count: adm.length },
      ]} value={tab} onChange={setTab} /></div>

      {tab === "geral" && (
        <div className="hms-split items-start">
          <Card title="Linha do tempo clínica" sub="Todos os acontecimentos registrados neste prontuário" noBody>
            <div className="max-h-[620px] overflow-y-auto p-5">
              {timeline.length === 0 ? <Empty icon={Activity} title="Sem acontecimentos" children="Agende uma consulta ou registre uma evolução para iniciar a linha do tempo." /> : (
                <div className="hms-timeline">
                  {timeline.map((t, i) => (
                    <div key={i} className={`hms-tl-item is-${t.kind}`}>
                      <div className="hms-tl-meta"><span>{fDateTime(t.at)}</span>{t.meta && <><span>·</span><span>{t.meta}</span></>}</div>
                      <div className="hms-tl-title">{t.title}</div>
                      {t.body && <div className="hms-tl-body line-clamp-3">{t.body}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <div className="hms-stack">
            <Card title="Histórico médico" actions={<Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEdit(true)}>Editar</Btn>}>
              <div className="space-y-3 text-[12.5px]">
                <div><div className="hms-section-label">Alergias</div><p className="mt-1 whitespace-pre-wrap">{patient.allergies || "Não informadas."}</p></div>
                <div><div className="hms-section-label">Condições preexistentes</div><p className="mt-1 whitespace-pre-wrap">{patient.conditions || "Não informadas."}</p></div>
                <div><div className="hms-section-label">Medicamentos em uso</div><p className="mt-1 whitespace-pre-wrap">{patient.medications || "Não informados."}</p></div>
                <div><div className="hms-section-label">Observações médicas</div><p className="mt-1 whitespace-pre-wrap">{patient.medical_notes || "Sem observações."}</p></div>
              </div>
            </Card>
            <Card title="Sinais vitais recentes" actions={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => setTab("prontuario")}>Registrar</Btn>}>
              {vitals.length ? (
                <div className="grid grid-cols-2 gap-2 text-center">
                  {(() => { const v = vitals[vitals.length - 1]; return [
                    ["PA", `${v.systolic ?? "—"}/${v.diastolic ?? "—"}`], ["FC", `${v.heart_rate ?? "—"} bpm`], ["Temp.", `${v.temperature ?? "—"} °C`], ["SpO₂", `${v.spo2 ?? "—"}%`],
                  ].map(([l, val]) => <div key={l} className="rounded-xl bg-[var(--h-soft)] p-2.5"><div className="hms-section-label">{l}</div><div className="mt-1 text-[13px] font-semibold">{val}</div></div>); })()}
                </div>
              ) : <div className="text-[12px] text-[var(--h-muted)]">Nenhuma aferição registrada.</div>}
              {notes[0] && <div className="mt-3 border-t border-[var(--h-line)] pt-2 text-[11.5px] text-[var(--h-muted)]"><b className="text-[var(--h-fg)]">Última anotação:</b> {notes[0].body.slice(0, 140)}</div>}
            </Card>
          </div>
        </div>
      )}

      {tab === "prontuario" && <PatientRecordTab patient={patient} records={records} />}

      {tab === "consultas" && (
        <Card noBody title="Consultas do paciente" actions={<Btn size="sm" icon={Plus} onClick={() => go("appointments", { patientId: id })}>Agendar</Btn>}>
          {appts.length ? (
            <Table head={<tr><th>Código</th><th>Data</th><th>Especialidade</th><th>Profissional</th><th>Status</th><th /></tr>}>
              {appts.sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)).map((a) => (
                <tr key={a.id}><td className="hms-code">{a.code}</td><td>{fDateTime(a.starts_at)}</td><td>{a.specialty ?? "—"}</td><td className="muted">{staffById(a.staff_id ?? undefined)?.full_name ?? "—"}</td><td><Chip tone={a.status === "concluida" ? "ok" : a.status === "cancelada" ? "vital" : "brand"}>{a.status}</Chip></td><td><button className="hms-btn ghost sm" onClick={() => go("appointments")}>Abrir</button></td></tr>
              ))}
            </Table>
          ) : <Empty icon={CalendarClock} title="Nenhuma consulta" children="Agende a primeira consulta deste paciente." action={<Btn onClick={() => go("appointments", { patientId: id })}>Agendar consulta</Btn>} />}
        </Card>
      )}

      {tab === "documentos" && (
        <Card noBody title="Documentos emitidos" actions={<Btn size="sm" icon={Plus} onClick={() => go("documents", { patientId: id, docKind: "atestado" })}>Emitir</Btn>}>
          {docs.length ? (
            <Table head={<tr><th>Documento</th><th>Tipo</th><th>Status</th><th>Emissão</th><th /></tr>}>
              {docs.map((d) => (
                <tr key={d.id}><td><div className="strong">{d.title}</div><div className="hms-code">{d.code}</div></td><td className="muted">{d.kind}</td><td><Chip tone={d.status === "finalizado" ? "ok" : d.status === "cancelado" ? "vital" : "warn"}>{d.status}</Chip></td><td className="muted">{fDate(d.created_at)}</td><td><button className="hms-btn ghost sm" onClick={() => go("documents", { docId: d.id, patientId: id })}>Abrir</button></td></tr>
              ))}
            </Table>
          ) : <Empty icon={FileText} title="Nenhum documento" children="Atestados, receitas e relatórios aparecem aqui." action={<Btn onClick={() => go("documents", { patientId: id, docKind: "receita" })}>Nova receita</Btn>} />}
        </Card>
      )}

      {tab === "exames" && (
        <Card noBody title="Exames" actions={<Btn size="sm" icon={Plus} onClick={() => go("exams", { patientId: id })}>Solicitar exame</Btn>}>
          {exams.length ? (
            <Table head={<tr><th>Exame</th><th>Categoria</th><th>Solicitado</th><th>Status</th><th>Resultado</th><th /></tr>}>
              {exams.map((e) => (
                <tr key={e.id}><td className="strong">{e.kind}</td><td className="muted">{e.category}</td><td className="muted">{fDate(e.requested_at)}</td><td><Chip tone={["concluido", "laudo"].includes(e.status) ? "ok" : e.status === "cancelado" ? "vital" : "warn"}>{e.status}</Chip></td><td className="muted max-w-[240px] truncate">{e.result ?? "—"}</td><td><button className="hms-btn ghost sm" onClick={() => go("exams")}>Abrir</button></td></tr>
              ))}
            </Table>
          ) : <Empty icon={FlaskConical} title="Nenhum exame" children="Solicite exames laboratoriais, de imagem ou cardiológicos." action={<Btn onClick={() => go("exams", { patientId: id })}>Solicitar</Btn>} />}
        </Card>
      )}

      {tab === "internacoes" && (
        <Card noBody title="Internações e leitos" actions={<Btn size="sm" icon={Plus} onClick={() => go("admissions", { patientId: id })}>Internar</Btn>}>
          {adm.length ? (
            <Table head={<tr><th>Entrada</th><th>Setor</th><th>Leito</th><th>Motivo</th><th>Saída</th><th>Status</th></tr>}>
              {adm.map((a) => (
                <tr key={a.id}><td>{fDateTime(a.admitted_at)}</td><td>{a.sector ?? "—"}</td><td className="hms-code">{bedById(a.bed_id ?? undefined)?.code ?? "—"}</td><td className="muted max-w-[280px] truncate">{a.reason ?? "—"}</td><td className="muted">{a.discharged_at ? fDateTime(a.discharged_at) : "—"}</td><td><Chip tone={a.discharged_at ? "ok" : "vital"}>{a.discharged_at ? "alta" : a.status}</Chip></td></tr>
              ))}
            </Table>
          ) : <Empty icon={HeartPulse} title="Sem internações" children="Registre uma internação para ocupar um leito." action={<Btn onClick={() => go("admissions", { patientId: id })}>Registrar internação</Btn>} />}
        </Card>
      )}

      {edit && <PatientForm patient={patient} onClose={() => setEdit(false)} />}
      <p className="mt-4 text-[10.5px] text-[var(--h-faint)]">Prontuário de roleplay · profissional autenticado: {me?.full_name ?? "equipe Life+"} · registros preservados para auditoria.</p>
    </div>
  );
}

export function labelRecord(kind: string) {
  return ({ anamnese: "Anamnese", evolucao: "Evolução clínica", sinais: "Sinais vitais", avaliacao: "Avaliação clínica", diagnostico: "Diagnóstico", conduta: "Conduta", observacao: "Observação", correcao: "Correção de registro" } as Record<string, string>)[kind] ?? kind;
}

function PatientRecordTab({ patient, records }: { patient: Patient; records: RecordRow[] }) {
  const { data, staffById, reload, can } = useHms();
  const [open, setOpen] = useState(false);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [correct, setCorrect] = useState<RecordRow | null>(null);
  const vitals = data.vitals.filter((v) => v.patient_id === patient.id).slice().sort((a, b) => +new Date(b.measured_at) - +new Date(a.measured_at));
  const notes = data.notes.filter((n) => n.patient_id === patient.id);

  return (
    <div className="hms-split items-start">
      <Card title="Prontuário eletrônico" sub={`${records.length} registros · histórico imutável`} actions={<><Btn size="sm" variant="ghost" icon={Activity} onClick={() => setVitalsOpen(true)}>Sinais vitais</Btn>{can("records") && <Btn size="sm" icon={Plus} onClick={() => setOpen(true)}>Nova evolução</Btn>}</>} noBody>
        <div className="max-h-[640px] space-y-3 overflow-y-auto p-5">
          {records.length === 0 && <Empty icon={NotebookPen} title="Prontuário vazio" children="Registre a primeira evolução clínica deste paciente." action={<Btn icon={Plus} onClick={() => setOpen(true)}>Nova evolução</Btn>} />}
          {records.map((r) => {
            const original = records.find((x) => x.id === r.corrects);
            return (
              <article key={r.id} className="rounded-xl border border-[var(--h-line)] bg-[var(--h-panel-2)] p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={r.kind === "correcao" ? "warn" : "brand"}>{labelRecord(r.kind)}</Chip>
                  <span className="hms-code">{fDateTime(r.created_at)}</span>
                  <span className="text-[11px] text-[var(--h-muted)]">{staffById(r.staff_id ?? undefined)?.full_name ?? "Equipe"}{r.specialty ? ` · ${r.specialty}` : ""}</span>
                  {r.appointment_id && <span className="hms-chip outline">atendimento</span>}
                  <button className="ml-auto text-[10.5px] text-[var(--h-faint)] hover:text-[var(--h-brand)]" onClick={() => setCorrect(r)}>corrigir</button>
                </div>
                {original && <div className="mt-1.5 text-[11px] text-[var(--h-warn)]">Correção do registro de {fDateTime(original.created_at)}</div>}
                <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-relaxed">{r.body}</p>
                {r.data && Object.keys(r.data).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(r.data).filter(([, v]) => v && typeof v === "string").slice(0, 6).map(([k, v]) => <span key={k} className="hms-chip outline">{k}: {String(v)}</span>)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </Card>
      <div className="hms-stack">
        <Card title="Sinais vitais" sub={`${vitals.length} aferições`} actions={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => setVitalsOpen(true)}>Novo</Btn>}>
          {vitals.length ? (
            <Table head={<tr><th>Data</th><th>PA</th><th>FC</th><th>Temp.</th><th>SpO₂</th></tr>}>
              {vitals.slice(0, 8).map((v) => <tr key={v.id}><td className="muted">{fDateTime(v.measured_at)}</td><td>{v.systolic ?? "—"}/{v.diastolic ?? "—"}</td><td>{v.heart_rate ?? "—"}</td><td>{v.temperature ?? "—"}</td><td>{v.spo2 ?? "—"}%</td></tr>)}
            </Table>
          ) : <div className="text-[12px] text-[var(--h-muted)]">Nenhuma aferição registrada.</div>}
        </Card>
        <Card title="Anotações de enfermagem" sub={`${notes.length} registros`} actions={<Btn size="sm" variant="ghost" icon={Plus} onClick={() => setOpen(true)}>Anotar</Btn>}>
          <div className="space-y-2.5">
            {notes.slice(0, 6).map((n) => <div key={n.id} className="border-l-2 border-[var(--h-brand)] pl-2.5 text-[12px]"><div className="hms-code">{fDateTime(n.created_at)} · {n.author ?? "equipe"}</div><p className="mt-0.5 whitespace-pre-wrap">{n.body}</p></div>)}
            {!notes.length && <div className="text-[12px] text-[var(--h-muted)]">Sem anotações.</div>}
          </div>
        </Card>
      </div>
      {open && <RecordComposer patientId={patient.id} onClose={() => setOpen(false)} onDone={async () => { await reload(); }} />}
      {correct && <RecordComposer patientId={patient.id} corrects={correct} onClose={() => setCorrect(null)} onDone={async () => { await reload(); }} />}
      {vitalsOpen && <VitalsForm patientId={patient.id} onClose={() => setVitalsOpen(false)} onDone={async () => { await reload(); }} />}
    </div>
  );
}

export function RecordComposer({ patientId, corrects, onClose, onDone }: { patientId: string; corrects?: RecordRow | null; onClose: () => void; onDone?: () => Promise<void> | void }) {
  const { me, reload } = useHms();
  const [f, setF] = useState({ kind: corrects ? "correcao" : "evolucao", body: corrects ? `Correção do registro de ${fDateTime(corrects.created_at)}:\n\n` : "", specialty: corrects?.specialty ?? "", queixa: "", hda: "", hipotese: "", conduta: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    if (!f.body.trim()) { setErr("Descreva o registro clínico."); return; }
    setBusy(true); setErr(null);
    const res = await hdb.from("lp_records").insert({
      patient_id: patientId, kind: f.kind, body: f.body, specialty: f.specialty || null,
      staff_id: me?.id ?? null, corrects: corrects?.id ?? null,
      data: { queixa: f.queixa, hda: f.hda, hipotese: f.hipotese, conduta: f.conduta },
    });
    if (!res.error && f.kind !== "correcao") {
      await hdb.from("lp_notes").insert({ patient_id: patientId, body: f.body, author: me?.full_name ?? "equipe" });
    }
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); await onDone?.(); onClose();
  };
  return (
    <Modal title={corrects ? "Corrigir registro" : "Novo registro no prontuário"} sub={corrects ? "Uma nova entrada é criada; a original nunca é apagada." : "Anamnese, evolução, conduta ou observação."} onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Registro assinado por {me?.full_name ?? "equipe Life+"}.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={NotebookPen} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Registrar"}</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Tipo de registro"><select className="hms-select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} disabled={!!corrects}>{["anamnese", "evolucao", "avaliacao", "conduta", "observacao", "diagnostico", "correcao"].map((k) => <option key={k} value={k}>{labelRecord(k)}</option>)}</select></Field>
        <Field label="Especialidade"><input className="hms-input" value={f.specialty} onChange={(e) => setF({ ...f, specialty: e.target.value })} placeholder="Clínica geral" /></Field>
        {f.kind === "anamnese" || f.kind === "avaliacao" ? (
          <>
            <Field label="Queixa principal" className="span-2"><input className="hms-input" value={f.queixa} onChange={(e) => setF({ ...f, queixa: e.target.value })} /></Field>
            <Field label="Histórico da doença atual" className="span-2"><textarea className="hms-textarea" rows={2} value={f.hda} onChange={(e) => setF({ ...f, hda: e.target.value })} /></Field>
            <Field label="Hipótese diagnóstica" className="span-2"><input className="hms-input" value={f.hipotese} onChange={(e) => setF({ ...f, hipotese: e.target.value })} /></Field>
          </>
        ) : null}
        <Field label="Registro clínico *" className="span-2"><textarea className="hms-textarea" rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Evolução, conduta, resposta ao tratamento…" /></Field>
      </div>
    </Modal>
  );
}

export function VitalsForm({ patientId, onClose, onDone }: { patientId: string; onClose: () => void; onDone?: () => Promise<void> | void }) {
  const { reload } = useHms();
  const [v, setV] = useState({ systolic: "", diastolic: "", heart_rate: "", temperature: "", spo2: "" });
  const [busy, setBusy] = useState(false);
  const num = (s: string) => (s.trim() ? Number(s) : null);
  return (
    <Modal slim title="Registrar sinais vitais" onClose={onClose}
      footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Activity} disabled={busy} onClick={async () => {
        setBusy(true);
        await hdb.from("lp_vitals").insert({ patient_id: patientId, systolic: num(v.systolic), diastolic: num(v.diastolic), heart_rate: num(v.heart_rate), temperature: num(v.temperature), spo2: num(v.spo2) });
        await reload(); setBusy(false); await onDone?.(); onClose();
      }}>Salvar</Btn></div></>}>
      <div className="hms-form-grid">
        <Field label="PA sistólica"><input className="hms-input" inputMode="numeric" value={v.systolic} onChange={(e) => setV({ ...v, systolic: e.target.value })} placeholder="120" /></Field>
        <Field label="PA diastólica"><input className="hms-input" inputMode="numeric" value={v.diastolic} onChange={(e) => setV({ ...v, diastolic: e.target.value })} placeholder="80" /></Field>
        <Field label="Freq. cardíaca (bpm)"><input className="hms-input" inputMode="numeric" value={v.heart_rate} onChange={(e) => setV({ ...v, heart_rate: e.target.value })} placeholder="78" /></Field>
        <Field label="Temperatura (°C)"><input className="hms-input" inputMode="decimal" value={v.temperature} onChange={(e) => setV({ ...v, temperature: e.target.value })} placeholder="36.7" /></Field>
        <Field label="SpO₂ (%)" className="span-2"><input className="hms-input" inputMode="numeric" value={v.spo2} onChange={(e) => setV({ ...v, spo2: e.target.value })} placeholder="98" /></Field>
      </div>
    </Modal>
  );
}
