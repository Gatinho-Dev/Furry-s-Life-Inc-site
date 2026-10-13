import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ArrowLeft, HeartPulse, LayoutDashboard, Users, BedDouble, Gamepad2, Plus, Trash2, X, FlaskConical, Pill, NotebookPen, Activity, Play, Square, Trophy, Timer, Server } from "lucide-react";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MaplePanel } from "@/components/lifeplus/MaplePanel";
import { DIFF, TRIAGE, CASES, randomPatient, type Difficulty } from "@/components/lifeplus/game";

export const Route = createFileRoute("/lifeplus/staff")({
  head: () => ({ meta: [{ title: "Life+ · Painel hospitalar" }, { name: "description", content: "Painel hospitalar da Life+." }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LifePlusStaff,
});

type Bed = { id: string; ward: string; code: string };
type Patient = { id: string; full_name: string; birth_date: string | null; sex: string | null; blood_type: string | null; allergies: string | null; insurance: string | null; complaint: string | null; triage: string; status: string; bed_id: string | null; doctor: string | null; is_simulated: boolean; created_at: string };
type Exam = { id: string; patient_id: string; kind: string; status: string; result: string | null; requested_at: string; completed_at: string | null };
type Task = { id: string; shift_id: string | null; patient_id: string | null; kind: string; title: string; points: number; due_at: string | null; done_at: string | null; failed: boolean };

const STATUS: Record<string, string> = { triagem: "Triagem", internado: "Internado", uti: "UTI", alta: "Alta", obito: "Óbito" };
const EXAMS = ["Hemograma", "Raio-X de tórax", "Tomografia de crânio", "ECG", "Ultrassom abdominal", "Glicemia + gasometria", "Urina tipo 1", "Ressonância"];
const inp = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none";
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const btn = "inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";
const ghost = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50";

function age(d: string | null) { if (!d) return "—"; return `${Math.floor((Date.now() - new Date(d).getTime()) / 3.156e10)} anos`; }

function LifePlusStaff() {
  const auth = useAuth(); const nav = useNavigate();
  const [tab, setTab] = useState<"overview" | "patients" | "beds" | "game" | "maple">("overview");
  const [beds, setBeds] = useState<Bed[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const [b, p, e] = await Promise.all([
      supabase.from("lp_beds").select("*").order("code"),
      supabase.from("lp_patients").select("*").order("created_at", { ascending: false }),
      supabase.from("lp_exams").select("*").order("requested_at", { ascending: false }).limit(300),
    ]);
    if (p.error) setErr(p.error.message);
    setBeds((b.data ?? []) as Bed[]); setPatients((p.data ?? []) as Patient[]); setExams((e.data ?? []) as Exam[]);
  };
  useEffect(() => { if (auth.user && auth.hasAccess("lifeplus")) load(); }, [auth.user, auth.ready]);

  if (auth.loading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (!auth.user) { nav({ to: "/auth", search: { redirect: "/lifeplus/staff" } }); return null; }
  if (!auth.hasAccess("lifeplus")) return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-center text-slate-700"><div><div className="text-xl font-semibold">Acesso negado</div><p className="mt-2 text-sm">Peça acesso à Life+.</p><Link to="/staff/dashboard" className="mt-4 inline-block text-sm text-blue-600 hover:underline">Voltar</Link></div></div>;

  const tabs = [
    { k: "overview", l: "Visão geral", i: LayoutDashboard }, { k: "patients", l: "Pacientes", i: Users },
    { k: "beds", l: "Leitos", i: BedDouble }, { k: "game", l: "Modo Plantão", i: Gamepad2 }, { k: "maple", l: "Maple Hospital", i: Server },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Link to="/staff/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Painel central</Link>
        <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-600 text-white"><HeartPulse className="h-4 w-4" /></span>Life+ Hospital</div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <nav className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1">
          {tabs.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm ${tab === t.k ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><t.i className="h-4 w-4" />{t.l}</button>)}
        </nav>
        {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
        {tab === "overview" && <Overview beds={beds} patients={patients} exams={exams} onOpen={setOpen} />}
        {tab === "patients" && <PatientsPanel beds={beds} patients={patients} reload={load} onOpen={setOpen} />}
        {tab === "beds" && <BedsPanel beds={beds} patients={patients} onOpen={setOpen} />}
        {tab === "maple" && <MaplePanel />}
        {tab === "game" && <GamePanel userId={auth.user.id} beds={beds} patients={patients} reload={load} onOpen={setOpen} />}
      </main>
      {open && <PatientDrawer id={open} beds={beds} patients={patients} onClose={() => setOpen(null)} reload={load} author={auth.user.email ?? "equipe"} />}
    </div>
  );
}

function Overview({ beds, patients, exams, onOpen }: { beds: Bed[]; patients: Patient[]; exams: Exam[]; onOpen: (id: string) => void }) {
  const active = patients.filter((p) => !["alta", "obito"].includes(p.status));
  const occ = new Set(active.map((p) => p.bed_id).filter(Boolean));
  const stats = [
    ["Pacientes ativos", active.length], ["Leitos ocupados", `${occ.size}/${beds.length}`],
    ["Na UTI", active.filter((p) => p.status === "uti").length], ["Exames pendentes", exams.filter((e) => e.status !== "concluido").length],
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">{stats.map(([l, v]) => <div key={l} className={card}><div className="text-3xl font-semibold text-blue-600">{v}</div><div className="mt-1 text-sm text-slate-500">{l}</div></div>)}</div>
      <div className={card}>
        <div className="mb-3 font-semibold">Triagem (Manchester)</div>
        <div className="grid grid-cols-5 gap-2">{["vermelho", "laranja", "amarelo", "verde", "azul"].map((t) => <div key={t} className={`rounded-xl p-3 text-center ${TRIAGE[t].cls}`}><div className="text-2xl font-semibold">{active.filter((p) => p.triage === t).length}</div><div className="text-xs">{TRIAGE[t].label}</div></div>)}</div>
      </div>
      <div className={card}>
        <div className="mb-3 font-semibold">Fila de atendimento</div>
        <PatientTable list={active.slice(0, 12)} beds={beds} onOpen={onOpen} />
      </div>
    </div>
  );
}

function PatientTable({ list, beds, onOpen, onDelete }: { list: Patient[]; beds: Bed[]; onOpen: (id: string) => void; onDelete?: (id: string) => void }) {
  if (!list.length) return <div className="py-6 text-center text-sm text-slate-500">Nenhum paciente.</div>;
  return (
    <div className="divide-y divide-slate-100">
      {list.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5">
          <span className={`h-3 w-3 shrink-0 rounded-full ${TRIAGE[p.triage]?.cls ?? "bg-slate-300"}`} />
          <button onClick={() => onOpen(p.id)} className="min-w-0 flex-1 text-left">
            <div className="truncate text-sm font-medium">{p.full_name} {p.is_simulated && <span className="ml-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">simulação</span>}</div>
            <div className="truncate text-xs text-slate-500">{age(p.birth_date)} · {p.complaint ?? "—"}</div>
          </button>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{STATUS[p.status] ?? p.status}</span>
          <span className="w-16 text-right text-xs text-slate-500">{beds.find((b) => b.id === p.bed_id)?.code ?? "—"}</span>
          {onDelete && <button onClick={() => onDelete(p.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
        </div>
      ))}
    </div>
  );
}

function PatientsPanel({ beds, patients, reload, onOpen }: { beds: Bed[]; patients: Patient[]; reload: () => void; onOpen: (id: string) => void }) {
  const empty = { full_name: "", birth_date: "", sex: "", blood_type: "", allergies: "", insurance: "", complaint: "", triage: "verde", doctor: "" };
  const [f, setF] = useState(empty); const [q, setQ] = useState(""); const [filter, setFilter] = useState("ativos"); const [showSim, setShowSim] = useState(false);
  const add = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.full_name.trim()) return;
    const o: Record<string, string | null> = {}; Object.entries(f).forEach(([k, v]) => (o[k] = v || null));
    await supabase.from("lp_patients").insert({ ...o, full_name: f.full_name, triage: f.triage });
    setF(empty); reload();
  };
  const del = async (id: string) => { if (confirm("Excluir paciente e todo o prontuário?")) { await supabase.from("lp_patients").delete().eq("id", id); reload(); } };
  const list = patients.filter((p) => (showSim || !p.is_simulated) && (filter === "todos" || (filter === "ativos" ? !["alta", "obito"].includes(p.status) : p.status === filter)) && p.full_name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <form onSubmit={add} className={`${card} grid gap-2 sm:grid-cols-3`}>
        <div className="font-semibold sm:col-span-3">Novo paciente</div>
        <input className={inp} placeholder="Nome completo *" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        <input className={inp} type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
        <select className={inp} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}><option value="">Sexo</option><option value="F">Feminino</option><option value="M">Masculino</option><option value="O">Outro</option></select>
        <select className={inp} value={f.blood_type} onChange={(e) => setF({ ...f, blood_type: e.target.value })}><option value="">Tipo sanguíneo</option>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b}>{b}</option>)}</select>
        <input className={inp} placeholder="Alergias" value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} />
        <input className={inp} placeholder="Convênio" value={f.insurance} onChange={(e) => setF({ ...f, insurance: e.target.value })} />
        <input className={`${inp} sm:col-span-2`} placeholder="Queixa principal" value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} />
        <select className={inp} value={f.triage} onChange={(e) => setF({ ...f, triage: e.target.value })}>{["vermelho", "laranja", "amarelo", "verde", "azul"].map((t) => <option key={t} value={t}>{TRIAGE[t].label}</option>)}</select>
        <input className={`${inp} sm:col-span-2`} placeholder="Médico responsável" value={f.doctor} onChange={(e) => setF({ ...f, doctor: e.target.value })} />
        <button className={btn}><Plus className="h-4 w-4" />Cadastrar</button>
      </form>
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input className={`${inp} max-w-xs`} placeholder="Buscar paciente…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={`${inp} w-auto`} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ativos">Ativos</option><option value="todos">Todos</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label className="flex items-center gap-1.5 text-xs text-slate-600"><input type="checkbox" checked={showSim} onChange={(e) => setShowSim(e.target.checked)} />Mostrar simulação</label>
          <span className="ml-auto text-xs text-slate-500">{list.length} pacientes</span>
        </div>
        <PatientTable list={list} beds={beds} onOpen={onOpen} onDelete={del} />
      </div>
    </div>
  );
}

