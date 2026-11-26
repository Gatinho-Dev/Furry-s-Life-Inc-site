import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hdb, ageOf, fDate, isToday, type Admission, type Appointment, type Bed, type DocRow, type Exam, type Medication, type Patient, type RecordRow, type Settings, type Staff, type Template } from "./core";
import { useAuth } from "@/lib/use-auth";

export type ModuleKey =
  | "dashboard" | "patients" | "records" | "appointments" | "queue" | "diagnoses" | "exams"
  | "prescriptions" | "certificates" | "documents" | "templates"
  | "admissions" | "beds" | "pharmacy"
  | "team" | "reports" | "notifications" | "audit" | "settings" | "ai" | "shift" | "maple";

export type Note = { id: string; patient_id: string; body: string; author: string | null; created_at: string };
export type Vital = { id: string; patient_id: string; systolic: number | null; diastolic: number | null; heart_rate: number | null; temperature: number | null; spo2: number | null; measured_at: string };
export type Prescription = { id: string; patient_id: string; medication: string; dose: string | null; schedule: string | null; administered_at: string | null; created_at: string };
export type CatalogItem = { id: string; code: string; name: string; category: string | null };
export type AuditRow = { id: string; actor: string | null; table_name: string; row_id: string | null; action: string; before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null; created_at: string };

export type Focus = { patientId?: string; docKind?: string; docId?: string; examPatient?: string };
export type CoreData = {
  patients: Patient[]; staff: Staff[]; beds: Bed[]; settings: Settings;
  appointments: Appointment[]; exams: Exam[]; docs: DocRow[]; admissions: Admission[];
  meds: Medication[]; templates: Template[]; catalog: CatalogItem[];
  records: RecordRow[]; notes: Note[]; vitals: Vital[]; prescriptions: Prescription[];
};

const DEFAULT_SETTINGS: Settings = {
  name: "Life+", logo_url: null, address: "Av. Life+, 1000 — Centro Médico, Cidade RP", phone: "(00) 0000-0000",
  cnpj: "00.000.000/0001-00 (fictício)", director: null, technical_lead: null, accent: "#1258d6",
  specialties: ["Clínica Geral", "Cardiologia", "Neurologia", "Ortopedia", "Pediatria", "Emergência", "Psiquiatria", "Dermatologia", "Ginecologia", "Cirurgia Geral"],
  sectors: ["Emergência", "Enfermaria", "UTI", "Centro Cirúrgico", "Pediatria"],
};
const EMPTY: CoreData = {
  patients: [], staff: [], beds: [], settings: DEFAULT_SETTINGS, appointments: [], exams: [], docs: [],
  admissions: [], meds: [], templates: [], catalog: [], records: [], notes: [], vitals: [], prescriptions: [],
};

export const ALL_ROLES = ["administrador", "diretor", "medico", "enfermeiro", "recepcionista", "farmaceutico", "tecnico", "administrativo"];

/** Which roles may open each module. The database enforces the same boundaries with RLS. */
export const PERMS: Record<ModuleKey, string[]> = {
  dashboard: ALL_ROLES,
  patients: ["administrador", "diretor", "medico", "enfermeiro", "recepcionista", "tecnico", "administrativo"],
  records: ["administrador", "diretor", "medico", "enfermeiro", "tecnico"],
  appointments: ["administrador", "diretor", "medico", "enfermeiro", "recepcionista", "administrativo"],
  queue: ["administrador", "diretor", "medico", "enfermeiro", "recepcionista"],
  diagnoses: ["administrador", "diretor", "medico", "enfermeiro"],
  exams: ["administrador", "diretor", "medico", "enfermeiro", "tecnico"],
  prescriptions: ["administrador", "diretor", "medico"],
  certificates: ["administrador", "diretor", "medico"],
  documents: ["administrador", "diretor", "medico", "enfermeiro"],
  templates: ["administrador", "diretor", "medico"],
  admissions: ["administrador", "diretor", "medico", "enfermeiro"],
  beds: ["administrador", "diretor", "medico", "enfermeiro", "tecnico"],
  pharmacy: ["administrador", "diretor", "farmaceutico", "enfermeiro", "medico"],
  team: ["administrador", "diretor"],
  reports: ["administrador", "diretor", "medico", "enfermeiro", "recepcionista", "farmaceutico", "administrativo"],
  notifications: ALL_ROLES,
  audit: ["administrador", "diretor"],
  settings: ["administrador", "diretor"],
  ai: ALL_ROLES,
  shift: ALL_ROLES,
  maple: ALL_ROLES,
};

export type Notification = { id: string; tone: "brand" | "warn" | "vital" | "ok"; module: ModuleKey; title: string; detail: string; when: string };

