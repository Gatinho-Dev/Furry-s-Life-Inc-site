/**
 * Bounded investigation queue.
 *
 * Sources are contacted by a small worker pool so a large input never floods
 * public APIs. Each task has its own state, one conservative retry for
 * transient network failures, and supports cancellation. The queue never
 * fabricates a result: a failed source stays failed and is reported as such.
 */

import { runSource, type SearchOutcome } from "./search";
import type { InvestigationPlan, PlannedTarget } from "./plan";
import type { SearchJob, SearchState } from "./types";

export type QueueProgress = { jobs: SearchJob[]; outcomes: SearchOutcome[] };

export type InvestigationRun = {
  jobs: SearchJob[];
  outcomes: SearchOutcome[];
  startedAt: string;
  durationMs: number;
  cancelled: boolean;
  totals: {
    queries: number;
    completed: number;
    empty: number;
    unavailable: number;
    errors: number;
    rateLimited: number;
    findings: number;
  };
};

const RETRYABLE = /network|timeout|fetch|econn|socket|502|503|504/i;

type Task = {
  target: PlannedTarget;
  sourceId: string;
  sourceName: string;
  category: SearchJob["category"];
  reference?: string;
};

export async function runInvestigationPlan(
  plan: InvestigationPlan,
  opts: {
    concurrency?: number;
    gapMs?: number;
    signal?: AbortSignal;
    onUpdate?: (progress: QueueProgress) => void;
  } = {},
): Promise<InvestigationRun> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 3, 6));
  const gapMs = opts.gapMs ?? 180;

  const tasks: Task[] = [];
  for (const target of plan.targets) {
    for (const source of target.sources) {
      tasks.push({
        target,
        sourceId: source.id,
        sourceName: source.name,
        category: source.category,
        reference: source.reference?.(target.value),
      });
    }
  }

  const jobs: SearchJob[] = tasks.map((task, i) => ({
    id: `${task.target.key}:${task.sourceId}:${i}`,
    value: task.target.value,
    kind: task.target.kind,
    sourceId: task.sourceId,
    sourceName: task.sourceName,
    category: task.category,
    state: "pending" as SearchState,
    durationMs: 0,
    resultCount: 0,
    reference: task.reference,
  }));
  const outcomes: SearchOutcome[] = new Array(tasks.length);
  let cursor = 0;

  const emit = () => opts.onUpdate?.({ jobs: jobs.map((j) => ({ ...j })), outcomes: outcomes.filter(Boolean) });

  const runOne = async (index: number): Promise<void> => {
    const task = tasks[index];
    const job = jobs[index];
    if (opts.signal?.aborted) {
      job.state = "error";
      job.error = "cancelled";
      emit();
      return;
    }
    job.state = "running";
    job.startedAt = new Date().toISOString();
    emit();
    let outcome = await runSource(task.sourceId, task.target.value, opts.signal);
    if (!outcome.ok && outcome.state === "error" && !opts.signal?.aborted && RETRYABLE.test(outcome.error ?? "")) {
      await new Promise((r) => setTimeout(r, 700));
      outcome = await runSource(task.sourceId, task.target.value, opts.signal);
    }
    outcome.query = task.target.value;
    outcomes[index] = outcome;
    job.state = outcome.state;
    job.durationMs = outcome.durationMs;
    job.resultCount = outcome.resultCount;
    job.error = outcome.error;
    job.reference = outcome.reference ?? job.reference;
    emit();
  };

  const worker = async () => {
    while (true) {
      if (opts.signal?.aborted) return;
      const index = cursor;
      cursor += 1;
      if (index >= tasks.length) return;
      await runOne(index);
      if (gapMs > 0) await new Promise((r) => setTimeout(r, gapMs));
    }
  };

  emit();
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(tasks.length, 1)) }, () => worker()));

  // Anything left untouched by cancellation is marked, never reported as done.
  for (const job of jobs) {
    if (job.state === "pending") {
      job.state = "error";
      job.error = opts.signal?.aborted ? "cancelled" : "not executed";
    }
    if (opts.signal?.aborted && job.state === "running") {
      job.state = "error";
      job.error = "cancelled";
    }
  }
  emit();

  const totals = {
    queries: jobs.length,
    completed: jobs.filter((j) => j.state === "completed").length,
    empty: jobs.filter((j) => j.state === "empty").length,
    unavailable: jobs.filter((j) => j.state === "unavailable").length,
    errors: jobs.filter((j) => j.state === "error").length,
    rateLimited: jobs.filter((j) => j.state === "rate-limited").length,
    findings: jobs.reduce((n, j) => n + j.resultCount, 0),
  };

  return {
    jobs,
    outcomes: outcomes.filter(Boolean),
    startedAt,
    durationMs: Date.now() - t0,
    cancelled: Boolean(opts.signal?.aborted),
    totals,
  };
}
