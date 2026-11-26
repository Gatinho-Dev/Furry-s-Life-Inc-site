import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowRight, Ban, Check, CircleDot, ClipboardPaste, FileText, Filter, Layers,
  Link2, Loader2, Play, Plus, Search, ShieldCheck, Sparkles, Square, StopCircle, Upload, Wand2, X,
} from "lucide-react";
import { analyzeInput, type InputCandidate } from "@/lib/palette/classify";
import { buildInvestigationPlan, DEPTH_META, type InvestigationPlan } from "@/lib/palette/plan";
import { runInvestigationPlan, type InvestigationRun } from "@/lib/palette/queue";
import { CATEGORY_LABEL, referenceFor, type SearchOutcome } from "@/lib/palette/search";
import { NODE_KIND_LABEL, type InvestigationDepth, type PaletteCase, type PaletteNodeKind, type SearchJob } from "@/lib/palette/types";
import { ConfidencePill, KindIcon, PalButton, PalField, PalLabel, inputCls, selectCls, KindPill } from "./kit";
import { cx } from "@/components/agency/kit";

export type IngestValue = {
  kind: PaletteNodeKind;
  value: string;
  score: number;
  context: string;
  alternates: InputCandidate["alternates"];
  derivedFromValue?: string;
  derivedRelation?: string;
};

type Stage = "input" | "review" | "running" | "done";

const MAX_TARGETS = 40;

const KIND_OPTIONS: PaletteNodeKind[] = [
  "email", "person", "organization", "company", "username", "phone", "domain", "subdomain", "url",
  "ipv4", "ipv6", "asn", "network", "hash", "cve", "wallet", "location", "social-profile", "certificate",
  "website", "public-service", "document", "event", "custom",
];

function normalize(kind: PaletteNodeKind, value: string): string {
  const v = value.trim().toLowerCase();
  if (["domain", "subdomain", "website"].includes(kind)) return v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return v;
}