type Ctx = {
  data: CoreData;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  role: string | null;
  me: Staff | null;
  can: (module: ModuleKey) => boolean;
  isAdmin: boolean;
  mod: ModuleKey;
  focus: Focus;
  go: (mod: ModuleKey, focus?: Focus) => void;
  patientById: (id: string | null | undefined) => Patient | undefined;
  staffById: (id: string | null | undefined) => Staff | undefined;
  bedById: (id: string | null | undefined) => Bed | undefined;
  notifications: Notification[];
  lowStock: Medication[];
  activePatients: Patient[];
};

const HmsCtx = createContext<Ctx | null>(null);

export function HmsProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [data, setData] = useState<CoreData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mod, setMod] = useState<ModuleKey>("dashboard");
  const [focus, setFocus] = useState<Focus>({});

  const load = useCallback(async () => {
    const tables = {
      patients: hdb.from("lp_patients").select("*").order("created_at", { ascending: false }).limit(4000),
      staff: hdb.from("lp_staff").select("*").order("full_name"),
      beds: hdb.from("lp_beds").select("*").order("code"),
      settings: hdb.from("lp_settings").select("*").eq("id", 1).maybeSingle(),
      appointments: hdb.from("lp_appointments").select("*").order("starts_at", { ascending: false }).limit(3000),
      exams: hdb.from("lp_exams").select("*").order("requested_at", { ascending: false }).limit(3000),
      docs: hdb.from("lp_documents").select("*").order("created_at", { ascending: false }).limit(2000),
      admissions: hdb.from("lp_admissions").select("*").order("admitted_at", { ascending: false }).limit(2000),
      meds: hdb.from("lp_medications").select("*").order("name"),
      templates: hdb.from("lp_templates").select("*").order("name"),
      catalog: hdb.from("lp_diagnosis_catalog").select("*").order("name"),
      records: hdb.from("lp_records").select("*").order("created_at", { ascending: false }).limit(4000),
      notes: hdb.from("lp_notes").select("*").order("created_at", { ascending: false }).limit(2000),
      vitals: hdb.from("lp_vitals").select("*").order("measured_at").limit(2000),
      prescriptions: hdb.from("lp_prescriptions").select("*").order("created_at", { ascending: false }).limit(2000),
    } as const;

    const entries = Object.entries(tables);
    const results = await Promise.all(entries.map(([, q]) => (q as Promise<{ data: unknown; error: { message: string } | null }>)));
    const next: Record<string, unknown> = {};
    let firstError: string | null = null;
    entries.forEach(([key], i) => {
      const r = results[i];
      next[key] = r.error ? (key === "settings" ? DEFAULT_SETTINGS : []) : (r.data ?? (key === "settings" ? DEFAULT_SETTINGS : []));
      if (r.error && !firstError) firstError = `${key}: ${r.error.message}`;
    });
    if (!next.settings) next.settings = DEFAULT_SETTINGS;
    setData({ ...(next as unknown as CoreData) });
    setError(firstError);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!auth.user) { setLoading(false); return; }
    setLoading(true);
    void load();
  }, [auth.user?.id, load]);

  /* painel assistencial: mantém indicadores e fila atualizados sem recarregar a página */
  useEffect(() => {
    if (!auth.user) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 90000);
    return () => clearInterval(t);
  }, [auth.user, load]);

  const role = useMemo(() => {
    if (!auth.user) return null;
    if (auth.isCeoOrAdmin) return "administrador";
    const staff = (data.staff as Staff[]).find((s) => s.user_id === auth.user?.id || (!!s.username && !!auth.user?.email && s.username === auth.user.email.split("@")[0]));
    return staff?.role ?? null;
  }, [auth.user, auth.isCeoOrAdmin, data.staff]);

  const me = useMemo(() => (data.staff as Staff[]).find((s) => s.user_id === auth.user?.id) ?? null, [data.staff, auth.user?.id]);
  const can = useCallback((m: ModuleKey) => !!role && (PERMS[m] ?? []).includes(role), [role]);
  const isAdmin = role === "administrador" || role === "diretor";

  const go = useCallback((m: ModuleKey, f?: Focus) => {
    setMod(m); setFocus(f ?? {});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const patientById = useCallback((id: string | null | undefined) => (data.patients as Patient[]).find((p) => p.id === id), [data.patients]);
  const staffById = useCallback((id: string | null | undefined) => (data.staff as Staff[]).find((s) => s.id === id), [data.staff]);
  const bedById = useCallback((id: string | null | undefined) => (data.beds as Bed[]).find((b) => b.id === id), [data.beds]);
  const activePatients = useMemo(() => (data.patients as Patient[]).filter((p) => !p.archived_at && !["alta", "obito"].includes(p.status)), [data.patients]);
  const lowStock = useMemo(() => (data.meds as Medication[]).filter((m) => m.stock <= m.min_stock), [data.meds]);

  const notifications = useMemo(() => buildNotifications(data), [data]);

  const value: Ctx = {
    data, loading, error, reload: load, role, me, can, isAdmin, mod, focus, go,
    patientById, staffById, bedById, notifications, lowStock, activePatients,
  };
  return <HmsCtx.Provider value={value}>{children}</HmsCtx.Provider>;
}

export function useHms() {
  const ctx = useContext(HmsCtx);
  if (!ctx) throw new Error("useHms must be used inside HmsProvider");
  return ctx;
}

/* ------------------------------------------------------------ */

function buildNotifications(d: CoreData): Notification[] {
  const out: Notification[] = [];
  const now = Date.now();
  const soon = 60 * 60 * 1000 * 24;

  for (const a of d.appointments as Appointment[]) {
    const t = new Date(a.starts_at).getTime();
    if (["agendada", "confirmada"].includes(a.status) && t >= now && t - now < soon) {
      const p = d.patients.find((x) => x.id === a.patient_id);
      out.push({ id: `appt-soon-${a.id}`, tone: "brand", module: "appointments", title: "Consulta próxima", detail: `${p?.full_name ?? "Paciente"} · ${fDate(a.starts_at)} ${new Date(a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, when: a.starts_at });
    }
    if (a.status === "aguardando") {
      const p = d.patients.find((x) => x.id === a.patient_id);
      out.push({ id: `appt-wait-${a.id}`, tone: "warn", module: "queue", title: "Paciente aguardando", detail: `${p?.full_name ?? "Paciente"} na fila desde ${new Date(a.checked_in_at ?? a.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, when: a.checked_in_at ?? a.starts_at });
    }
  }
  for (const e of d.exams as Exam[]) {
    if (!["concluido", "laudo", "cancelado"].includes(e.status)) {
      const p = d.patients.find((x) => x.id === e.patient_id);
      out.push({ id: `exam-${e.id}`, tone: e.status === "solicitado" ? "warn" : "brand", module: "exams", title: `Exame ${e.status === "solicitado" ? "pendente" : "em andamento"}`, detail: `${e.kind} · ${p?.full_name ?? "Paciente"}`, when: e.requested_at });
    }
  }
  for (const a of d.admissions as Admission[]) {
    if (!a.discharged_at) {
      const p = d.patients.find((x) => x.id === a.patient_id);
      out.push({ id: `adm-${a.id}`, tone: "vital", module: "admissions", title: "Internação ativa", detail: `${p?.full_name ?? "Paciente"} · ${a.sector ?? "setor não informado"}`, when: a.admitted_at });
    }
  }
  for (const p of (d.patients as Patient[]).filter((p) => !p.archived_at && isToday(p.created_at))) {
    out.push({ id: `new-pat-${p.id}`, tone: "ok", module: "patients", title: "Novo paciente cadastrado", detail: `${p.full_name} · ${p.code ?? ""}`, when: p.created_at });
  }
  for (const p of (d.patients as Patient[]).filter((p) => p.status === "triagem" && !p.archived_at)) {
    out.push({ id: `triage-${p.id}`, tone: "warn", module: "queue", title: "Paciente em triagem", detail: p.full_name, when: p.created_at });
  }
  for (const doc of (d.docs as DocRow[]).filter((x) => x.status === "rascunho")) {
    out.push({ id: `doc-${doc.id}`, tone: "brand", module: "documents", title: "Documento em rascunho", detail: `${doc.title} · ${doc.code}`, when: doc.updated_at ?? doc.created_at });
  }
  for (const m of (d.meds as Medication[]).filter((m) => m.stock <= m.min_stock)) {
    out.push({ id: `stock-${m.id}`, tone: "vital", module: "pharmacy", title: "Estoque baixo", detail: `${m.name} · ${m.stock} un. (mín. ${m.min_stock})`, when: new Date().toISOString() });
  }
  const rank = { vital: 0, warn: 1, brand: 2, ok: 3 } as const;
  return out.sort((a, b) => rank[a.tone] - rank[b.tone] || new Date(b.when).getTime() - new Date(a.when).getTime());
}

/** Nearest upcoming appointment for a patient. */
export function nextAppointment(appointments: Appointment[], patientId: string) {
  const now = Date.now();
  return appointments
    .filter((a) => a.patient_id === patientId && new Date(a.starts_at).getTime() >= now && !["cancelada", "concluida", "nao_compareceu"].includes(a.status))
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0];
}

export function patientSummary(p: Patient | undefined, appointments: Appointment[]) {
  if (!p) return [] as { label: string; value: string }[];
  const age = ageOf(p.birth_date);
  return [
    { label: "Código", value: p.code ?? "—" },
    { label: "Idade", value: age != null ? `${age} anos` : "não informada" },
    { label: "Convênio", value: p.insurance || "Nenhum" },
    { label: "Tipo sanguíneo", value: p.blood_type || "não informado" },
    { label: "Consultas", value: String(appointments.filter((a) => a.patient_id === p.id).length) },
  ];
}

export type { Patient, Staff, Bed, Settings, Appointment, Exam, DocRow, Admission, Medication, Template, RecordRow };
