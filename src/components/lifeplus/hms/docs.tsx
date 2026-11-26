import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, ArchiveRestore, CalendarRange, CheckCircle2, ClipboardList, Copy, Download, Eye, FilePlus2,
  FileSignature, FileText, FlaskConical, FolderOpen, HeartPulse, LayoutTemplate, Lock, Microscope, Pencil,
  Pill, Plus, Printer, Save, ShieldCheck, Stethoscope, Trash2, X, type LucideIcon,
} from "lucide-react";
import {
  fDate, fillVars, hdb, type DocRow, type Patient, type Settings, type Staff, type Template,
} from "./core";
import { useHms } from "./data";
import { PatientSelect, StaffSelect } from "./pickers";
import { Banner, Btn, Card, Chip, Empty, Field, Modal, Page, SearchInput, Tabs, Table } from "./ui";
import {
  buildPaperModel, buildVars, calloutFromData, DEFAULT_BODIES, DEFAULT_STYLE, DISCLAIMER, DOC_CATEGORIES,
  DOC_KINDS, DOC_TEMPLATE_KIND, EMPTY_MED, EXAM_CATS, EXAM_PRESETS, examsToText, medsToText, pairsFromData,
  readPaperStyle, RECEITA_TYPES, resolveBody, sectionsFromData, stripMedBlock, toStylePayload,
  type MedLine, type PaperModel, type PaperStyle,
} from "./paper/model";
import { DocPreviewModal, DocStage } from "./paper/viewer";
import { downloadPdf, printPdf } from "./paper/render";

export { EMPTY_MED, DOC_KINDS, DOC_TEMPLATE_KIND, DISCLAIMER, type MedLine };
export type { PaperModel };

/* ------------------------------------------------------------------ */
/*  Formulário                                                         */
/* ------------------------------------------------------------------ */

