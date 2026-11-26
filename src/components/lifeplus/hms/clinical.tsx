import { useMemo, useRef, useState } from "react";
import {
  Activity, BookOpenCheck, CalendarClock, CheckCircle2, ClipboardList, FlaskConical,
  ImagePlus, Microscope, NotebookPen, Paperclip, Plus, Save, Stethoscope, Trash2, X,
} from "lucide-react";
import {
  hdb, EXAM_CATS, EXAM_STATUS, fDate, fDateTime, lpUrl, uploadLp,
  type Exam, type RecordRow,
} from "./core";
import { useHms } from "./data";
import { PatientSelect, StaffSelect } from "./pickers";
import { Avatar, Banner, Btn, Card, Chip, Empty, Field, Kpi, Modal, Page, SearchInput, Table, Drawer, CopyBtn } from "./ui";
import { labelRecord, RecordComposer } from "./patients";

/* ============================ PRONTUÁRIOS ============================ */

export function RecordsModule() {
  const { data, patientById, staffById, go, can } = useHms();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [compose, setCompose] = useState<string | null>(null);
  const [openRecord, setOpenRecord] = useState<RecordRow | null>(null);
  const records = useMemo(() => (data.records as RecordRow[]).filter((r) => {
    if (kind && r.kind !== kind) return false;
    const p = patientById(r.patient_id);
    return !q.trim() || [p?.full_name, p?.code, r.body, staffById(r.staff_id ?? undefined)?.full_name].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  }), [data.records, kind, q, patientById, staffById]);

  const withRecords = new Set(records.map((r) => r.patient_id)).size;

  return (
    <Page eyebrow="Prontuário eletrônico" title="Prontuários" sub="Histórico clínico completo, com registros datados, assinados e preservados. Correções geram nova entrada, nunca apagam a anterior."
      actions={can("records") ? <Btn icon={Plus} onClick={() => setCompose("")}>Novo registro</Btn> : undefined}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Registros" value={records.length} note="entradas clínicas" icon={NotebookPen} tone="brand" />
        <Kpi label="Pacientes com prontuário" value={withRecords} note="histórico ativo" icon={BookOpenCheck} tone="ok" />
        <Kpi label="Evoluções" value={data.records.filter((r) => r.kind === "evolucao").length} note="acompanhamentos" icon={Activity} />
        <Kpi label="Correções" value={data.records.filter((r) => r.kind === "correcao").length} note="histórico preservado" icon={ClipboardList} tone="warn" />
      </div>
      <Card noBody>
        <div className="hms-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar por paciente, código ou conteúdo…" />
          <select className="hms-select" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos os tipos</option>{["anamnese", "evolucao", "avaliacao", "diagnostico", "conduta", "observacao", "correcao"].map((k) => <option key={k} value={k}>{labelRecord(k)}</option>)}</select>
          <span className="push hms-code">{records.length} registros</span>
        </div>
        {records.length === 0 ? <Empty icon={NotebookPen} title="Nenhum registro clínico" children="Selecione um paciente e registre a primeira evolução." action={<Btn icon={Plus} onClick={() => setCompose("")}>Novo registro</Btn>} /> : (
          <Table head={<tr><th>Paciente</th><th>Tipo</th><th>Registro</th><th>Profissional</th><th>Data</th><th /></tr>}>
            {records.slice(0, 200).map((r) => {
              const p = patientById(r.patient_id);
              return (
                <tr key={r.id} className="is-clickable" onClick={() => setOpenRecord(r)}>
                  <td><div className="flex items-center gap-2"><Avatar name={p?.full_name} size={26} /><div><div className="strong truncate">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code}</div></div></div></td>
                  <td><Chip tone={r.kind === "correcao" ? "warn" : "brand"}>{labelRecord(r.kind)}</Chip></td>
                  <td className="muted max-w-[380px]"><div className="truncate">{r.body}</div></td>
                  <td className="muted">{staffById(r.staff_id ?? undefined)?.full_name ?? "—"}</td>
                  <td className="muted whitespace-nowrap">{fDateTime(r.created_at)}</td>
                  <td><button className="hms-btn ghost sm" onClick={(e) => { e.stopPropagation(); go("patients", { patientId: r.patient_id }); }}>Prontuário</button></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {compose !== null && (
        <ComposeRecord onClose={() => setCompose(null)} presetPatientId={compose} />
      )}
      {openRecord && (
        <Drawer title="Registro clínico" sub={`${patientById(openRecord.patient_id)?.full_name} · ${fDateTime(openRecord.created_at)}`} onClose={() => setOpenRecord(null)}
          footer={<><Chip tone="brand">{labelRecord(openRecord.kind)}</Chip><div className="ml-auto flex gap-2"><CopyBtn text={openRecord.body} /><Btn variant="ghost" onClick={() => { go("patients", { patientId: openRecord.patient_id }); setOpenRecord(null); }}>Abrir prontuário</Btn></div></>}>
          <div className="hms-timeline">
            <div className="hms-tl-item is-record">
              <div className="hms-tl-meta">{fDateTime(openRecord.created_at)} · {staffById(openRecord.staff_id ?? undefined)?.full_name ?? "equipe"}{openRecord.specialty ? ` · ${openRecord.specialty}` : ""}</div>
              <p className="mt-1 whitespace-pre-wrap text-[13px]">{openRecord.body}</p>
              {Object.entries(openRecord.data ?? {}).filter(([, v]) => v).map(([k, v]) => <div key={k} className="mt-2"><div className="hms-section-label">{k}</div><div className="text-[12.5px]">{String(v)}</div></div>)}
            </div>
          </div>
        </Drawer>
      )}
    </Page>
  );
}

function ComposeRecord({ onClose, presetPatientId }: { onClose: () => void; presetPatientId?: string }) {
  const { data, reload } = useHms();
  const [patientId, setPatientId] = useState(presetPatientId ?? "");
  const [formOpen, setFormOpen] = useState(!!presetPatientId);
  return (
    <>
      {!formOpen && (
        <Modal slim title="Novo registro clínico" onClose={onClose}
          footer={<><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn disabled={!patientId} onClick={() => setFormOpen(true)}>Continuar</Btn></div></>}>
          <Field label="Paciente"><PatientSelect patients={data.patients} value={patientId} onChange={setPatientId} /></Field>
        </Modal>
      )}
      {formOpen && patientId && <RecordComposer patientId={patientId} onClose={onClose} onDone={async () => { await reload(); }} />}
    </>
  );
}

/* ============================ DIAGNÓSTICOS ============================ */

const SEVERITY = ["Leve", "Moderada", "Grave"];

export function DiagnosesModule() {
  const { data, patientById, staffById, reload, can } = useHms();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [detail, setDetail] = useState<RecordRow | null>(null);
  const diags = data.records.filter((r) => r.kind === "diagnostico") as RecordRow[];
  const list = diags.filter((r) => {
    const p = patientById(r.patient_id);
    return !q.trim() || [p?.full_name, p?.code, r.body, JSON.stringify(r.data)].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  });
  const top = useMemo(() => {
    const count = new Map<string, number>();
    diags.forEach((d) => { const name = String((d.data as Record<string, unknown>)?.principal ?? d.body.split("\n")[0]); count.set(name, (count.get(name) ?? 0) + 1); });
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [diags]);

  return (
    <Page eyebrow="Diagnóstico clínico" title="Diagnósticos" sub="Diagnóstico principal, secundários e hipóteses vinculados ao prontuário e ao atendimento."
      actions={<><Btn variant="ghost" icon={BookOpenCheck} onClick={() => setCatalogOpen(true)}>Catálogo RP</Btn><Btn icon={Plus} onClick={() => setOpen(true)} disabled={!can("diagnoses")}>Novo diagnóstico</Btn></>}>
      <div className="hms-split mb-3 items-start">
        <div className="hms-cols-3 hms-grid">
          <Kpi label="Diagnósticos" value={diags.length} note="registrados" icon={Stethoscope} tone="brand" />
          <Kpi label="Pacientes" value={new Set(diags.map((d) => d.patient_id)).size} note="com diagnóstico" icon={Activity} />
          <Kpi label="Catálogo" value={data.catalog.length} note="diagnósticos fictícios" icon={BookOpenCheck} tone="ok" />
        </div>
        <Card title="Mais frequentes" sub="No universo Life+ RP">
          {top.length ? top.map(([name, n]) => <div key={name} className="flex items-center justify-between border-b border-[var(--h-line)] py-1.5 text-[12px] last:border-0"><span className="truncate">{name}</span><Chip tone="brand">{n}</Chip></div>) : <div className="text-[12px] text-[var(--h-muted)]">Sem diagnósticos registrados.</div>}
        </Card>
      </div>
      <Card noBody>
        <div className="hms-toolbar"><SearchInput value={q} onChange={setQ} placeholder="Buscar diagnóstico, paciente ou código…" /><span className="push hms-code">{list.length} registros</span></div>
        {list.length === 0 ? <Empty icon={Stethoscope} title="Nenhum diagnóstico" children="Registre o primeiro diagnóstico de roleplay e ele aparecerá no prontuário." action={<Btn icon={Plus} onClick={() => setOpen(true)}>Novo diagnóstico</Btn>} /> : (
          <Table head={<tr><th>Paciente</th><th>Diagnóstico principal</th><th>Secundários</th><th>Profissional</th><th>Data</th><th /></tr>}>
            {list.map((r) => {
              const p = patientById(r.patient_id); const d = (r.data ?? {}) as Record<string, unknown>;
              const sec = Array.isArray(d.secundarios) ? (d.secundarios as string[]) : [];
              return (
                <tr key={r.id} className="is-clickable" onClick={() => setDetail(r)}>
                  <td><div className="flex items-center gap-2"><Avatar name={p?.full_name} size={26} /><div><div className="strong">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code}</div></div></div></td>
                  <td><div className="strong">{String(d.principal ?? r.body.slice(0, 60))}</div><div className="hms-code">{String(d.codigo ?? "")}</div></td>
                  <td className="muted">{sec.length ? sec.join(", ") : "—"}</td>
                  <td className="muted">{staffById(r.staff_id ?? undefined)?.full_name ?? "—"}</td>
                  <td className="muted whitespace-nowrap">{fDate(r.created_at)}</td>
                  <td><button className="hms-btn ghost sm" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>Abrir</button></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {open && <DiagnosisForm onClose={() => { setOpen(false); void reload(); }} />}
      {catalogOpen && <CatalogModal onClose={() => setCatalogOpen(false)} />}
      {detail && (
        <Modal title="Diagnóstico" sub={`${patientById(detail.patient_id)?.full_name} · ${fDateTime(detail.created_at)}`} onClose={() => setDetail(null)} footer={<Btn variant="ghost" onClick={() => setDetail(null)}>Fechar</Btn>}>
          <div className="hms-grid hms-cols-2">
            {Object.entries(detail.data ?? {}).map(([k, v]) => (
              <div key={k} className={k === "descricao" || k === "sintomas" ? "col-span-2" : ""}>
                <div className="hms-section-label">{k}</div>
                <div className="mt-1 text-[12.5px]">{Array.isArray(v) ? (v as string[]).join(", ") || "—" : String(v || "—")}</div>
              </div>
            ))}
            <div className="col-span-2"><div className="hms-section-label">Registro no prontuário</div><p className="mt-1 whitespace-pre-wrap text-[12.5px]">{detail.body}</p></div>
          </div>
        </Modal>
      )}
    </Page>
  );
}

function DiagnosisForm({ onClose }: { onClose: () => void }) {
  const { data, me, reload } = useHms();
  const [f, setF] = useState({ patientId: "", staffId: "", appointmentId: "", principal: "", codigo: "", secundarios: [] as string[], hipoteses: "", descricao: "", sintomas: "", observacoes: "", gravidade: "Moderada" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const appts = data.appointments.filter((a) => a.patient_id === f.patientId).slice(0, 10);

  const save = async () => {
    if (!f.patientId || !f.principal.trim()) { setErr("Selecione o paciente e informe o diagnóstico principal."); return; }
    setBusy(true); setErr(null);
    const body = [
      `Diagnóstico principal: ${f.principal}${f.codigo ? ` (${f.codigo})` : ""}`,
      f.secundarios.length ? `Diagnósticos secundários: ${f.secundarios.join(", ")}` : "",
      f.hipoteses ? `Hipóteses: ${f.hipoteses}` : "",
      f.sintomas ? `Sintomas: ${f.sintomas}` : "",
      f.descricao ? `\n${f.descricao}` : "",
      f.observacoes ? `\nObservações: ${f.observacoes}` : "",
    ].filter(Boolean).join("\n");
    const res = await hdb.from("lp_records").insert({
      patient_id: f.patientId, staff_id: f.staffId || me?.id || null, appointment_id: f.appointmentId || null,
      kind: "diagnostico", specialty: data.staff.find((s) => s.id === f.staffId)?.specialty ?? null, body,
      data: { principal: f.principal, codigo: f.codigo, secundarios: f.secundarios, hipoteses: f.hipoteses, sintomas: f.sintomas, descricao: f.descricao, observacoes: f.observacoes, gravidade: f.gravidade },
    });
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); onClose();
  };

  return (
    <Modal wide title="Novo diagnóstico" sub="Vinculado automaticamente ao prontuário do paciente." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Diagnósticos são fictícios e exclusivos do RP.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Stethoscope} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Registrar diagnóstico"}</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Paciente *" className="span-2"><PatientSelect patients={data.patients} value={f.patientId} onChange={(id) => set({ patientId: id })} /></Field>
        <Field label="Profissional"><StaffSelect staff={data.staff} value={f.staffId} onChange={(id) => set({ staffId: id })} roles={["medico", "enfermeiro", "diretor"]} /></Field>
        <Field label="Atendimento vinculado">
          <select className="hms-select" value={f.appointmentId} onChange={(e) => set({ appointmentId: e.target.value })}>
            <option value="">Sem vínculo</option>
            {appts.map((a) => <option key={a.id} value={a.id}>{a.code} · {fDate(a.starts_at)}</option>)}
          </select>
        </Field>
        <Field label="Diagnóstico principal *">
          <input list="lifeplus-diag" className="hms-input" value={f.principal} onChange={(e) => { const name = e.target.value; const hit = data.catalog.find((c) => c.name === name); set({ principal: name, codigo: hit?.code ?? f.codigo }); }} placeholder="Ex.: Crise asmática" />
          <datalist id="lifeplus-diag">{data.catalog.map((c) => <option key={c.id} value={c.name}>{c.code}</option>)}</datalist>
        </Field>
        <Field label="Código fictício"><input className="hms-input" value={f.codigo} onChange={(e) => set({ codigo: e.target.value })} placeholder="RP-R03" /></Field>
        <Field label="Diagnósticos secundários" hint="Digite e pressione Enter." className="span-2">
          <input className="hms-input" onKeyDown={(e) => { if (e.key !== "Enter") return; const v = (e.target as HTMLInputElement).value.trim(); if (v) set({ secundarios: [...f.secundarios, v] }); (e.target as HTMLInputElement).value = ""; }} placeholder={f.secundarios.length ? f.secundarios.join(", ") : "Adicionar secundário"} />
          {f.secundarios.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{f.secundarios.map((s) => <Chip key={s} tone="brand">{s}<button onClick={() => set({ secundarios: f.secundarios.filter((x) => x !== s) })}><X className="h-3 w-3" /></button></Chip>)}</div>}
        </Field>
        <Field label="Gravidade"><select className="hms-select" value={f.gravidade} onChange={(e) => set({ gravidade: e.target.value })}>{SEVERITY.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Hipóteses diagnósticas"><input className="hms-input" value={f.hipoteses} onChange={(e) => set({ hipoteses: e.target.value })} /></Field>
        <Field label="Sintomas" className="span-2"><input className="hms-input" value={f.sintomas} onChange={(e) => set({ sintomas: e.target.value })} placeholder="Dispneia, sibilância, tosse seca…" /></Field>
        <Field label="Descrição" className="span-2"><textarea className="hms-textarea" rows={3} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Field>
        <Field label="Observações" className="span-2"><textarea className="hms-textarea" rows={2} value={f.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function CatalogModal({ onClose }: { onClose: () => void }) {
  const { data, reload, can } = useHms();
  const [f, setF] = useState({ code: "", name: "", category: "" });
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    if (!f.name.trim()) return;
    const res = await hdb.from("lp_diagnosis_catalog").insert({ code: f.code.trim() || `RP-${f.name.slice(0, 2).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`, name: f.name.trim(), category: f.category || null });
    if (res.error) { setErr(res.error.message); return; }
    setF({ code: "", name: "", category: "" }); await reload();
  };
  return (
    <Modal title="Catálogo de diagnósticos RP" sub="Diagnósticos fictícios usados no roleplay da Life+." onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>Fechar</Btn>}>
      {can("diagnoses") && (
        <div className="mb-3 grid gap-2 sm:grid-cols-[110px_1fr_150px_auto]">
          <input className="hms-input" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="RP-XXX" />
          <input className="hms-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nome do diagnóstico" />
          <input className="hms-input" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Categoria" />
          <Btn icon={Plus} onClick={() => void add()}>Adicionar</Btn>
        </div>
      )}
      {err && <div className="mb-2"><Banner tone="error">{err}</Banner></div>}
      <Table head={<tr><th>Código</th><th>Diagnóstico</th><th>Categoria</th></tr>}>
        {data.catalog.map((c) => <tr key={c.id}><td className="hms-code">{c.code}</td><td className="strong">{c.name}</td><td className="muted">{c.category ?? "—"}</td></tr>)}
      </Table>
    </Modal>
  );
}

/* ============================ EXAMES ============================ */

const EXAM_PRESETS: Record<string, string[]> = {
  Laboratoriais: ["Hemograma completo", "Glicemia de jejum", "Perfil lipídico", "Função renal", "Função hepática", "Urina tipo 1", "Gasometria arterial"],
  Imagem: ["Raio-X de tórax", "Raio-X de membro", "Ultrassom abdominal", "Tomografia de crânio", "Ressonância magnética"],
  Cardiológicos: ["ECG de repouso", "Ecocardiograma", "Holter 24h", "Teste ergométrico"],
  Neurológicos: ["EEG", "Tomografia de crânio", "Ressonância de encéfalo"],
  Outros: ["Teste alérgico", "Audiometria", "Espirometria"],
};

export function ExamsModule() {
  const { data, focus, patientById, staffById, reload, can, go } = useHms();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState(!!focus.patientId);
  const [detail, setDetail] = useState<Exam | null>(null);
  const list = data.exams.filter((e) => {
    if (status && e.status !== status) return false;
    if (cat && e.category !== cat) return false;
    const p = patientById(e.patient_id);
    return !q.trim() || [e.kind, p?.full_name, p?.code, e.result, e.justification].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  });

  return (
    <Page eyebrow="Diagnóstico por imagem e laboratório" title="Exames" sub="Solicitação, agendamento, execução e laudo — com anexos de imagens e PDFs."
      actions={can("exams") ? <Btn icon={Plus} onClick={() => setOpen(true)}>Solicitar exame</Btn> : undefined}>
      <div className="hms-cols-4 hms-grid mb-3">
        <Kpi label="Solicitados" value={data.exams.filter((e) => e.status === "solicitado").length} note="aguardando coleta" icon={FlaskConical} tone="warn" />
        <Kpi label="Em andamento" value={data.exams.filter((e) => ["andamento", "coletado", "agendado"].includes(e.status)).length} note="em execução" icon={Microscope} tone="brand" />
        <Kpi label="Concluídos" value={data.exams.filter((e) => ["concluido", "laudo"].includes(e.status)).length} note="com resultado" icon={CheckCircle2} tone="ok" />
        <Kpi label="Pendentes hoje" value={data.exams.filter((e) => e.status === "solicitado" && new Date(e.requested_at).toDateString() === new Date().toDateString()).length} note="solicitados hoje" icon={CalendarClock} />
      </div>
      <Card noBody>
        <div className="hms-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Exame, paciente ou laudo…" />
          <select className="hms-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.entries(EXAM_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select className="hms-select" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas as categorias</option>{EXAM_CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <span className="push hms-code">{list.length} exames</span>
        </div>
        {list.length === 0 ? <Empty icon={FlaskConical} title="Nenhum exame encontrado" children="Solicite um exame para um paciente da Life+." action={<Btn icon={Plus} onClick={() => setOpen(true)}>Solicitar exame</Btn>} /> : (
          <Table head={<tr><th>Paciente</th><th>Exame</th><th>Categoria</th><th>Solicitado</th><th>Status</th><th>Resultado</th><th /></tr>}>
            {list.map((e) => {
              const p = patientById(e.patient_id);
              return (
                <tr key={e.id} className="is-clickable" onClick={() => setDetail(e)}>
                  <td><div className="strong truncate">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code}</div></td>
                  <td>{e.kind}</td>
                  <td className="muted">{e.category}</td>
                  <td className="muted whitespace-nowrap">{fDate(e.requested_at)}</td>
                  <td><Chip tone={["concluido", "laudo"].includes(e.status) ? "ok" : e.status === "cancelado" ? "vital" : "warn"}>{e.status}</Chip></td>
                  <td className="muted max-w-[220px] truncate">{e.result ?? "—"}</td>
                  <td><button className="hms-btn ghost sm" onClick={(ev) => { ev.stopPropagation(); setDetail(e); }}>Abrir</button></td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {open && <ExamForm presetPatientId={focus.patientId} onClose={() => { setOpen(false); void reload(); }} />}
      {detail && <ExamDrawer exam={detail} onClose={() => setDetail(null)} onGoPatient={(id) => { setDetail(null); go("patients", { patientId: id }); }} />}
    </Page>
  );
}

function ExamForm({ presetPatientId, onClose }: { presetPatientId?: string; onClose: () => void }) {
  const { data, me, reload } = useHms();
  const [f, setF] = useState({ patientId: presetPatientId ?? "", staffId: "", category: "Laboratoriais", kinds: [] as string[], justification: "", scheduled: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!f.patientId || !f.kinds.length) { setErr("Selecione o paciente e ao menos um exame."); return; }
    setBusy(true); setErr(null);
    const rows = f.kinds.map((k) => ({
      patient_id: f.patientId, staff_id: f.staffId || me?.id || null, kind: k, category: f.category,
      justification: f.justification || null, notes: f.notes || null, scheduled_for: f.scheduled ? new Date(f.scheduled).toISOString() : null,
      status: f.scheduled ? "agendado" : "solicitado",
    }));
    const res = await hdb.from("lp_exams").insert(rows);
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); onClose();
  };
  return (
    <Modal wide title="Solicitar exames" sub="Um pedido pode conter vários exames da mesma categoria." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Exames fictícios de roleplay.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={FlaskConical} disabled={busy} onClick={() => void save()}>{busy ? "Solicitando…" : `Solicitar ${f.kinds.length || ""}`}</Btn></div></>}>
      {err && <div className="mb-3"><Banner tone="error">{err}</Banner></div>}
      <div className="hms-form-grid">
        <Field label="Paciente *"><PatientSelect patients={data.patients} value={f.patientId} onChange={(id) => set({ patientId: id })} /></Field>
        <Field label="Solicitante"><StaffSelect staff={data.staff} value={f.staffId} onChange={(id) => set({ staffId: id })} roles={["medico", "enfermeiro", "diretor"]} /></Field>
        <Field label="Categoria"><select className="hms-select" value={f.category} onChange={(e) => set({ category: e.target.value, kinds: [] })}>{EXAM_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Agendamento (opcional)"><input type="datetime-local" className="hms-input" value={f.scheduled} onChange={(e) => set({ scheduled: e.target.value })} /></Field>
        <div className="span-2">
          <div className="hms-section-label">Exames ({f.kinds.length} selecionados)</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(EXAM_PRESETS[f.category] ?? []).map((k) => {
              const on = f.kinds.includes(k);
              return <button key={k} className={`hms-chip ${on ? "brand" : "outline"}`} onClick={() => set({ kinds: on ? f.kinds.filter((x) => x !== k) : [...f.kinds, k] })}>{on && <CheckCircle2 />}{k}</button>;
            })}
          </div>
          <Field label="Outro exame" hint="Enter para adicionar." className="mt-3">
            <input className="hms-input" onKeyDown={(e) => { if (e.key !== "Enter") return; const v = (e.target as HTMLInputElement).value.trim(); if (v) set({ kinds: [...f.kinds, v] }); (e.target as HTMLInputElement).value = ""; }} />
          </Field>
          {f.kinds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{f.kinds.map((k) => <Chip key={k} tone="brand">{k}<button onClick={() => set({ kinds: f.kinds.filter((x) => x !== k) })}><X className="h-3 w-3" /></button></Chip>)}</div>}
        </div>
        <Field label="Justificativa" className="span-2"><textarea className="hms-textarea" rows={3} value={f.justification} onChange={(e) => set({ justification: e.target.value })} /></Field>
        <Field label="Observações" className="span-2"><input className="hms-input" value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ExamDrawer({ exam, onClose, onGoPatient }: { exam: Exam; onClose: () => void; onGoPatient: (id: string) => void }) {
  const { data, patientById, staffById, reload } = useHms();
  const [result, setResult] = useState(exam.result ?? "");
  const [notes, setNotes] = useState(exam.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attach, setAttach] = useState<{ path: string; name: string }[]>(() => (Array.isArray(exam.attachments) ? exam.attachments : []));
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const p = patientById(exam.patient_id); const s = staffById(exam.staff_id ?? undefined);
  const patch = async (p2: Record<string, unknown>) => { await hdb.from("lp_exams").update(p2).eq("id", exam.id); await reload(); };

  const upload = async (file: File) => {
    setUploading(true); setErr(null);
    try {
      const path = await uploadLp(file, `exames/${exam.id}`);
      const next = [...attach, { path, name: file.name }];
      setAttach(next);
      await patch({ attachments: next });
    } catch (e) { setErr(e instanceof Error ? e.message : "Falha no upload."); }
    finally { setUploading(false); }
  };
  const openAttachment = async (path: string) => {
    const url = await lpUrl(path);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <Drawer title={`Exame · ${exam.kind}`} sub={`${p?.full_name ?? "Paciente"} · ${fDate(exam.requested_at)} · ${exam.category}`} onClose={onClose}
      footer={<><Chip tone={["concluido", "laudo"].includes(exam.status) ? "ok" : "warn"}>{EXAM_STATUS[exam.status] ?? exam.status}</Chip><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={() => onGoPatient(exam.patient_id)}>Prontuário</Btn><Btn icon={CheckCircle2} disabled={busy || !result.trim()} onClick={async () => { setBusy(true); await patch({ result, notes, status: "concluido", completed_at: new Date().toISOString() }); setBusy(false); onClose(); }}>{busy ? "Salvando…" : "Concluir exame"}</Btn></div></>}>
      <div className="hms-grid hms-cols-3 mb-4">
        <div><div className="hms-section-label">Solicitante</div><div className="mt-1 text-[12.5px] font-medium">{s?.full_name ?? "—"}</div></div>
        <div><div className="hms-section-label">Status</div><div className="mt-1">
          <select className="hms-select" value={exam.status} onChange={(e) => void patch({ status: e.target.value, completed_at: e.target.value === "concluido" ? new Date().toISOString() : null })}>
            {Object.entries(EXAM_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div></div>
        <div><div className="hms-section-label">Concluído em</div><div className="mt-1 text-[12.5px]">{exam.completed_at ? fDateTime(exam.completed_at) : "—"}</div></div>
      </div>
      <Field label="Justificativa"><p className="text-[12.5px]">{exam.justification || "—"}</p></Field>
      <div className="mt-3"><Field label="Resultado / laudo"><textarea className="hms-textarea" rows={6} value={result} onChange={(e) => setResult(e.target.value)} placeholder="Descreva os achados do exame fictício…" /></Field></div>
      <div className="mt-3"><Field label="Observações técnicas"><input className="hms-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field></div>
      <div className="mt-3 flex items-center gap-2"><Btn size="sm" variant="ghost" icon={Save} disabled={busy} onClick={async () => { setBusy(true); await patch({ result, notes }); setBusy(false); }}>Salvar parcial</Btn></div>

      <div className="mt-4 border-t border-[var(--h-line)] pt-3">
        <div className="flex items-center justify-between"><div className="hms-section-label">Anexos ({attach.length})</div><Btn size="sm" variant="ghost" icon={ImagePlus} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Enviando…" : "Anexar imagem/PDF"}</Btn></div>
        <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} />
        {err && <div className="mt-2"><Banner tone="error">{err}</Banner></div>}
        <div className="mt-2 space-y-1.5">
          {attach.map((a) => (
            <div key={a.path} className="flex items-center gap-2 rounded-lg border border-[var(--h-line)] px-2.5 py-1.5 text-[12px]">
              <Paperclip className="h-3.5 w-3.5 text-[var(--h-faint)]" />
              <button className="min-w-0 flex-1 truncate text-left hover:text-[var(--h-brand)]" onClick={() => void openAttachment(a.path)}>{a.name}</button>
              <button className="text-[var(--h-faint)] hover:text-[var(--h-vital)]" onClick={async () => { const next = attach.filter((x) => x.path !== a.path); setAttach(next); await patch({ attachments: next }); }}><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {!attach.length && <div className="text-[11.5px] text-[var(--h-muted)]">Nenhum anexo. Envie imagens ou PDFs do exame fictício.</div>}
        </div>
      </div>
      <p className="mt-3 text-[10.5px] text-[var(--h-faint)]">Solicitado em {fDateTime(exam.requested_at)} · {data.settings.name} RP.</p>
    </Drawer>
  );
}

