import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, CircleDashed, Layers, Loader2, Play, Plus, Save, Trash2, XCircle } from "lucide-react";
import { WORKFLOWS, type Workflow } from "@/lib/agency/workflows";
import { RUNNERS, runTool } from "@/lib/agency/run";
import { addEvidence, listInvestigations } from "@/lib/agency/store";
import { logActivity } from "@/lib/agency/activity";
import {
  Badge, Button, Empty, Field, Notice, PageHeader, Panel, ValueView, cx, errorMessage,
} from "@/components/agency/kit";

export const Route = createFileRoute("/agency/tool-builder")({
  head: () => ({ meta: [{ title: "Tool Builder — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ToolBuilder,
});

const CUSTOM_KEY = "life-agency.workflows.v1";

type CustomWorkflow = { id: string; name: string; description: string; inputKind: string; steps: Array<{ toolId: string; label: string }> };

function loadCustom(): CustomWorkflow[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    return raw ? (JSON.parse(raw) as CustomWorkflow[]) : [];
  } catch { return []; }
}

type StepRun = { toolId: string; label: string; status: "idle" | "running" | "done" | "error"; data?: unknown; error?: string; ms?: number };

function ToolBuilder() {
  const [custom, setCustom] = useState<CustomWorkflow[]>([]);
  const [selected, setSelected] = useState<string>(WORKFLOWS[0].id);
  const [input, setInput] = useState("");
  const [runs, setRuns] = useState<Record<string, StepRun>>({});
  const [busy, setBusy] = useState(false);
  const [saveTarget, setSaveTarget] = useState("");
  const [builderName, setBuilderName] = useState("");
  const [builderTools, setBuilderTools] = useState<string[]>([]);

  useEffect(() => setCustom(loadCustom()), []);

  const allWorkflows: Array<Workflow | CustomWorkflow> = useMemo(() => [...WORKFLOWS, ...custom], [custom]);
  const workflow = allWorkflows.find((w) => w.id === selected) ?? allWorkflows[0];

  const runStep = async (toolId: string, label: string) => {
    setRuns((r) => ({ ...r, [toolId]: { toolId, label, status: "running" } }));
    const started = performance.now();
    try {
      const data = await runTool(toolId, input.trim());
      const ms = Math.round(performance.now() - started);
      setRuns((r) => ({ ...r, [toolId]: { toolId, label, status: "done", data, ms } }));
      logActivity({ tool: label, toolId, input: input.trim(), status: "success", source: "Tool Builder", durationMs: ms });
    } catch (e) {
      const msg = errorMessage(e);
      setRuns((r) => ({ ...r, [toolId]: { toolId, label, status: "error", error: msg } }));
      logActivity({ tool: label, toolId, input: input.trim(), status: "error", source: "Tool Builder", detail: msg.slice(0, 200) });
    }
  };

  const runAll = async () => {
    if (!input.trim() || !workflow) return;
    setBusy(true);
    setRuns({});
    for (const step of workflow.steps) {
      await runStep(step.toolId, step.label);
    }
    setBusy(false);
  };

  const saveAll = () => {
    if (!saveTarget) return;
    const done = Object.values(runs).filter((r) => r.status === "done");
    for (const r of done) {
      addEvidence(saveTarget, {
        toolId: r.toolId, tool: r.label, input: input.trim(), source: "Tool Builder",
        summary: `${r.label} · ${input.trim()}`, data: r.data,
      });
    }
    setSaveTarget("");
  };

  const createWorkflow = () => {
    if (!builderName.trim() || builderTools.length === 0) return;
    const next: CustomWorkflow = {
      id: `custom-${Date.now()}`,
      name: builderName.trim(),
      description: `${builderTools.length} etapas definidas pelo analista`,
      inputKind: "text",
      steps: builderTools.map((toolId) => ({ toolId, label: RUNNERS[toolId]?.name ?? toolId })),
    };
    const list = [...custom, next];
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    setCustom(list);
    setBuilderName("");
    setBuilderTools([]);
    setSelected(next.id);
  };

  const removeWorkflow = (id: string) => {
    const list = custom.filter((w) => w.id !== id);
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    setCustom(list);
    if (selected === id) setSelected(WORKFLOWS[0].id);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Fluxos de investigação"
        title="Tool Builder"
        subtitle="Organize ferramentas reais em fluxos executáveis. Rode o fluxo completo ou etapa por etapa; cada etapa mantém sua própria fonte, resultado e erro."
        actions={<Link to="/agency/quick-search" search={{ q: undefined }} className="ag-btn !text-[11px]">Quick Search</Link>}
      />

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <Panel title="Fluxos disponíveis" description="Prontos para uso.">
            <ul className="space-y-1.5">
              {allWorkflows.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => { setSelected(w.id); setRuns({}); }}
                    className={cx(
                      "group flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                      selected === w.id ? "border-cyan-400/40 bg-cyan-400/[0.06]" : "border-[var(--ag-border)] hover:border-[var(--ag-border-strong)]",
                    )}
                  >
                    <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#e3ecf6]">
                        {w.name}
                        {!WORKFLOWS.some((b) => b.id === w.id) && <Badge tone="violet">custom</Badge>}
                      </span>
                      <span className="block text-[10.5px] leading-snug text-[var(--ag-faint)]">{w.steps.length} etapas · {w.description}</span>
                    </span>
                    {!WORKFLOWS.some((b) => b.id === w.id) && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); removeWorkflow(w.id); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeWorkflow(w.id); } }}
                        className="text-[var(--ag-faint)] hover:text-rose-300"
                      ><Trash2 className="h-3 w-3" /></span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Criar fluxo" description="Selecione ferramentas integradas.">
            <Field label="Nome do fluxo"><input className="ag-input" value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder="Ex.: Verificação de fornecedor" /></Field>
            <div className="mt-2 max-h-52 space-y-1 overflow-auto rounded-lg border border-[var(--ag-border)] p-2">
              {Object.values(RUNNERS).map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-[11px] text-[var(--ag-muted)]">
                  <input
                    type="checkbox"
                    checked={builderTools.includes(r.id)}
                    onChange={(e) => setBuilderTools((list) => e.target.checked ? [...list, r.id] : list.filter((x) => x !== r.id))}
                  />
                  {r.name}
                </label>
              ))}
            </div>
            <Button size="sm" className="mt-2" onClick={createWorkflow} disabled={!builderName.trim() || !builderTools.length}>
              <Plus className="h-3 w-3" /> Salvar fluxo
            </Button>
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title={workflow?.name ?? "Fluxo"} description={workflow?.description}>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[240px] flex-1">
                <Field label="Entrada do fluxo" hint="Domínio, IP, URL, username, e-mail ou hash — conforme as etapas.">
                  <input className="ag-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="exemplo.com" spellCheck={false} />
                </Field>
              </div>
              <Button variant="primary" onClick={() => void runAll()} disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Executar fluxo
              </Button>
            </div>

            <ol className="mt-4 space-y-1.5">
              {(workflow?.steps ?? []).map((s, i) => {
                const run = runs[s.toolId];
                return (
                  <li key={`${s.toolId}-${i}`} className="flex items-center gap-2 rounded-lg border border-[var(--ag-border)] px-2.5 py-2">
                    <span className="ag-mono w-5 text-[10px] text-[var(--ag-faint)]">{i + 1}</span>
                    {run ? (
                      run.status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
                        : run.status === "done" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : run.status === "error" ? <XCircle className="h-3.5 w-3.5 text-rose-400" />
                        : <CircleDashed className="h-3.5 w-3.5 text-[var(--ag-faint)]" />
                    ) : <CircleDashed className="h-3.5 w-3.5 text-[var(--ag-faint)]" />}
                    <span className="min-w-0 flex-1 truncate text-[11.5px]">{s.label}</span>
                    {run?.ms !== undefined && <span className="ag-mono text-[9.5px] text-[var(--ag-faint)]">{run.ms}ms</span>}
                    <Button size="sm" variant="ghost" disabled={!input.trim() || busy} onClick={() => void runStep(s.toolId, s.label)}>
                      <ChevronRight className="h-3 w-3" /> executar
                    </Button>
                  </li>
                );
              })}
            </ol>

            {Object.values(runs).some((r) => r.status === "done") && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className="ag-select !w-auto !py-1.5 !text-[11px]" value={saveTarget} onChange={(e) => setSaveTarget(e.target.value)}>
                  <option value="">Salvar resultados em investigação…</option>
                  {listInvestigations().map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
                </select>
                <Button size="sm" onClick={saveAll} disabled={!saveTarget}><Save className="h-3 w-3" /> Salvar evidências</Button>
              </div>
            )}
          </Panel>

          {Object.values(runs).map((r) => (
            <Panel
              key={r.toolId}
              title={r.label}
              actions={
                r.status === "done" ? <Badge tone="green">concluído</Badge>
                  : r.status === "error" ? <Badge tone="rose">erro</Badge>
                  : <Badge tone="blue">executando</Badge>
              }
            >
              {r.status === "error" && <Notice tone="warn" title="Etapa falhou">{r.error}</Notice>}
              {r.status === "done" && <ValueView value={strip(r.data)} />}
            </Panel>
          ))}

          {Object.keys(runs).length === 0 && (
            <Panel><Empty title="Nenhuma etapa executada" hint="Escolha um fluxo, informe a entrada e execute tudo ou etapas individuais." icon={<Layers className="h-6 w-6" />} /></Panel>
          )}
        </div>
      </div>

      <Notice tone="info" title="Operações passivas">
        Todos os fluxos fazem apenas consultas a bases públicas. Não há varredura de portas, autenticação forçada ou exploração.
      </Notice>
    </div>
  );
}

function strip(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const clone: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  delete clone.sources;
  delete clone.source;
  delete clone.queriedAt;
  return clone;
}
