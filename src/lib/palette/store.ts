/**
 * Life Palette persistence — browser localStorage only.
 * The platform never sends case content to a third party. Sharing is an
 * explicit, compressed, read-only snapshot that the user chooses to export.
 */

import { compressSync, decompressSync, strFromU8, strToU8 } from "fflate";
import type {
  AiFeedback, EdgeStyle, KnowledgeChunk, KnowledgeDoc, PaletteCase, PaletteEvidence,
  PaletteMemory, PaletteNode, PaletteNodeKind, PalettePrefs, PaletteSearchRecord,
  PaletteTimelineEntry, TimelineType, Viewport,
} from "./types";
import { CONFIDENCE_LABEL } from "./types";

const CASE_KEY = "life-palette.cases.v1";
const SHARED_KEY = "life-palette.shared.v1";
const KNOW_KEY = "life-palette.knowledge.v1";
const MEM_KEY = "life-palette.memory.v1";
const PREF_KEY = "life-palette.prefs.v1";
const FEEDBACK_KEY = "life-palette.feedback.v1";

export const PALETTE_KEYS = { CASE_KEY, SHARED_KEY, KNOW_KEY, MEM_KEY, PREF_KEY, FEEDBACK_KEY };

const listeners = new Set<() => void>();
export function subscribePalette(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
function notify() { listeners.forEach((l) => l()); }

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    notify();
    return true;
  } catch {
    return false;
  }
}

