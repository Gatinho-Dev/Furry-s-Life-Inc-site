import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, CircleDashed, Fingerprint, Layers, Loader2, Play, Plus, Search, XCircle } from "lucide-react";
import { detectInput, suggestionsFor, type InputKind } from "@/lib/agency/catalog";
import { runTool } from "@/lib/agency/run";
import { workflowsFor } from "@/lib/agency/workflows";
import { addEntity, addEvidence, listInvestigations } from "@/lib/agency/store";
import { PageHeader, Panel, Badge, Button, Empty, ErrorBox, Notice, ValueView, cx, errorMessage } from "@/components/agency/kit";
import { logActivity } from "@/lib/agency/activity";

export const Route = createFileRoute("/agency/quick-search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : undefined }),
  head: () => ({ meta: [{ title: "Quick Search — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: QuickSearch,
});

const KIND_LABEL: Record<InputKind, string> = {
  domain: "Domínio", ip: "Endereço IP", url: "URL", username: "Username público",
  email: "E-mail", hash: "Hash de arquivo", cve: "CVE", asn: "ASN", company: "CNPJ / empresa", text: "Texto livre",
};

const KIND_HINT: Record<InputKind, string> = {
  domain: "Consultas de registro, DNS, certificados e histórico.",
  ip: "Rede, ASN, prefixo, PTR e reputação pública.",
  url: "Parse, redirecionamentos, headers e reputação.",
  username: "Perfis públicos em plataformas abertas.",
  email: "Validação técnica do domínio (SPF/DMARC/DKIM).",
  hash: "Metadados públicos de amostra por hash.",
  cve: "NVD, CISA KEV e EPSS.",
  asn: "Prefixos anunciados e vizinhos de rede.",
  company: "Cadastro público e presença digital.",
  text: "Busca em fontes públicas indexadas.",
};

type ResultRow = {
  key: string;
  toolId: string;
  toolName: string;
  input: string;
  loading: boolean;
  data: unknown | null;
  error: string | null;
  ms?: number;
};

function QuickSearch() {
  const { q } = Route.useSearch();
  const [input, setInput] = useState(q ?? "");
  const [kind, setKind] = useState<InputKind>(() => detectInput(q ?? ""));
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [workflowState, setWorkflowState] = useState<{ id: string; step: number; total: number; label: string; done: boolean } | null>(null);
  const [combinedError, setCombinedError] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState("");

  useEffect(() => {
    if (q) {
      setInput(q);
      setKind(detectInput(q));
    }
  }, [q]);

  const suggestions = useMemo(() => suggestionsFor(kind), [kind]);
  const workflows = useMemo(() => workflowsFor(kind), [kind]);

  const execute = async (toolId: string, toolName: string) => {
    const value = input.trim();
    if (!value) return;
    const key = `${toolId}-${Date.now()}`;
    setRows((r) => [...r, { key, toolId, toolName, input: value, loading: true, data: null, error: null }]);
    const started = performance.now();
    try {
      const data = await runTool(toolId, value);
      const ms = Math.round(performance.now() - started);
      setRows((r) => r.map((row) => (row.key === key ? { ...row, loading: false, data, ms } : row)));
      logActivity({ tool: toolName, toolId, input: value, status: "success", source: "Quick Search", durationMs: ms });
    } catch (e) {
      const msg = errorMessage(e);
      setRows((r) => r.map((row) => (row.key === key ? { ...row, loading: false, error: msg } : row)));
      logActivity({ tool: toolName, toolId, input: value, status: "error", source: "Quick Search", detail: msg.slice(0, 200) });
    }
  };

  const runWorkflow = async (workflowId: string) => {
    const wf = workflows.find((w) => w.id === workflowId);
    if (!wf || !input.trim()) return;
    setCombinedError(null);
    setRows([]);
    for (let i = 0; i < wf.steps.length; i++) {
      const step = wf.steps[i];
      setWorkflowState({ id: wf.id, step: i + 1, total: wf.steps.length, label: step.label, done: false });
      await execute(step.toolId, step.label);
    }
    setWorkflowState((s) => (s ? { ...s, done: true } : null));
  };

  const saveAll = () => {
    if (!saveTarget) return;
    const ok = rows.filter((r) => r.data);
    for (const row of ok) {
      addEntity(saveTarget, {
        kind: kind === "text" ? "note" : (kind === "company" ? "organization" : kind) as never,
        value: row.input,
        source: row.toolName,
        confidence: "confirmed",
      });
      addEvidence(saveTarget, {
        toolId: row.toolId, tool: row.toolName, input: row.input,
        source: "Quick Search", summary: `${row.toolName} · ${row.input}`, data: row.data,
      });
    }
    setSaveTarget("");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Universal pivoting"
        title="Quick Search"
        subtitle="Uma entrada, todas as ferramentas compatíveis. O tipo é detectado automaticamente e cada consulta usa fontes públicas reais, com fonte e horário."
        actions={<Link to="/agency/tool-builder" className="ag-btn"><Layers className="h-3.5 w-3.5" /> Tool Builder</Link>}
      />

      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const first = suggestions[0];
            if (first) void execute(first.id, first.name);
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="min-w-[260px] flex-1">
            <label className="ag-label mb-1.5 block">Pesquisa universal</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ag-faint)]" />
              <input
                value={input}
                onChange={(e) => { setInput(e.target.value); setKind(detectInput(e.target.value)); }}
                placeholder="dominio.com · 8.8.8.8 · AS15169 · CVE-2021-44228 · usuario@dominio.com · @username · sha256…"
                className="ag-input !py-2.5 !pl-9 !text-[13px]"
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="min-w-[150px]">
            <label className="ag-label mb-1.5 block">Tipo detectado</label>
            <select className="ag-select !py-2.5" value={kind} onChange={(e) => setKind(e.target.value as InputKind)}>
              {(Object.keys(KIND_LABEL) as InputKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </div>
          <Button type="submit" variant="primary" className="!py-2.5" disabled={!input.trim()}>
            <Play className="h-3.5 w-3.5" /> Consultar principal
          </Button>
        </form>

        {input.trim() && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--ag-muted)]">
            <Badge tone="cyan">{KIND_LABEL[kind]}</Badge>
            <span>{KIND_HINT[kind]}</span>
          </div>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Panel title="Ferramentas sugeridas" description="Executadas individualmente ou em sequência.">
            {!input.trim() ? (
              <Empty title="Digite uma consulta" hint="O sistema sugere as ferramentas compatíveis com o tipo detectado." />
            ) : (
              <ul className="space-y-1.5">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => void execute(s.id, s.name)}
                      className="group flex w-full items-start gap-2 rounded-lg border border-[var(--ag-border)] p-2.5 text-left transition-colors hover:border-cyan-400/40 hover:bg-white/[0.03]"
                    >
                      <Play className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] font-medium text-[#e3ecf6]">{s.name}</span>
                        <span className="block text-[10.5px] leading-snug text-[var(--ag-faint)]">{s.description}</span>
                      </span>
                      <ArrowRight className="mt-1 h-3 w-3 shrink-0 text-[var(--ag-faint)] group-hover:text-cyan-300" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {(kind === "username" || kind === "email") && input.trim() && (
            <Panel title="Identidade e correlação" description="Cruza perfis, contatos declarados, chaves e avatar em um caso único." icon={<Fingerprint className="h-3.5 w-3.5" />}>
              <p className="text-[11px] leading-relaxed text-[var(--ag-muted)]">
                {kind === "username"
                  ? "Varre 464 sites (Sherlock, MIT), GitHub, Keybase, Hacker News, Mastodon, GitLab e dev.to; deriva e-mails/sites publicados e monta o caso com confiança por sinal."
                  : "Consulta o perfil público do Gravatar para o e-mail e reúne contas vinculadas quando existirem."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/agency/identity" search={{ seed: input.trim(), deep: undefined }} className="ag-btn ag-btn-primary !px-2.5 !py-1.5 !text-[11px]">
                  <Fingerprint className="h-3 w-3" /> Abrir no Case Seeder
                </Link>
                <Link to="/agency/username" className="ag-btn ag-btn-ghost !px-2.5 !py-1.5 !text-[11px]">
                  Sherlock · varredura estendida
                </Link>
              </div>
            </Panel>
          )}

          {workflows.length > 0 && (
            <Panel title="Investigação combinada" description="Executa todas as etapas em sequência, cada uma com sua própria fonte.">
              {workflows.map((wf) => (
                <button
                  key={wf.id}
                  onClick={() => void runWorkflow(wf.id)}
                  disabled={Boolean(workflowState && !workflowState.done) || !input.trim()}
                  className="mb-2 flex w-full items-center justify-between gap-2 rounded-xl border border-blue-500/30 bg-blue-500/[0.06] px-3 py-2.5 text-left hover:bg-blue-500/10 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block text-[12px] font-semibold text-blue-100">{wf.name}</span>
                    <span className="block text-[10.5px] text-blue-200/70">{wf.steps.length} etapas · {wf.description}</span>
                  </span>
                  {workflowState && !workflowState.done
                    ? <Loader2 className="h-4 w-4 animate-spin text-blue-300" />
                    : <ArrowRight className="h-4 w-4 text-blue-300" />}
                </button>
              ))}
              {workflowState && (
                <div className="mt-2 rounded-lg border border-[var(--ag-border)] p-2.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span>{workflowState.done ? "Workflow concluído" : `Etapa ${workflowState.step}/${workflowState.total}`}</span>
                    <span className="text-[var(--ag-faint)]">{workflowState.label}</span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                    <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: `${(workflowState.step / workflowState.total) * 100}%` }} />
                  </div>
                </div>
              )}
              {combinedError && <div className="mt-2"><ErrorBox message={combinedError} /></div>}
            </Panel>
          )}
        </div>

        <div className="space-y-3">
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--ag-border)] bg-black/25 px-3 py-2">
              <div className="text-[11.5px] text-[var(--ag-muted)]">{rows.filter((r) => r.data).length} resultado(s) · {rows.length} execução(ões)</div>
              <div className="flex items-center gap-2">
                <select className="ag-select !w-auto !py-1 !text-[11px]" value={saveTarget} onChange={(e) => setSaveTarget(e.target.value)}>
                  <option value="">Salvar em investigação…</option>
                  {listInvestigations().map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
                </select>
                <Button size="sm" variant="primary" onClick={saveAll} disabled={!saveTarget}><Plus className="h-3 w-3" /> Salvar</Button>
              </div>
            </div>
          )}

          {rows.length === 0 && (
            <Panel>
              <Empty title="Nenhuma consulta executada" hint="Escolha uma ferramenta sugerida ou execute a investigação combinada." icon={<CircleDashed className="h-6 w-6" />} />
            </Panel>
          )}

          {rows.map((row) => (
            <Panel
              key={row.key}
              title={row.toolName}
              actions={
                <div className="flex items-center gap-2">
                  {row.loading ? <Badge tone="blue"><Loader2 className="h-2.5 w-2.5 animate-spin" /> executando</Badge>
                    : row.error ? <Badge tone="rose"><XCircle className="h-2.5 w-2.5" /> erro</Badge>
                    : <Badge tone="green"><CheckCircle2 className="h-2.5 w-2.5" /> {row.ms}ms</Badge>}
                  <button onClick={() => setRows((r) => r.filter((x) => x.key !== row.key))} className="text-[var(--ag-faint)] hover:text-white"><XCircle className="h-3.5 w-3.5" /></button>
                </div>
              }
            >
              {row.loading && <div className="h-16 ag-skeleton" />}
              {row.error && <ErrorBox message={row.error} />}
              {row.data !== null && <ValueView value={stripSources(row.data)} />}
            </Panel>
          ))}
        </div>
      </div>

      <Notice tone="info" title="Escopo ético">
        A plataforma trabalha apenas com dados públicos e fontes que autorizam consulta. Não há quebra de senhas, acesso a contas privadas,
        rastreamento de pessoas ou exploração de sistemas.
      </Notice>
    </div>
  );
}

function stripSources(data: unknown): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const clone: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  delete clone.sources;
  delete clone.source;
  delete clone.queriedAt;
  return clone;
}

export function QuickSearchBadge({ label }: { label: string }) {
  return <span className={cx("text-[10px] text-[var(--ag-faint)]")}>{label}</span>;
}