export type DocForm = {
  id?: string; code?: string | null; status: string; kind: string; templateId: string;
  patientId: string; staffId: string; title: string; specialty: string;
  date: string; time: string; days: string; startDate: string; endDate: string;
  text: string; notes: string; meds: MedLine[]; orientation: string; prescriptionType: string;
  exams: string[]; justification: string; category: string; referral: string; body: string;
  /* estruturas por tipo */
  entryTime: string; exitTime: string; addressee: string;
  examType: string; examDate: string; description: string; result: string; conclusion: string;
  reason: string; history: string; evaluation: string; diagnosis: string; procedures: string;
  evolution: string; finalNotes: string; observations: string;
  admissionDate: string; dischargeDate: string; hospitalDays: string; responsible: string;
  condition: string; instructions: string; followUp: string;
  version?: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

export function emptyForm(kind: string, staffId = "", patientId = ""): DocForm {
  return {
    status: "rascunho", kind, templateId: "", patientId, staffId, title: DOC_KINDS[kind] ?? "Documento",
    specialty: "", date: today(), time: nowTime(), days: "1", startDate: today(), endDate: today(),
    text: "", notes: "", meds: [{ ...EMPTY_MED }], orientation: "", prescriptionType: "simples",
    exams: [], justification: "", category: "Laboratoriais", referral: "", body: "",
    entryTime: nowTime(), exitTime: "", addressee: "",
    examType: "", examDate: today(), description: "", result: "", conclusion: "",
    reason: "", history: "", evaluation: "", diagnosis: "", procedures: "", evolution: "", finalNotes: "", observations: "",
    admissionDate: "", dischargeDate: today(), hospitalDays: "", responsible: "", condition: "", instructions: "", followUp: "",
    version: 1,
  };
}

function formFromDoc(d: DocRow): DocForm {
  const data = (d.data ?? {}) as Record<string, unknown>;
  const get = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
  const base = emptyForm(d.kind, (data.staffId as string) ?? "", d.patient_id ?? "");
  return {
    ...base,
    id: d.id, code: d.code, status: d.status, kind: d.kind, templateId: (data.templateId as string) ?? "",
    patientId: d.patient_id ?? "", staffId: d.staff_id ?? base.staffId, title: d.title,
    specialty: get("specialty"), date: get("date") || today(), time: get("time") || nowTime(),
    days: get("days") || "1", startDate: get("startDate") || today(), endDate: get("endDate") || today(),
    text: get("text"), notes: get("notes"),
    meds: Array.isArray(data.meds) && (data.meds as MedLine[]).length ? (data.meds as MedLine[]) : [{ ...EMPTY_MED }],
    orientation: get("orientation"), prescriptionType: get("prescriptionType") || "simples",
    exams: Array.isArray(data.exams) ? (data.exams as string[]) : [],
    justification: get("justification"), category: get("category") || "Laboratoriais",
    referral: get("referral"), body: get("body") || d.body,
    entryTime: get("entryTime") || get("time"), exitTime: get("exitTime"), addressee: get("addressee"),
    examType: get("examType"), examDate: get("examDate") || today(), description: get("description"),
    result: get("result"), conclusion: get("conclusion"), reason: get("reason"), history: get("history"),
    evaluation: get("evaluation"), diagnosis: get("diagnosis"), procedures: get("procedures"),
    evolution: get("evolution"), finalNotes: get("finalNotes"), observations: get("observations"),
    admissionDate: get("admissionDate"), dischargeDate: get("dischargeDate"), hospitalDays: get("hospitalDays"),
    responsible: get("responsible"), condition: get("condition"), instructions: get("instructions"),
    followUp: get("followUp"), version: typeof data.version === "number" ? data.version : 1,
  };
}

const STRUCTURED = ["relatorio", "laudo", "alta"] as const;

/** Corpo narrativo final (variáveis resolvidas e blocos de posologia removidos). */
function documentBody(form: DocForm, template: Template | null | undefined, vars: Record<string, string>) {
  if (form.kind === "personalizado") return fillVars(form.body || form.text, vars);
  if (form.kind === "receita" || form.kind === "exames") return "";
  if ((STRUCTURED as readonly string[]).includes(form.kind)) {
    return [fillVars(template?.body ?? "", vars), fillVars(form.text, vars)].filter((p) => p.trim()).join("\n\n");
  }
  if (form.kind === "encaminhamento") return fillVars(template?.body?.trim() || form.text, vars);
  return stripMedBlock(resolveBody(form.kind, "", template, { ...vars, "documento.texto": form.text, "documento.medicamentos": medsToText(form.meds), "documento.exames": examsToText(form.exams) }));
}

/** Monta o modelo institucional que alimenta a prévia e o PDF. */
export function modelFromForm(form: DocForm, data: { settings: Settings }, patient: Patient | null | undefined, staff: Staff | null | undefined, template: Template | null | undefined): PaperModel {
  const date = form.date ? fDate(form.date) : fDate(new Date().toISOString());
  const vars = buildVars(patient, staff, data.settings, {
    "documento.data_emissao": date,
    "documento.codigo": form.code ?? "",
    "documento.dias": form.days || "1",
    "documento.inicio": form.startDate ? fDate(form.startDate) : "",
    "documento.fim": form.endDate ? fDate(form.endDate) : "",
    "documento.horario": form.time || "",
    "documento.texto": form.text,
    "documento.medicamentos": medsToText(form.meds),
    "documento.exames": examsToText(form.exams),
    "documento.justificativa": form.justification,
    "documento.especialidade": form.referral || form.specialty,
  });
  const meta = form as unknown as Record<string, unknown>;
  const meds = form.meds.filter((m) => m.name.trim());

  return buildPaperModel({
    kind: form.kind,
    title: form.title || DOC_KINDS[form.kind] || "Documento",
    code: form.code,
    status: form.status,
    dateISO: form.date,
    emittedAt: form.status === "finalizado" ? form.date : undefined,
    body: documentBody(form, template, vars),
    template,
    settings: data.settings,
    patient,
    staff,
    meds: form.kind === "receita" ? meds : undefined,
    orientation: form.kind === "receita" ? stripMedBlock(fillVars(form.orientation || form.text, vars)) : undefined,
    exams: form.kind === "exames" ? form.exams.map((name) => ({ name, category: form.category })) : undefined,
    justification: form.kind === "exames" ? fillVars(form.justification, vars) : undefined,
    observations: form.kind === "exames" ? fillVars(form.observations, vars) : undefined,
    pairs: pairsFromData(form.kind, meta),
    sections: sectionsFromData(form.kind, meta).map((s) => ({ ...s, text: fillVars(s.text, vars) })),
    callout: (() => {
      const c = calloutFromData(form.kind, meta);
      return c ? { ...c, text: fillVars(c.text, vars) } : null;
    })(),
    templateName: template?.name ?? null,
  });
}

/* ------------------------------------------------------------------ */
/*  Estúdio de documento                                               */
/* ------------------------------------------------------------------ */

export function DocumentStudio({ presetKind = "atestado", presetPatientId, presetDocId, onSaved }: {
  presetKind?: string; presetPatientId?: string; presetDocId?: string; onSaved?: (d: DocRow) => void;
}) {
  const { data, role, reload, go } = useHms();
  const [form, setForm] = useState<DocForm>(() => emptyForm(presetKind, "", presetPatientId ?? ""));
  const [loadedPreset, setLoadedPreset] = useState(false);
  const [busy, setBusy] = useState<"rascunho" | "finalizado" | "pdf" | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const [dirtyKind, setDirtyKind] = useState(presetKind);
  const patient = data.patients.find((p) => p.id === form.patientId) ?? null;
  const staff = data.staff.find((s) => s.id === form.staffId) ?? null;
  const kindTemplateKey = DOC_TEMPLATE_KIND[form.kind] ?? form.kind;
  const kindTemplates = data.templates.filter((t) => !t.archived && (t.kind === kindTemplateKey || t.kind === form.kind));
  const template = data.templates.find((t) => t.id === form.templateId)
    ?? kindTemplates.find((t) => t.is_default)
    ?? kindTemplates[0];
  const canFinalize = !!role && ["administrador", "diretor", "medico"].includes(role);
  const finalized = form.status === "finalizado";

  /* preset de outro módulo (paciente, tipo ou documento existente) */
  useEffect(() => {
    if (presetDocId && !loadedPreset) {
      const d = data.docs.find((x) => x.id === presetDocId);
      if (d) { setForm(formFromDoc(d)); setDirtyKind(d.kind); setLoadedPreset(true); return; }
    }
    if (presetKind !== dirtyKind) {
      setForm((f) => ({ ...f, kind: presetKind, title: DOC_KINDS[presetKind] ?? f.title, id: undefined, code: null, status: "rascunho" }));
      setDirtyKind(presetKind);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKind, presetDocId, data.docs.length]);

  /* nova versão de um documento já finalizado (histórico preservado) */
  useEffect(() => {
    if (loadedPreset) return;
    let cloneId: string | null = null;
    try { cloneId = sessionStorage.getItem("lifeplus.doc.clone"); } catch { cloneId = null; }
    if (!cloneId) return;
    const d = data.docs.find((x) => x.id === cloneId);
    try { sessionStorage.removeItem("lifeplus.doc.clone"); } catch { /* ignora */ }
    if (!d) return;
    const base = formFromDoc(d);
    const nextVersion = (base.version ?? 1) + 1;
    setForm({ ...base, id: undefined, code: null, status: "rascunho", version: nextVersion, title: `${d.title.replace(/\s*\(v\d+\)$/, "")} (v${nextVersion})` });
    setDirtyKind(d.kind);
    setLoadedPreset(true);
    setMsg({ tone: "info", text: `Nova versão (v${nextVersion}) criada a partir de ${d.code}. O documento original permanece no acervo.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.docs.length, loadedPreset]);

  useEffect(() => {
    if (presetPatientId && presetPatientId !== form.patientId) setForm((f) => ({ ...f, patientId: presetPatientId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetPatientId]);

  /* texto produzido pela Life+ AI, confirmado pelo usuário */
  useEffect(() => {
    let draft: string | null = null;
    try { draft = sessionStorage.getItem("lifeplus.ai.draft"); } catch { draft = null; }
    if (draft && !form.id && !form.text) {
      setForm((f) => ({ ...f, text: draft as string }));
      try { sessionStorage.removeItem("lifeplus.ai.draft"); } catch { /* ignora */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* modelo padrão por tipo */
  useEffect(() => {
    const first = data.templates.find((t) => !t.archived && (t.kind === kindTemplateKey || t.kind === form.kind));
    setForm((f) => ({ ...f, templateId: f.templateId || first?.id || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.kind, data.templates.length]);

  useEffect(() => {
    if (staff?.specialty) setForm((f) => (f.specialty ? f : { ...f, specialty: staff.specialty ?? "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.staffId]);

  const model = useMemo(() => modelFromForm(form, data, patient, staff, template), [form, data, patient, staff, template]);
  const set = (patch: Partial<DocForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (status: "rascunho" | "finalizado") => {
    if (!form.patientId && !["personalizado", "relatorio"].includes(form.kind)) {
      setMsg({ tone: "error", text: "Selecione o paciente do documento." }); return;
    }
    if (!form.title.trim()) { setMsg({ tone: "error", text: "Informe o título do documento." }); return; }
    setBusy(status); setMsg(null);
    const snapshot = model.blocks
      .map((b) => (b.t === "prose" ? b.text : b.t === "section" ? [b.title, b.text].filter(Boolean).join("\n") : ""))
      .filter(Boolean).join("\n\n");
    const payload = {
      kind: form.kind, template_id: template?.id ?? null, patient_id: form.patientId || null,
      staff_id: form.staffId || null, title: form.title, body: snapshot, status,
      data: { ...form, code: form.code, templateId: template?.id ?? "", body: form.body, version: form.version ?? 1, savedAt: new Date().toISOString() },
    };
    const res = form.id
      ? await hdb.from("lp_documents").update(payload).eq("id", form.id).select("*").single()
      : await hdb.from("lp_documents").insert(payload).select("*").single();
    setBusy(null);
    if (res.error) { setMsg({ tone: "error", text: res.error.message }); return; }
    const doc = res.data as DocRow;
    setForm((f) => ({ ...f, id: doc.id, code: doc.code, status: doc.status }));
    setMsg({ tone: "info", text: status === "finalizado" ? `Documento ${doc.code} finalizado e registrado no acervo.` : `Rascunho ${doc.code} salvo.` });
    await reload();
    onSaved?.(doc);
  };

  const download = async () => {
    setBusy("pdf");
    try { await downloadPdf(model); } catch (e) { setMsg({ tone: "error", text: e instanceof Error ? e.message : "Falha ao gerar PDF." }); }
    finally { setBusy(null); }
  };

  const print = async () => {
    setBusy("pdf");
    try { await printPdf(model); } catch (e) { setMsg({ tone: "error", text: e instanceof Error ? e.message : "Falha ao imprimir." }); }
    finally { setBusy(null); }
  };

  const reset = () => { setForm({ ...emptyForm(form.kind, form.staffId, form.patientId) }); setMsg(null); };

  return (
    <div className="hms-split items-start">
      <div className="hms-stack">
        <Card
          title="Dados do documento"
          sub={`${DOC_KINDS[form.kind] ?? "Documento"} · ${form.code ?? "novo"}`}
          actions={<Chip tone={finalized ? "ok" : "warn"}>{finalized ? "Finalizado" : form.status === "cancelado" ? "Cancelado" : "Rascunho"}</Chip>}
        >
          <div className="hms-form-grid">
            <Field label="Tipo de documento">
              <select className="hms-select" value={form.kind} disabled={!!form.id} onChange={(e) => set({ kind: e.target.value, templateId: "", title: DOC_KINDS[e.target.value] ?? "" })}>
                {Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Modelo Life+" hint={template ? `Padrão: ${template.name}` : "Nenhum modelo — será usado o layout institucional padrão."}>
              <select className="hms-select" value={template?.id ?? ""} onChange={(e) => set({ templateId: e.target.value })}>
                <option value="">— Layout institucional padrão —</option>
                {kindTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_default ? " · padrão" : ""}</option>)}
              </select>
            </Field>
            <Field label="Paciente" className="span-2">
              <PatientSelect patients={data.patients} value={form.patientId} onChange={(id) => set({ patientId: id })} />
            </Field>
            <Field label="Profissional responsável">
              <StaffSelect staff={data.staff} value={form.staffId} onChange={(id) => set({ staffId: id })} roles={["medico", "enfermeiro", "diretor", "administrador"]} />
            </Field>
            <Field label="Especialidade">
              <input className="hms-input" value={form.specialty} onChange={(e) => set({ specialty: e.target.value })} placeholder="Clínica geral" />
            </Field>
            <Field label="Data de emissão"><input type="date" className="hms-input" value={form.date} onChange={(e) => set({ date: e.target.value })} /></Field>
            <Field label="Horário"><input type="time" className="hms-input" value={form.time} onChange={(e) => set({ time: e.target.value })} /></Field>

            {(form.kind === "atestado" || form.kind === "afastamento") && (
              <>
                <Field label="Dias de afastamento"><input type="number" min={0} className="hms-input" value={form.days} onChange={(e) => set({ days: e.target.value })} /></Field>
                <Field label="Observação do atestado"><input className="hms-input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Afastamento a partir do atendimento" /></Field>
                <Field label="Início do afastamento"><input type="date" className="hms-input" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
                <Field label="Término do afastamento"><input type="date" className="hms-input" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
              </>
            )}

            {(form.kind === "declaracao" || form.kind === "acompanhamento") && (
              <>
                <Field label="Horário de entrada"><input type="time" className="hms-input" value={form.entryTime} onChange={(e) => set({ entryTime: e.target.value })} /></Field>
                <Field label="Horário de saída"><input type="time" className="hms-input" value={form.exitTime} onChange={(e) => set({ exitTime: e.target.value })} /></Field>
              </>
            )}

            {form.kind === "receita" && (
              <div className="span-2">
                <Field label="Tipo de receita">
                  <select className="hms-select" value={form.prescriptionType} onChange={(e) => set({ prescriptionType: e.target.value })}>
                    {Object.entries(RECEITA_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <div className="mt-3 flex items-center justify-between">
                  <div className="hms-section-label">Medicamentos ({form.meds.filter((m) => m.name).length})</div>
                  <Btn size="sm" variant="ghost" icon={Plus} onClick={() => set({ meds: [...form.meds, { ...EMPTY_MED }] })}>Adicionar</Btn>
                </div>
                <div className="mt-2 space-y-3">
                  {form.meds.map((m, i) => (
                    <div key={i} className="rounded-xl border border-[var(--h-line)] bg-[var(--h-panel-2)] p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Chip tone="brand">#{i + 1}</Chip>
                        <div className="hms-section-label">Medicamento</div>
                        {form.meds.length > 1 && (
                          <button className="ml-auto text-[var(--h-faint)] hover:text-[var(--h-vital)]" aria-label="Remover medicamento" onClick={() => set({ meds: form.meds.filter((_, j) => j !== i) })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Nome"><input list="lifeplus-meds" className="hms-input" value={m.name} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, name: e.target.value }; set({ meds }); }} placeholder="Ex.: Lifedol" /></Field>
                        <Field label="Concentração"><input className="hms-input" value={m.concentration} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, concentration: e.target.value }; set({ meds }); }} placeholder="500 mg" /></Field>
                        <Field label="Apresentação"><input className="hms-input" value={m.presentation} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, presentation: e.target.value }; set({ meds }); }} placeholder="Comprimido" /></Field>
                        <Field label="Dosagem"><input className="hms-input" value={m.dose} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, dose: e.target.value }; set({ meds }); }} placeholder="1 comprimido" /></Field>
                        <Field label="Via"><select className="hms-select" value={m.route} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, route: e.target.value }; set({ meds }); }}>{["Via oral", "Intravenosa", "Intramuscular", "Subcutânea", "Tópica", "Inalatória", "Sublingual", "Retal"].map((r) => <option key={r}>{r}</option>)}</select></Field>
                        <Field label="Frequência"><input className="hms-input" value={m.frequency} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, frequency: e.target.value }; set({ meds }); }} placeholder="8/8h" /></Field>
                        <Field label="Duração"><input className="hms-input" value={m.duration} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, duration: e.target.value }; set({ meds }); }} placeholder="7 dias" /></Field>
                        <Field label="Quantidade"><input className="hms-input" value={m.qty} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, qty: e.target.value }; set({ meds }); }} placeholder="1 caixa" /></Field>
                        <Field label="Observação do item" className="col-span-2"><input className="hms-input" value={m.notes} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, notes: e.target.value }; set({ meds }); }} placeholder="Tomar após as refeições" /></Field>
                      </div>
                    </div>
                  ))}
                </div>
                <datalist id="lifeplus-meds">{data.meds.map((m) => <option key={m.id} value={m.name}>{m.concentration ?? ""} {m.presentation ?? ""}</option>)}</datalist>
              </div>
            )}

            {form.kind === "exames" && (
              <div className="span-2">
                <Field label="Categoria do exame">
                  <select className="hms-select" value={form.category} onChange={(e) => set({ category: e.target.value })}>{EXAM_CATS.map((c) => <option key={c}>{c}</option>)}</select>
                </Field>
                <div className="mt-3 hms-section-label">Exames solicitados</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(EXAM_PRESETS[form.category] ?? []).map((ex) => {
                    const on = form.exams.includes(ex);
                    return <button key={ex} className={`hms-chip ${on ? "brand" : "outline"}`} onClick={() => set({ exams: on ? form.exams.filter((x) => x !== ex) : [...form.exams, ex] })}>{on && <CheckCircle2 />}{ex}</button>;
                  })}
                </div>
                <Field label="Outro exame" hint="Digite e pressione Enter para adicionar." className="mt-3">
                  <input className="hms-input" placeholder="Ex.: Painel toxicológico fictício" onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v && !form.exams.includes(v)) set({ exams: [...form.exams, v] });
                    (e.target as HTMLInputElement).value = "";
                  }} />
                </Field>
                {form.exams.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {form.exams.map((ex) => <Chip key={ex} tone="brand">{ex}<button onClick={() => set({ exams: form.exams.filter((x) => x !== ex) })}><X className="h-3 w-3" /></button></Chip>)}
                  </div>
                )}
                <Field label="Justificativa clínica" className="mt-3"><textarea className="hms-textarea" rows={2} value={form.justification} onChange={(e) => set({ justification: e.target.value })} /></Field>
                <Field label="Observações da solicitação" className="mt-3"><textarea className="hms-textarea" rows={2} value={form.observations} onChange={(e) => set({ observations: e.target.value })} placeholder="Preparo, jejum, prioridade…" /></Field>
              </div>
            )}

            {form.kind === "encaminhamento" && (
              <>
                <Field label="Especialidade de destino"><input className="hms-input" value={form.referral} onChange={(e) => set({ referral: e.target.value })} placeholder="Cardiologia" /></Field>
                <Field label="Profissional destinatário"><input className="hms-input" value={form.addressee} onChange={(e) => set({ addressee: e.target.value })} placeholder="Opcional" /></Field>
                <Field label="Motivo do encaminhamento" className="span-2"><textarea className="hms-textarea" rows={3} value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder="Descreva o motivo clínico do encaminhamento." /></Field>
                <Field label="Histórico resumido" className="span-2"><textarea className="hms-textarea" rows={3} value={form.history} onChange={(e) => set({ history: e.target.value })} /></Field>
                <Field label="Observações" className="span-2"><textarea className="hms-textarea" rows={2} value={form.observations} onChange={(e) => set({ observations: e.target.value })} /></Field>
              </>
            )}

            {form.kind === "relatorio" && (
              <>
                <Field label="Motivo do relatório" className="span-2"><textarea className="hms-textarea" rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
                <Field label="Histórico clínico" className="span-2"><textarea className="hms-textarea" rows={3} value={form.history} onChange={(e) => set({ history: e.target.value })} /></Field>
                <Field label="Avaliação" className="span-2"><textarea className="hms-textarea" rows={3} value={form.evaluation} onChange={(e) => set({ evaluation: e.target.value })} /></Field>
                <Field label="Diagnósticos registrados" className="span-2" hint="Um diagnóstico por linha."><textarea className="hms-textarea" rows={2} value={form.diagnosis} onChange={(e) => set({ diagnosis: e.target.value })} /></Field>
                <Field label="Procedimentos realizados" className="span-2"><textarea className="hms-textarea" rows={2} value={form.procedures} onChange={(e) => set({ procedures: e.target.value })} /></Field>
                <Field label="Evolução" className="span-2"><textarea className="hms-textarea" rows={3} value={form.evolution} onChange={(e) => set({ evolution: e.target.value })} /></Field>
                <Field label="Considerações finais" className="span-2"><textarea className="hms-textarea" rows={2} value={form.finalNotes} onChange={(e) => set({ finalNotes: e.target.value })} /></Field>
              </>
            )}

            {form.kind === "laudo" && (
              <>
                <Field label="Exame ou avaliação"><input className="hms-input" value={form.examType} onChange={(e) => set({ examType: e.target.value })} placeholder="Ultrassom abdominal" /></Field>
                <Field label="Data do exame"><input type="date" className="hms-input" value={form.examDate} onChange={(e) => set({ examDate: e.target.value })} /></Field>
                <Field label="Descrição" className="span-2"><textarea className="hms-textarea" rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
                <Field label="Resultado" className="span-2"><textarea className="hms-textarea" rows={3} value={form.result} onChange={(e) => set({ result: e.target.value })} /></Field>
                <Field label="Conclusão" className="span-2"><textarea className="hms-textarea" rows={2} value={form.conclusion} onChange={(e) => set({ conclusion: e.target.value })} /></Field>
                <Field label="Observações" className="span-2"><textarea className="hms-textarea" rows={2} value={form.observations} onChange={(e) => set({ observations: e.target.value })} /></Field>
              </>
            )}

            {form.kind === "alta" && (
              <>
                <Field label="Data de internação"><input type="date" className="hms-input" value={form.admissionDate} onChange={(e) => set({ admissionDate: e.target.value })} /></Field>
                <Field label="Data de alta"><input type="date" className="hms-input" value={form.dischargeDate} onChange={(e) => set({ dischargeDate: e.target.value })} /></Field>
                <Field label="Permanência (dias)"><input type="number" min={0} className="hms-input" value={form.hospitalDays} onChange={(e) => set({ hospitalDays: e.target.value })} /></Field>
                <Field label="Médico responsável"><input className="hms-input" value={form.responsible} onChange={(e) => set({ responsible: e.target.value })} placeholder={staff?.full_name ?? ""} /></Field>
                <Field label="Motivo da internação" className="span-2"><textarea className="hms-textarea" rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
                <Field label="Resumo da evolução" className="span-2"><textarea className="hms-textarea" rows={3} value={form.evolution} onChange={(e) => set({ evolution: e.target.value })} /></Field>
                <Field label="Procedimentos realizados" className="span-2"><textarea className="hms-textarea" rows={2} value={form.procedures} onChange={(e) => set({ procedures: e.target.value })} /></Field>
                <Field label="Condição na alta" className="span-2"><textarea className="hms-textarea" rows={2} value={form.condition} onChange={(e) => set({ condition: e.target.value })} /></Field>
                <Field label="Orientações" className="span-2"><textarea className="hms-textarea" rows={2} value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} /></Field>
                <Field label="Acompanhamento recomendado" className="span-2"><textarea className="hms-textarea" rows={2} value={form.followUp} onChange={(e) => set({ followUp: e.target.value })} /></Field>
              </>
            )}

            <Field label={form.kind === "personalizado" ? "Título do documento" : "Título exibido"} className="span-2">
              <input className="hms-input" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>

            {form.kind === "personalizado" ? (
              <Field label="Corpo do documento" hint="Use variáveis como {{paciente.nome}} — elas são substituídas automaticamente." className="span-2">
                <textarea className="hms-textarea" rows={8} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder="Escreva o documento…" />
              </Field>
            ) : form.kind === "receita" ? (
              <Field label="Orientações ao paciente" className="span-2">
                <textarea className="hms-textarea" rows={3} value={form.orientation} onChange={(e) => set({ orientation: e.target.value })} placeholder="Hidratação, repouso, retorno em caso de piora…" />
              </Field>
            ) : (STRUCTURED as readonly string[]).includes(form.kind) || form.kind === "encaminhamento" ? (
              <Field label="Texto complementar" hint="Aparece após as seções do documento." className="span-2">
                <textarea className="hms-textarea" rows={2} value={form.text} onChange={(e) => set({ text: e.target.value })} />
              </Field>
            ) : (
              <Field label={form.kind === "atestado" || form.kind === "afastamento" ? "Motivo / texto do atestado" : "Texto complementar"} className="span-2">
                <textarea className="hms-textarea" rows={4} value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder="Informações adicionais que aparecem no documento." />
              </Field>
            )}
          </div>

          {msg && <div className="mt-3"><Banner tone={msg.tone === "error" ? "error" : "info"}>{msg.text}</Banner></div>}
          {finalized && <div className="mt-3"><Banner tone="warn"><b>Documento finalizado.</b> O histórico é imutável. Para corrigir, emita uma nova versão a partir do acervo.</Banner></div>}
          {!canFinalize && <div className="mt-3"><Banner tone="info">Seu cargo pode salvar rascunhos; a finalização é exclusiva de médicos e diretores.</Banner></div>}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Btn icon={Save} disabled={!!busy || finalized} onClick={() => void save("rascunho")}>{busy === "rascunho" ? "Salvando…" : "Salvar rascunho"}</Btn>
          <Btn variant="soft" icon={CheckCircle2} disabled={!!busy || finalized || !canFinalize} onClick={() => void save("finalizado")}>{busy === "finalizado" ? "Finalizando…" : "Finalizar"}</Btn>
          <Btn variant="ghost" icon={Eye} onClick={() => setPreview(true)}>Visualizar</Btn>
          <Btn variant="ghost" icon={Download} disabled={busy === "pdf"} onClick={() => void download()}>{busy === "pdf" ? "Gerando…" : "PDF"}</Btn>
          <Btn variant="ghost" icon={Printer} disabled={busy === "pdf"} onClick={() => void print()}>Imprimir</Btn>
          <Btn variant="ghost" icon={FilePlus2} onClick={reset}>Novo</Btn>
        </div>
        <Banner tone="info"><b>Documento fictício de roleplay.</b> Todo documento leva a marcação <i>{DISCLAIMER}</i> e não tem validade médica ou legal.</Banner>
      </div>

      <div className="hms-stack">
        <Card
          title="Pré-visualização A4"
          sub="Documento diagramado como PDF real · atualiza automaticamente"
          actions={<Chip tone="outline">A4 · 210 × 297 mm</Chip>}
          noBody
        >
          <div className="p-3">
            <DocStage model={model} delay={650} />
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--h-muted)]">
          <Lock className="h-3 w-3" /> Documentos finalizados são preservados integralmente no histórico e na auditoria.
          <button className="ml-auto underline" onClick={() => go("templates")}>Editar modelos Life+</button>
        </div>
      </div>

      {preview && (
        <DocPreviewModal
          model={model}
          onClose={() => setPreview(false)}
          onSaveDraft={() => void save("rascunho")}
          onFinalize={() => void save("finalizado")}
          onEdit={() => setPreview(false)}
          busy={busy === "rascunho" || busy === "finalizado" ? busy : !!busy}
          canFinalize={canFinalize && !finalized}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Acervo                                                             */
/* ------------------------------------------------------------------ */

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", aguardando: "Aguardando aprovação", finalizado: "Finalizado", arquivado: "Arquivado", cancelado: "Cancelado",
};

export function DocumentList({ kinds, onOpen, limit, statusFilter }: {
  kinds?: string[]; onOpen?: (d: DocRow) => void; limit?: number; statusFilter?: string;
}) {
  const { data, patientById, staffById, go } = useHms();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState(statusFilter ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [view, setView] = useState<DocRow | null>(null);

  const pool = data.docs.filter((d) => {
    if (kinds && !kinds.includes(d.kind)) return false;
    if (kind && d.kind !== kind) return false;
    const st = status || statusFilter;
    if (st && d.status !== st) return false;
    const when = (d.finalized_at ?? d.created_at).slice(0, 10);
    if (from && when < from) return false;
    if (to && when > to) return false;
    return true;
  });
  const list = pool.filter((d) => {
    if (!q.trim()) return true;
    const p = patientById(d.patient_id ?? undefined);
    return [d.title, d.code, p?.full_name, p?.code, d.kind, DOC_KINDS[d.kind]].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
  }).slice(0, limit ?? 300);

  return (
    <>
      <Card noBody>
        <div className="hms-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar por código, título ou paciente…" />
          <select className="hms-select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Todos os tipos</option>
            {Object.entries(DOC_KINDS).filter(([k]) => !kinds || kinds.includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="hms-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <label className="hms-date-filter"><CalendarRange className="h-3.5 w-3.5" /><input type="date" className="hms-input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <input type="date" className="hms-input" value={to} onChange={(e) => setTo(e.target.value)} />
          <span className="push hms-code">{list.length} documentos</span>
        </div>
        <Table
          head={<tr><th>Documento</th><th>Paciente</th><th>Profissional</th><th>Tipo</th><th>Status</th><th>Emissão</th><th /></tr>}
          empty={!list.length ? <Empty icon={FolderOpen} title="Nenhum documento encontrado" children="Ajuste os filtros ou emita um novo documento." /> : undefined}
        >
          {list.map((d) => {
            const p = patientById(d.patient_id ?? undefined); const s = staffById(d.staff_id ?? undefined);
            return (
              <tr key={d.id} className="is-clickable" onClick={() => { setView(d); onOpen?.(d); }}>
                <td><div className="strong truncate">{d.title}</div><div className="hms-code">{d.code}</div></td>
                <td><div className="truncate">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code ?? ""}</div></td>
                <td className="muted">{s?.full_name ?? "—"}</td>
                <td className="muted">{DOC_KINDS[d.kind] ?? d.kind}</td>
                <td><Chip tone={d.status === "finalizado" ? "ok" : d.status === "cancelado" || d.status === "arquivado" ? "vital" : "warn"}>{STATUS_LABEL[d.status] ?? d.status}</Chip></td>
                <td className="muted">{fDate(d.finalized_at ?? d.created_at)}</td>
                <td><button className="hms-btn ghost sm" onClick={(e) => { e.stopPropagation(); setView(d); }}><FileText className="h-3.5 w-3.5" />Abrir</button></td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {view && (
        <DocViewer
          doc={view}
          onClose={() => setView(null)}
          onEdit={() => { setView(null); go("documents", { docId: view.id, docKind: view.kind }); }}
        />
      )}
    </>
  );
}

export function DocViewer({ doc, onClose, onEdit }: { doc: DocRow; onClose: () => void; onEdit?: () => void }) {
  const { data, patientById, staffById, reload, go, role } = useHms();
  const [busy, setBusy] = useState(false);
  const patient = patientById(doc.patient_id ?? undefined);
  const staff = staffById(doc.staff_id ?? undefined);
  const template = data.templates.find((t) => t.id === doc.template_id) ?? data.templates.find((t) => t.kind === (DOC_TEMPLATE_KIND[doc.kind] ?? doc.kind));
  const model = useMemo(() => modelFromForm(formFromDoc(doc), data, patient, staff, template), [doc, data, patient, staff, template]);

  const setStatus = async (status: string) => {
    setBusy(true);
    const res = await hdb.from("lp_documents").update({ status, finalized_at: status === "finalizado" ? new Date().toISOString() : doc.finalized_at }).eq("id", doc.id);
    setBusy(false);
    if (res.error) { alert(res.error.message); return; }
    await reload(); onClose();
  };

  const newVersion = () => {
    try { sessionStorage.setItem("lifeplus.doc.clone", doc.id); } catch { /* ignora */ }
    onClose();
    go("documents", { docKind: doc.kind, patientId: doc.patient_id ?? undefined });
  };

  const canManage = !!role && ["administrador", "diretor", "medico"].includes(role);

  return (
    <DocPreviewModal
      model={model}
      statusLabel={STATUS_LABEL[doc.status] ?? doc.status}
      onClose={onClose}
      onEdit={doc.status === "rascunho" ? onEdit : undefined}
      footerExtra={
        <>
          {canManage && doc.status === "rascunho" && (
            <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("finalizado")}>Finalizar</Btn>
          )}
          {canManage && doc.status !== "cancelado" && doc.status !== "arquivado" && (
            <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("arquivado")}>Arquivar</Btn>
          )}
          {doc.status === "arquivado" && (
            <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void setStatus("rascunho")}>Restaurar</Btn>
          )}
          <Btn size="sm" variant="ghost" disabled={busy} onClick={newVersion}>Nova versão</Btn>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Módulo DOCUMENTOS                                                  */
/* ------------------------------------------------------------------ */

const ICONS: Record<string, LucideIcon> = {
  FileSignature, Pill, ClipboardList, FlaskConical, Stethoscope, FileText, Microscope, HeartPulse, LayoutTemplate,
};

function CategoryGrid({ onPick }: { onPick: (kind: string) => void }) {
  const { data } = useHms();
  const countFor = (kinds: string[]) => data.docs.filter((d) => kinds.includes(d.kind)).length;
  return (
    <div className="hms-cat-grid">
      {DOC_CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon] ?? FileText;
        return (
          <button key={c.key} className="hms-cat" onClick={() => onPick(c.kinds[0])}>
            <span className="hms-cat-icon"><Icon className="h-4 w-4" /></span>
            <span className="hms-cat-body">
              <span className="hms-cat-title">{c.label}</span>
              <span className="hms-cat-desc">{c.description}</span>
            </span>
            <span className="hms-cat-foot">
              <span className="hms-code">{countFor(c.kinds)} no acervo</span>
              <span className="hms-cat-cta"><Plus className="h-3 w-3" /> Criar</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function RecentDocs({ onOpen }: { onOpen: (d: DocRow) => void }) {
  const { data, patientById } = useHms();
  const recent = data.docs.slice(0, 4);
  if (!recent.length) return null;
  return (
    <Card title="Documentos recentes" sub="Últimos registros emitidos na instituição" noBody>
      <div className="hms-recent">
        {recent.map((d) => {
          const p = patientById(d.patient_id ?? undefined);
          return (
            <button key={d.id} className="hms-recent-item" onClick={() => onOpen(d)}>
              <span className="hms-recent-icon"><FileText className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">{d.title}</span>
                <span className="hms-code">{d.code} · {p?.full_name ?? "sem paciente"}</span>
              </span>
              <Chip tone={d.status === "finalizado" ? "ok" : "warn"}>{STATUS_LABEL[d.status] ?? d.status}</Chip>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function DocumentsModule() {
  const { focus, data } = useHms();
  const [tab, setTab] = useState<"emitir" | "acervo" | "rascunhos">("emitir");
  const [kind, setKind] = useState(focus.docKind ?? "atestado");
  const [viewing, setViewing] = useState<DocRow | null>(null);
  const draftCount = data.docs.filter((d) => d.status === "rascunho").length;
  const total = data.docs.length;

  useEffect(() => { if (focus.docKind) { setKind(focus.docKind); setTab("emitir"); } }, [focus.docKind]);

  return (
    <Page
      eyebrow="Central de documentos"
      title="Documentos institucionais"
      sub="Papel timbrado Life+, numeração própria, PDF vetorial A4 e acervo com histórico completo."
      actions={<><Chip tone="outline">A4 · PDF vetorial</Chip><Chip tone={draftCount ? "warn" : "ok"}>{draftCount} rascunhos</Chip></>}
    >
      <div className="mb-3"><CategoryGrid onPick={(k) => { setKind(k); setTab("emitir"); }} /></div>
      <div className="mb-3">
        <Tabs
          items={[
            { key: "emitir", label: "Emitir documento" },
            { key: "acervo", label: "Acervo", count: total },
            { key: "rascunhos", label: "Rascunhos", count: draftCount },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === "emitir" && (
        <DocumentStudio
          key={`${kind}-${focus.patientId ?? ""}-${focus.docId ?? ""}`}
          presetKind={kind}
          presetPatientId={focus.patientId}
          presetDocId={focus.docId}
        />
      )}
      {tab === "acervo" && (
        <div className="hms-stack">
          <RecentDocs onOpen={setViewing} />
          <DocumentList onOpen={setViewing} />
        </div>
      )}
      {tab === "rascunhos" && <DocumentList statusFilter="rascunho" onOpen={setViewing} />}
      {viewing && <DocViewer doc={viewing} onClose={() => setViewing(null)} onEdit={() => { setKind(viewing.kind); setTab("emitir"); setViewing(null); }} />}
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/*  MÓDULO MODELOS LIFE+                                               */
/* ------------------------------------------------------------------ */

const VARS = [
  "{{paciente.nome}}", "{{paciente.codigo}}", "{{paciente.idade}}", "{{paciente.data_nascimento}}",
  "{{paciente.convenio}}", "{{paciente.tipo_sanguineo}}", "{{profissional.nome}}", "{{profissional.registro}}",
  "{{profissional.especialidade}}", "{{profissional.cargo}}", "{{instituicao.nome}}", "{{instituicao.endereco}}",
  "{{instituicao.telefone}}", "{{instituicao.email}}", "{{documento.codigo}}", "{{documento.data_emissao}}",
  "{{documento.dias}}", "{{documento.inicio}}", "{{documento.fim}}", "{{documento.horario}}", "{{documento.texto}}",
  "{{documento.medicamentos}}", "{{documento.exames}}", "{{documento.justificativa}}", "{{documento.especialidade}}",
];

const SEED_KIND: Record<string, string> = {
  atestado: "atestado", receita: "receita", declaracao: "declaracao", exames: "exames",
  encaminhamento: "encaminhamento", relatorio: "relatorio", laudo: "laudo", alta: "alta",
};

/** Salva modelo com degradação elegante caso a migração de estilo ainda não esteja aplicada. */
async function saveTemplate(template: Template | null, body: Record<string, unknown>) {
  const write = async (payload: Record<string, unknown>) => (template?.id
    ? await hdb.from("lp_templates").update(payload).eq("id", template.id)
    : await hdb.from("lp_templates").insert(payload));
  const full = await write(body);
  if (!full.error) return { error: null as string | null, legacy: false };
  const msg = String(full.error.message ?? "");
  if (/column|schema cache|does not exist|style|signature_url|sector|is_default/i.test(msg)) {
    const { style: _style, sector: _sector, signature_url: _signature, is_default: _default, ...legacy } = body as Record<string, unknown>;
    const retry = await write(legacy);
    return { error: retry.error ? String(retry.error.message) : null, legacy: !retry.error };
  }
  return { error: msg, legacy: false };
}

export function TemplatesModule() {
  const { data, reload, can } = useHms();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [q, setQ] = useState("");
  const list = data.templates.filter((t) => [t.name, t.kind, t.title, t.sector].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  const duplicate = async (t: Template) => {
    await saveTemplate(null, {
      kind: t.kind, name: `${t.name} (cópia)`, title: t.title, body: t.body, header: t.header, footer: t.footer,
      accent: t.accent, font: t.font, margin_mm: t.margin_mm, logo_url: t.logo_url, sector: t.sector ?? "",
      signature_url: t.signature_url ?? null, ...toStylePayload(readPaperStyle(t, data.settings.accent)),
    });
    await reload();
  };
  const archive = async (t: Template) => { await hdb.from("lp_templates").update({ archived: !t.archived }).eq("id", t.id); await reload(); };
  const makeDefault = async (t: Template) => {
    await hdb.from("lp_templates").update({ is_default: false }).eq("kind", t.kind);
    const res = await hdb.from("lp_templates").update({ is_default: true }).eq("id", t.id);
    if (res.error) alert("Definir modelo padrão exige a migração 0007 do banco.");
    await reload();
  };
  const seed = async () => {
    for (const [kind, layoutKind] of Object.entries(SEED_KIND)) {
      await saveTemplate(null, {
        kind, name: `${DOC_KINDS[layoutKind] ?? "Documento"} Life+`, title: (DOC_KINDS[layoutKind] ?? "Documento").toUpperCase(),
        body: DEFAULT_BODIES[layoutKind] ?? "", accent: data.settings.accent, font: "serif", margin_mm: 18,
        sector: "Setor de Clínica Médica", ...toStylePayload({ ...DEFAULT_STYLE, accent: data.settings.accent }),
      });
    }
    await reload();
  };

  const previewModel = useMemo(() => {
    if (!preview) return null;
    const patient = data.patients[0] ?? null;
    const staff = data.staff.find((s) => s.role === "medico") ?? data.staff[0] ?? null;
    const vars = buildVars(patient, staff, data.settings, {
      "documento.dias": "3", "documento.inicio": fDate(today()), "documento.fim": fDate(today()),
      "documento.horario": "14:00", "documento.texto": "Conteúdo de exemplo do modelo institucional Life+.",
      "documento.medicamentos": "1. Medicamento de exemplo — 500 mg\n   Posologia: 1 comprimido · Via oral · 8/8h · por 5 dias",
      "documento.exames": "1. Hemograma completo\n2. Raio-X de tórax", "documento.justificativa": "Investigação clínica de roleplay.",
      "documento.especialidade": "Cardiologia",
    });
    return buildPaperModel({
      kind: preview.kind, title: preview.title, code: "DOC-PRÉVIA", status: "rascunho",
      body: fillVars(preview.body, vars), template: preview, settings: data.settings, patient, staff,
    });
  }, [preview, data]);

  return (
    <Page
      eyebrow="Modelos institucionais"
      title="Modelos Life+"
      sub="Cabeçalho, rodapé, tipografia, cores, margens e campos automáticos de cada tipo de documento."
      actions={<>
        <Btn variant="ghost" icon={FileText} onClick={() => void seed()} disabled={!can("templates")}>Restaurar biblioteca</Btn>
        <Btn icon={Plus} onClick={() => setEditing("new")} disabled={!can("templates")}>Novo modelo</Btn>
      </>}
    >
      <Card noBody>
        <div className="hms-toolbar">
          <SearchInput value={q} onChange={setQ} placeholder="Buscar modelo…" />
          <span className="push hms-code">{list.length} modelos</span>
        </div>
        {!list.length ? (
          <Empty icon={FileSignature} title="Nenhum modelo criado" children="Crie um modelo ou restaure a biblioteca inicial Life+." action={<Btn icon={Plus} onClick={() => setEditing("new")}>Novo modelo</Btn>} />
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => {
              const style = readPaperStyle(t, data.settings.accent);
              return (
                <div key={t.id} className={`hms-template ${t.archived ? "is-archived" : ""}`}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: style.accent }}><FileText className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{t.name}</div>
                      <div className="hms-code truncate">{DOC_KINDS[t.kind] ?? t.kind} · {style.family === "sans" ? "sem serifa" : "serifada"}</div>
                    </div>
                    <Chip tone={t.archived ? "outline" : t.is_default ? "brand" : "ok"}>{t.archived ? "arquivado" : t.is_default ? "padrão" : "ativo"}</Chip>
                  </div>
                  <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--h-muted)]">{t.title} — {(t.sector || t.header || "sem setor definido")}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(t)}>Editar</Btn>
                    <Btn size="sm" variant="ghost" icon={Eye} onClick={() => setPreview(t)}>Prévia</Btn>
                    <Btn size="sm" variant="ghost" icon={Copy} onClick={() => void duplicate(t)}>Duplicar</Btn>
                    <Btn size="sm" variant="ghost" icon={t.archived ? ArchiveRestore : Archive} onClick={() => void archive(t)}>{t.archived ? "Restaurar" : "Arquivar"}</Btn>
                    <Btn size="sm" variant="ghost" icon={ShieldCheck} onClick={() => void makeDefault(t)}>Padrão</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && <TemplateEditor template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {preview && previewModel && (
        <Modal wide title={`Prévia · ${preview.name}`} sub={`${DOC_KINDS[preview.kind] ?? preview.kind} · documento de exemplo`} onClose={() => setPreview(null)}
          footer={<><span className="text-[11px] text-[var(--h-muted)]">Prévia gerada pelo mesmo motor do PDF final.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={() => setPreview(null)}>Fechar</Btn><Btn icon={Pencil} onClick={() => { const t = preview; setPreview(null); setEditing(t); }}>Editar modelo</Btn></div></>}>
          <DocStage model={previewModel} delay={100} />
        </Modal>
      )}
    </Page>
  );
}

function TemplateEditor({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const { data, reload } = useHms();
  const initial = useMemo<PaperStyle>(() => readPaperStyle(template, data.settings.accent), [template, data.settings.accent]);
  const [f, setF] = useState({
    name: template?.name ?? "Novo modelo Life+",
    kind: template?.kind ?? "atestado",
    title: template?.title ?? "ATESTADO MÉDICO",
    body: template?.body ?? DEFAULT_BODIES.atestado,
    header: template?.header ?? "",
    footer: template?.footer ?? "",
    sector: template?.sector ?? "",
    logo_url: template?.logo_url ?? "",
    signature_url: template?.signature_url ?? "",
    archived: template?.archived ?? false,
    ...initial,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVar = (v: string) => {
    const el = bodyRef.current;
    if (!el) { setF({ ...f, body: f.body + v }); return; }
    const start = el.selectionStart ?? f.body.length; const end = el.selectionEnd ?? start;
    const next = f.body.slice(0, start) + v + f.body.slice(end);
    setF({ ...f, body: next });
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + v.length; });
  };

  const save = async () => {
    setBusy(true); setErr(null); setNote(null);
    const payload = {
      kind: f.kind, name: f.name, title: f.title, body: f.body, header: f.header, footer: f.footer,
      accent: f.accent, font: `${f.family};scale=${f.scale};space=${f.spacing}`, margin_mm: Number(f.marginMm) || 18,
      logo_url: f.logo_url || null, archived: f.archived, sector: f.sector || null, signature_url: f.signature_url || null,
      ...toStylePayload({
        accent: f.accent, family: f.family, scale: f.scale, spacing: f.spacing, marginMm: Number(f.marginMm) || 18,
        headingAlign: f.headingAlign, dividers: f.dividers, logoMark: f.logoMark,
      }),
    };
    const res = await saveTemplate(template, payload);
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    if (res.legacy) setNote("Modelo salvo no formato compatível. Aplique a migração 0007 do Supabase para habilitar estilo avançado e assinatura visual.");
    await reload();
    if (!res.legacy) onClose();
  };

  return (
    <Modal
      wide
      title={template ? `Editar · ${template.name}` : "Novo modelo Life+"}
      sub="Aparência, papel timbrado e texto com campos automáticos."
      onClose={onClose}
      footer={<>
        <span className="text-[11px] text-[var(--h-muted)]">Use “Prévia” na lista para ver o modelo aplicado a um paciente real.</span>
        <div className="ml-auto flex gap-2">
          <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn icon={Save} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar modelo"}</Btn>
        </div>
      </>}
    >
      <div className="hms-form-grid">
        <Field label="Nome do modelo"><input className="hms-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Tipo de documento">
          <select className="hms-select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
            {Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Título no documento"><input className="hms-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Setor emissor" hint="Aparece no cabeçalho, ao lado dos contatos."><input className="hms-input" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })} placeholder="Setor de Clínica Médica" /></Field>

        <Field label="Cor institucional"><input type="color" className="hms-input h-9 p-1" value={f.accent} onChange={(e) => setF({ ...f, accent: e.target.value })} /></Field>
        <Field label="Tipografia">
          <select className="hms-select" value={f.family} onChange={(e) => setF({ ...f, family: e.target.value as PaperStyle["family"] })}>
            <option value="serif">Serifada (institucional)</option>
            <option value="sans">Sem serifa (moderna)</option>
          </select>
        </Field>
        <Field label={`Tamanho do texto · ${Math.round(f.scale * 100)}%`}>
          <input type="range" min={0.85} max={1.2} step={0.01} className="hms-range" value={f.scale} onChange={(e) => setF({ ...f, scale: Number(e.target.value) })} />
        </Field>
        <Field label={`Espaçamento · ${Math.round(f.spacing * 100)}%`}>
          <input type="range" min={0.8} max={1.35} step={0.01} className="hms-range" value={f.spacing} onChange={(e) => setF({ ...f, spacing: Number(e.target.value) })} />
        </Field>
        <Field label={`Margens · ${f.marginMm} mm`}>
          <input type="range" min={10} max={34} step={1} className="hms-range" value={f.marginMm} onChange={(e) => setF({ ...f, marginMm: Number(e.target.value) })} />
        </Field>
        <Field label="Alinhamento do título">
          <select className="hms-select" value={f.headingAlign} onChange={(e) => setF({ ...f, headingAlign: e.target.value as PaperStyle["headingAlign"] })}>
            <option value="center">Centralizado</option>
            <option value="left">À esquerda</option>
          </select>
        </Field>
        <Field label="Linhas divisórias">
          <select className="hms-select" value={f.dividers ? "1" : "0"} onChange={(e) => setF({ ...f, dividers: e.target.value === "1" })}>
            <option value="1">Discretas (recomendado)</option>
            <option value="0">Sem linhas</option>
          </select>
        </Field>
        <Field label="Marca no cabeçalho">
          <select className="hms-select" value={f.logoMark ? "1" : "0"} onChange={(e) => setF({ ...f, logoMark: e.target.value === "1" })}>
            <option value="1">Exibir marca Life+</option>
            <option value="0">Ocultar marca</option>
          </select>
        </Field>

        <Field label="Logotipo (URL opcional)" className="span-2"><input className="hms-input" value={f.logo_url} onChange={(e) => setF({ ...f, logo_url: e.target.value })} placeholder="https://… (deixe vazio para usar o logotipo da instituição)" /></Field>
        <Field label="Assinatura visual (URL opcional)" className="span-2" hint="Imagem de representação gráfica. Nunca é tratada como assinatura digital certificada."><input className="hms-input" value={f.signature_url} onChange={(e) => setF({ ...f, signature_url: e.target.value })} placeholder="https://…" /></Field>
        <Field label="Rodapé adicional" className="span-2"><input className="hms-input" value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} placeholder="Ex.: Emitido pelo setor de clínica médica fictícia" /></Field>

        <div className="span-2">
          <Field label="Corpo do modelo (documentos textuais)" hint="Receitas, exames, relatórios, laudos e altas são montados a partir das seções do formulário; o corpo abaixo vale para atestados, declarações e textos corridos.">
            <textarea ref={bodyRef} className="hms-textarea font-[var(--h-mono)] text-[12px]" rows={9} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
          <div className="mt-2 hms-section-label">Campos automáticos</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARS.map((v) => <button key={v} className="hms-chip outline hover:border-[var(--h-brand)] hover:text-[var(--h-brand)]" onClick={() => insertVar(v)}>{v.replace(/[{}\s]/g, "")}</button>)}
          </div>
        </div>
      </div>
      {err && <div className="mt-3"><Banner tone="error">{err}</Banner></div>}
      {note && <div className="mt-3"><Banner tone="info">{note}</Banner></div>}
    </Modal>
  );
}

/* atalho usado nas telas de paciente e prontuário */
export function DocQuickLinks({ patientId }: { patientId?: string }) {
  const { go } = useHms();
  const items = [
    { kind: "atestado", label: "Atestado", icon: FileSignature },
    { kind: "receita", label: "Receita", icon: Pill },
    { kind: "exames", label: "Exames", icon: FlaskConical },
    { kind: "declaracao", label: "Declaração", icon: ClipboardList },
    { kind: "relatorio", label: "Relatório", icon: FileText },
    { kind: "encaminhamento", label: "Encaminhamento", icon: Stethoscope },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <button key={i.kind} className="flex items-center gap-2 rounded-xl border border-[var(--h-line)] bg-[var(--h-panel)] px-3 py-2.5 text-left text-[12px] font-medium hover:border-[var(--h-brand)] hover:text-[var(--h-brand)]" onClick={() => go("documents", { docKind: i.kind, patientId })}>
          <i.icon className="h-4 w-4" />{i.label}
        </button>
      ))}
    </div>
  );
}


