/**
 * Investigation workspace, graphs and preferences — stored locally in the browser.
 * The platform never uploads investigation content to a third party.
 */

import type { InvestigationStatus } from "./types";

export type { InvestigationStatus };

export type EntityKind =
  | "domain" | "subdomain" | "ip" | "asn" | "organization" | "certificate"
  | "url" | "cve" | "hash" | "username" | "email" | "person" | "key" | "note";

export type Entity = {
  id: string;
  kind: EntityKind;
  value: string;
  label?: string;
  source: string;
  confidence: "confirmed" | "probable" | "unconfirmed";
  at: string;
  notes?: string;
};

export type Evidence = {
  id: string;
  toolId: string;
  tool: string;
  input: string;
  source: string;
  at: string;
  summary: string;
  data?: unknown;
};

export type Note = { id: string; body: string; at: string; author?: string };

export type TimelineEvent = { id: string; at: string; title: string; detail?: string };

export type Investigation = {
  id: string;
  code: string;
  name: string;
  description: string;
  objective: string;
  status: InvestigationStatus;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  entities: Entity[];
  evidence: Evidence[];
  notes: Note[];
  timeline: TimelineEvent[];
  conclusion: string;
  /** Optional seed used by the Case Seeder (public identifier that started the case). */
  seed?: { kind: string; value: string };
};

export type GraphNode = {
  id: string;
  kind: EntityKind;
  label: string;
  source: string;
  confidence: "confirmed" | "probable" | "unconfirmed";
  at: string;
  x: number;
  y: number;
};
export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  source: string;
  confidence: "confirmed" | "probable" | "unconfirmed";
  at: string;
};
export type GraphDoc = { id: string; name: string; nodes: GraphNode[]; edges: GraphEdge[]; updatedAt: string };

export type Prefs = {
  theme: "carbon" | "graphite" | "midnight";
  language: "pt-BR" | "en-US";
  compact: boolean;
  reduceMotion: boolean;
  blurPii: boolean;
  persistResults: boolean;
  apiKeys: Record<string, string>;
};

const INV_KEY = "life-agency.investigations.v1";
const GRAPH_KEY = "life-agency.graphs.v1";
const PREFS_KEY = "life-agency.prefs.v1";

const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }
export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
  notify();
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ----------------------------- investigations ---------------------------- */

export const INVESTIGATIONS_KEY = INV_KEY;

