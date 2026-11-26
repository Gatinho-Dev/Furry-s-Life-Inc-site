import { useEffect, useMemo, useRef, useState } from "react";
import { Gamepad2, Play, Square, Timer, Trash2, Trophy } from "lucide-react";
import { hdb } from "./core";
import type { Bed, Patient } from "./core";
import { useHms } from "./data";
import { useAuth } from "@/lib/use-auth";
import { Btn, Card, Chip } from "./ui";
import { DIFF, TRIAGE, CASES, randomPatient, type Difficulty } from "../game";

type Task = { id: string; shift_id: string | null; patient_id: string | null; kind: string; title: string; points: number; due_at: string | null; done_at: string | null; failed: boolean };
type Step = "triar" | "exame" | "laudo" | "medicar" | "destino";
const NEXT: Record<Step, Step | null> = { triar: "exame", exame: "laudo", laudo: "medicar", medicar: "destino", destino: null };
const STEP_TITLE: Record<Step, string> = { triar: "Classificar risco de", exame: "Solicitar exame para", laudo: "Ler resultado do exame de", medicar: "Medicar", destino: "Definir destino de" };
const EXAMS = ["Hemograma", "Raio-X de tórax", "Tomografia de crânio", "ECG", "Ultrassom abdominal", "Glicemia + gasometria", "Urina tipo 1", "Ressonância"];
const card = "hms-card hms-card-body";

