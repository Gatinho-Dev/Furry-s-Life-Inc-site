import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import {
  Archive, ArchiveRestore, CheckCircle2, ClipboardList, Copy, Download, FilePlus2, FileText,
  FileSignature, FlaskConical, FolderOpen, Lock, Pencil, Pill, Plus, Printer, Save, Stethoscope,
  Trash2, X,
} from "lucide-react";
import { hdb, DOC_KINDS, DOC_TEMPLATE_KIND, DISCLAIMER, ageOf, docVars, fDate, fDateTime, fillVars, type DocRow, type Patient, type Settings, type Staff, type Template } from "./core";
import { useHms } from "./data";
import { PatientSelect, StaffSelect } from "./pickers";
import { Banner, Btn, Card, Chip, Empty, Field, Modal, Page, SearchInput, Tabs, Table } from "./ui";

/* ------------------------------------------------------------------ */
/*  A4 paper rendering, PDF export and printing                        */
/* ------------------------------------------------------------------ */

const PAPER_FONT = (font: string) => (font === "sans" ? "var(--h-sans)" : font === "mono" ? "var(--h-mono)" : "var(--h-serif)");

export type MedLine = { name: string; concentration: string; presentation: string; dose: string; route: string; frequency: string; duration: string; qty: string; notes: string };
export const EMPTY_MED: MedLine = { name: "", concentration: "", presentation: "", dose: "", route: "Via oral", frequency: "", duration: "", qty: "", notes: "" };

type PaperProps = {
  settings: Settings; patient?: Patient | null; staff?: Staff | null;
  title: string; code?: string | null; body: string; date: string; template?: Template | null;
  meds?: MedLine[]; extraFields?: { label: string; value: string }[];
};

