/**
 * Life+ — modelo de documento institucional.
 *
 * Este arquivo é a única fonte de verdade do conteúdo de um documento:
 * ele resolve paciente, profissional, instituição, modelo e variáveis em uma
 * estrutura neutra (`PaperModel`) que é desenhada tanto no PDF quanto na prévia.
 */
import { ageOf, fDate, fillVars, type DocRow, type Patient, type Settings, type Staff, type Template } from "../core";

/* ---------------------------------- tipos --------------------------------- */

export type MedLine = {
  name: string; concentration: string; presentation: string; dose: string;
  route: string; frequency: string; duration: string; qty: string; notes: string;
};
export const EMPTY_MED: MedLine = { name: "", concentration: "", presentation: "", dose: "", route: "Via oral", frequency: "", duration: "", qty: "", notes: "" };

export type Pair = { label: string; value: string };

export type PaperBlock =
  | { t: "prose"; text: string }
  | { t: "section"; title: string; text?: string; bullets?: string[]; numbered?: boolean }
  | { t: "fields"; items: Pair[]; columns?: number }
  | { t: "meds"; items: MedLine[]; orientation?: string }
  | { t: "exams"; items: { name: string; category: string }[]; justification?: string; observations?: string }
  | { t: "callout"; label: string; text: string }
  | { t: "table"; head: string[]; rows: string[][] };

export type PaperPatient = {
  name: string; code: string; birth: string | null; age: number | null;
  insurance: string | null; blood: string | null;
};

export type PaperStaff = {
  name: string; role: string; roleLabel: string; specialty: string | null; registry: string | null;
};

export type PaperInstitution = {
  name: string; address: string | null; phone: string | null; email: string | null;
  cnpj: string | null; director: string | null; technicalLead: string | null;
  logoUrl: string | null; signatureUrl: string | null; sector: string | null;
};

export type PaperStyle = {
  accent: string; family: "sans" | "serif"; scale: number; spacing: number;
  marginMm: number; headingAlign: "center" | "left"; dividers: boolean; logoMark: boolean;
};

export type PaperModel = {
  kind: string;
  title: string;
  kicker: string;
  code: string | null;
  status: string;
  emittedAt: string;
  city: string | null;
  institution: PaperInstitution;
  patient: PaperPatient | null;
  staff: PaperStaff | null;
  style: PaperStyle;
  headerNote: string | null;
  footerNote: string | null;
  blocks: PaperBlock[];
  authenticity: string;
  disclaimer: string;
  signatureNote: string;
  templateName: string | null;
};

/* -------------------------------- constantes ------------------------------- */

export const DISCLAIMER = "DOCUMENTO FICTÍCIO — ROLEPLAY — SEM VALIDADE MÉDICA OU LEGAL";
export const SIGNATURE_NOTE = "Assinatura gráfica de roleplay — não é assinatura digital certificada.";

export const DOC_KINDS: Record<string, string> = {
  atestado: "Atestado médico",
  afastamento: "Atestado de afastamento",
  declaracao: "Declaração de comparecimento",
  acompanhamento: "Declaração de acompanhamento",
  receita: "Receita médica",
  exames: "Solicitação de exames",
  encaminhamento: "Encaminhamento médico",
  relatorio: "Relatório médico",
  laudo: "Laudo médico",
  resumo: "Resumo de atendimento",
  alta: "Relatório de alta",
  consentimento: "Termo de consentimento",
  personalizado: "Documento personalizado",
};

export const DOC_TEMPLATE_KIND: Record<string, string> = {
  atestado: "atestado", afastamento: "atestado", declaracao: "declaracao", acompanhamento: "declaracao",
  receita: "receita", exames: "exames", encaminhamento: "encaminhamento", relatorio: "relatorio",
  laudo: "laudo", resumo: "relatorio", alta: "alta", consentimento: "relatorio", personalizado: "relatorio",
};

export const RECEITA_TYPES: Record<string, string> = {
  simples: "Receita simples", continua: "Uso contínuo", especial: "Receita especial (fictícia)", personalizada: "Receita personalizada",
};