/** Modo Plantão — minigame de roleplay preservado do painel original. */
export function ShiftModule() {
  const { data, go, reload } = useHms();
  const auth = useAuth();
  const userId = auth.user?.id ?? data.staff.find((s) => s.user_id)?.user_id ?? "00000000-0000-0000-0000-000000000000";
  const patients = data.patients as Patient[];
  const beds = data.beds as Bed[];
  const [diff, setDiff] = useState<Difficulty>("normal");
  const [shift, setShift] = useState<{ id: string; score: number; seen: number; done: number; started: number } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [now, setNow] = useState(Date.now());
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ score: number; seen: number; done: number } | null>(null);
  const [history, setHistory] = useState<{ id: string; difficulty: string; score: number; patients_seen: number; started_at: string }[]>([]);
  const caseOf = useRef<Record<string, (typeof CASES)[number]>>({});
  const spawnT = useRef<number | null>(null);
  const shiftRef = useRef(shift);
  shiftRef.current = shift;

  const loadHistory = async () => {
    const { data: rows } = await hdb.from("lp_shifts").select("*").eq("user_id", userId).not("ended_at", "is", null).order("score", { ascending: false }).limit(5);
    setHistory((rows ?? []) as typeof history);
  };
  useEffect(() => { void loadHistory(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const push = (s: string) => setLog((l) => [`${new Date().toLocaleTimeString("pt-BR")} · ${s}`, ...l].slice(0, 30));
  const addScore = (pts: number, done = 0, seen = 0) => setShift((s) => (s ? { ...s, score: s.score + pts, done: s.done + done, seen: s.seen + seen } : s));

  const createTask = async (shiftId: string, patientId: string, step: Step, name: string) => {
    const { data: row } = await hdb.from("lp_shift_tasks").insert({ shift_id: shiftId, patient_id: patientId, kind: step, title: `${STEP_TITLE[step]} ${name}`, points: 10, due_at: new Date(Date.now() + DIFF[diff].taskSec * 1000).toISOString() }).select().single();
    if (row) setTasks((t) => [...t, row as Task]);
  };

  const spawn = async () => {
    const s = shiftRef.current; if (!s) return;
    const g = randomPatient();
    const { data: p } = await hdb.from("lp_patients").insert(g.patient).select().single();
    if (!p) return;
    caseOf.current[p.id] = g.case;
    await hdb.from("lp_vitals").insert({ patient_id: p.id, ...g.vitals });
    push(`🚑 Chegou ${p.full_name}: ${g.case.complaint}`);
    addScore(0, 0, 1);
    await createTask(s.id, p.id, "triar", p.full_name);
    reload();
    const [a, b] = DIFF[diff].spawnMs;
    spawnT.current = window.setTimeout(spawn, a + Math.random() * (b - a));
  };

  const start = async () => {
    const { data: row } = await hdb.from("lp_shifts").insert({ user_id: userId, difficulty: diff }).select().single();
    if (!row) return;
    setSummary(null); setTasks([]); setLog([]);
    const s = { id: row.id as string, score: 0, seen: 0, done: 0, started: Date.now() };
    setShift(s); shiftRef.current = s;
    push("Plantão iniciado. Boa sorte, doutor(a)!");
    void spawn();
  };
  const stop = async () => {
    if (spawnT.current) clearTimeout(spawnT.current);
    const s = shiftRef.current; if (!s) return;
    await hdb.from("lp_shifts").update({ ended_at: new Date().toISOString(), score: s.score, patients_seen: s.seen, tasks_done: s.done }).eq("id", s.id);
    setSummary({ score: s.score, seen: s.seen, done: s.done }); setShift(null); void loadHistory();
  };
  useEffect(() => () => { if (spawnT.current) clearTimeout(spawnT.current); }, []);

  useEffect(() => {
    if (!shift) return;
    const t = setInterval(async () => {
      setNow(Date.now());
      const expired = tasks.filter((x) => !x.done_at && !x.failed && x.due_at && new Date(x.due_at).getTime() < Date.now());
      for (const x of expired) {
        await hdb.from("lp_shift_tasks").update({ failed: true }).eq("id", x.id);
        setTasks((ts) => ts.map((y) => (y.id === x.id ? { ...y, failed: true, due_at: new Date(Date.now() + DIFF[diff].taskSec * 1000).toISOString() } : y)));
        const p = patients.find((y) => y.id === x.patient_id);
        if (p) {
          const order = ["azul", "verde", "amarelo", "laranja", "vermelho"]; const i = order.indexOf(p.triage);
          if (p.triage === "vermelho") { await hdb.from("lp_patients").update({ status: "obito", bed_id: null }).eq("id", p.id); push(`💀 ${p.full_name} não resistiu à demora.`); addScore(-100); setTasks((ts) => ts.filter((y) => y.patient_id !== p.id)); }
          else { if (i >= 0 && i < 4) await hdb.from("lp_patients").update({ triage: order[i + 1] }).eq("id", p.id); push(`⚠️ ${p.full_name} piorou por espera.`); addScore(-15); }
          reload();
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [shift, tasks, patients, diff, reload]);

  const complete = async (t: Task, ok: boolean, extra?: string) => {
    const p = patients.find((x) => x.id === t.patient_id); if (!p || !shift) return;
    const c = caseOf.current[p.id];
    await hdb.from("lp_shift_tasks").update({ done_at: new Date().toISOString() }).eq("id", t.id);
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
    if (!p || !c) return <span className="text-xs text-[var(--h-faint)]">Paciente indisponível</span>;
    if (t.kind === "triar") return ["vermelho", "laranja", "amarelo", "verde", "azul"].map((k) => (
      <button key={k} className={`hms-chip ${TRIAGE[k].cls}`} onClick={async () => {
        await hdb.from("lp_patients").update({ triage: k }).eq("id", p.id);
        const bed = freeBed("Emergência"); if (bed) await hdb.from("lp_patients").update({ bed_id: bed.id }).eq("id", p.id);
        void complete(t, k === c.triage, k === c.triage ? "classificação correta" : `o correto era ${TRIAGE[c.triage].label}`);
      }}>{TRIAGE[k].label}</button>
    ));
    if (t.kind === "exame") { const opts = [...new Set([c.exam, ...EXAMS.slice(0, 3)])].sort(); return opts.map((x) => <button key={x} className="hms-btn ghost sm" onClick={async () => { await hdb.from("lp_exams").insert({ patient_id: p.id, kind: x, status: "coletado" }); void complete(t, x === c.exam, x === c.exam ? undefined : `indicado: ${c.exam}`); }}>{x}</button>); }
    if (t.kind === "laudo") return <button className="hms-btn ghost sm" onClick={async () => { const { data: rows } = await hdb.from("lp_exams").select("id").eq("patient_id", p.id).neq("status", "concluido").limit(1); if (rows?.[0]) await hdb.from("lp_exams").update({ status: "concluido", result: `Achados compatíveis com: ${c.complaint.toLowerCase()}.`, completed_at: new Date().toISOString() }).eq("id", rows[0].id); void complete(t, true, "laudo revisado"); }}>Revisar laudo</button>;
    if (t.kind === "medicar") { const opts = [...new Set([c.med, ...CASES.map((x) => x.med).filter((x) => x !== c.med).sort(() => Math.random() - 0.5).slice(0, 2)])].sort(); return opts.map((x) => <button key={x} className="hms-btn ghost sm" onClick={async () => { await hdb.from("lp_prescriptions").insert({ patient_id: p.id, medication: x, administered_at: new Date().toISOString() }); void complete(t, x === c.med, x === c.med ? undefined : `indicado: ${c.med}`); }}>{x}</button>); }
    return [["uti", "UTI"], ["internado", "Internar"], ["alta", "Alta"]].map(([k, l]) => (
      <button key={k} className="hms-btn ghost sm" onClick={async () => {
        const ward = k === "uti" ? "UTI" : k === "internado" ? "Enfermaria" : null; const bed = ward ? freeBed(ward) : null;
        await hdb.from("lp_patients").update({ status: k, bed_id: bed?.id ?? null }).eq("id", p.id);
        const right = c.icu ? k === "uti" : k !== "uti";
        void complete(t, right, right ? undefined : c.icu ? "precisava de UTI" : "UTI desnecessária");
      }}>{l}</button>
    ));
  };

  const clearSim = async () => { if (confirm("Excluir todos os pacientes de simulação?")) { await hdb.from("lp_patients").delete().eq("is_simulated", true); reload(); } };
  const open = tasks.filter((t) => !t.done_at).sort((a, b) => new Date(a.due_at ?? 0).getTime() - new Date(b.due_at ?? 0).getTime());
  const elapsed = shift ? Math.floor((now - shift.started) / 1000) : 0;
  const simCount = useMemo(() => patients.filter((p) => p.is_simulated).length, [patients]);

  return (
    <div className="hms-stack">
      <div className={`${card} flex flex-wrap items-center gap-4 bg-gradient-to-r from-[var(--h-petrol)] to-[var(--h-petrol-2)] text-white`}>
        <Gamepad2 className="h-8 w-8" />
        <div className="flex-1"><div className="text-[15px] font-semibold">Modo Plantão</div><div className="text-[12px] text-white/70">Pacientes chegam sozinhos. Faça triagem, peça exames, medique e defina o destino antes do tempo acabar.</div></div>
        {shift ? (
          <>
            <div className="text-center"><div className="text-2xl font-semibold">{shift.score}</div><div className="text-[10px] text-white/70">pontos</div></div>
            <div className="text-center"><div className="text-2xl font-semibold">{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</div><div className="text-[10px] text-white/70">plantão</div></div>
            <Btn variant="danger" icon={Square} onClick={() => void stop()}>Encerrar</Btn>
          </>
        ) : (
          <>
            <select value={diff} onChange={(e) => setDiff(e.target.value as Difficulty)} className="rounded-xl bg-white/15 px-3 py-2 text-sm text-white">{Object.entries(DIFF).map(([k, d]) => <option key={k} value={k} className="text-slate-900">{d.label}</option>)}</select>
            <Btn icon={Play} onClick={() => void start()} className="invert">Iniciar plantão</Btn>
          </>
        )}
      </div>

      {summary && <Card><div className="flex flex-col items-center text-center"><Trophy className="h-8 w-8 text-[var(--h-warn)]" /><div className="mt-2 text-lg font-semibold">Plantão encerrado: {summary.score} pontos</div><div className="text-[12px] text-[var(--h-muted)]">{summary.seen} pacientes atendidos · {summary.done} tarefas concluídas</div></div></Card>}

      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`Suas tarefas (${open.length})`} noBody>
          <div className="space-y-2 p-3">
            {!open.length && <div className="py-10 text-center text-sm text-[var(--h-muted)]">{shift ? "Aguardando próximos pacientes…" : "Inicie um plantão para receber tarefas."}</div>}
            {open.map((t) => {
              const left = t.due_at ? Math.max(0, Math.floor((new Date(t.due_at).getTime() - now) / 1000)) : 0;
              const p = patients.find((x) => x.id === t.patient_id);
              return (
                <div key={t.id} className={`rounded-xl border p-3 ${t.failed ? "border-[var(--h-vital)] bg-[var(--h-vital-soft)]" : "border-[var(--h-line)]"}`}>
                  <div className="flex items-center gap-2">
                    {p && <span className={`h-2.5 w-2.5 rounded-full ${TRIAGE[p.triage]?.cls}`} />}
                    <button onClick={() => p && go("patients", { patientId: p.id })} className="flex-1 text-left text-[12.5px] font-medium hover:underline">{t.title}</button>
                    <span className={`inline-flex items-center gap-1 text-[11px] ${left < 20 ? "text-[var(--h-vital)]" : "text-[var(--h-muted)]"}`}><Timer className="h-3 w-3" />{left}s</span>
                  </div>
                  {p && <div className="mt-0.5 text-[11px] text-[var(--h-muted)]">{p.complaint}</div>}
                  <div className="mt-2 flex flex-wrap gap-1.5">{actions(t)}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <div className="hms-stack">
          <Card title="Registro"><div className="max-h-72 space-y-1 overflow-y-auto text-[11px] text-[var(--h-muted)]">{log.map((l, i) => <div key={i}>{l}</div>)}{!log.length && "—"}</div></Card>
          <Card title="Melhores plantões">
            {history.map((hd) => <div key={hd.id} className="flex justify-between py-1 text-[12px]"><span>{DIFF[hd.difficulty as Difficulty]?.label} · {new Date(hd.started_at).toLocaleDateString("pt-BR")}</span><b>{hd.score}</b></div>)}
            {!history.length && <div className="text-[11px] text-[var(--h-muted)]">Nenhum ainda.</div>}
          </Card>
          <div className="flex items-center justify-between gap-2"><Chip tone="outline">{simCount} pacientes de simulação</Chip><Btn size="sm" variant="ghost" icon={Trash2} disabled={!!shift || !simCount} onClick={() => void clearSim()}>Limpar</Btn></div>
        </div>
      </div>
    </div>
  );
}