export function PaperView({ settings, patient, staff, title, code, body, date, template, meds, extraFields }: PaperProps) {
  const margin = Math.min(Math.max(template?.margin_mm ?? 20, 8), 40);
  const accent = template?.accent || settings.accent || "#1258d6";
  const font = PAPER_FONT(template?.font ?? "serif");
  const age = ageOf(patient?.birth_date);
  const fields = [
    { label: "Paciente", value: patient?.full_name ?? "—" },
    { label: "Código Life+", value: patient?.code ?? "—" },
    { label: "Data de nascimento", value: patient?.birth_date ? fDate(patient.birth_date) : "não informada" },
    { label: "Idade", value: age != null ? `${age} anos` : "não informada" },
    { label: "Convênio", value: patient?.insurance || "Nenhum" },
    { label: "Tipo sanguíneo", value: patient?.blood_type || "não informado" },
    { label: "Profissional", value: staff?.full_name ?? "—" },
    { label: "Registro", value: staff?.registry ? `${staff.registry}${staff.uf ? "/" + staff.uf : ""}` : "—" },
    { label: "Especialidade", value: staff?.specialty ?? "—" },
    { label: "Emissão", value: date },
    ...(extraFields ?? []),
  ];
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="hms-paper" style={{ ["--paper-accent" as string]: accent, fontFamily: font } as React.CSSProperties}>
      <div className="hms-paper-inner" style={{ padding: `${margin}mm` }}>
        <header className="hms-paper-head">
          <span className="hms-paper-logo">{settings.logo_url ? <img src={settings.logo_url} alt="" /> : "＋"}</span>
          <div className="hms-paper-inst">
            <b>{settings.name}</b>
            <span>{settings.address}</span>
            <span>{settings.phone}{settings.cnpj ? ` · CNPJ ${settings.cnpj}` : ""}</span>
            <span>Direção: {settings.director || "—"} · Resp. técnico: {settings.technical_lead || "—"}</span>
          </div>
          <div className="hms-paper-docmeta">
            <b>{code || "(código ao salvar)"}</b>
            <span>{date}</span>
            <span>Documento interno</span>
          </div>
        </header>
        {template?.header && <div className="mt-3 text-center text-[8.5pt] text-[var(--paper-muted)]">{template.header}</div>}
        <div className="hms-paper-title">{title}</div>
        <div className="hms-paper-subtitle">Documento assistencial · roleplay · Life+ RP</div>
        <div className="hms-paper-fields">
          {fields.map((f) => <div key={f.label}><label>{f.label}:</label><b>{f.value}</b></div>)}
        </div>
        <div className="hms-paper-body">
          {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {!!meds?.length && (
            <table>
              <thead><tr><th>Medicamento</th><th>Apresentação</th><th>Posologia</th><th>Duração</th><th>Qtd.</th></tr></thead>
              <tbody>
                {meds.map((m, i) => (
                  <tr key={i}>
                    <td><b>{m.name}</b>{m.concentration ? ` · ${m.concentration}` : ""}</td>
                    <td>{m.presentation || "—"}</td>
                    <td>{[m.dose, m.route, m.frequency].filter(Boolean).join(" · ") || "—"}{m.notes ? ` — ${m.notes}` : ""}</td>
                    <td>{m.duration || "—"}</td>
                    <td>{m.qty || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="hms-paper-sign">
          <div className="line" />
          <b>{staff?.full_name ?? "Profissional responsável"}</b>
          <span>{staff?.specialty ?? "Especialidade"}{staff?.registry ? ` · ${staff.registry}${staff.uf ? "/" + staff.uf : ""}` : ""}</span>
          <span>{settings.name} · documento fictício de roleplay</span>
        </div>
        {template?.footer && <div className="mt-4 text-center text-[8pt] text-[var(--paper-muted)]">{template.footer}</div>}
        <footer className="hms-paper-foot">
          <span className="disclaimer">{DISCLAIMER}</span>
          <span className="page">{settings.name} · {settings.phone}</span>
        </footer>
      </div>
    </div>
  );
}

const PRINT_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.hms-paper { --paper-ink:#12181c; --paper-muted:#5c666c; --paper-line:#d9dee1; --h-sans:"Instrument Sans",Arial,sans-serif; --h-serif:"Newsreader",Georgia,serif; --h-mono:"SF Mono",Menlo,monospace;
  position: relative; width: 210mm; min-height: 297mm; background:#fff; color:var(--paper-ink); font-size:11.4pt; line-height:1.5; display:flex; flex-direction:column; }
.hms-paper-inner { flex:1; display:flex; flex-direction:column; }
.hms-paper-head { display:flex; align-items:flex-start; gap:14px; padding-bottom:12px; border-bottom:1.5px solid var(--paper-accent); }
.hms-paper-logo { height:44px; width:44px; flex:none; border-radius:8px; display:grid; place-items:center; background:var(--paper-accent); color:#fff; font-size:22px; font-weight:700; overflow:hidden; }
.hms-paper-logo img { height:100%; width:100%; object-fit:contain; background:#fff; }
.hms-paper-inst { flex:1; } .hms-paper-inst b { display:block; font-family:var(--h-sans); font-size:15px; letter-spacing:-.02em; }
.hms-paper-inst span { display:block; font-family:var(--h-sans); font-size:8.4pt; color:var(--paper-muted); line-height:1.45; }
.hms-paper-docmeta { text-align:right; font-family:var(--h-sans); font-size:8.4pt; color:var(--paper-muted); }
.hms-paper-docmeta b { display:block; font-family:var(--h-mono); font-size:8pt; color:var(--paper-ink); }
.hms-paper-title { margin:18px 0 4px; text-align:center; font-family:var(--h-sans); font-size:13.5pt; font-weight:700; letter-spacing:.06em; text-transform:uppercase; }
.hms-paper-subtitle { text-align:center; font-size:9pt; color:var(--paper-muted); margin-bottom:14px; }
.hms-paper-fields { display:grid; grid-template-columns:1fr 1fr; gap:5px 18px; padding:10px 12px; border:1px solid var(--paper-line); border-radius:4px; margin-bottom:14px; font-family:var(--h-sans); font-size:8.6pt; }
.hms-paper-fields div { display:flex; gap:6px; min-width:0; } .hms-paper-fields label { color:var(--paper-muted); white-space:nowrap; } .hms-paper-fields b { font-weight:600; }
.hms-paper-body { flex:1; white-space:pre-wrap; } .hms-paper-body p { margin:0 0 9pt; }
.hms-paper-body table { width:100%; border-collapse:collapse; margin:8pt 0 12pt; font-family:var(--h-sans); font-size:8.8pt; }
.hms-paper-body th { text-align:left; padding:5pt 6pt; background:#f2f4f5; border:1px solid var(--paper-line); font-size:7.6pt; text-transform:uppercase; letter-spacing:.05em; color:var(--paper-muted); }
.hms-paper-body td { padding:5pt 6pt; border:1px solid var(--paper-line); vertical-align:top; }
.hms-paper-sign { margin-top:26pt; display:flex; flex-direction:column; align-items:center; gap:3px; page-break-inside:avoid; }
.hms-paper-sign .line { width:62mm; border-top:1px solid var(--paper-ink); margin-bottom:4pt; }
.hms-paper-sign b { font-family:var(--h-sans); font-size:9.4pt; } .hms-paper-sign span { font-family:var(--h-sans); font-size:8pt; color:var(--paper-muted); }
.hms-paper-foot { margin-top:18px; padding-top:8px; border-top:1px solid var(--paper-line); font-family:var(--h-sans); font-size:7.2pt; color:var(--paper-muted); display:flex; gap:12px; justify-content:space-between; align-items:flex-end; }
.hms-paper-foot .disclaimer { font-weight:600; color:#8a949a; } .hms-paper-foot .page { font-family:var(--h-mono); white-space:nowrap; }
.mt-3 { margin-top:12px; } .mt-4 { margin-top:16px; } .text-center { text-align:center; }
.text-\\[8\\.5pt\\] { font-size:8.5pt; } .text-\\[8pt\\] { font-size:8pt; } .text-\\[var\\(--paper-muted\\)\\] { color:var(--paper-muted); }
`;

function offscreenClone(node: HTMLElement) {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;background:#fff;z-index:-1;";
  const clone = node.cloneNode(true) as HTMLElement;
  clone.style.boxShadow = "none";
  clone.style.zoom = "1";
  clone.style.margin = "0";
  holder.appendChild(clone);
  document.body.appendChild(holder);
  return { holder, clone };
}

export async function paperToPdf(node: HTMLElement, filename: string) {
  const { holder, clone } = offscreenClone(node);
  try {
    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: clone.offsetWidth });
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pw = 210, ph = 297;
    const pxPerMm = canvas.width / pw;
    const pageH = Math.floor(ph * pxPerMm);
    let y = 0, page = 0;
    while (y < canvas.height - 2) {
      const h = Math.min(pageH, canvas.height - y);
      const slice = document.createElement("canvas");
      slice.width = canvas.width; slice.height = h;
      const ctx = slice.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, pw, h / pxPerMm, undefined, "FAST");
      y += h; page += 1;
      if (page > 20) break;
    }
    pdf.save(filename);
  } finally {
    holder.remove();
  }
}

export function printPaper(node: HTMLElement) {
  const { holder, clone } = offscreenClone(node);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>Life+ · documento</title>
    <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,600&display=swap" rel="stylesheet">
    <style>${PRINT_CSS}</style></head><body>${clone.outerHTML}</body></html>`;
  holder.remove();
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { alert("Permita pop-ups para imprimir o documento."); return; }
  w.document.open(); w.document.write(html); w.document.close();
  const go = () => { w.focus(); w.print(); };
  if (w.document.readyState === "complete") setTimeout(go, 700); else w.onload = () => setTimeout(go, 700);
}

/* ------------------------------------------------------------------ */
/*  Document builder                                                    */
/* ------------------------------------------------------------------ */

const DEFAULT_BODIES: Record<string, string> = {
  atestado: "Atesto, para os devidos fins, que o(a) paciente {{paciente.nome}} ({{paciente.codigo}}), {{paciente.idade}}, esteve sob meus cuidados profissionais nesta data, necessitando de afastamento de suas atividades por {{documento.dias}} dia(s), no período de {{documento.inicio}} a {{documento.fim}}.\n\n{{documento.texto}}",
  afastamento: "Atesto que o(a) paciente {{paciente.nome}} ({{paciente.codigo}}) encontra-se sob acompanhamento nesta instituição e necessita de afastamento de suas atividades por {{documento.dias}} dia(s), a contar de {{documento.inicio}} até {{documento.fim}}.\n\n{{documento.texto}}",
  declaracao: "Declaro que {{paciente.nome}} ({{paciente.codigo}}) compareceu a esta instituição em {{documento.data_emissao}}, no horário de {{documento.horario}}, para atendimento médico.\n\n{{documento.texto}}",
  acompanhamento: "Declaro que o(a) acompanhante do(a) paciente {{paciente.nome}} ({{paciente.codigo}}) permaneceu nesta instituição em {{documento.data_emissao}}, no horário de {{documento.horario}}, acompanhando o atendimento realizado.\n\n{{documento.texto}}",
  receita: "Paciente: {{paciente.nome}} — {{paciente.codigo}}\nConvênio: {{paciente.convenio}}\n\n{{documento.medicamentos}}\n\nOrientações: {{documento.texto}}",
  exames: "Solicito a realização dos exames abaixo relacionados para o(a) paciente {{paciente.nome}} ({{paciente.codigo}}):\n\n{{documento.exames}}\n\nJustificativa clínica: {{documento.justificativa}}",
  encaminhamento: "Encaminho o(a) paciente {{paciente.nome}} ({{paciente.codigo}}), {{paciente.idade}}, para avaliação em {{documento.especialidade}}.\n\nMotivo do encaminhamento: {{documento.texto}}",
  relatorio: "Paciente {{paciente.nome}} ({{paciente.codigo}}), {{paciente.idade}}, convênio {{paciente.convenio}}, encontra-se em acompanhamento nesta instituição.\n\n{{documento.texto}}",
  laudo: "Paciente: {{paciente.nome}} — {{paciente.codigo}}\n\n{{documento.texto}}",
  resumo: "Resumo de atendimento de {{paciente.nome}} ({{paciente.codigo}}), realizado em {{documento.data_emissao}}.\n\n{{documento.texto}}",
  alta: "O(a) paciente {{paciente.nome}} ({{paciente.codigo}}) recebe alta hospitalar nesta data, com orientações de seguimento descritas abaixo.\n\n{{documento.texto}}",
  consentimento: "Eu, {{paciente.nome}} ({{paciente.codigo}}), declaro estar ciente e de acordo com o procedimento descrito a seguir, no contexto de roleplay da Life+.\n\n{{documento.texto}}",
  personalizado: "{{documento.texto}}",
};

const RECEITA_TYPES: Record<string, string> = { simples: "Receita simples", continua: "Uso contínuo", especial: "Receita especial (fictícia)", personalizada: "Receita personalizada" };
const EXAM_CATS = ["Laboratoriais", "Imagem", "Cardiológicos", "Neurológicos", "Outros"];
const EXAM_PRESETS: Record<string, string[]> = {
  Laboratoriais: ["Hemograma completo", "Glicemia de jejum", "Perfil lipídico", "Função renal", "Função hepática", "Urina tipo 1", "Gasometria arterial"],
  Imagem: ["Raio-X de tórax", "Raio-X de membro", "Ultrassom abdominal", "Tomografia de crânio", "Ressonância magnética", "Ecografia pélvica"],
  Cardiológicos: ["ECG de repouso", "Ecocardiograma", "Holter 24h", "Teste ergométrico", "Mapa 24h"],
  Neurológicos: ["EEG", "Tomografia de crânio", "Ressonância de encéfalo", "Doppler transcraniano"],
  Outros: ["Teste alérgico", "Audiometria", "Espirometria", "Biopsia (fictícia)"],
};

export type DocForm = {
  id?: string; code?: string | null; status: string; kind: string; templateId: string;
  patientId: string; staffId: string; title: string; specialty: string;
  date: string; time: string; days: string; startDate: string; endDate: string;
  text: string; notes: string; meds: MedLine[]; orientation: string; prescriptionType: string;
  exams: string[]; justification: string; category: string; referral: string; body: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);

function emptyForm(kind: string, staffId = ""): DocForm {
  return {
    status: "rascunho", kind, templateId: "", patientId: "", staffId, title: DOC_KINDS[kind] ?? "Documento",
    specialty: "", date: today(), time: nowTime(), days: "1", startDate: today(), endDate: today(),
    text: "", notes: "", meds: [{ ...EMPTY_MED }], orientation: "", prescriptionType: "simples",
    exams: [], justification: "", category: "Laboratoriais", referral: "", body: "",
  };
}

function formFromDoc(d: DocRow): DocForm {
  const data = (d.data ?? {}) as Record<string, unknown>;
  const base = emptyForm(d.kind, (data.staffId as string) ?? "");
  return {
    ...base,
    id: d.id, code: d.code, status: d.status, kind: d.kind, templateId: (data.templateId as string) ?? "",
    patientId: d.patient_id ?? "", staffId: d.staff_id ?? base.staffId, title: d.title,
    specialty: (data.specialty as string) ?? "", date: (data.date as string) ?? today(), time: (data.time as string) ?? nowTime(),
    days: (data.days as string) ?? "1", startDate: (data.startDate as string) ?? today(), endDate: (data.endDate as string) ?? today(),
    text: (data.text as string) ?? "", notes: (data.notes as string) ?? "",
    meds: ((data.meds as MedLine[]) ?? []).length ? (data.meds as MedLine[]) : [{ ...EMPTY_MED }],
    orientation: (data.orientation as string) ?? "", prescriptionType: (data.prescriptionType as string) ?? "simples",
    exams: (data.exams as string[]) ?? [], justification: (data.justification as string) ?? "",
    category: (data.category as string) ?? "Laboratoriais", referral: (data.referral as string) ?? "", body: (data.body as string) ?? d.body,
  };
}

export function stripMedBlock(body: string, meds?: MedLine[]) {
  if (!meds?.length) return body;
  return body.split(/\n{2,}/).filter((p) => !p.includes("Posologia:")).join("\n\n");
}

function medsToText(meds: MedLine[]) {
  return meds.filter((m) => m.name.trim()).map((m, i) => `${i + 1}. ${m.name}${m.concentration ? " — " + m.concentration : ""}${m.presentation ? " (" + m.presentation + ")" : ""}\n   Posologia: ${[m.dose, m.route, m.frequency].filter(Boolean).join(" · ")}${m.duration ? ` · por ${m.duration}` : ""}${m.qty ? ` · ${m.qty}` : ""}${m.notes ? `\n   Obs.: ${m.notes}` : ""}`).join("\n\n");
}

export function buildBody(form: DocForm, template: Template | undefined, vars: Record<string, string>) {
  const base = template?.body?.trim() || DEFAULT_BODIES[form.kind] || DEFAULT_BODIES.personalizado;
  const medsText = medsToText(form.meds);
  if (form.kind === "personalizado" && form.body.trim()) return fillVars(form.body, vars);
  return fillVars(base, { ...vars, "documento.medicamentos": medsText, "documento.exames": form.exams.map((e, i) => `${i + 1}. ${e}`).join("\n"), "documento.dias": form.days || "1", "documento.inicio": form.startDate ? fDate(form.startDate) : "—", "documento.fim": form.endDate ? fDate(form.endDate) : "—", "documento.horario": form.time || "—", "documento.texto": form.text, "documento.justificativa": form.justification, "documento.especialidade": form.referral || form.specialty || "especialidade de referência" });
}

export function DocumentStudio({ presetKind = "atestado", presetPatientId, presetDocId, onSaved }: { presetKind?: string; presetPatientId?: string; presetDocId?: string; onSaved?: (d: DocRow) => void }) {
  const { data, role, reload, go } = useHms();
  const [templatesReady, setTemplatesReady] = useState(false);
  const [form, setForm] = useState<DocForm>(() => ({ ...emptyForm(presetKind), patientId: presetPatientId ?? "" }));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const patient = data.patients.find((p) => p.id === form.patientId) ?? null;
  const staff = data.staff.find((s) => s.id === form.staffId) ?? null;
  const kindTemplateKey = DOC_TEMPLATE_KIND[form.kind] ?? form.kind;
  const kindTemplates = data.templates.filter((t) => !t.archived && (t.kind === kindTemplateKey || t.kind === form.kind));
  const template = data.templates.find((t) => t.id === form.templateId) ?? kindTemplates[0];
  const canFinalize = !!role && ["administrador", "diretor", "medico"].includes(role);

  /* load templates / preset doc once */
  useEffect(() => {
    if (templatesReady) return;
    if (presetDocId) {
      const d = data.docs.find((x) => x.id === presetDocId);
      if (d) setForm(formFromDoc(d));
    }
    setTemplatesReady(true);
  }, [templatesReady, presetDocId, data.docs]);

  /* text drafted by Life+ AI, confirmed by the user in the editor */
  useEffect(() => {
    if (form.id || form.text) return;
    let draft: string | null = null;
    try { draft = sessionStorage.getItem("lifeplus.ai.draft"); } catch { draft = null; }
    if (draft && (presetKind === "relatorio" || presetKind === "personalizado")) {
      setForm((f) => ({ ...f, text: draft as string }));
      try { sessionStorage.removeItem("lifeplus.ai.draft"); } catch { /* ignore */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetKind]);

  /* keep template + specialty in sync with kind/professional */
  useEffect(() => {
    const first = data.templates.find((t) => !t.archived && (t.kind === kindTemplateKey || t.kind === form.kind));
    setForm((f) => ({ ...f, templateId: f.templateId || first?.id || "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.kind, data.templates.length]);
  useEffect(() => {
    if (staff?.specialty) setForm((f) => (f.specialty ? f : { ...f, specialty: staff.specialty ?? "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.staffId]);

  useEffect(() => { if (form.status !== "rascunho") return; if (!form.title || DOC_KINDS[form.kind]) setForm((f) => ({ ...f, title: DOC_KINDS[f.kind] ?? f.title })); }, [form.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const date = form.date ? fDate(form.date) : fDate(new Date().toISOString());
  const vars = docVars(patient, staff, data.settings, {
    "documento.data_emissao": date, "documento.codigo": form.code ?? "", "documento.dias": form.days,
    "documento.inicio": form.startDate ? fDate(form.startDate) : "", "documento.fim": form.endDate ? fDate(form.endDate) : "",
    "documento.horario": form.time, "documento.texto": form.text, "documento.medicamentos": medsToText(form.meds),
    "documento.exames": form.exams.join(", "), "documento.justificativa": form.justification, "documento.especialidade": form.referral,
  });
  const body = buildBody(form, template, vars);
  const set = (patch: Partial<DocForm>) => setForm((f) => ({ ...f, ...patch }));

  const save = async (status: "rascunho" | "finalizado") => {
    if (!form.patientId && form.kind !== "personalizado") { setMsg({ tone: "error", text: "Selecione o paciente do documento." }); return; }
    if (!form.title.trim()) { setMsg({ tone: "error", text: "Informe o título do documento." }); return; }
    setBusy(status); setMsg(null);
    const payload = {
      kind: form.kind, template_id: template?.id ?? null, patient_id: form.patientId || null,
      staff_id: form.staffId || null, title: form.title, body, status,
      data: { ...form, code: form.code, templateId: template?.id ?? "", vars, body },
    };
    const res = form.id ? await hdb.from("lp_documents").update(payload).eq("id", form.id).select("*").single() : await hdb.from("lp_documents").insert(payload).select("*").single();
    setBusy(null);
    if (res.error) { setMsg({ tone: "error", text: res.error.message }); return; }
    const doc = res.data as DocRow;
    setForm((f) => ({ ...f, id: doc.id, code: doc.code, status: doc.status }));
    setMsg({ tone: "info", text: status === "finalizado" ? `Documento ${doc.code} finalizado e registrado no acervo.` : `Rascunho ${doc.code} salvo.` });
    await reload();
    onSaved?.(doc);
  };

  const download = async () => {
    if (!paperRef.current) return;
    setBusy("pdf");
    try { await paperToPdf(paperRef.current, `${form.code || form.kind}-life+.pdf`); }
    catch (e) { setMsg({ tone: "error", text: e instanceof Error ? e.message : "Falha ao gerar PDF." }); }
    finally { setBusy(null); }
  };

  const print = () => { if (paperRef.current) printPaper(paperRef.current); };
  const finalized = form.status === "finalizado";

  return (
    <div className="hms-split items-start">
      <div className="hms-stack">
        <Card title="Dados do documento" sub={`${DOC_KINDS[form.kind] ?? "Documento"} · ${form.code ?? "novo"}`} actions={<Chip tone={finalized ? "ok" : "warn"}>{finalized ? "Finalizado" : "Rascunho"}</Chip>}>
          <div className="hms-form-grid">
            <Field label="Tipo de documento">
              <select className="hms-select" value={form.kind} disabled={!!form.id} onChange={(e) => set({ kind: e.target.value, templateId: "", title: DOC_KINDS[e.target.value] ?? "" })}>
                {Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Modelo Life+">
              <select className="hms-select" value={template?.id ?? ""} onChange={(e) => set({ templateId: e.target.value })}>
                <option value="">— Modelo padrão —</option>
                {kindTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
            <Field label="Data de emissão">
              <input type="date" className="hms-input" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </Field>
            <Field label="Horário">
              <input type="time" className="hms-input" value={form.time} onChange={(e) => set({ time: e.target.value })} />
            </Field>

            {(form.kind === "atestado" || form.kind === "afastamento") && (
              <>
                <Field label="Dias de afastamento"><input type="number" min={0} className="hms-input" value={form.days} onChange={(e) => set({ days: e.target.value })} /></Field>
                <Field label="Observações"><input className="hms-input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
                <Field label="Data inicial"><input type="date" className="hms-input" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} /></Field>
                <Field label="Data final"><input type="date" className="hms-input" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} /></Field>
              </>
            )}
            {(form.kind === "declaracao" || form.kind === "acompanhamento") && (
              <Field label="Horário de comparecimento" className="span-2"><input type="time" className="hms-input" value={form.time} onChange={(e) => set({ time: e.target.value })} /></Field>
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
                        {form.meds.length > 1 && <button className="ml-auto text-[var(--h-faint)] hover:text-[var(--h-vital)]" onClick={() => set({ meds: form.meds.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>}
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
                        <Field label="Observação do item" className="col-span-2"><input className="hms-input" value={m.notes} onChange={(e) => { const meds = [...form.meds]; meds[i] = { ...m, notes: e.target.value }; set({ meds }); }} placeholder="Tomar após refeições" /></Field>
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
              </div>
            )}

            {form.kind === "encaminhamento" && (
              <Field label="Especialidade de destino" className="span-2"><input className="hms-input" value={form.referral} onChange={(e) => set({ referral: e.target.value })} placeholder="Cardiologia" /></Field>
            )}

            <Field label={form.kind === "personalizado" ? "Título do documento" : "Título exibido"} className="span-2">
              <input className="hms-input" value={form.title} onChange={(e) => set({ title: e.target.value })} />
            </Field>

            {form.kind === "personalizado" ? (
              <Field label="Corpo do documento" hint="Use variáveis como {{paciente.nome}} — elas são substituídas automaticamente." className="span-2">
                <textarea className="hms-textarea" rows={8} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder="Escreva o documento…" />
              </Field>
            ) : (
              <Field label={form.kind === "receita" ? "Orientações ao paciente" : form.kind === "atestado" || form.kind === "afastamento" ? "Motivo / texto do atestado" : "Texto complementar"} className="span-2">
                <textarea className="hms-textarea" rows={4} value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder="Informações adicionais que aparecem no documento." />
              </Field>
            )}
          </div>

          {msg && <div className="mt-3"><Banner tone={msg.tone === "error" ? "error" : "info"}>{msg.text}</Banner></div>}
          {finalized && <div className="mt-3"><Banner tone="warn"><b>Documento finalizado.</b> O histórico é imutável (auditoria). Para corrigir, emita um novo documento ou cancele este.</Banner></div>}
          {!canFinalize && <div className="mt-3"><Banner tone="info">Seu cargo pode salvar rascunhos; a finalização é exclusiva de médicos e diretores.</Banner></div>}
        </Card>

        <div className="flex flex-wrap gap-2">
          <Btn icon={Save} disabled={!!busy || finalized} onClick={() => void save("rascunho")}>{busy === "rascunho" ? "Salvando…" : "Salvar rascunho"}</Btn>
          <Btn variant="soft" icon={CheckCircle2} disabled={!!busy || finalized || !canFinalize} onClick={() => void save("finalizado")}>{busy === "finalizado" ? "Finalizando…" : "Finalizar"}</Btn>
          <Btn variant="ghost" icon={Download} disabled={busy === "pdf"} onClick={() => void download()}>{busy === "pdf" ? "Gerando…" : "PDF"}</Btn>
          <Btn variant="ghost" icon={Printer} onClick={print}>Imprimir</Btn>
          <Btn variant="ghost" icon={FilePlus2} onClick={() => setForm({ ...emptyForm(form.kind, form.staffId), patientId: form.patientId })}>Novo</Btn>
        </div>
        <Banner tone="info"><b>Documento fictício de roleplay.</b> Todo documento leva a marcação <i>{DISCLAIMER}</i> e não tem validade médica ou legal.</Banner>
      </div>

      <div className="hms-stack">
        <Card title="Pré-visualização A4" sub="Atualiza em tempo real · o PDF é independente da interface" actions={<Chip tone="outline">A4 · 210 × 297 mm</Chip>} noBody>
          <div className="hms-paper-wrap" style={{ padding: 14 }}>
            <div ref={paperRef}>
              <PaperView settings={data.settings} patient={patient} staff={staff} title={form.title.toUpperCase()} code={form.code} body={stripMedBlock(body, form.kind === "receita" ? form.meds.filter((m) => m.name) : undefined)} date={date} template={template} meds={form.kind === "receita" ? form.meds.filter((m) => m.name) : undefined} extraFields={form.kind === "receita" ? [{ label: "Tipo", value: RECEITA_TYPES[form.prescriptionType] }] : []} />
            </div>
          </div>
        </Card>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--h-muted)]">
          <Lock className="h-3 w-3" /> Documentos finalizados são preservados integralmente no histórico e na auditoria.
          <button className="ml-auto underline" onClick={() => go("templates")}>Editar modelos Life+</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Acervo de documentos                                               */
/* ------------------------------------------------------------------ */

export function DocumentList({ kinds, onOpen, limit, statusFilter }: { kinds?: string[]; onOpen?: (d: DocRow) => void; limit?: number; statusFilter?: string }) {
  const { data, patientById, staffById, go } = useHms();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState(statusFilter ?? "");
  const [view, setView] = useState<DocRow | null>(null);
  const pool = data.docs.filter((d) => (!kinds || kinds.includes(d.kind)) && (!kind || d.kind === kind) && (!(status || statusFilter) || d.status === (status || statusFilter)));
  const list = pool.filter((d) => {
    if (!q.trim()) return true;
    const p = patientById(d.patient_id ?? undefined);
    return [d.title, d.code, p?.full_name, p?.code, d.kind].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase()));
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
            <option value="">Todos os status</option><option value="rascunho">Rascunho</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option>
          </select>
          <span className="push hms-code">{list.length} documentos</span>
        </div>
        <Table head={<tr><th>Documento</th><th>Paciente</th><th>Profissional</th><th>Tipo</th><th>Status</th><th>Emissão</th><th /></tr>}
          empty={!list.length ? <Empty icon={FolderOpen} title="Nenhum documento no acervo" children="Emita um atestado, receita ou relatório para começar." /> : undefined}>
          {list.map((d) => {
            const p = patientById(d.patient_id ?? undefined); const s = staffById(d.staff_id ?? undefined);
            return (
              <tr key={d.id} className="is-clickable" onClick={() => { setView(d); onOpen?.(d); }}>
                <td><div className="strong truncate">{d.title}</div><div className="hms-code">{d.code}</div></td>
                <td><div className="truncate">{p?.full_name ?? "—"}</div><div className="hms-code">{p?.code ?? ""}</div></td>
                <td className="muted">{s?.full_name ?? "—"}</td>
                <td className="muted">{DOC_KINDS[d.kind] ?? d.kind}</td>
                <td><Chip tone={d.status === "finalizado" ? "ok" : d.status === "cancelado" ? "vital" : "warn"}>{d.status}</Chip></td>
                <td className="muted">{fDate(d.finalized_at ?? d.created_at)}</td>
                <td><button className="hms-btn ghost sm" onClick={(e) => { e.stopPropagation(); setView(d); }}><FileText className="h-3.5 w-3.5" />Abrir</button></td>
              </tr>
            );
          })}
        </Table>
      </Card>
      {view && <DocViewer doc={view} onClose={() => setView(null)} onEdit={() => { setView(null); go("documents", { docId: view.id, docKind: view.kind }); }} />}
    </>
  );
}

export function DocViewer({ doc, onClose, onEdit }: { doc: DocRow; onClose: () => void; onEdit?: () => void }) {
  const { data, patientById, staffById, reload } = useHms();
  const paperRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const form = useMemo(() => formFromDoc(doc), [doc]);
  const patient = patientById(doc.patient_id ?? undefined);
  const staff = staffById(doc.staff_id ?? undefined);
  const template = data.templates.find((t) => t.id === form.templateId) ?? data.templates.find((t) => t.kind === (DOC_TEMPLATE_KIND[doc.kind] ?? doc.kind));
  const vars = (doc.data as Record<string, unknown>)?.vars as Record<string, string> | undefined;
  const body = doc.body || buildBody(form, template, vars ?? {});
  const date = fDate(doc.finalized_at ?? doc.created_at);
  const meds = form.kind === "receita" ? form.meds.filter((m) => m.name) : undefined;

  useEffect(() => { /* keep body stable from saved snapshot */ }, [doc.id]);

  return (
    <Modal wide title={doc.title} sub={`${doc.code} · ${DOC_KINDS[doc.kind] ?? doc.kind} · ${doc.status}`} onClose={onClose}
      footer={<>
        <Chip tone={doc.status === "finalizado" ? "ok" : "warn"}>{doc.status}</Chip>
        <div className="ml-auto flex flex-wrap gap-2">
          {doc.status === "rascunho" && onEdit && <Btn variant="soft" icon={Pencil} onClick={onEdit}>Editar rascunho</Btn>}
          {doc.status !== "cancelado" && (
            <Btn variant="danger-ghost" icon={X} onClick={async () => {
              if (!confirm("Cancelar este documento? Ele permanece no histórico para auditoria.")) return;
              await hdb.from("lp_documents").update({ status: "cancelado" }).eq("id", doc.id); await reload(); onClose();
            }}>Cancelar</Btn>
          )}
          <Btn variant="ghost" icon={Printer} onClick={() => paperRef.current && printPaper(paperRef.current)}>Imprimir</Btn>
          <Btn icon={Download} disabled={busy === "pdf"} onClick={async () => { if (!paperRef.current) return; setBusy("pdf"); try { await paperToPdf(paperRef.current, `${doc.code}.pdf`); } finally { setBusy(null); } }}>{busy === "pdf" ? "Gerando…" : "Baixar PDF"}</Btn>
        </div>
      </>}>
      <div ref={paperRef}>
        <PaperView settings={data.settings} patient={patient} staff={staff} title={doc.title.toUpperCase()} code={doc.code} body={stripMedBlock(body, meds)} date={date} template={template} meds={meds} extraFields={[{ label: "Emitido em", value: fDateTime(doc.finalized_at ?? doc.created_at) }]} />
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Módulo DOCUMENTOS                                                  */
/* ------------------------------------------------------------------ */

export function DocumentsModule() {
  const { focus, data } = useHms();
  const [tab, setTab] = useState<"emitir" | "acervo" | "rascunhos">("emitir");
  const draftCount = data.docs.filter((d) => d.status === "rascunho").length;
  return (
    <Page eyebrow="Central de documentos" title="Documentos médicos" sub="Atestados, receitas, laudos e declarações com identidade Life+, numeração própria e PDF A4."
      actions={<><Chip tone="outline">A4 · PDF · impressão</Chip></>}>
      <div className="mb-3"><Tabs items={[{ key: "emitir", label: "Emitir documento" }, { key: "acervo", label: "Acervo", count: data.docs.length }, { key: "rascunhos", label: "Rascunhos", count: draftCount }]} value={tab} onChange={setTab} /></div>
      {tab === "emitir" && <DocumentStudio presetKind={focus.docKind ?? "atestado"} presetPatientId={focus.patientId} presetDocId={focus.docId} />}
      {tab === "acervo" && <DocumentList />}
      {tab === "rascunhos" && <DocumentList statusFilter="rascunho" />}
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/*  MÓDULO MODELOS LIFE+                                               */
/* ------------------------------------------------------------------ */

const VARS = ["{{paciente.nome}}", "{{paciente.codigo}}", "{{paciente.idade}}", "{{paciente.data_nascimento}}", "{{paciente.convenio}}", "{{paciente.tipo_sanguineo}}", "{{profissional.nome}}", "{{profissional.registro}}", "{{profissional.especialidade}}", "{{instituicao.nome}}", "{{documento.data_emissao}}", "{{documento.codigo}}", "{{documento.dias}}", "{{documento.inicio}}", "{{documento.fim}}", "{{documento.horario}}", "{{documento.texto}}", "{{documento.medicamentos}}", "{{documento.exames}}", "{{documento.justificativa}}", "{{documento.especialidade}}"];

export function TemplatesModule() {
  const { data, reload, can } = useHms();
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const [preview, setPreview] = useState<Template | null>(null);
  const [q, setQ] = useState("");
  const list = data.templates.filter((t) => [t.name, t.kind, t.title].some((v) => (v ?? "").toLowerCase().includes(q.toLowerCase())));

  const duplicate = async (t: Template) => {
    await hdb.from("lp_templates").insert({ kind: t.kind, name: `${t.name} (cópia)`, title: t.title, body: t.body, header: t.header, footer: t.footer, accent: t.accent, font: t.font, margin_mm: t.margin_mm, logo_url: t.logo_url });
    await reload();
  };
  const archive = async (t: Template) => { await hdb.from("lp_templates").update({ archived: !t.archived }).eq("id", t.id); await reload(); };
  const seed = async () => {
    const rows = Object.keys(DOCKINDS_FOR_SEED).map((kind) => ({
      kind, name: `${DOC_KINDS[SEED_KIND[kind] ?? kind] ?? "Documento"} Life+`, title: (DOC_KINDS[SEED_KIND[kind] ?? kind] ?? "Documento").toUpperCase(),
      body: DEFAULT_BODIES[SEED_KIND[kind] ?? kind] ?? DEFAULT_BODIES.personalizado, accent: data.settings.accent, font: "serif", margin_mm: 20,
    }));
    await hdb.from("lp_templates").insert(rows); await reload();
  };

  return (
    <Page eyebrow="Modelos institucionais" title="Modelos Life+" sub="Cabeçalho, rodapé, cores, fontes, margens e campos automáticos dos documentos da instituição."
      actions={<><Btn variant="ghost" icon={FileText} onClick={() => void seed()} disabled={!can("templates")}>Restaurar biblioteca</Btn><Btn icon={Plus} onClick={() => setEditing("new")} disabled={!can("templates")}>Novo modelo</Btn></>}>
      <Card noBody>
        <div className="hms-toolbar"><SearchInput value={q} onChange={setQ} placeholder="Buscar modelo…" /><span className="push hms-code">{list.length} modelos</span></div>
        {!list.length ? <Empty icon={FileSignature} title="Nenhum modelo criado" children="Crie um modelo ou restaure a biblioteca inicial Life+." action={<Btn icon={Plus} onClick={() => setEditing("new")}>Novo modelo</Btn>} /> : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => (
              <div key={t.id} className={`rounded-xl border p-4 ${t.archived ? "border-dashed border-[var(--h-line)] opacity-70" : "border-[var(--h-line)]"} bg-[var(--h-panel)]`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: t.accent }}><FileText className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{t.name}</div>
                    <div className="hms-code truncate">{DOC_KINDS[t.kind] ?? t.kind} · {t.font}</div>
                  </div>
                  <Chip tone={t.archived ? "outline" : "ok"}>{t.archived ? "arquivado" : "ativo"}</Chip>
                </div>
                <p className="mt-2 line-clamp-2 text-[11.5px] leading-relaxed text-[var(--h-muted)]">{t.title} — {t.body.slice(0, 120)}…</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Btn size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(t)}>Editar</Btn>
                  <Btn size="sm" variant="ghost" icon={FileText} onClick={() => setPreview(t)}>Prévia</Btn>
                  <Btn size="sm" variant="ghost" icon={Copy} onClick={() => void duplicate(t)}>Duplicar</Btn>
                  <Btn size="sm" variant="ghost" icon={t.archived ? ArchiveRestore : Archive} onClick={() => void archive(t)}>{t.archived ? "Restaurar" : "Arquivar"}</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      {editing && <TemplateEditor template={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
      {preview && (
        <Modal wide title={`Prévia · ${preview.name}`} onClose={() => setPreview(null)} footer={<Btn variant="ghost" onClick={() => setPreview(null)}>Fechar</Btn>}>
          <PaperView settings={data.settings} patient={data.patients[0]} staff={data.staff.find((s) => s.role === "medico") ?? data.staff[0]} title={preview.title} code="DOC-PRÉVIA" body={fillVars(preview.body, docVars(data.patients[0], data.staff[0], data.settings, { "documento.dias": "3", "documento.inicio": fDate(new Date().toISOString()), "documento.fim": fDate(new Date().toISOString()), "documento.horario": "14:00", "documento.texto": "Texto de exemplo do modelo institucional Life+.", "documento.medicamentos": "1. Lifedol — 500 mg (Comprimido)\n   Posologia: 1 comprimido · Via oral · 8/8h · por 5 dias", "documento.exames": "1. Hemograma completo\n2. Raio-X de tórax", "documento.justificativa": "Investigação clínica de roleplay.", "documento.especialidade": "Cardiologia" }))} date={fDate(new Date().toISOString())} template={preview} />
        </Modal>
      )}
    </Page>
  );
}

const SEED_KIND: Record<string, string> = { atestado: "atestado", receita: "receita", declaracao: "declaracao", exames: "exames", encaminhamento: "encaminhamento", relatorio: "relatorio", laudo: "laudo", alta: "alta" };
const DOCKINDS_FOR_SEED: Record<string, true> = { atestado: true, receita: true, declaracao: true, exames: true, encaminhamento: true, relatorio: true, laudo: true, alta: true };

function TemplateEditor({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const { data, reload } = useHms();
  const [f, setF] = useState<Template>(template ?? {
    id: "", kind: "atestado", name: "Novo modelo Life+", title: "ATESTADO MÉDICO", body: DEFAULT_BODIES.atestado,
    header: "", footer: "", accent: data.settings.accent, font: "serif", margin_mm: 20, logo_url: null, archived: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    setBusy(true); setErr(null);
    const payload = { kind: f.kind, name: f.name, title: f.title, body: f.body, header: f.header, footer: f.footer, accent: f.accent, font: f.font, margin_mm: Number(f.margin_mm) || 20, logo_url: f.logo_url, archived: f.archived };
    const res = template?.id ? await hdb.from("lp_templates").update(payload).eq("id", template.id) : await hdb.from("lp_templates").insert(payload);
    setBusy(false);
    if (res.error) { setErr(res.error.message); return; }
    await reload(); onClose();
  };
  return (
    <Modal wide title={template ? `Editar · ${template.name}` : "Novo modelo Life+"} sub="As variáveis automáticas são preenchidas ao emitir o documento." onClose={onClose}
      footer={<><span className="text-[11px] text-[var(--h-muted)]">Prévia em A4 disponível na lista de modelos.</span><div className="ml-auto flex gap-2"><Btn variant="ghost" onClick={onClose}>Cancelar</Btn><Btn icon={Save} disabled={busy} onClick={() => void save()}>{busy ? "Salvando…" : "Salvar modelo"}</Btn></div></>}>
      <div className="hms-form-grid">
        <Field label="Nome do modelo"><input className="hms-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Tipo de documento"><select className="hms-select" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(DOC_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Título no documento"><input className="hms-input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <Field label="Cor institucional"><input type="color" className="hms-input h-9 p-1" value={f.accent} onChange={(e) => setF({ ...f, accent: e.target.value })} /></Field>
        <Field label="Tipografia"><select className="hms-select" value={f.font} onChange={(e) => setF({ ...f, font: e.target.value })}><option value="serif">Serifada (institucional)</option><option value="sans">Sem serifa (moderna)</option><option value="mono">Monoespaçada</option></select></Field>
        <Field label="Margens (mm)"><input type="number" min={8} max={40} className="hms-input" value={f.margin_mm} onChange={(e) => setF({ ...f, margin_mm: Number(e.target.value) })} /></Field>
        <Field label="Cabeçalho adicional" className="span-2"><input className="hms-input" value={f.header} onChange={(e) => setF({ ...f, header: e.target.value })} placeholder="Ex.: Setor de Clínica Médica" /></Field>
        <Field label="Rodapé adicional" className="span-2"><input className="hms-input" value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} placeholder="Ex.: Emitido por telemedicina fictícia" /></Field>
        <Field label="Logotipo (URL opcional)" className="span-2"><input className="hms-input" value={f.logo_url ?? ""} onChange={(e) => setF({ ...f, logo_url: e.target.value || null })} placeholder="https://…" /></Field>
        <div className="span-2">
          <Field label="Corpo do modelo">
            <textarea ref={bodyRef} className="hms-textarea font-[var(--h-mono)] text-[12px]" rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </Field>
          <div className="mt-2 hms-section-label">Campos automáticos</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VARS.map((v) => <button key={v} className="hms-chip outline hover:border-[var(--h-brand)] hover:text-[var(--h-brand)]" onClick={() => insertVar(v)}>{v.replace(/[{}]/g, "")}</button>)}
          </div>
        </div>
      </div>
      {err && <div className="mt-3"><Banner tone="error">{err}</Banner></div>}
    </Modal>
  );
}

/* small helper used by other modules to open a doc kind quickly */
export function DocQuickLinks() {
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
        <button key={i.kind} className="flex items-center gap-2 rounded-xl border border-[var(--h-line)] bg-[var(--h-panel)] px-3 py-2.5 text-left text-[12px] font-medium hover:border-[var(--h-brand)] hover:text-[var(--h-brand)]" onClick={() => go("documents", { docKind: i.kind })}>
          <i.icon className="h-4 w-4" />{i.label}
        </button>
      ))}
    </div>
  );
}