export function listInvestigations(): Investigation[] {
  return load<Investigation[]>(INV_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getInvestigation(id: string): Investigation | null {
  return load<Investigation[]>(INV_KEY, []).find((i) => i.id === id) ?? null;
}

export function nextCaseCode(): string {
  const all = load<Investigation[]>(INV_KEY, []);
  const year = new Date().getFullYear();
  const n = all.filter((i) => i.code.includes(String(year))).length + 1;
  return `LA-${year}-${String(n).padStart(4, "0")}`;
}

export function createInvestigation(input: {
  name: string;
  description?: string;
  objective?: string;
  tags?: string[];
  status?: InvestigationStatus;
  seed?: { kind: string; value: string };
}): Investigation {
  const now = new Date().toISOString();
  const inv: Investigation = {
    id: uid("inv"),
    code: nextCaseCode(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    objective: input.objective?.trim() ?? "",
    status: input.status ?? "draft",
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
    entities: [],
    evidence: [],
    notes: [],
    timeline: [{ id: uid("tl"), at: now, title: "Investigação criada", detail: input.seed ? `Semente: ${input.seed.kind} ${input.seed.value}` : undefined }],
    conclusion: "",
    seed: input.seed,
  };
  save(INV_KEY, [inv, ...load<Investigation[]>(INV_KEY, [])]);
  return inv;
}

export function updateInvestigation(id: string, patch: Partial<Omit<Investigation, "id" | "createdAt">>) {
  const all = load<Investigation[]>(INV_KEY, []);
  const idx = all.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  save(INV_KEY, all);
  return all[idx];
}

export function deleteInvestigation(id: string) {
  save(INV_KEY, load<Investigation[]>(INV_KEY, []).filter((i) => i.id !== id));
}

export function addEntity(invId: string, entity: Omit<Entity, "id" | "at">): Entity | null {
  const inv = getInvestigation(invId);
  if (!inv) return null;
  const row: Entity = { ...entity, id: uid("ent"), at: new Date().toISOString() };
  const exists = inv.entities.some((e) => e.kind === entity.kind && e.value.toLowerCase() === entity.value.toLowerCase());
  if (exists) return inv.entities.find((e) => e.kind === entity.kind && e.value.toLowerCase() === entity.value.toLowerCase()) ?? row;
  updateInvestigation(invId, { entities: [...inv.entities, row] });
  return row;
}

export function addEvidence(invId: string, ev: Omit<Evidence, "id" | "at">): Evidence | null {
  const inv = getInvestigation(invId);
  if (!inv) return null;
  const row: Evidence = { ...ev, id: uid("ev"), at: new Date().toISOString() };
  updateInvestigation(invId, {
    evidence: [...inv.evidence, row],
    timeline: [...inv.timeline, { id: uid("tl"), at: row.at, title: `Evidência registrada · ${ev.tool}`, detail: ev.input }],
  });
  return row;
}

export function removeEntity(invId: string, entityId: string) {
  const inv = getInvestigation(invId);
  if (!inv) return;
  updateInvestigation(invId, { entities: inv.entities.filter((e) => e.id !== entityId) });
}

export function removeEvidence(invId: string, evId: string) {
  const inv = getInvestigation(invId);
  if (!inv) return;
  updateInvestigation(invId, { evidence: inv.evidence.filter((e) => e.id !== evId) });
}

export function addNote(invId: string, body: string) {
  const inv = getInvestigation(invId);
  if (!inv || !body.trim()) return;
  updateInvestigation(invId, { notes: [...inv.notes, { id: uid("note"), body: body.trim(), at: new Date().toISOString() }] });
}

export function removeNote(invId: string, noteId: string) {
  const inv = getInvestigation(invId);
  if (!inv) return;
  updateInvestigation(invId, { notes: inv.notes.filter((n) => n.id !== noteId) });
}

/* --------------------------------- graphs -------------------------------- */

export function listGraphs(): GraphDoc[] {
  return load<GraphDoc[]>(GRAPH_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function getGraph(id: string): GraphDoc | null {
  return load<GraphDoc[]>(GRAPH_KEY, []).find((g) => g.id === id) ?? null;
}
export function saveGraph(graph: GraphDoc): GraphDoc {
  const all = load<GraphDoc[]>(GRAPH_KEY, []);
  const idx = all.findIndex((g) => g.id === graph.id);
  const next = { ...graph, updatedAt: new Date().toISOString() };
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  save(GRAPH_KEY, all);
  return next;
}
export function deleteGraph(id: string) {
  save(GRAPH_KEY, load<GraphDoc[]>(GRAPH_KEY, []).filter((g) => g.id !== id));
}

/* -------------------------------- prefs ---------------------------------- */

export const DEFAULT_PREFS: Prefs = {
  theme: "carbon",
  language: "pt-BR",
  compact: false,
  reduceMotion: false,
  blurPii: false,
  persistResults: true,
  apiKeys: {},
};

export function getPrefs(): Prefs {
  return { ...DEFAULT_PREFS, ...load<Partial<Prefs>>(PREFS_KEY, {}) };
}
export function setPrefs(patch: Partial<Prefs>) {
  save(PREFS_KEY, { ...getPrefs(), ...patch });
}
export function getApiKey(sourceId: string): string | undefined {
  const map: Record<string, string> = {
    virustotal: "VT_API_KEY",
    abuseipdb: "ABUSEIPDB_API_KEY",
    shodan: "SHODAN_API_KEY",
    otx: "OTX_API_KEY",
    greynoise: "GREYNOISE_API_KEY",
    hibp: "HIBP_API_KEY",
    "safe-browsing": "GOOGLE_SAFE_BROWSING_KEY",
  };
  const env = map[sourceId];
  return env ? getPrefs().apiKeys[env] || undefined : undefined;
}