function scoreTone(score: number): { label: string; cls: string } {
  if (score >= 80) return { label: "confirmado", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" };
  if (score >= 60) return { label: "provável", cls: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" };
  return { label: "ambíguo", cls: "border-amber-400/35 bg-amber-400/10 text-amber-200" };
}

function jobTone(state: SearchJob["state"]): string {
  switch (state) {
    case "completed": return "text-emerald-300";
    case "empty": return "text-slate-400";
    case "running": return "text-cyan-300";
    case "unavailable": return "text-violet-300";
    case "rate-limited": return "text-amber-300";
    case "error": return "text-rose-300";
    default: return "text-slate-500";
  }
}

export function PaletteInputEngine({
  cases, active, readOnly, onIngest, onSearchResults, onReview, onOpenCanvas, onOpenCase, onToast, compact = false,
}: {
  cases: PaletteCase[];
  active: PaletteCase | null;
  readOnly: boolean;
  onIngest: (values: IngestValue[], meta: { depth: InvestigationDepth; investigate: boolean }) => { caseId?: string } | void;
  onSearchResults: (outcomes: SearchOutcome[], meta: { depth: InvestigationDepth; values: IngestValue[]; durationMs: number }) => void;
  onReview: (query: string, outcomes: SearchOutcome[]) => void;
  onOpenCanvas: () => void;
  onOpenCase: (id: string) => void;
  onToast: (message: string, tone?: "ok" | "warn" | "info") => void;
  compact?: boolean;
}) {
  const [stage, setStage] = useState<Stage>("input");
  const [text, setText] = useState("");
  const [depth, setDepth] = useState<InvestigationDepth>("standard");
  const [autoSearch, setAutoSearch] = useState(true);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [kindOverrides, setKindOverrides] = useState<Record<string, PaletteNodeKind>>({});
  const [analysis, setAnalysis] = useState(() => analyzeInput(""));
  const [title, setTitle] = useState("");
  const [run, setRun] = useState<InvestigationRun | null>(null);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [plan, setPlan] = useState<InvestigationPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const prepared = useMemo(() => {
    const list = analysis.candidates.slice(0, MAX_TARGETS).map((c) => ({ ...c, kind: kindOverrides[c.key] ?? c.kind }));
    return list;
  }, [analysis, kindOverrides]);

  const selected = prepared.filter((c) => accepted[c.key] !== false);
  const displayedKind = (candidate: InputCandidate): PaletteNodeKind => kindOverrides[candidate.key] ?? candidate.kind;

  const existing = useCallback((kind: PaletteNodeKind, value: string): PaletteCase | undefined => {
    if (!active) return undefined;
    const target = normalize(kind, value);
    const hit = active.nodes.find((n) => n.kind === kind && normalize(n.kind, n.title) === target);
    return hit ? active : undefined;
  }, [active]);

  const stats = useMemo(() => {
    let entities = 0;
    let searches = 0;
    const sources = new Set<string>();
    for (const c of cases) {
      entities += c.nodes.length;
      searches += c.searches.length;
      for (const s of c.searches) sources.add(s.tool);
    }
    return { cases: cases.filter((c) => !c.shared?.readOnly).length, entities, searches, sources: sources.size };
  }, [cases]);

  const analyze = () => {
    const next = analyzeInput(text);
    setAnalysis(next);
    setAccepted(Object.fromEntries(next.candidates.map((c) => [c.key, true])));
    setKindOverrides({});
    setStage("review");
    if (next.candidates.length === 0) onToast("Nenhum identificador reconhecido no texto.", "warn");
  };

  const readFile = async (file: File) => {
    if (file.size > 2_000_000) { onToast("Arquivo acima de 2 MB. Cole apenas o trecho relevante.", "warn"); return; }
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["txt", "md", "markdown", "csv", "tsv", "json", "log", "html", "htm", "xml", "eml"].includes(extension)) {
      onToast(`“${extension || "arquivo"}” não é extraído no navegador. Aceitos: TXT, MD, CSV, JSON, LOG, HTML, XML, EML. Para PDF/DOCX, cole o texto.`, "warn");
      return;
    }
    const content = await file.text();
    setText((prev) => `${prev ? `${prev}\n\n` : ""}${content}`.slice(0, 400_000));
    onToast(`${file.name} carregado (${content.length.toLocaleString("pt-BR")} caracteres).`, "ok");
  };

  const commit = (investigate: boolean) => {
    if (!selected.length) { onToast("Selecione ao menos uma entidade.", "warn"); return; }
    if (investigate && readOnly) { onToast("Caso read-only. Duplique o caso para investigar.", "warn"); return; }
    if (investigate && selected.length > MAX_TARGETS) onToast(`Apenas os primeiros ${MAX_TARGETS} alvos serão consultados.`, "warn");
    const values: IngestValue[] = selected.map((c) => ({
      kind: c.kind,
      value: c.value,
      score: c.score,
      context: c.context,
      alternates: c.alternates,
      derivedFromValue: c.derivedFromValue,
      derivedRelation: c.derivedRelation,
    }));
    const result = onIngest(values, { depth, investigate });
    if (!investigate) {
      onToast(`${values.length} entidade(s) adicionada(s) ao caso.`, "ok");
      setStage("input");
      setText("");
      return;
    }
    const targets = values.map((v) => ({ key: `${v.kind}:${v.value}`, kind: v.kind, value: v.value }));
    const nextPlan = buildInvestigationPlan(targets, depth);
    setPlan(nextPlan);
    setJobs([]);
    setRun(null);
    if (nextPlan.totalQueries === 0) {
      setStage("done");
      setRun({
        jobs: [], outcomes: [], startedAt: new Date().toISOString(), durationMs: 0, cancelled: false,
        totals: { queries: 0, completed: 0, empty: 0, unavailable: 0, errors: 0, rateLimited: 0, findings: 0 },
      });
      onToast("Entidades adicionadas, mas nenhuma fonte gratuita é compatível com esses tipos.", "warn");
      void result;
      return;
    }
    setStage("running");
    void execute(nextPlan, values);
  };

  const execute = async (nextPlan: InvestigationPlan, values: IngestValue[]) => {
    setBusy(true);
    abortRef.current = new AbortController();
    const startedAt = Date.now();
    try {
      const result = await runInvestigationPlan(nextPlan, {
        concurrency: 3,
        gapMs: 200,
        signal: abortRef.current.signal,
        onUpdate: ({ jobs: snapshot }) => setJobs(snapshot),
      });
      setRun(result);
      setStage("done");
      const usable = result.outcomes.filter((o) => o.ok || o.state === "unavailable" || o.state === "empty");
      if (usable.length > 0) {
        onSearchResults(result.outcomes, { depth, values, durationMs: result.durationMs });
      }
      if (result.cancelled) onToast("Investigação cancelada. As consultas concluídas foram registradas.", "warn");
      else if (result.totals.findings > 0) onToast(`${result.totals.findings} resultado(s) encontrados em ${result.durationMs} ms.`, "ok");
      else onToast("Consultas concluídas sem resultados. Nada foi inventado.", "info");
      void startedAt;
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao executar o plano.", "warn");
      setStage("done");
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const cancel = () => { abortRef.current?.abort(); };

  const openCase = (id: string) => { onOpenCase(id); };

  const reset = () => {
    setStage("input");
    setText("");
    setAnalysis(analyzeInput(""));
    setAccepted({});
    setKindOverrides({});
    setRun(null);
    setJobs([]);
    setPlan(null);
    setTitle("");
  };

  const toggleAll = (on: boolean) => setAccepted(Object.fromEntries(prepared.map((c) => [c.key, on])));

  const findings = run?.outcomes ?? [];
  const importable = findings.filter((o) => o.ok && (o.resultCount > 0 || o.data));

  useEffect(() => () => abortRef.current?.abort(), []);

  /* --------------------------------- input --------------------------------- */

  if (stage === "input") {
    return (
      <section className={cx("palette-hero relative overflow-hidden rounded-2xl border border-[#1b2a3a]", compact ? "p-3" : "p-4 sm:p-6")}>
        <div className="palette-hero-glow" aria-hidden />
        <div className="relative">
          {!compact && (
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-cyan-300/80">
                  <Sparkles className="h-3 w-3" /> Life Intelligence Input Engine
                </div>
                <h1 className="mt-1 font-display text-[26px] font-semibold leading-tight text-[#f1f7fd] sm:text-[32px]">Your intelligence workspace</h1>
                <p className="mt-1 text-[12px] text-[#8ca2b8]">Turn raw information into structured intelligence.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[["casos", stats.cases], ["entidades", stats.entities], ["consultas", stats.searches], ["fontes usadas", stats.sources]].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border border-[#1e2e3e] bg-[#08111a]/80 px-2 py-1 text-center">
                    <div className="text-[14px] font-semibold leading-none text-[#e8f2fb]">{value}</div>
                    <div className="mt-0.5 text-[8px] uppercase tracking-wide text-[#5f7488]">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="palette-input-shell">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); analyze(); } }}
              placeholder="Insira um e-mail, nome, telefone, usuário, domínio, IP, URL ou cole um texto com várias informações..."
              className={cx("palette-input w-full resize-y bg-transparent px-3 py-2.5 text-[12.5px] leading-relaxed text-[#e8f2fb] outline-none placeholder:text-[#51677c]", compact ? "min-h-[74px]" : "min-h-[124px]")}
              spellCheck={false}
            />
            <div className="flex flex-wrap items-center gap-1 border-t border-[#16222e] px-2 py-1.5">
              <button onClick={() => void navigator.clipboard?.readText().then((v) => { if (v) { setText((p) => `${p}${p ? "\n" : ""}${v}`); onToast("Conteúdo colado.", "info"); } }).catch(() => onToast("Permissão de área de transferência negada. Use Ctrl+V.", "warn"))} className="palette-tool">
                <ClipboardPaste className="h-3 w-3" /> Colar
              </button>
              <button onClick={() => fileRef.current?.click()} className="palette-tool">
                <Upload className="h-3 w-3" /> Importar arquivo
              </button>
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.tsv,.json,.log,.html,.htm,.xml,.eml" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void readFile(f); e.target.value = ""; }} />
              <button onClick={() => setText("")} disabled={!text} className="palette-tool disabled:opacity-40">
                <X className="h-3 w-3" /> Limpar
              </button>
              <span className="ml-auto hidden text-[9px] text-[#51677c] sm:inline">{text.length.toLocaleString("pt-BR")} caracteres</span>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-end gap-2">
            <div className="min-w-[240px]">
              <PalLabel>Investigation depth</PalLabel>
              <div className="mt-1 flex rounded-lg border border-[#1e2e3e] bg-[#08111a] p-0.5">
                {(Object.keys(DEPTH_META) as InvestigationDepth[]).map((key) => (
                  <button key={key} onClick={() => setDepth(key)} title={DEPTH_META[key].description}
                    className={cx("flex-1 rounded-md px-2 py-1 text-[10px] transition-colors", depth === key ? "bg-cyan-400/15 text-cyan-100" : "text-[#7f94a9] hover:text-[#c6d6e6]")}>
                    {DEPTH_META[key].short}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-1.5 pb-1 text-[10px] text-[#9db0c4]">
              <input type="checkbox" checked={autoSearch} onChange={(e) => setAutoSearch(e.target.checked)} className="h-3 w-3 accent-cyan-400" />
              Executar pesquisas automaticamente
            </label>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <PalButton variant="soft" onClick={analyze} disabled={!text.trim()}>
                <Filter className="h-3.5 w-3.5" /> Analisar sem pesquisar
              </PalButton>
              <PalButton variant="primary" onClick={analyze} disabled={!text.trim()}>
                <Wand2 className="h-3.5 w-3.5" /> Analyze &amp; Investigate
              </PalButton>
            </div>
          </div>
          <p className="mt-1.5 text-[9.5px] leading-relaxed text-[#5f7488]">
            {DEPTH_META[depth].estimate} · {autoSearch ? "as fontes compatíveis serão consultadas após sua confirmação" : "a pesquisa automática ficará desligada"}. Nada é enviado a terceiros fora das consultas às fontes públicas.
          </p>

          {!compact && (
            <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#14202c] pt-2 text-[9.5px] text-[#5f7488]">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-emerald-400/70" /> dados locais</span>
              <span className="inline-flex items-center gap-1"><Ban className="h-3 w-3 text-rose-400/60" /> sem acesso a contas privadas</span>
              <span className="inline-flex items-center gap-1"><CircleDot className="h-3 w-3 text-cyan-400/60" /> fontes gratuitas</span>
              <button onClick={() => onOpenCanvas()} className="ml-auto inline-flex items-center gap-1 text-cyan-300 hover:underline">
                abrir canvas <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </section>
    );
  }

  /* -------------------------------- review --------------------------------- */

  if (stage === "review") {
    const ambiguous = prepared.filter((c) => c.status === "ambiguous").length;
    return (
      <section className="rounded-2xl border border-[#1b2a3a] bg-[#070e15]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#16222e] px-3 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><Layers className="h-3.5 w-3.5" /></span>
          <div>
            <div className="text-[12px] font-semibold text-[#eaf3fb]">Revisar entidades reconhecidas</div>
            <div className="text-[9px] text-[#657b90]">
              {prepared.length} identificador(es) · {analysis.derived} derivado(s) · {ambiguous} ambíguo(s). Nada entra no caso antes da sua confirmação.
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => toggleAll(true)} className="text-[9.5px] text-cyan-300 hover:underline">todos</button>
            <span className="text-[#33465a]">·</span>
            <button onClick={() => toggleAll(false)} className="text-[9.5px] text-[#7f94a9] hover:underline">nenhum</button>
            <PalButton size="sm" variant="ghost" onClick={() => setStage("input")}>Voltar</PalButton>
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {prepared.length === 0 && (
            <div className="px-4 py-8 text-center text-[11px] text-[#7f94a9]">
              Nenhum identificador reconhecido. Volte e adicione contexto (ex.: “E-mail: nome@dominio.com”).
            </div>
          )}
          <ul className="divide-y divide-[#111c27]">
            {prepared.map((candidate) => {
              const kind = displayedKind(candidate);
              const tone = scoreTone(candidate.score);
              const checked = accepted[candidate.key] !== false;
              const dupe = existing(kind, candidate.value);
              return (
                <li key={candidate.key} className={cx("px-3 py-2 transition-colors", checked ? "bg-transparent" : "opacity-45")}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={checked} onChange={(e) => setAccepted((p) => ({ ...p, [candidate.key]: e.target.checked }))} className="mt-1 h-3 w-3 flex-none accent-cyan-400" />
                    <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md border" style={{ borderColor: "#243546", color: "#8fd8f0" }}>
                      <KindIcon kind={kind} className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="max-w-full truncate text-[11.5px] font-medium text-[#e8f2fb]" title={candidate.value}>{candidate.value}</span>
                        <span className={cx("rounded-full border px-1.5 py-0 text-[8px] uppercase tracking-wide", tone.cls)}>{tone.label} · {candidate.score}</span>
                        {dupe && <span className="rounded border border-[#2a3b4d] px-1 text-[8px] text-[#8399ae]">já no caso</span>}
                        {candidate.derivedFromValue && <span className="rounded bg-white/[0.05] px-1 text-[8px] text-[#8399ae]">derivado</span>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <select value={kind} onChange={(e) => setKindOverrides((p) => ({ ...p, [candidate.key]: e.target.value as PaletteNodeKind }))}
                          className="rounded border border-[#21303f] bg-[#0a1017] px-1 py-0 text-[9px] text-[#a5b9cc]">
                          {KIND_OPTIONS.map((k) => <option key={k} value={k}>{NODE_KIND_LABEL[k]}</option>)}
                        </select>
                        {candidate.cue && <span className="text-[8.5px] text-[#657b90]">{candidate.cue}</span>}
                        {candidate.derivedFromValue && <span className="inline-flex items-center gap-0.5 text-[8.5px] text-[#657b90]"><Link2 className="h-2.5 w-2.5" /> {candidate.derivedRelation}: {candidate.derivedFromValue}</span>}
                      </div>
                      {candidate.alternates.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[8.5px] text-[#6f859a]">
                          <span>outras leituras:</span>
                          {candidate.alternates.slice(0, 3).map((alt) => (
                            <button key={`${candidate.key}-${alt.kind}`} title={alt.why}
                              onClick={() => setKindOverrides((p) => ({ ...p, [candidate.key]: alt.kind }))}
                              className="rounded border border-[#243546] px-1 text-[8.5px] text-[#9db0c4] hover:border-amber-400/40 hover:text-amber-200">
                              {NODE_KIND_LABEL[alt.kind]} ({alt.score})
                            </button>
                          ))}
                        </div>
                      )}
                      <p className="mt-0.5 truncate text-[8.5px] text-[#4f6377]" title={candidate.context}>{candidate.context}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {analysis.notes.length > 0 && (
          <div className="border-t border-[#16222e] bg-[#08111a] px-3 py-2">
            {analysis.notes.map((note) => (
              <p key={note} className="flex items-start gap-1 text-[9px] leading-relaxed text-[#7f94a9]"><AlertTriangle className="mt-0.5 h-2.5 w-2.5 flex-none text-amber-400/80" /> {note}</p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-[#16222e] px-3 py-2">
          {!active && (
            <div className="min-w-[180px] flex-1">
              <PalField label="Nome da nova investigação">
                <input className={cx(inputCls, "!py-1 !text-[10.5px]")} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selected[0]?.value ? `Investigação: ${selected[0].value}` : "Nova investigação"} />
              </PalField>
            </div>
          )}
          <span className="text-[9px] text-[#657b90]">
            {selected.length} selecionada(s) · {depth} · {plan ? `${plan.totalQueries} consultas` : `${selected.reduce((n, c) => n + (KIND_OPTIONS.includes(displayedKind(c)) ? 1 : 0), 0)} alvos`}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <PalButton variant="ghost" onClick={() => setStage("input")}>Cancelar</PalButton>
            {autoSearch && (
              <PalButton variant="soft" onClick={() => commit(false)} disabled={!selected.length}>
                <Plus className="h-3.5 w-3.5" /> Adicionar sem pesquisar
              </PalButton>
            )}
            <PalButton variant="primary" onClick={() => commit(autoSearch)} disabled={!selected.length}>
              <Search className="h-3.5 w-3.5" /> {autoSearch ? "Investigar selecionadas" : "Adicionar ao caso"}
            </PalButton>
          </div>
        </div>
      </section>
    );
  }

  /* -------------------------------- running -------------------------------- */

  if (stage === "running") {
    const total = jobs.length;
    const done = jobs.filter((j) => j.state !== "pending" && j.state !== "running").length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    const running = jobs.filter((j) => j.state === "running");
    const findingsCount = jobs.reduce((n, j) => n + j.resultCount, 0);
    return (
      <section className="rounded-2xl border border-[#1b2a3a] bg-[#070e15]">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#16222e] px-3 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
          <div>
            <div className="text-[12px] font-semibold text-[#eaf3fb]">Investigação em andamento</div>
            <div className="text-[9px] text-[#657b90]">{depth} · concorrência 3 · {DEPTH_META[depth].description}</div>
          </div>
          <PalButton size="sm" variant="danger" className="ml-auto" onClick={cancel} disabled={!busy}>
            <StopCircle className="h-3 w-3" /> Cancelar
          </PalButton>
        </div>
        <div className="px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-[9.5px] text-[#8399ae]">
            <span>{done}/{total} consultas · {findingsCount} resultado(s)</span>
            <span>{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#0f1a24]">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all" style={{ width: `${percent}%` }} />
          </div>
          {running.length > 0 && (
            <p className="mt-1.5 truncate text-[9px] text-[#5f7488]">consultando {running.map((j) => `${j.sourceName} → ${j.value}`).join(" · ")}</p>
          )}
        </div>
        <div className="max-h-[42vh] overflow-y-auto border-t border-[#16222e]">
          <table className="w-full text-[9.5px]">
            <thead className="sticky top-0 bg-[#0a131c] text-[#657b90]">
              <tr><th className="px-2 py-1 text-left">Alvo</th><th className="px-1 text-left">Fonte</th><th className="px-1 text-left">Estado</th><th className="px-1 text-right">Achados</th><th className="px-2 text-right">ms</th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id} className="border-t border-[#111c27]">
                  <td className="max-w-[150px] truncate px-2 py-0.5 text-[#b6c8da]">{job.value}</td>
                  <td className="max-w-[130px] truncate px-1 text-[#8399ae]">{job.sourceName}</td>
                  <td className={cx("px-1", jobTone(job.state))}>{job.state}</td>
                  <td className="px-1 text-right text-[#b6c8da]">{job.resultCount || "—"}</td>
                  <td className="px-2 text-right text-[#5f7488]">{job.durationMs || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  /* --------------------------------- done ---------------------------------- */

  const totals = run?.totals;
  const grouped = new Map<string, SearchJob[]>();
  for (const job of jobs) grouped.set(job.value, [...(grouped.get(job.value) ?? []), job]);
  const withResults = jobs.filter((j) => j.state === "completed");
  const problems = jobs.filter((j) => j.state === "error" || j.state === "unavailable" || j.state === "rate-limited");

  return (
    <section className="rounded-2xl border border-[#1b2a3a] bg-[#070e15]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#16222e] px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Check className="h-3.5 w-3.5" /></span>
        <div>
          <div className="text-[12px] font-semibold text-[#eaf3fb]">Investigação concluída</div>
          <div className="text-[9px] text-[#657b90]">
            {totals?.queries ?? 0} consultas · {totals?.findings ?? 0} achados · {totals?.completed ?? 0} com resultado · {totals?.empty ?? 0} sem resultado · {run?.durationMs ?? 0} ms
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <PalButton size="sm" variant="ghost" onClick={reset}>Nova entrada</PalButton>
          {active && <PalButton size="sm" variant="soft" onClick={() => openCase(active.id)}><Layers className="h-3 w-3" /> Abrir caso</PalButton>}
          {importable.length > 0 && !readOnly && (
            <PalButton size="sm" variant="primary" onClick={() => onReview(selected[0]?.value ?? "investigação", findings)}>
              <Plus className="h-3 w-3" /> Revisar {importable.length} descoberta(s)
            </PalButton>
          )}
        </div>
      </div>

      <div className="grid gap-2 border-b border-[#16222e] px-3 py-2 sm:grid-cols-4">
        {[["Com resultado", totals?.completed ?? 0, "text-emerald-300"], ["Sem resultado", totals?.empty ?? 0, "text-slate-300"], ["Indisponíveis", totals?.unavailable ?? 0, "text-violet-300"], ["Erros", totals?.errors ?? 0, "text-rose-300"]].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-lg border border-[#1a2836] bg-[#08111a] px-2 py-1">
            <div className={cx("text-[15px] font-semibold leading-none", String(tone))}>{value}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-wide text-[#5f7488]">{label}</div>
          </div>
        ))}
      </div>

      <div className="max-h-[46vh] space-y-1.5 overflow-y-auto p-2.5">
        {[...grouped.entries()].map(([value, rows]) => (
          <div key={value} className="rounded-lg border border-[#16222e] bg-[#08111a]">
            <div className="flex items-center gap-1.5 border-b border-[#111c27] px-2 py-1">
              <KindIcon kind={rows[0].kind} className="h-3 w-3 text-cyan-300" />
              <span className="truncate text-[10.5px] font-medium text-[#dbe7f4]">{value}</span>
              <span className="ml-auto text-[8.5px] text-[#5f7488]">{rows.filter((r) => r.state === "completed").length}/{rows.length} fontes com resultado</span>
            </div>
            <ul className="divide-y divide-[#0e1922]">
              {rows.map((job) => (
                <li key={job.id} className="flex items-center gap-1.5 px-2 py-0.5 text-[9px]">
                  <span className={cx("w-[92px] flex-none truncate", jobTone(job.state))}>{job.state}</span>
                  <span className="min-w-0 flex-1 truncate text-[#9db0c4]">{job.sourceName}</span>
                  <span className="flex-none text-[#657b90]">{job.resultCount > 0 ? `${job.resultCount} achado(s)` : job.error ? job.error.slice(0, 46) : "—"}</span>
                  {job.reference && (
                    <a href={job.reference} target="_blank" rel="noreferrer noopener" className="flex-none text-cyan-400/80 hover:text-cyan-200" title="Abrir fonte original">↗</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {(totals?.queries ?? 0) === 0 && (
          <p className="px-2 py-4 text-center text-[10px] text-[#7f94a9]">Nenhuma consulta compatível. As entidades já estão no caso.</p>
        )}
      </div>

      {problems.length > 0 && (
        <div className="border-t border-[#16222e] px-3 py-1.5">
          <p className="text-[8.5px] leading-relaxed text-[#657b90]">
            {problems.length} fonte(s) não retornaram dados. Motivos são exibidos acima; nenhuma delas foi marcada como consultada com sucesso.
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-[#16222e] px-3 py-2">
        <span className="text-[9px] text-[#5f7488]">Consultas e falhas foram registradas na timeline do caso.</span>
        <PalButton size="sm" variant="primary" className="ml-auto" onClick={onOpenCanvas}><ArrowRight className="h-3 w-3" /> Ir ao canvas</PalButton>
      </div>
    </section>
  );
}