export const EXAM_CATS = ["Laboratoriais", "Imagem", "Cardiológicos", "Neurológicos", "Outros"];
export const EXAM_PRESETS: Record<string, string[]> = {
  Laboratoriais: ["Hemograma completo", "Glicemia de jejum", "Perfil lipídico", "Função renal", "Função hepática", "Urina tipo 1", "Gasometria arterial"],
  Imagem: ["Raio-X de tórax", "Raio-X de membro", "Ultrassom abdominal", "Tomografia de crânio", "Ressonância magnética", "Ecografia pélvica"],
  Cardiológicos: ["ECG de repouso", "Ecocardiograma", "Holter 24h", "Teste ergométrico", "Mapa 24h"],
  Neurológicos: ["EEG", "Tomografia de crânio", "Ressonância de encéfalo", "Doppler transcraniano"],
  Outros: ["Teste alérgico", "Audiometria", "Espirometria", "Biopsia (fictícia)"],
};

/** Textos padrão por tipo. `useTemplateBody` só é chamado quando o modelo não traz corpo. */
export const DEFAULT_BODIES: Record<string, string> = {
  atestado: "Atesto, para os devidos fins, que o(a) paciente {{paciente.nome}} ({{paciente.codigo}}), {{paciente.idade}}, esteve sob meus cuidados profissionais nesta data, necessitando de afastamento de suas atividades pelo período abaixo indicado.\n\n{{documento.texto}}",
  afastamento: "Atesto que o(a) paciente {{paciente.nome}} ({{paciente.codigo}}) encontra-se sob acompanhamento nesta instituição e necessita de afastamento de suas atividades laborais pelo período abaixo indicado.\n\n{{documento.texto}}",
  declaracao: "Declaro, para os devidos fins, que {{paciente.nome}} ({{paciente.codigo}}) compareceu a esta instituição na data e nos horários abaixo registrados para atendimento assistencial.\n\n{{documento.texto}}",
  acompanhamento: "Declaro que o(a) acompanhante do(a) paciente {{paciente.nome}} ({{paciente.codigo}}) permaneceu nesta instituição na data e no horário abaixo registrados, acompanhando o atendimento realizado.\n\n{{documento.texto}}",
  receita: "",
  exames: "",
  encaminhamento: "",
  relatorio: "",
  laudo: "",
  resumo: "Resumo do atendimento de {{paciente.nome}} ({{paciente.codigo}}), realizado em {{documento.data_emissao}}.\n\n{{documento.texto}}",
  alta: "",
  consentimento: "Eu, {{paciente.nome}} ({{paciente.codigo}}), declaro estar ciente e de acordo com o procedimento descrito a seguir, no contexto de roleplay da Life+.\n\n{{documento.texto}}",
  personalizado: "{{documento.texto}}",
};

/** Categorias da central de documentos (ícone é resolvido na interface). */
export const DOC_CATEGORIES: { key: string; label: string; kinds: string[]; description: string; icon: string }[] = [
  { key: "atestado", label: "Atestados", kinds: ["atestado", "afastamento"], description: "Afastamento e comparecimento com período.", icon: "FileSignature" },
  { key: "receita", label: "Receitas", kinds: ["receita"], description: "Receituário com posologia completa.", icon: "Pill" },
  { key: "declaracao", label: "Declarações", kinds: ["declaracao", "acompanhamento", "consentimento"], description: "Comparecimento, acompanhante e termos.", icon: "ClipboardList" },
  { key: "exames", label: "Exames", kinds: ["exames"], description: "Solicitação por categoria e justificativa.", icon: "FlaskConical" },
  { key: "encaminhamento", label: "Encaminhamentos", kinds: ["encaminhamento"], description: "Referência com histórico resumido.", icon: "Stethoscope" },
  { key: "relatorio", label: "Relatórios", kinds: ["relatorio", "resumo"], description: "Documento editorial de várias páginas.", icon: "FileText" },
  { key: "laudo", label: "Laudos", kinds: ["laudo"], description: "Descrição, resultado e conclusão.", icon: "Microscope" },
  { key: "alta", label: "Altas hospitalares", kinds: ["alta"], description: "Internação, evolução e orientações.", icon: "HeartPulse" },
  { key: "personalizado", label: "Modelos personalizados", kinds: ["personalizado"], description: "Texto livre com campos automáticos.", icon: "LayoutTemplate" },
];

/* ------------------------------ estilo do modelo --------------------------- */

