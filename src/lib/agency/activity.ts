/**
 * Global activity log — persisted in the browser only (localStorage).
 * Nothing about the analyst's activity is sent to any third party.
 */

export type ActivityEntry = {
  id: string;
  tool: string;
  toolId: string;
  input: string;
  status: "success" | "error" | "partial";
  source: string;
  investigationId?: string;
  detail?: string;
  durationMs?: number;
  at: string;
};

const KEY = "life-agency.activity.v1";
const MAX = 500;
const listeners = new Set<() => void>();

function read(): ActivityEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: ActivityEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* storage full / disabled */
  }
  listeners.forEach((l) => l());
}

export function getActivity(): ActivityEntry[] {
  return read();
}

export function logActivity(entry: Omit<ActivityEntry, "id" | "at">): ActivityEntry {
  const row: ActivityEntry = {
    ...entry,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
  };
  write([row, ...read()]);
  return row;
}

export function clearActivity() {
  write([]);
}

export function subscribeActivity(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) fn();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function activityStats(entries = read()) {
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = entries.filter((e) => e.at.slice(0, 10) === today).length;
  const byTool = new Map<string, number>();
  for (const e of entries) byTool.set(e.tool, (byTool.get(e.tool) ?? 0) + 1);
  const byInput = new Map<string, number>();
  for (const e of entries) {
    const t = e.input.includes(".") ? "domain" : /^\d+\.\d+\.\d+\.\d+$/.test(e.input) ? "ip" : "other";
    byInput.set(t, (byInput.get(t) ?? 0) + 1);
  }
  return {
    total: entries.length,
    today: todayCount,
    errors: entries.filter((e) => e.status === "error").length,
    tools: entries.filter((e) => e.status === "success").length,
    topTools: [...byTool.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
  };
}
