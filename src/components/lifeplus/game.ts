// Gerador de casos e tarefas do Modo Plantão
export type Difficulty = "tranquilo" | "normal" | "caos";
export const DIFF: Record<Difficulty, { label: string; spawnMs: [number, number]; taskSec: number }> = {
  tranquilo: { label: "Tranquilo", spawnMs: [60000, 90000], taskSec: 180 },
  normal: { label: "Normal", spawnMs: [35000, 60000], taskSec: 120 },
  caos: { label: "Caos", spawnMs: [15000, 30000], taskSec: 75 },
};

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor", "Isis", "João", "Kaique", "Luna", "Marcos", "Nina", "Otávio", "Paula", "Rafa", "Sofia", "Tiago", "Vitória"];
const LAST = ["Silva", "Souza", "Oliveira", "Lima", "Costa", "Pereira", "Almeida", "Ribeiro", "Martins", "Rocha", "Barbosa", "Gomes"];
const BLOOD = ["A+", "A-", "B+", "B-", "AB+", "O+", "O-"];

export const CASES = [
  { complaint: "Dor torácica intensa irradiando para o braço", triage: "vermelho", exam: "ECG", med: "AAS 300mg", icu: true },
  { complaint: "Falta de ar e saturação baixa", triage: "laranja", exam: "Raio-X de tórax", med: "Oxigenoterapia", icu: true },
  { complaint: "Febre alta há 3 dias", triage: "amarelo", exam: "Hemograma", med: "Dipirona 1g", icu: false },
  { complaint: "Queda com suspeita de fratura no punho", triage: "amarelo", exam: "Raio-X de punho", med: "Tramadol 50mg", icu: false },
  { complaint: "Cefaleia súbita e confusão mental", triage: "vermelho", exam: "Tomografia de crânio", med: "Manitol", icu: true },
  { complaint: "Dor abdominal no lado direito", triage: "laranja", exam: "Ultrassom abdominal", med: "Escopolamina", icu: false },
  { complaint: "Corte no dedo", triage: "verde", exam: "Nenhum (avaliação clínica)", med: "Sutura + antisséptico", icu: false },
  { complaint: "Crise alérgica com inchaço", triage: "laranja", exam: "Hemograma", med: "Adrenalina IM", icu: false },
  { complaint: "Dor de garganta", triage: "azul", exam: "Nenhum (avaliação clínica)", med: "Ibuprofeno 400mg", icu: false },
  { complaint: "Glicemia muito alta", triage: "laranja", exam: "Glicemia + gasometria", med: "Insulina regular", icu: false },
];

const r = (a: number, b: number) => Math.round(a + Math.random() * (b - a));
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function randomPatient() {
  const c = pick(CASES);
  const severe = c.triage === "vermelho" || c.triage === "laranja";
  return {
    case: c,
    patient: {
      full_name: `${pick(FIRST)} ${pick(LAST)}`,
      birth_date: `${r(1945, 2018)}-${String(r(1, 12)).padStart(2, "0")}-${String(r(1, 28)).padStart(2, "0")}`,
      sex: Math.random() > 0.5 ? "F" : "M",
      blood_type: pick(BLOOD),
      allergies: Math.random() > 0.8 ? "Dipirona" : null,
      complaint: c.complaint,
      triage: "nao_triado",
      status: "triagem",
      is_simulated: true,
    },
    vitals: {
      systolic: severe ? r(80, 180) : r(110, 135), diastolic: severe ? r(50, 110) : r(70, 85),
      heart_rate: severe ? r(100, 140) : r(65, 95), temperature: c.complaint.includes("Febre") ? 39.4 : Number((36 + Math.random()).toFixed(1)),
      spo2: c.complaint.includes("ar") ? r(84, 90) : r(94, 99),
    },
  };
}

export const TRIAGE: Record<string, { label: string; cls: string; pts: number }> = {
  vermelho: { label: "Emergência", cls: "bg-red-500 text-white", pts: 50 },
  laranja: { label: "Muito urgente", cls: "bg-orange-500 text-white", pts: 35 },
  amarelo: { label: "Urgente", cls: "bg-yellow-400 text-black", pts: 25 },
  verde: { label: "Pouco urgente", cls: "bg-green-500 text-white", pts: 15 },
  azul: { label: "Não urgente", cls: "bg-sky-500 text-white", pts: 10 },
  nao_triado: { label: "Sem triagem", cls: "bg-slate-400 text-white", pts: 0 },
};