export const DEFAULT_STYLE: PaperStyle = {
  accent: "#0f5c9c", family: "serif", scale: 1, spacing: 1, marginMm: 18, headingAlign: "center", dividers: true, logoMark: true,
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * O estilo vive na coluna `style` (jsonb) quando ela existe. Modelos antigos,
 * criados antes dessa coluna, guardam um spec compacto em `font`:
 * "serif" | "serif;scale=1.05;space=1.1".
 */
export function readPaperStyle(template: Template | null | undefined, accentFallback: string): PaperStyle {
  const legacy = parseFontSpec(template?.font);
  const raw = (template?.style ?? {}) as Record<string, unknown>;
  return {
    accent: str(raw.accent) || template?.accent || accentFallback || DEFAULT_STYLE.accent,
    family: raw.family === "sans" || raw.family === "serif" ? raw.family : legacy.family,
    scale: clamp(num(raw.scale, legacy.scale), 0.85, 1.2),
    spacing: clamp(num(raw.spacing, legacy.spacing), 0.8, 1.35),
    marginMm: clamp(num(raw.marginMm, num(template?.margin_mm, DEFAULT_STYLE.marginMm)), 10, 34),
    headingAlign: raw.headingAlign === "left" ? "left" : "center",
    dividers: raw.dividers === false ? false : true,
    logoMark: raw.logoMark === false ? false : true,
  };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown) => v === true;

export function parseFontSpec(font: string | null | undefined): { family: "sans" | "serif"; scale: number; spacing: number } {
  const raw = (font ?? "serif").trim();
  if (raw.startsWith("{")) {
    try {
      const o = JSON.parse(raw) as Record<string, unknown>;
      return { family: o.family === "sans" ? "sans" : "serif", scale: clamp(num(o.scale, 1), 0.85, 1.2), spacing: clamp(num(o.spacing, 1), 0.8, 1.35) };
    } catch { /* cai no legado */ }
  }
  const parts = raw.split(";").map((p) => p.trim());
  const family = parts[0] === "sans" ? "sans" : "serif";
  const read = (key: string) => {
    const hit = parts.find((p) => p.startsWith(`${key}=`));
    return hit ? Number(hit.split("=")[1]) : NaN;
  };
  return { family, scale: clamp(Number.isFinite(read("scale")) ? read("scale") : 1, 0.85, 1.2), spacing: clamp(Number.isFinite(read("space")) ? read("space") : 1, 0.8, 1.35) };
}

export function toStylePayload(style: PaperStyle) {
  return {
    style: {
      accent: style.accent, family: style.family, scale: style.scale, spacing: style.spacing,
      marginMm: style.marginMm, headingAlign: style.headingAlign, dividers: style.dividers, logoMark: style.logoMark,
    },
  };
}

/* ------------------------------ variáveis ---------------------------------- */

const TZ = "America/Sao_Paulo";

export function buildVars(
  patient: Patient | null | undefined,
  staff: Staff | null | undefined,
  settings: Settings,
  extra: Record<string, string> = {},
): Record<string, string> {
  const age = ageOf(patient?.birth_date);
  const roleLabel = staff?.role ? ROLE_LABEL[staff.role] ?? staff.role : "";
  return {
    "paciente.nome": patient?.full_name ?? "",
    "paciente.codigo": patient?.code ?? "",
    "paciente.idade": age != null ? `${age} anos` : "",
    "paciente.data_nascimento": patient?.birth_date ? fDate(patient.birth_date) : "",
    "paciente.convenio": patient?.insurance || "Nenhum",
    "paciente.tipo_sanguineo": patient?.blood_type || "",
    "profissional.nome": staff?.full_name ?? "",
    "profissional.registro": staff?.registry ? `${staff.registry}${staff.uf ? "/" + staff.uf : ""}` : "",
    "profissional.especialidade": staff?.specialty ?? "",
    "profissional.cargo": roleLabel,
    "instituicao.nome": settings.name,
    "instituicao.endereco": settings.address ?? "",
    "instituicao.telefone": settings.phone ?? "",
    "instituicao.email": settings.email ?? "",
    "documento.data_emissao": new Date().toLocaleDateString("pt-BR", { timeZone: TZ }),
    "documento.codigo": extra["documento.codigo"] ?? "",
    ...extra,
  };
}

export const ROLE_LABEL: Record<string, string> = {
  administrador: "Administrador", diretor: "Diretor(a)", medico: "Médico(a)", enfermeiro: "Enfermeiro(a)",
  recepcionista: "Recepcionista", farmaceutico: "Farmacêutico(a)", tecnico: "Técnico(a)", administrativo: "Administrativo(a)",
};

/* --------------------------- montagem do modelo ---------------------------- */

export type PaperInput = {
  kind: string;
  title: string;
  code?: string | null;
  status?: string;
  dateISO?: string | null;
  emittedAt?: string | null;
  body?: string;
  template?: Template | null;
  settings: Settings;
  patient?: Patient | null;
  staff?: Staff | null;
  meds?: MedLine[];
  exams?: { name: string; category: string }[];
  pairs?: Pair[];
  sections?: { title: string; text?: string; bullets?: string[] }[];
  callout?: { label: string; text: string } | null;
  orientation?: string;
  justification?: string;
  observations?: string;
  table?: { head: string[]; rows: string[][] } | null;
  kicker?: string;
  authenticity?: string | null;
  templateName?: string | null;
  signatureUrl?: string | null;
};

function paragraphs(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function bulletsFrom(text: string): string[] {
  return text.split(/\n+/).map((l) => l.replace(/^[-•\d.)\s]+/, "").trim()).filter(Boolean);
}

const cityOf = (address: string | null | undefined) => {
  if (!address) return null;
  const tail = address.split(/[—–-]/).pop()?.trim();
  if (!tail) return null;
  const parts = tail.split(",").map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || null;
};

/** Monta o documento completo. Campos vazios são simplesmente omitidos. */
export function buildPaperModel(input: PaperInput): PaperModel {
  const { kind, settings, patient, staff, template } = input;
  const style = readPaperStyle(template, settings.accent);
  const dateISO = input.dateISO || new Date().toISOString();
  const emittedAt = input.emittedAt ? fDate(input.emittedAt) : fDate(dateISO);

  const patientBlock: PaperPatient | null = patient
    ? {
      name: patient.full_name,
      code: patient.code,
      birth: patient.birth_date ? fDate(patient.birth_date) : null,
      age: ageOf(patient.birth_date),
      insurance: patient.insurance || "Nenhum",
      blood: patient.blood_type || null,
    }
    : null;

  const staffBlock: PaperStaff | null = staff
    ? {
      name: staff.full_name,
      role: staff.role,
      roleLabel: ROLE_LABEL[staff.role] ?? staff.role,
      specialty: staff.specialty || null,
      registry: staff.registry ? `${staff.registry}${staff.uf ? "/" + staff.uf : ""}` : null,
    }
    : null;

  const institution: PaperInstitution = {
    name: settings.name,
    address: settings.address,
    phone: settings.phone,
    email: settings.email ?? null,
    cnpj: settings.cnpj,
    director: settings.director,
    technicalLead: settings.technical_lead,
    logoUrl: template?.logo_url || settings.logo_url || null,
    signatureUrl: input.signatureUrl ?? template?.signature_url ?? settings.signature_url ?? null,
    sector: template?.sector || template?.header || null,
  };

  const body = paragraphs(input.body ?? "");
  const pairs = (input.pairs ?? []).filter((p) => p.value && p.value.trim() && p.value.trim() !== "—");
  const blocks: PaperBlock[] = [];

  const pushSection = (title: string, text?: string, opts: { numbered?: boolean } = {}) => {
    const clean = paragraphs(text ?? "");
    if (!clean) return;
    blocks.push({ t: "section", title, text: clean, ...opts });
  };

  switch (kind) {
    case "receita":
      if (input.meds?.length) blocks.push({ t: "meds", items: input.meds, orientation: paragraphs(input.orientation ?? "") });
      else if (body) blocks.push({ t: "prose", text: body });
      break;

    case "exames":
      if (input.exams?.length || input.justification) {
        blocks.push({
          t: "exams", items: input.exams ?? [], justification: paragraphs(input.justification ?? ""),
          observations: paragraphs(input.observations ?? ""),
        });
      } else if (body) blocks.push({ t: "prose", text: body });
      break;

    case "encaminhamento":
      if (pairs.length) blocks.push({ t: "fields", items: pairs, columns: 2 });
      if (body) blocks.push({ t: "prose", text: body });
      for (const s of input.sections ?? []) pushSection(s.title, s.text);
      break;

    case "relatorio":
    case "resumo":
      for (const s of input.sections ?? []) pushSection(s.title, s.text);
      if (body) blocks.push({ t: "prose", text: body });
      if (input.callout?.text.trim()) blocks.push({ t: "callout", label: input.callout.label, text: paragraphs(input.callout.text) });
      break;

    case "laudo":
      if (pairs.length) blocks.push({ t: "fields", items: pairs, columns: 3 });
      for (const s of input.sections ?? []) pushSection(s.title, s.text);
      if (body) blocks.push({ t: "prose", text: body });
      if (input.callout?.text.trim()) blocks.push({ t: "callout", label: input.callout.label, text: paragraphs(input.callout.text) });
      break;

    case "alta":
      if (pairs.length) blocks.push({ t: "fields", items: pairs, columns: 2 });
      for (const s of input.sections ?? []) pushSection(s.title, s.text);
      if (body) blocks.push({ t: "prose", text: body });
      if (input.callout?.text.trim()) blocks.push({ t: "callout", label: input.callout.label, text: paragraphs(input.callout.text) });
      break;

    case "personalizado":
    case "consentimento":
      if (body) blocks.push({ t: "prose", text: body });
      for (const s of input.sections ?? []) pushSection(s.title, s.text);
      break;

    default: {
      /* atestado, afastamento, declaração, acompanhamento e demais textos corridos */
      if (body) blocks.push({ t: "prose", text: body });
      if (pairs.length) blocks.push({ t: "fields", items: pairs, columns: 2 });
      if (input.callout?.text.trim()) blocks.push({ t: "callout", label: input.callout.label, text: paragraphs(input.callout.text) });
    }
  }

  if (input.table?.rows.length) blocks.push({ t: "table", head: input.table.head, rows: input.table.rows.slice(0, 300) });

  const code = input.code ?? null;
  const status = input.status ?? "rascunho";
  const authenticity = input.authenticity
    ?? (code
      ? `Autenticidade interna: ${code} · consulte o acervo da Life+ para conferir este registro.`
      : "Documento ainda não registrado — o código de autenticidade é gerado ao salvar.");

  return {
    kind,
    title: input.title,
    kicker: input.kicker ?? "Documento assistencial",
    code,
    status,
    emittedAt,
    city: cityOf(settings.address),
    institution,
    patient: patientBlock,
    staff: staffBlock,
    style,
    headerNote: template?.header || null,
    footerNote: template?.footer || null,
    blocks,
    authenticity,
    disclaimer: DISCLAIMER,
    signatureNote: SIGNATURE_NOTE,
    templateName: input.templateName ?? template?.name ?? null,
  };
}

/* ------------------------- helpers de documento salvo ---------------------- */

export function docToInput(doc: DocRow, settings: Settings, patient?: Patient, staff?: Staff, template?: Template | null): PaperInput {
  const data = (doc.data ?? {}) as Record<string, unknown>;
  const get = (k: string) => (typeof data[k] === "string" ? (data[k] as string) : "");
  const meds = Array.isArray(data.meds) ? (data.meds as MedLine[]).filter((m) => m?.name) : [];
  const exams = Array.isArray(data.exams) ? (data.exams as string[]) : [];
  return {
    kind: doc.kind,
    title: doc.title,
    code: doc.code,
    status: doc.status,
    dateISO: get("date") || doc.finalized_at || doc.created_at,
    emittedAt: doc.finalized_at || doc.created_at,
    body: doc.body,
    template,
    settings,
    patient,
    staff,
    meds,
    exams: exams.map((name) => ({ name, category: get("category") || "Exames" })),
    pairs: pairsFromData(doc.kind, data),
    sections: sectionsFromData(doc.kind, data),
    callout: calloutFromData(doc.kind, data),
    orientation: get("orientation") || get("text"),
    justification: get("justification"),
    observations: get("observations"),
    templateName: template?.name ?? null,
  };
}

const firstOf = (data: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
};
const dateOf = (v: string) => (v ? fDate(v) : "");

export function pairsFromData(kind: string, data: Record<string, unknown>): Pair[] {
  const g = (k: string) => firstOf(data, [k]);
  const out: Pair[] = [];
  if (kind === "atestado" || kind === "afastamento") {
    const days = g("days");
    const start = dateOf(g("startDate"));
    const end = dateOf(g("endDate"));
    if (days) out.push({ label: "Dias de afastamento", value: `${days} dia(s)` });
    if (start) out.push({ label: "Início", value: start });
    if (end) out.push({ label: "Término", value: end });
    const notes = g("notes");
    if (notes) out.push({ label: "Observação", value: notes });
  }
  if (kind === "declaracao" || kind === "acompanhamento") {
    const date = dateOf(g("date"));
    const entry = g("entryTime") || g("time");
    const exit = g("exitTime");
    if (date) out.push({ label: "Data do comparecimento", value: date });
    if (entry) out.push({ label: "Entrada", value: entry });
    if (exit) out.push({ label: "Saída", value: exit });
  }
  if (kind === "encaminhamento") {
    const spec = g("referral") || g("specialty");
    if (spec) out.push({ label: "Especialidade de destino", value: spec });
    const to = g("addressee");
    if (to) out.push({ label: "Profissional destinatário", value: to });
  }
  if (kind === "laudo") {
    const type = g("examType");
    const date = dateOf(g("examDate") || g("date"));
    if (type) out.push({ label: "Exame / avaliação", value: type });
    if (date) out.push({ label: "Data do exame", value: date });
  }
  if (kind === "alta") {
    const adm = dateOf(g("admissionDate"));
    const dis = dateOf(g("dischargeDate") || g("date"));
    const doc = g("hospitalDays");
    if (adm) out.push({ label: "Internação", value: adm });
    if (dis) out.push({ label: "Alta", value: dis });
    if (doc) out.push({ label: "Permanência", value: `${doc} dia(s)` });
    const resp = g("responsible");
    if (resp) out.push({ label: "Médico responsável", value: resp });
  }
  return out;
}

export function sectionsFromData(kind: string, data: Record<string, unknown>): { title: string; text: string }[] {
  const g = (k: string) => firstOf(data, [k]);
  const map: Record<string, [string, string][]> = {
    relatorio: [["reason", "Motivo do relatório"], ["history", "Histórico clínico"], ["evaluation", "Avaliação"], ["diagnosis", "Diagnósticos registrados"], ["procedures", "Procedimentos realizados"], ["evolution", "Evolução"], ["finalNotes", "Considerações finais"]],
    resumo: [["reason", "Motivo do atendimento"], ["evolution", "Conduta e evolução"], ["finalNotes", "Considerações finais"]],
    laudo: [["description", "Descrição"], ["result", "Resultado"], ["observations", "Observações"]],
    alta: [["reason", "Motivo da internação"], ["evolution", "Resumo da evolução"], ["procedures", "Procedimentos realizados"], ["instructions", "Orientações"], ["followUp", "Acompanhamento recomendado"]],
    encaminhamento: [["history", "Histórico resumido"], ["observations", "Observações"]],
    personalizado: [],
    consentimento: [["procedures", "Procedimento"], ["observations", "Observações"]],
  };
  return (map[kind] ?? [])
    .map(([key, title]) => ({ title, text: g(key) }))
    .filter((s) => s.text.trim().length > 0);
}

export function calloutFromData(kind: string, data: Record<string, unknown>): { label: string; text: string } | null {
  const g = (k: string) => firstOf(data, [k]);
  if (kind === "laudo" && g("conclusion")) return { label: "Conclusão", text: g("conclusion") };
  if (kind === "alta" && g("condition")) return { label: "Condição na alta", text: g("condition") };
  return null;
}

/** Corpo efetivo de um documento em edição, com variáveis já substituídas. */
export function resolveBody(kind: string, layoutBody: string, template: Template | null | undefined, vars: Record<string, string>) {
  const base = template?.body?.trim() || DEFAULT_BODIES[kind] || DEFAULT_BODIES.personalizado;
  if (layoutBody.trim() && (kind === "personalizado" || kind === "consentimento")) return fillVars(layoutBody, vars);
  return fillVars(base, vars);
}

/** Remove blocos de posologia de corpos antigos (a receita agora é estruturada). */
export function stripMedBlock(body: string) {
  return body.split(/\n{2,}/).filter((p) => !p.includes("Posologia:")).join("\n\n");
}

export function medsToText(meds: MedLine[]) {
  return meds.filter((m) => m.name.trim()).map((m, i) => {
    const head = `${i + 1}. ${m.name}${m.concentration ? " — " + m.concentration : ""}${m.presentation ? ` (${m.presentation})` : ""}`;
    const pos = [m.dose, m.route, m.frequency].filter(Boolean).join(" · ");
    return `${head}\n   Posologia: ${pos}${m.duration ? ` · por ${m.duration}` : ""}${m.qty ? ` · ${m.qty}` : ""}${m.notes ? `\n   Obs.: ${m.notes}` : ""}`;
  }).join("\n\n");
}

export function examsToText(exams: string[]) {
  return exams.map((e, i) => `${i + 1}. ${e}`).join("\n");
}

export { bool, str };
