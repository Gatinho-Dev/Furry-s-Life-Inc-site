import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const hdb = supabase as any;

export const INSURANCES = ["Life+", "Sanklech", "Santa Tereza", "Nenhum"] as const;
export const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const ROLES: Record<string, string> = {
  administrador: "Administrador", diretor: "Diretor", medico: "Médico", enfermeiro: "Enfermeiro",
  recepcionista: "Recepcionista", farmaceutico: "Farmacêutico", tecnico: "Técnico", administrativo: "Administrativo",
};
export const APPT_STATUS: Record<string, string> = {
  agendada: "Agendada", confirmada: "Confirmada", aguardando: "Aguardando", em_atendimento: "Em atendimento",
  concluida: "Concluída", cancelada: "Cancelada", nao_compareceu: "Não compareceu",
};
export const EXAM_STATUS: Record<string, string> = {
  solicitado: "Solicitado", agendado: "Agendado", andamento: "Em andamento", coletado: "Em andamento",
  concluido: "Concluído", laudo: "Concluído", cancelado: "Cancelado",
};
export const EXAM_CATS = ["Laboratoriais", "Imagem", "Cardiológicos", "Neurológicos", "Outros"];
export const BED_STATUS: Record<string, string> = { disponivel: "Disponível", ocupado: "Ocupado", limpeza: "Em limpeza", manutencao: "Em manutenção", reservado: "Reservado" };
export const DOC_KINDS: Record<string, string> = {
  atestado: "Atestado médico", afastamento: "Atestado de afastamento", declaracao: "Declaração de comparecimento",
  acompanhamento: "Declaração de acompanhamento", receita: "Receita médica", exames: "Solicitação de exames",
  encaminhamento: "Encaminhamento médico", relatorio: "Relatório médico", laudo: "Laudo médico",
  resumo: "Resumo de atendimento", alta: "Relatório de alta", consentimento: "Termo de consentimento", personalizado: "Documento personalizado",
};
export const DOC_TEMPLATE_KIND: Record<string, string> = {
  atestado: "atestado", afastamento: "atestado", declaracao: "declaracao", acompanhamento: "declaracao", receita: "receita",
  exames: "exames", encaminhamento: "encaminhamento", relatorio: "relatorio", laudo: "laudo", resumo: "relatorio", alta: "alta",
  consentimento: "relatorio", personalizado: "relatorio",
};
export const DISCLAIMER = "DOCUMENTO FICTÍCIO — ROLEPLAY — SEM VALIDADE MÉDICA OU LEGAL";

export type Patient = {
  id: string; code: string; full_name: string; photo_url: string | null; nickname: string | null; birth_date: string | null; sex: string | null;
  phone: string | null; email: string | null; address: string | null; blood_type: string | null; allergies: string | null; conditions: string | null;
  medications: string | null; medical_notes: string | null; insurance: string | null; complaint: string | null; triage: string; status: string;
  bed_id: string | null; doctor: string | null; is_simulated: boolean; archived_at: string | null; created_at: string; updated_at: string;
};
export type Staff = { id: string; user_id: string | null; full_name: string; photo_url: string | null; username: string | null; role: string; specialty: string | null; registry: string | null; uf: string | null; status: string; created_at: string };
export type Settings = { name: string; logo_url: string | null; address: string | null; phone: string | null; cnpj: string | null; director: string | null; technical_lead: string | null; accent: string; specialties: string[]; sectors: string[] };
export type Bed = { id: string; ward: string; code: string; room: string | null; status: string };
export type Appointment = { id: string; code: string; patient_id: string; staff_id: string | null; specialty: string | null; starts_at: string; duration_min: number; reason: string | null; priority: string; status: string; checked_in_at: string | null; started_at: string | null; finished_at: string | null; created_at: string };
export type RecordRow = { id: string; patient_id: string; appointment_id: string | null; staff_id: string | null; kind: string; specialty: string | null; body: string; data: Record<string, unknown>; corrects: string | null; created_at: string };
export type Template = { id: string; kind: string; name: string; title: string; body: string; header: string; footer: string; accent: string; font: string; margin_mm: number; logo_url: string | null; archived: boolean };
export type DocRow = { id: string; code: string; kind: string; template_id: string | null; patient_id: string | null; staff_id: string | null; title: string; data: Record<string, unknown>; body: string; status: string; finalized_at: string | null; created_at: string; updated_at: string };
export type Exam = { id: string; patient_id: string; kind: string; category: string; status: string; result: string | null; staff_id: string | null; justification: string | null; scheduled_for: string | null; attachments: { path: string; name: string }[]; notes: string | null; requested_at: string; completed_at: string | null };
export type Admission = { id: string; patient_id: string; staff_id: string | null; bed_id: string | null; sector: string | null; reason: string | null; admitted_at: string; discharged_at: string | null; discharge_notes: string | null; status: string };
export type Medication = { id: string; name: string; active_ingredient: string | null; concentration: string | null; presentation: string | null; manufacturer: string | null; stock: number; min_stock: number; lot: string | null; expires_on: string | null };

export type Core = { patients: Patient[]; staff: Staff[]; settings: Settings; beds: Bed[]; me: Staff | null; role: string | null };

export function ageOf(d: string | null | undefined) {
  if (!d) return null;
  const b = new Date(d + "T12:00:00"); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
}
const TZ = "America/Sao_Paulo";
export const fDate = (s: string | null | undefined) => (s ? new Date(s.length === 10 ? s + "T12:00:00" : s).toLocaleDateString("pt-BR", { timeZone: TZ }) : "—");
export const fDateTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const fTime = (s: string) => new Date(s).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export const isToday = (s: string | null | undefined) => !!s && new Date(s).toLocaleDateString("pt-BR", { timeZone: TZ }) === new Date().toLocaleDateString("pt-BR", { timeZone: TZ });

/** Replace {{a.b}} variables. */
export function fillVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}
export function docVars(p: Patient | null | undefined, s: Staff | null | undefined, set: Settings, extra: Record<string, string> = {}) {
  const age = ageOf(p?.birth_date);
  return {
    "paciente.nome": p?.full_name ?? "", "paciente.codigo": p?.code ?? "", "paciente.idade": age != null ? `${age} anos` : "idade não informada",
    "paciente.data_nascimento": p?.birth_date ? fDate(p.birth_date) : "não informada", "paciente.convenio": p?.insurance || "Nenhum",
    "paciente.tipo_sanguineo": p?.blood_type || "não informado",
    "profissional.nome": s?.full_name ?? "", "profissional.registro": s?.registry ? `${s.registry}${s.uf ? "/" + s.uf : ""}` : "",
    "profissional.especialidade": s?.specialty ?? "", "instituicao.nome": set.name,
    "documento.data_emissao": new Date().toLocaleDateString("pt-BR", { timeZone: TZ }), "documento.codigo": extra["documento.codigo"] ?? "(gerado ao salvar)",
    ...extra,
  } as Record<string, string>;
}

export async function uploadLp(file: File, folder: string) {
  const path = `${folder}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("lp-files").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
export async function lpUrl(path: string) {
  const { data } = await supabase.storage.from("lp-files").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

export function toCSV(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return "\uFEFF" + [keys.map(esc).join(";"), ...rows.map((r) => keys.map((k) => esc(r[k])).join(";"))].join("\n");
}
export function download(name: string, content: string, type = "text/csv;charset=utf-8") {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([content], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const can = (role: string | null, roles: string[]) => !!role && (role === "administrador" || roles.includes(role));