export function uid(prefix = "id"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const DEFAULT_PREFS: PalettePrefs = {
  nodeSize: "regular",
  density: "comfortable",
  edgeStyle: "solid",
  showMinimap: true,
  showGrid: true,
  autoLayout: "none",
  autoSave: true,
  confirmDestructive: true,
  reduceMotion: false,
  analystName: "Analista",
  defaultConfidence: "unverified",
};

export function getPrefs(): PalettePrefs {
  return { ...DEFAULT_PREFS, ...read<Partial<PalettePrefs>>(PREF_KEY, {}) };
}
export function savePrefs(patch: Partial<PalettePrefs>): PalettePrefs {
  const next = { ...getPrefs(), ...patch };
  write(PREF_KEY, next);
  return next;
}

function loadCases(): PaletteCase[] { return read<PaletteCase[]>(CASE_KEY, []); }
function loadShared(): PaletteCase[] { return read<PaletteCase[]>(SHARED_KEY, []); }

export function listCases(): PaletteCase[] {
  return loadCases().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function listAllVisibleCases(): PaletteCase[] {
  return [...listCases(), ...loadShared().map((c) => ({ ...c, shared: { ...(c.shared ?? {}), readOnly: true } }))];
}
export function getCase(id: string): PaletteCase | null {
  return loadCases().find((c) => c.id === id) ?? loadShared().find((c) => c.id === id) ?? null;
}
export function isReadOnly(id: string): boolean {
  return loadShared().some((c) => c.id === id) && !loadCases().some((c) => c.id === id);
}

export function nextCaseCode(): string {
  const all = loadCases();
  const year = new Date().getFullYear();
  const n = all.filter((c) => c.code.includes(String(year))).length + 1;
  return `LP-${year}-${String(n).padStart(4, "0")}`;
}

export type NewCaseInput = {
  title: string;
  description?: string;
  objective?: string;
  priority?: PaletteCase["priority"];
  tags?: string[];
  templateId?: string;
  plan?: PaletteCase["plan"];
  owner?: string;
};

export function createCase(input: NewCaseInput): PaletteCase {
  const now = new Date().toISOString();
  const prefs = getPrefs();
  const owner = input.owner?.trim() || prefs.analystName || "Analista";
  const c: PaletteCase = {
    id: uid("case"),
    code: nextCaseCode(),
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    objective: input.objective?.trim() ?? "",
    owner,
    status: "draft",
    priority: input.priority ?? "normal",
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
    templateId: input.templateId,
    nodes: [],
    edges: [],
    groups: [],
    evidence: [],
    searches: [],
    timeline: [{ id: uid("tl"), at: now, type: "case", title: "Investigação criada", actor: owner, detail: input.templateId ? `Template: ${input.templateId}` : undefined }],
    notes: [],
    comments: [],
    participants: [{ id: uid("p"), name: owner, role: "owner", addedAt: now }],
    viewport: { x: 0, y: 0, zoom: 1 },
    plan: input.plan ?? [],
  };
  const all = loadCases();
  write(CASE_KEY, [c, ...all]);
  return c;
}

export function saveCase(c: PaletteCase, touch = true): PaletteCase {
  if (isReadOnly(c.id)) return c;
  const next: PaletteCase = { ...c, updatedAt: touch ? new Date().toISOString() : c.updatedAt };
  const all = loadCases();
  const idx = all.findIndex((x) => x.id === next.id);
  if (idx >= 0) all[idx] = next; else all.unshift(next);
  write(CASE_KEY, all);
  return next;
}

export function deleteCase(id: string): void {
  const all = loadCases().filter((c) => c.id !== id);
  write(CASE_KEY, all);
  const shared = loadShared().filter((c) => c.id !== id);
  write(SHARED_KEY, shared);
  const mem = getMemory();
  delete mem.perCase[id];
  write(MEM_KEY, mem);
}

export function duplicateCase(id: string): PaletteCase | null {
  const src = getCase(id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: PaletteCase = {
    ...structuredClone(src),
    id: uid("case"),
    code: nextCaseCode(),
    title: `${src.title} (cópia)`,
    createdAt: now,
    updatedAt: now,
    shared: undefined,
    participants: src.participants.map((p) => ({ ...p })),
  };
  copy.timeline = [{ id: uid("tl"), at: now, type: "case", title: "Caso duplicado", actor: getPrefs().analystName, detail: `Origem: ${src.code}` }, ...copy.timeline];
  write(CASE_KEY, [copy, ...loadCases()]);
  return copy;
}

/* ------------------------------- timeline -------------------------------- */

export function timelineEntry(type: TimelineType, title: string, detail?: string, refId?: string): PaletteTimelineEntry {
  return { id: uid("tl"), at: new Date().toISOString(), type, title, detail, actor: getPrefs().analystName || "Analista", refId };
}

export function appendTimeline(c: PaletteCase, ...entries: PaletteTimelineEntry[]): PaletteCase {
  return { ...c, timeline: [...entries, ...c.timeline] };
}

/* -------------------------------- vision --------------------------------- */

export type ExtractedCandidate = {
  kind: PaletteNodeKind;
  value: string;
  source: string;
  confidence: PaletteCase["nodes"][number]["confidence"];
  path?: string;
  label?: string;
};

/* --------------------------------- share --------------------------------- */

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export type ShareBundle = {
  kind: "life-palette-share";
  v: 1;
  at: string;
  readOnly: true;
  case: PaletteCase;
};

export function encodeShare(c: PaletteCase): string {
  const bundle: ShareBundle = { kind: "life-palette-share", v: 1, at: new Date().toISOString(), readOnly: true, case: c };
  return toBase64Url(compressSync(strToU8(JSON.stringify(bundle)), { level: 9 }));
}

export function decodeShare(token: string): PaletteCase | null {
  try {
    const bundle = JSON.parse(strFromU8(decompressSync(fromBase64Url(token)))) as ShareBundle;
    if (bundle?.kind !== "life-palette-share" || !bundle.case?.id) return null;
    return { ...bundle.case, shared: { readOnly: true, importedFrom: bundle.at } };
  } catch {
    return null;
  }
}

export function importSharedCase(c: PaletteCase): PaletteCase {
  const cloned: PaletteCase = { ...structuredClone(c), shared: { readOnly: true, importedFrom: c.shared?.importedFrom } };
  // Never let a received snapshot shadow (or be shadowed by) an editable local case.
  if (loadCases().some((x) => x.id === cloned.id)) cloned.id = `${cloned.id}-shared`;
  const all = loadShared().filter((x) => x.id !== cloned.id);
  write(SHARED_KEY, [cloned, ...all]);
  return cloned;
}

export function exportCaseJson(c: PaletteCase): string {
  return JSON.stringify({ kind: "life-palette-case", v: 1, exportedAt: new Date().toISOString(), case: c }, null, 2);
}

/* -------------------------------- evidence -------------------------------- */

export async function sha256Hex(input: ArrayBuffer | string): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newEvidence(input: Partial<PaletteEvidence> & { title: string }): PaletteEvidence {
  const now = new Date().toISOString();
  return {
    id: uid("ev"),
    title: input.title,
    description: input.description ?? "",
    kind: input.kind ?? "text",
    url: input.url,
    filename: input.filename,
    mime: input.mime,
    size: input.size,
    sha256: input.sha256,
    content: input.content,
    source: input.source ?? "Coleta manual",
    collectedAt: input.collectedAt ?? now,
    createdAt: now,
    responsible: input.responsible ?? (getPrefs().analystName || "Analista"),
    nodeIds: input.nodeIds ?? [],
    notes: input.notes ?? "",
  };
}

/* ------------------------------- knowledge -------------------------------- */

export function listKnowledge(): KnowledgeDoc[] {
  return read<KnowledgeDoc[]>(KNOW_KEY, []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function saveKnowledge(docs: KnowledgeDoc[]): void { write(KNOW_KEY, docs); }
export function upsertKnowledge(doc: KnowledgeDoc): KnowledgeDoc[] {
  const all = listKnowledge();
  const idx = all.findIndex((d) => d.id === doc.id);
  if (idx >= 0) all[idx] = doc; else all.unshift(doc);
  saveKnowledge(all);
  return all;
}
export function deleteKnowledge(id: string): KnowledgeDoc[] {
  const all = listKnowledge().filter((d) => d.id !== id);
  saveKnowledge(all);
  return all;
}

export function getMemory(): PaletteMemory {
  return read<PaletteMemory>(MEM_KEY, { global: [], perCase: {}, preferences: [] });
}
export function saveMemory(m: PaletteMemory): void { write(MEM_KEY, m); }

export function listFeedback(): AiFeedback[] {
  return read<AiFeedback[]>(FEEDBACK_KEY, []).sort((a, b) => b.at.localeCompare(a.at));
}
export function addFeedback(f: AiFeedback): void { write(FEEDBACK_KEY, [f, ...read<AiFeedback[]>(FEEDBACK_KEY, [])]); }
export function updateFeedback(id: string, patch: Partial<AiFeedback>): void {
  write(FEEDBACK_KEY, read<AiFeedback[]>(FEEDBACK_KEY, []).map((f) => (f.id === id ? { ...f, ...patch } : f)));
}

/* -------------------------------- analysis -------------------------------- */

export type CaseStats = {
  nodes: number;
  edges: number;
  groups: number;
  evidence: number;
  searches: number;
  verified: number;
  high: number;
  medium: number;
  low: number;
  unverified: number;
  kinds: Record<string, number>;
  isolatedNodes: number;
  unverifiedEdges: number;
  orphanEvidence: number;
  coverage: number;
};

export function caseStats(c: PaletteCase): CaseStats {
  const kinds: Record<string, number> = {};
  for (const n of c.nodes) kinds[n.kind] = (kinds[n.kind] ?? 0) + 1;
  const degree = new Map<string, number>();
  for (const e of c.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const count = (lvl: PaletteCase["nodes"][number]["confidence"]) => c.nodes.filter((n) => n.confidence === lvl).length;
  const isolatedNodes = c.nodes.filter((n) => !degree.get(n.id)).length;
  const unverifiedEdges = c.edges.filter((e) => e.confidence === "unverified" || e.confidence === "low").length;
  const orphanEvidence = c.evidence.filter((ev) => ev.nodeIds.length === 0).length;
  const withEvidence = c.nodes.filter((n) => n.evidenceIds.length > 0 || n.sources.length > 0).length;
  return {
    nodes: c.nodes.length,
    edges: c.edges.length,
    groups: c.groups.length,
    evidence: c.evidence.length,
    searches: c.searches.length,
    verified: count("verified"),
    high: count("high"),
    medium: count("medium"),
    low: count("low"),
    unverified: count("unverified"),
    kinds,
    isolatedNodes,
    unverifiedEdges,
    orphanEvidence,
    coverage: c.nodes.length ? Math.round((withEvidence / c.nodes.length) * 100) : 0,
  };
}

export type DuplicateGroup = { key: string; kind: PaletteNodeKind; nodes: PaletteNode[] };

export function findDuplicates(c: PaletteCase): DuplicateGroup[] {
  const map = new Map<string, PaletteNode[]>();
  for (const n of c.nodes) {
    const key = `${n.kind}:${n.title.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
    const list = map.get(key) ?? [];
    list.push(n);
    map.set(key, list);
  }
  return [...map.entries()].filter(([, list]) => list.length > 1).map(([key, nodes]) => ({ key, kind: nodes[0].kind, nodes }));
}

export function mergeNodes(c: PaletteCase, keepId: string, dropIds: string[]): PaletteCase {
  const keep = c.nodes.find((n) => n.id === keepId);
  if (!keep) return c;
  const drops = new Set(dropIds.filter((id) => id !== keepId));
  const dropped = c.nodes.filter((n) => drops.has(n.id));
  const merged: PaletteNode = {
    ...keep,
    sources: [...new Set([...keep.sources, ...dropped.flatMap((n) => n.sources)])],
    evidenceIds: [...new Set([...keep.evidenceIds, ...dropped.flatMap((n) => n.evidenceIds)])],
    tags: [...new Set([...keep.tags, ...dropped.flatMap((n) => n.tags)])],
    identifiers: dedupeIdentifiers([...keep.identifiers, ...dropped.flatMap((n) => n.identifiers)]),
    properties: { ...Object.assign({}, ...dropped.map((n) => n.properties)), ...keep.properties },
    description: keep.description || dropped.map((n) => n.description).find(Boolean) || "",
    updatedAt: new Date().toISOString(),
  };
  const nodes = c.nodes.filter((n) => !drops.has(n.id)).map((n) => (n.id === keepId ? merged : n));
  const edges = c.edges
    .map((e) => ({ ...e, source: drops.has(e.source) ? keepId : e.source, target: drops.has(e.target) ? keepId : e.target }))
    .filter((e, i, arr) => e.source !== e.target && arr.findIndex((x) => x.source === e.source && x.target === e.target && x.relation === e.relation) === i);
  const evidence = c.evidence.map((ev) => ({ ...ev, nodeIds: [...new Set(ev.nodeIds.map((id) => (drops.has(id) ? keepId : id)))] }));
  return appendTimeline(
    { ...c, nodes, edges, evidence },
    timelineEntry("entity", "Entidades consolidadas", `${dropped.length} duplicata(s) mescladas em “${keep.title}”.`, keepId),
  );
}

function dedupeIdentifiers(list: PaletteNode["identifiers"]): PaletteNode["identifiers"] {
  const seen = new Set<string>();
  return list.filter((i) => {
    const key = `${i.label.toLowerCase()}::${i.value.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* -------------------------------- search --------------------------------- */

export function newSearchRecord(input: Omit<PaletteSearchRecord, "id" | "at">): PaletteSearchRecord {
  return { ...input, id: uid("search"), at: new Date().toISOString() };
}

/* --------------------------------- misc ---------------------------------- */

export function touchViewport(c: PaletteCase, viewport: Viewport): PaletteCase {
  return { ...c, viewport };
}

export function confidenceSummary(c: PaletteCase): string {
  const s = caseStats(c);
  return (["verified", "high", "medium", "low", "unverified"] as const)
    .map((lvl) => `${CONFIDENCE_LABEL[lvl]}: ${s[lvl]}`)
    .join(" · ");
}

export function emptyCasePatch(id: string): PaletteCase | null {
  const c = getCase(id);
  if (!c) return null;
  return { ...c, nodes: [], edges: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

export type { EdgeStyle, KnowledgeChunk };