function BedsPanel({ beds, patients, onOpen }: { beds: Bed[]; patients: Patient[]; onOpen: (id: string) => void }) {
  const wards = [...new Set(beds.map((b) => b.ward))];
  return (
    <div className="space-y-4">
      {wards.map((w) => (
        <div key={w} className={card}>
          <div className="mb-3 font-semibold">{w}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {beds.filter((b) => b.ward === w).map((b) => {
              const p = patients.find((x) => x.bed_id === b.id && !["alta", "obito"].includes(x.status));
              return (
                <button key={b.id} disabled={!p} onClick={() => p && onOpen(p.id)} className={`rounded-xl border p-3 text-left ${p ? "border-blue-200 bg-blue-50 hover:bg-blue-100" : "border-dashed border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between text-xs font-semibold"><span>{b.code}</span>{p && <span className={`h-2.5 w-2.5 rounded-full ${TRIAGE[p.triage]?.cls}`} />}</div>
                  <div className="mt-1 truncate text-xs text-slate-600">{p ? p.full_name : "Livre"}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PatientDrawer({ id, beds, patients, onClose, reload, author }: { id: string; beds: Bed[]; patients: Patient[]; onClose: () => void; reload: () => void; author: string }) {
  const p = patients.find((x) => x.id === id);
  const [notes, setNotes] = useState<{ id: string; body: string; author: string | null; created_at: string }[]>([]);
  const [vitals, setVitals] = useState<{ id: string; systolic: number | null; diastolic: number | null; heart_rate: number | null; temperature: number | null; spo2: number | null; measured_at: string }[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [rx, setRx] = useState<{ id: string; medication: string; dose: string | null; schedule: string | null; administered_at: string | null }[]>([]);
  const [note, setNote] = useState(""); const [v, setV] = useState({ systolic: "", diastolic: "", heart_rate: "", temperature: "", spo2: "" });
  const [ex, setEx] = useState(EXAMS[0]); const [m, setM] = useState({ medication: "", dose: "", schedule: "" });
  const loadAll = async () => {
    const [n, vi, e, r] = await Promise.all([
      supabase.from("lp_notes").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
      supabase.from("lp_vitals").select("*").eq("patient_id", id).order("measured_at"),
      supabase.from("lp_exams").select("*").eq("patient_id", id).order("requested_at", { ascending: false }),
      supabase.from("lp_prescriptions").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    ]);
    setNotes((n.data ?? []) as typeof notes); setVitals((vi.data ?? []) as typeof vitals); setExams((e.data ?? []) as Exam[]); setRx((r.data ?? []) as typeof rx);
  };
  useEffect(() => { loadAll(); }, [id]);
  if (!p) return null;
  const upd = async (patch: Partial<Patient>) => { await supabase.from("lp_patients").update(patch).eq("id", id); reload(); };
  const usedBeds = new Set(patients.filter((x) => x.id !== id && !["alta", "obito"].includes(x.status)).map((x) => x.bed_id));
  const num = (s: string) => (s ? Number(s) : null);
  const last = vitals[vitals.length - 1];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 p-6 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div><div className="text-2xl font-semibold">{p.full_name}</div><div className="text-sm text-slate-500">{age(p.birth_date)} · {p.sex ?? "—"} · Sangue {p.blood_type ?? "—"} · {p.insurance ?? "Particular"}</div>
            {p.allergies && <div className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">Alergia: {p.allergies}</div>}</div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className={`${card} mt-4 grid gap-2 sm:grid-cols-4`}>
          <select className={inp} value={p.triage} onChange={(e) => upd({ triage: e.target.value })}>{Object.entries(TRIAGE).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</select>
          <select className={inp} value={p.status} onChange={(e) => upd({ status: e.target.value, ...(["alta", "obito"].includes(e.target.value) ? { bed_id: null } : {}) })}>{Object.entries(STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className={inp} value={p.bed_id ?? ""} onChange={(e) => upd({ bed_id: e.target.value || null })}><option value="">Sem leito</option>{beds.filter((b) => !usedBeds.has(b.id)).map((b) => <option key={b.id} value={b.id}>{b.code} · {b.ward}</option>)}</select>
          <input className={inp} placeholder="Médico" defaultValue={p.doctor ?? ""} onBlur={(e) => upd({ doctor: e.target.value || null })} />
          <div className="text-sm text-slate-600 sm:col-span-4"><b>Queixa:</b> {p.complaint ?? "—"}</div>
        </div>

        <Section icon={Activity} title="Sinais vitais">
          {last && <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">{[["PA", `${last.systolic ?? "—"}/${last.diastolic ?? "—"}`], ["FC", `${last.heart_rate ?? "—"} bpm`], ["Temp", `${last.temperature ?? "—"} °C`], ["SpO₂", `${last.spo2 ?? "—"}%`]].map(([a, b]) => <div key={a} className="rounded-xl bg-slate-100 p-2"><div className="text-slate-500">{a}</div><div className="font-semibold">{b}</div></div>)}</div>}
          {vitals.length > 1 && <Spark values={vitals.map((x) => x.heart_rate ?? 0)} />}
          <div className="mt-2 grid grid-cols-6 gap-2">
            {(["systolic", "diastolic", "heart_rate", "temperature", "spo2"] as const).map((k) => <input key={k} className={inp} placeholder={{ systolic: "PAS", diastolic: "PAD", heart_rate: "FC", temperature: "Temp", spo2: "SpO₂" }[k]} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />)}
            <button className={btn} onClick={async () => { await supabase.from("lp_vitals").insert({ patient_id: id, systolic: num(v.systolic), diastolic: num(v.diastolic), heart_rate: num(v.heart_rate), temperature: num(v.temperature), spo2: num(v.spo2) }); setV({ systolic: "", diastolic: "", heart_rate: "", temperature: "", spo2: "" }); loadAll(); }}>+</button>
          </div>
        </Section>

        <Section icon={FlaskConical} title="Exames">
          <div className="mb-3 flex gap-2"><select className={inp} value={ex} onChange={(e) => setEx(e.target.value)}>{EXAMS.map((x) => <option key={x}>{x}</option>)}</select><button className={btn} onClick={async () => { await supabase.from("lp_exams").insert({ patient_id: id, kind: ex }); loadAll(); reload(); }}>Solicitar</button></div>
          {exams.map((e) => <ExamRow key={e.id} e={e} reload={() => { loadAll(); reload(); }} />)}
          {!exams.length && <div className="text-xs text-slate-500">Nenhum exame.</div>}
        </Section>

        <Section icon={Pill} title="Prescrições">
          <div className="mb-3 grid grid-cols-4 gap-2"><input className={inp} placeholder="Medicamento" value={m.medication} onChange={(e) => setM({ ...m, medication: e.target.value })} /><input className={inp} placeholder="Dose" value={m.dose} onChange={(e) => setM({ ...m, dose: e.target.value })} /><input className={inp} placeholder="Horário" value={m.schedule} onChange={(e) => setM({ ...m, schedule: e.target.value })} /><button className={btn} onClick={async () => { if (!m.medication) return; await supabase.from("lp_prescriptions").insert({ patient_id: id, medication: m.medication, dose: m.dose || null, schedule: m.schedule || null }); setM({ medication: "", dose: "", schedule: "" }); loadAll(); }}>Prescrever</button></div>
          {rx.map((r) => <div key={r.id} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm"><div><b>{r.medication}</b> <span className="text-slate-500">{r.dose} · {r.schedule}</span></div>{r.administered_at ? <span className="text-xs text-green-600">Administrado {new Date(r.administered_at).toLocaleTimeString("pt-BR")}</span> : <button className={ghost} onClick={async () => { await supabase.from("lp_prescriptions").update({ administered_at: new Date().toISOString() }).eq("id", r.id); loadAll(); }}>Administrar</button>}</div>)}
        </Section>

        <Section icon={NotebookPen} title="Evolução / prontuário">
          <textarea className={inp} rows={3} placeholder="Registrar evolução…" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className={`${btn} mt-2`} onClick={async () => { if (!note.trim()) return; await supabase.from("lp_notes").insert({ patient_id: id, body: note, author }); setNote(""); loadAll(); }}>Salvar evolução</button>
          {notes.map((n) => <div key={n.id} className="mt-3 border-l-2 border-blue-200 pl-3 text-sm"><div className="text-xs text-slate-500">{new Date(n.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {n.author}</div><div className="whitespace-pre-wrap">{n.body}</div></div>)}
        </Section>
      </div>
    </div>
  );
}

function ExamRow({ e, reload }: { e: Exam; reload: () => void }) {
  const [res, setRes] = useState(e.result ?? "");
  const set = async (patch: Partial<Exam>) => { await supabase.from("lp_exams").update(patch).eq("id", e.id); reload(); };
  return (
    <div className="border-t border-slate-100 py-2 text-sm">
      <div className="flex items-center justify-between"><b>{e.kind}</b>
        <div className="flex gap-1">{e.status === "solicitado" && <button className={ghost} onClick={() => set({ status: "coletado" })}>Marcar coletado</button>}
          <span className={`rounded-full px-2 py-0.5 text-xs ${e.status === "concluido" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{e.status}</span></div></div>
      {e.status !== "solicitado" && <div className="mt-1 flex gap-2"><input className={inp} placeholder="Resultado / laudo" value={res} onChange={(x) => setRes(x.target.value)} /><button className={ghost} onClick={() => set({ result: res, status: "concluido", completed_at: new Date().toISOString() })}>Salvar laudo</button></div>}
    </div>
  );
}

function Section({ icon: I, title, children }: { icon: typeof Activity; title: string; children: React.ReactNode }) {
  return <div className={`${card} mt-4`}><div className="mb-3 flex items-center gap-2 font-semibold"><I className="h-4 w-4 text-blue-600" />{title}</div>{children}</div>;
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 28}`).join(" ");
  return <svg viewBox="0 0 100 30" className="h-12 w-full"><polyline points={pts} fill="none" stroke="#2563eb" strokeWidth="1.5" /></svg>;
}

/* ---------------- Modo Plantão ---------------- */
type Step = "triar" | "exame" | "laudo" | "medicar" | "destino";
const NEXT: Record<Step, Step | null> = { triar: "exame", exame: "laudo", laudo: "medicar", medicar: "destino", destino: null };
const STEP_TITLE: Record<Step, string> = { triar: "Classificar risco de", exame: "Solicitar exame para", laudo: "Ler resultado do exame de", medicar: "Medicar", destino: "Definir destino de" };

function GamePanel({ userId, beds, patients, reload, onOpen }: { userId: string; beds: Bed[]; patients: Patient[]; reload: () => void; onOpen: (id: string) => void }) {
  const [diff, setDiff] = useState<Difficulty>("normal");
  const [shift, setShift] = useState<{ id: string; score: number; seen: number; done: number; started: number } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now, setNow] = useState(Date.now());
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ score: number; seen: number; done: number } | null>(null);
  const caseOf = useRef<Record<string, (typeof CASES)[number]>>({});
  const spawnT = useRef<number | null>(null);
  const shiftRef = useRef(shift); shiftRef.current = shift;
  const [history, setHistory] = useState<{ id: string; difficulty: string; score: number; patients_seen: number; started_at: string }[]>([]);

  const loadHistory = async () => { const { data } = await supabase.from("lp_shifts").select("*").eq("user_id", userId).not("ended_at", "is", null).order("score", { ascending: false }).limit(5); setHistory((data ?? []) as typeof history); };
  useEffect(() => { loadHistory(); }, []);
  const push = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString("pt-BR")} · ${s}`, ...l].slice(0, 30));
  const addScore = (pts: number, done = 0, seen = 0) => setShift((s) => s && ({ ...s, score: s.score + pts, done: s.done + done, seen: s.seen + seen }));

  const createTask = async (shiftId: string, patientId: string, step: Step, name: string) => {
    const { data } = await supabase.from("lp_shift_tasks").insert({ shift_id: shiftId, patient_id: patientId, kind: step, title: `${STEP_TITLE[step]} ${name}`, points: 10, due_at: new Date(Date.now() + DIFF[diff].taskSec * 1000).toISOString() }).select().single();
    if (data) setTasks((t) => [...t, data as Task]);
  };

  const spawn = async () => {
    const s = shiftRef.current; if (!s) return;
    const g = randomPatient();
    const { data: p } = await supabase.from("lp_patients").insert(g.patient).select().single();
    if (!p) return;
    caseOf.current[p.id] = g.case;
    await supabase.from("lp_vitals").insert({ patient_id: p.id, ...g.vitals });
    push(`🚑 Chegou ${p.full_name}: ${g.case.complaint}`);
    addScore(0, 0, 1);
    await createTask(s.id, p.id, "triar", p.full_name);
    reload();
    const [a, b] = DIFF[diff].spawnMs;
    spawnT.current = window.setTimeout(spawn, a + Math.random() * (b - a));
  };

  const start = async () => {
    const { data } = await supabase.from("lp_shifts").insert({ user_id: userId, difficulty: diff }).select().single();
    if (!data) return;
    setSummary(null); setTasks([]); setLog([]);
    setShift({ id: data.id, score: 0, seen: 0, done: 0, started: Date.now() });
    shiftRef.current = { id: data.id, score: 0, seen: 0, done: 0, started: Date.now() };
    push("Plantão iniciado. Boa sorte, doutor(a)!");
    spawn();
  };
  const stop = async () => {
    if (spawnT.current) clearTimeout(spawnT.current);
    const s = shiftRef.current; if (!s) return;
    await supabase.from("lp_shifts").update({ ended_at: new Date().toISOString(), score: s.score, patients_seen: s.seen, tasks_done: s.done }).eq("id", s.id);
    setSummary({ score: s.score, seen: s.seen, done: s.done }); setShift(null); loadHistory();
  };
  useEffect(() => () => { if (spawnT.current) clearTimeout(spawnT.current); }, []);

  // relógio + tarefas expiradas
  useEffect(() => {
    if (!shift) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const expired = tasks.filter((x) => !x.done_at && !x.failed && x.due_at && new Date(x.due_at).getTime() < Date.now());
      for (const x of expired) {
        await supabase.from("lp_shift_tasks").update({ failed: true }).eq("id", x.id);
        setTasks((ts) => ts.map((y) => (y.id === x.id ? { ...y, failed: true, due_at: new Date(Date.now() + DIFF[diff].taskSec * 1000).toISOString() } : y)));
        const p = patients.find((y) => y.id === x.patient_id);
        if (p) {
          const order = ["azul", "verde", "amarelo", "laranja", "vermelho"]; const i = order.indexOf(p.triage);
          if (p.triage === "vermelho" && x.failed) { await supabase.from("lp_patients").update({ status: "obito", bed_id: null }).eq("id", p.id); push(`💀 ${p.full_name} não resistiu à demora.`); addScore(-100); setTasks((ts) => ts.filter((y) => y.patient_id !== p.id)); }
          else { if (i >= 0 && i < 4) await supabase.from("lp_patients").update({ triage: order[i + 1] }).eq("id", p.id); push(`⚠️ ${p.full_name} piorou por espera.`); addScore(-15); }
          reload();
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [shift, tasks, patients]);

  const complete = async (t: Task, ok: boolean, extra?: string) => {
    const p = patients.find((x) => x.id === t.patient_id); if (!p || !shift) return;
    const c = caseOf.current[p.id];
    await supabase.from("lp_shift_tasks").update({ done_at: new Date().toISOString() }).eq("id", t.id);
    setTasks((ts) => ts.filter((x) => x.id !== t.id));
    const pts = ok ? (t.failed ? 5 : 20) + (TRIAGE[c?.triage ?? "verde"].pts / 5) : -10;
    addScore(Math.round(pts), 1);
    push(`${ok ? "✅" : "❌"} ${t.title}${extra ? ` — ${extra}` : ""} (${pts > 0 ? "+" : ""}${Math.round(pts)})`);
    const next = NEXT[t.kind as Step];
    if (next) await createTask(shift.id, p.id, next, p.full_name);
    reload();
  };

  const freeBed = (ward: string) => { const used = new Set(patients.filter((x) => !["alta", "obito"].includes(x.status)).map((x) => x.bed_id)); return beds.find((b) => b.ward === ward && !used.has(b.id)); };

  const actions = (t: Task) => {
    const p = patients.find((x) => x.id === t.patient_id); const c = p && caseOf.current[p.id];
    if (!p || !c) return <span className="text-xs text-slate-400">Paciente indisponível</span>;
    if (t.kind === "triar") return ["vermelho", "laranja", "amarelo", "verde", "azul"].map((k) => <button key={k} className={`rounded-lg px-2 py-1 text-xs ${TRIAGE[k].cls}`} onClick={async () => { await supabase.from("lp_patients").update({ triage: k }).eq("id", p.id); const bed = freeBed("Emergência"); if (bed) await supabase.from("lp_patients").update({ bed_id: bed.id }).eq("id", p.id); complete(t, k === c.triage, k === c.triage ? "classificação correta" : `o correto era ${TRIAGE[c.triage].label}`); }}>{TRIAGE[k].label}</button>);
    if (t.kind === "exame") { const opts = [...new Set([c.exam, ...EXAMS.slice(0, 3)])].sort(); return opts.map((x) => <button key={x} className={ghost} onClick={async () => { await supabase.from("lp_exams").insert({ patient_id: p.id, kind: x, status: "coletado" }); complete(t, x === c.exam, x === c.exam ? undefined : `indicado: ${c.exam}`); }}>{x}</button>); }
    if (t.kind === "laudo") return <button className={ghost} onClick={async () => { const { data } = await supabase.from("lp_exams").select("id").eq("patient_id", p.id).neq("status", "concluido").limit(1); if (data?.[0]) await supabase.from("lp_exams").update({ status: "concluido", result: `Achados compatíveis com: ${c.complaint.toLowerCase()}.`, completed_at: new Date().toISOString() }).eq("id", data[0].id); complete(t, true, "laudo revisado"); }}>Revisar laudo</button>;
    if (t.kind === "medicar") { const opts = [...new Set([c.med, ...CASES.map((x) => x.med).filter((x) => x !== c.med).sort(() => Math.random() - 0.5).slice(0, 2)])].sort(); return opts.map((x) => <button key={x} className={ghost} onClick={async () => { await supabase.from("lp_prescriptions").insert({ patient_id: p.id, medication: x, administered_at: new Date().toISOString() }); complete(t, x === c.med, x === c.med ? undefined : `indicado: ${c.med}`); }}>{x}</button>); }
    return [["uti", "UTI"], ["internado", "Internar"], ["alta", "Alta"]].map(([k, l]) => <button key={k} className={ghost} onClick={async () => {
      const ward = k === "uti" ? "UTI" : k === "internado" ? "Enfermaria" : null; const bed = ward ? freeBed(ward) : null;
      await supabase.from("lp_patients").update({ status: k, bed_id: bed?.id ?? null }).eq("id", p.id);
      const right = c.icu ? k === "uti" : k !== "uti";
      complete(t, right, right ? undefined : c.icu ? "precisava de UTI" : "UTI desnecessária");
    }}>{l}</button>);
  };

  const clearSim = async () => { if (confirm("Excluir todos os pacientes de simulação?")) { await supabase.from("lp_patients").delete().eq("is_simulated", true); reload(); } };
  const open = tasks.filter((t) => !t.done_at).sort((a, b) => new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime());
  const elapsed = shift ? Math.floor((now - shift.started) / 1000) : 0;
  const simCount = useMemo(() => patients.filter((p) => p.is_simulated).length, [patients]);

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white`}>
        <Gamepad2 className="h-8 w-8" />
        <div className="flex-1"><div className="text-lg font-semibold">Modo Plantão</div><div className="text-sm text-white/80">Pacientes chegam sozinhos. Faça triagem, peça exames, medique e defina o destino antes do tempo acabar.</div></div>
        {shift ? (<>
          <div className="text-center"><div className="text-2xl font-semibold">{shift.score}</div><div className="text-xs text-white/70">pontos</div></div>
          <div className="text-center"><div className="text-2xl font-semibold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="text-xs text-white/70">plantão</div></div>
          <button onClick={stop} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-red-600"><Square className="h-4 w-4" />Encerrar</button>
        </>) : (<>
          <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)} className="rounded-xl bg-white/20 px-3 py-2 text-sm text-white">{Object.entries(DIFF).map(([k, d]) => <option key={k} value={k} className="text-slate-900">{d.label}</option>)}</select>
          <button onClick={start} className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-blue-700"><Play className="h-4 w-4" />Iniciar plantão</button>
        </>)}
      </div>

      {summary && <div className={`${card} text-center`}><Trophy className="mx-auto h-8 w-8 text-amber-500" /><div className="mt-2 text-xl font-semibold">Plantão encerrado: {summary.score} pontos</div><div className="text-sm text-slate-500">{summary.seen} pacientes atendidos · {summary.done} tarefas concluídas</div></div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={`${card} lg:col-span-2`}>
          <div className="mb-3 font-semibold">Suas tarefas ({open.length})</div>
          {!open.length && <div className="py-8 text-center text-sm text-slate-500">{shift ? "Aguardando próximos pacientes…" : "Inicie um plantão para receber tarefas."}</div>}
          <div className="space-y-2">
            {open.map((t) => {
              const left = t.due_at ? Math.max(0, Math.floor((new Date(t.due_at).getTime() - now) / 1000)) : 0;
              const p = patients.find((x) => x.id === t.patient_id);
              return (
                <div key={t.id} className={`rounded-xl border p-3 ${t.failed ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
                  <div className="flex items-center gap-2">
                    {p && <span className={`h-2.5 w-2.5 rounded-full ${TRIAGE[p.triage]?.cls}`} />}
                    <button onClick={() => p && onOpen(p.id)} className="flex-1 text-left text-sm font-medium hover:underline">{t.title}</button>
                    <span className={`inline-flex items-center gap-1 text-xs ${left < 20 ? "text-red-600" : "text-slate-500"}`}><Timer className="h-3 w-3" />{left}s</span>
                  </div>
                  {p && <div className="mt-0.5 text-xs text-slate-500">{p.complaint}</div>}
                  <div className="mt-2 flex flex-wrap gap-1.5">{actions(t)}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-4">
          <div className={card}><div className="mb-2 font-semibold">Registro</div><div className="max-h-72 space-y-1 overflow-y-auto text-xs text-slate-600">{log.map((l, i) => <div key={i}>{l}</div>)}{!log.length && "—"}</div></div>
          <div className={card}><div className="mb-2 font-semibold">Melhores plantões</div>{history.map((h) => <div key={h.id} className="flex justify-between py-1 text-sm"><span>{DIFF[h.difficulty as Difficulty]?.label} · {new Date(h.started_at).toLocaleDateString("pt-BR")}</span><b>{h.score}</b></div>)}{!history.length && <div className="text-xs text-slate-500">Nenhum ainda.</div>}</div>
          <button onClick={clearSim} disabled={!!shift || !simCount} className={ghost}><Trash2 className="h-3.5 w-3.5" />Limpar pacientes de simulação ({simCount})</button>
        </div>
      </div>
    </div>
  );
}
