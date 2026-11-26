import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, Bot, Check, ChevronDown, ChevronUp, CircleHelp, Copy, Database, ExternalLink,
  Layers, Loader2, Play, Plus, Search, Send, ShieldQuestion, Sparkles, ThumbsDown, ThumbsUp,
  TriangleAlert, X,
} from "lucide-react";
import { answerQuestion } from "@/lib/palette/ai";
import { addFeedback } from "@/lib/palette/store";
import { extractFromUnknown } from "@/lib/palette/extract";
import { defaultSourcesFor, runSource, SEARCH_SOURCES, type SearchOutcome } from "@/lib/palette/search";
import { knowledgeStats } from "@/lib/palette/knowledge";
import {
  CONFIDENCE_LABEL, NODE_KIND_LABEL,
  type AiAction, type AiAnswer, type AiRating, type PaletteCase, type PaletteNode, type PaletteSearchRecord,
} from "@/lib/palette/types";
import { ConfidencePill, PalButton, PalField, PalLabel, inputCls, selectCls, KindPill, Toggle } from "./kit";
import { ValueView, cx } from "@/components/agency/kit";

const SUGGESTIONS = [
  "Resuma a investigação",
  "Quais são as principais descobertas?",
  "O que ainda não foi verificado?",
  "Quais informações estão faltando?",
  "Quais fontes sustentam este caso?",
  "Sugira os próximos passos",
  "Mostre o histórico do caso",
];

export function PaletteAiPanel({
  c, selected, memoryNote, onAction, onCitation, onSaveMemory, onToast,
}: {
  c: PaletteCase;
  selected: PaletteNode | null;
  memoryNote: string;
  onAction: (action: AiAction) => void;
  onCitation: (ref: string, kind: string) => void;
  onSaveMemory: (note: string) => void;
  onToast: (msg: string, tone?: "ok" | "warn" | "info") => void;
}) {
  const [messages, setMessages] = useState<Array<{ question: string; answer: AiAnswer }>>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  const [showMemory, setShowMemory] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState(memoryNote);
  const endRef = useRef<HTMLDivElement>(null);
  const stats = knowledgeStats();

  useEffect(() => { setMessages([]); }, [c.id]);
  useEffect(() => { setMemoryDraft(memoryNote); }, [memoryNote]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length]);

  const ask = (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    try {
      const answer = answerQuestion(q, { case: c, memoryNote });
      setMessages((prev) => [...prev, { question: q, answer }]);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao analisar o caso.", "warn");
    } finally {
      setBusy(false);
    }
  };

  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    const handler = (e: Event) => { const q = (e as CustomEvent<string>).detail; if (q) askRef.current(q); };
    window.addEventListener("palette:ask", handler);
    return () => window.removeEventListener("palette:ask", handler);
  }, []);

  const rate = (answer: AiAnswer, rating: AiRating) => {
    addFeedback({
      id: `${answer.id}-${rating}-${Date.now()}`,
      at: new Date().toISOString(),
      caseId: c.id,
      messageId: answer.id,
      question: answer.question,
      rating,
      note: "",
      reviewed: false,
      approved: false,
    });
    onToast("Avaliação registrada. Ela não altera o conhecimento automaticamente.", "ok");
  };

  const statsLine = `${c.nodes.length} entidades · ${c.edges.length} relações · ${c.searches.length} consultas · ${c.evidence.length} evidências`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[#182432] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-400/10 text-violet-300"><Bot className="h-3.5 w-3.5" /></span>
          <div>
            <div className="text-[11px] font-semibold text-[#e6eef7]">Life Intelligence AI</div>
            <div className="text-[8.5px] text-[#657b90]">analista contextual · motor local</div>
          </div>
        </div>
        <button onClick={() => setShowMemory((v) => !v)} title="Memória da investigação" className={cx("rounded p-1", showMemory ? "bg-violet-400/15 text-violet-200" : "text-[#71879c] hover:text-white")}><Database className="h-3.5 w-3.5" /></button>
      </div>

      {showMemory && (
        <div className="border-b border-[#182432] bg-[#0a1118] px-3 py-2">
          <PalLabel>Memória desta investigação</PalLabel>
          <textarea className={cx(inputCls, "mt-1 min-h-[52px] resize-y !text-[10.5px]")} value={memoryDraft} onChange={(e) => setMemoryDraft(e.target.value)} placeholder="Contexto que a IA deve considerar neste caso (hipóteses, restrições, decisões)." />
          <div className="mt-1 flex justify-end gap-1">
            <PalButton size="sm" variant="ghost" onClick={() => setMemoryDraft(memoryNote)}>Reverter</PalButton>
            <PalButton size="sm" variant="soft" onClick={() => { onSaveMemory(memoryDraft); onToast("Memória da investigação salva.", "ok"); }}><Check className="h-3 w-3" /> Salvar</PalButton>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="space-y-2">
            <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.04] p-2.5">
              <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-violet-200"><Sparkles className="h-3 w-3" /> Contexto carregado</div>
              <p className="mt-1 text-[10px] leading-relaxed text-[#93a8bd]">{statsLine}.</p>
              <p className="mt-1 text-[9.5px] leading-relaxed text-[#6f859a]">Respostas derivadas apenas dos registros do caso e da base Life Knowledge ({stats.docs} docs, {stats.chunks} trechos, recuperação lexical local). Sem LLM externo: nada é inventado.</p>
            </div>
            {selected && (
              <button onClick={() => ask(`O que sabemos sobre ${selected.title}?`)} className="flex w-full items-center gap-2 rounded-lg border border-[#243546] bg-[#0a1118] px-2 py-1.5 text-left text-[10.5px] text-[#c6d6e6] hover:border-violet-400/40">
                <CircleHelp className="h-3 w-3 text-violet-300" /> Analisar {selected.title}
              </button>
            )}
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-[#1c2a38] px-2 py-1.5 text-left text-[10.5px] text-[#9db0c4] transition-colors hover:border-violet-400/35 hover:text-[#e0d9ff]">{s}</button>
            ))}
          </div>
        )}

        {messages.map(({ question, answer }, mi) => (
          <div key={`${answer.id}-${mi}`} className="space-y-2">
            <div className="ml-auto w-fit max-w-[92%] rounded-xl rounded-br-sm border border-cyan-400/25 bg-cyan-400/[0.07] px-2.5 py-1.5 text-[10.5px] text-[#d9f6ff]">{question}</div>
            <div className="rounded-xl border border-[#22303f] bg-[#081019] p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[11px] font-semibold leading-snug text-[#e8f1fb]">{answer.headline}</div>
                <ConfidencePill level={answer.confidence} small />
              </div>
              <div className="mt-2 space-y-2">
                {answer.sections.map((s, i) => (
                  <div key={i}>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-[#6f859a]">{s.title}</div>
                    <p className="mt-0.5 whitespace-pre-wrap text-[10.5px] leading-relaxed text-[#b3c6d8]">{s.body}</p>
                  </div>
                ))}
              </div>

              {answer.citations.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {answer.citations.slice(0, 8).map((cit) => (
                    <button key={`${cit.kind}-${cit.ref}`} onClick={() => onCitation(cit.ref, cit.kind)} className="inline-flex items-center gap-1 rounded border border-[#263749] bg-[#0c141d] px-1.5 py-0.5 text-[8.5px] text-[#9fb3c7] hover:border-cyan-400/40 hover:text-cyan-200">
                      <ExternalLink className="h-2 w-2" /> {cit.label.length > 38 ? `${cit.label.slice(0, 36)}…` : cit.label}
                    </button>
                  ))}
                </div>
              )}

              <details className="mt-2 rounded-lg border border-[#1b2836] bg-[#0a1118] px-2 py-1">
                <summary className="cursor-pointer text-[9px] uppercase tracking-wider text-[#6f859a]">Explicação · dados, fontes e limites</summary>
                <div className="mt-1 space-y-1 text-[9.5px] leading-relaxed text-[#8399ae]">
                  <div><span className="text-[#5f7488]">Dados usados:</span> {answer.dataUsed.join(" · ")}</div>
                  {answer.limitations.length > 0 && <div><span className="text-[#5f7488]">Limitações:</span> {answer.limitations.join(" ")}</div>}
                  {answer.knowledgeHits.length > 0 && <div><span className="text-[#5f7488]">Life Knowledge:</span> {answer.knowledgeHits.map((k) => `${k.docTitle} (${k.category})`).join("; ")}</div>}
                  <div className="text-[#5f7488]">Confiança: {CONFIDENCE_LABEL[answer.confidence]} — classificação explicável, não probabilidade.</div>
                </div>
              </details>

              {answer.actions.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-[9px] uppercase tracking-wider text-[#6f859a]">Ações propostas (exigem confirmação)</div>
                  {answer.actions.map((action, ai) => {
                    const key = `${answer.id}:${ai}`;
                    return (
                      <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-violet-400/20 bg-violet-400/[0.04] px-2 py-1">
                        <div className="min-w-0">
                          <div className="truncate text-[10px] text-[#d9d2ff]">{actionLabel(action)}</div>
                          <div className="truncate text-[8.5px] text-[#8277a8]">{action.reason}</div>
                        </div>
                        {applied[key] ? <span className="text-[8.5px] text-emerald-300">aplicada</span> : (
                          <button onClick={() => { onAction(action); setApplied((p) => ({ ...p, [key]: true })); }} className="rounded border border-violet-400/35 bg-violet-400/10 px-1.5 py-0.5 text-[8.5px] text-violet-200 hover:bg-violet-400/20">Confirmar</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-2 flex items-center gap-1 border-t border-[#182432] pt-1.5">
                <span className="text-[8.5px] text-[#5f7488]">útil?</span>
                <button onClick={() => rate(answer, "useful")} title="Útil" className="rounded p-0.5 text-[#6f859a] hover:text-emerald-300"><ThumbsUp className="h-2.5 w-2.5" /></button>
                <button onClick={() => rate(answer, "partial")} title="Parcialmente útil" className="rounded p-0.5 text-[#6f859a] hover:text-amber-300"><CircleHelp className="h-2.5 w-2.5" /></button>
                <button onClick={() => rate(answer, "incorrect")} title="Incorreta" className="rounded p-0.5 text-[#6f859a] hover:text-rose-300"><ThumbsDown className="h-2.5 w-2.5" /></button>
                <button onClick={() => rate(answer, "bad-source")} title="Fonte inadequada" className="rounded p-0.5 text-[#6f859a] hover:text-orange-300"><TriangleAlert className="h-2.5 w-2.5" /></button>
                <span className="ml-auto text-[8px] text-[#4f6377]">{answer.at.slice(11, 16)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-[#182432] p-2">
        <div className="flex items-end gap-1">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }}
            placeholder="Pergunte sobre o caso…"
            rows={1}
            className={cx(inputCls, "max-h-[92px] min-h-[32px] resize-y !text-[10.5px]")}
          />
          <button onClick={() => ask(input)} disabled={busy || !input.trim()} className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-violet-400/35 bg-violet-400/15 text-violet-200 disabled:opacity-40">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between text-[8px] text-[#4f6377]">
          <span>Sem LLM · respostas citam os registros</span>
          <span>Enter envia</span>
        </div>
      </div>
    </div>
  );
}

function actionLabel(action: AiAction): string {
  switch (action.type) {
    case "run_search": return `Consultar ${SEARCH_SOURCES[action.tool]?.name ?? action.tool} para ${action.value}`;
    case "create_note": return "Criar nota com esta análise";
    case "create_edge": return `Criar relação ${action.relation}`;
    case "create_group": return `Criar grupo ${action.title}`;
    case "add_node": return `Adicionar ${NODE_KIND_LABEL[action.kind]} ${action.value}`;
    case "summarize": return "Registrar resumo executivo como nota";
    default: return "Ação";
  }
}

/* ------------------------------- search ---------------------------------- */

export function PaletteSearchPanel({
  c, node, readOnly, onRecord, onImport, onToast,
}: {
  c: PaletteCase;
  node: PaletteNode | null;
  readOnly: boolean;
  onRecord: (record: PaletteSearchRecord) => void;
  onImport: (query: string, nodeId: string | undefined, outcomes: SearchOutcome[]) => void;
  onToast: (msg: string, tone?: "ok" | "warn" | "info") => void;
}) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [value, setValue] = useState(node?.title ?? "");
  const [sources, setSources] = useState<string[]>(node ? defaultSourcesFor(node.kind) : ["domainLookup"]);
  const [running, setRunning] = useState(false);
  const [outcomes, setOutcomes] = useState<SearchOutcome[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");
  const [bulkKind, setBulkKind] = useState<PaletteNode["kind"]>("domain");
  const [bulkRows, setBulkRows] = useState<Array<{ value: string; ok: number; failed: number; entities: number; state: "pending" | "done" | "error"; message?: string }>>([]);
  const [autoImport, setAutoImport] = useState(false);

  useEffect(() => {
    if (node) {
      setValue(node.title);
      setSources(defaultSourcesFor(node.kind));
    }
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => setSources((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  const available = Object.values(SEARCH_SOURCES);

  const run = async () => {
    if (!value.trim() || !sources.length || running) return;
    setRunning(true);
    setOutcomes([]);
    setProgress({ done: 0, total: sources.length });
    const results: SearchOutcome[] = [];
    for (const sourceId of sources) {
      const outcome = await runSource(sourceId, value.trim());
      results.push(outcome);
      setOutcomes([...results]);
      setProgress((p) => ({ ...p, done: p.done + 1 }));
      onRecord({
        id: `${Date.now().toString(36)}-${sourceId}`,
        at: new Date().toISOString(),
        tool: sourceId,
        source: outcome.sourceName,
        query: value.trim(),
        queryKind: node?.kind ?? "manual",
        status: outcome.ok ? (outcome.resultCount > 0 ? "ok" : "empty") : "error",
        summary: outcome.summary,
        resultCount: outcome.resultCount,
        durationMs: outcome.durationMs,
        error: outcome.error,
        data: outcome.data,
      });
    }
    setRunning(false);
    if (results.some((r) => r.ok)) onToast(`${results.filter((r) => r.ok).length}/${results.length} fonte(s) responderam.`, "ok");
    else onToast("Nenhuma fonte respondeu. Verifique o valor e os limites.", "warn");
  };

  const runBulk = async () => {
    const lines = [...new Set(bulk.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean))].slice(0, 30);
    if (!lines.length) return;
    setRunning(true);
    const kindSources = defaultSourcesFor(bulkKind).slice(0, 2);
    const rows = lines.map((v) => ({ value: v, ok: 0, failed: 0, entities: 0, state: "pending" as const }));
    setBulkRows(rows);
    let importedTotal = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      let ok = 0;
      let failed = 0;
      const collected: SearchOutcome[] = [];
      for (const sourceId of kindSources) {
        const outcome = await runSource(sourceId, line);
        collected.push(outcome);
        if (outcome.ok) ok += 1; else failed += 1;
        onRecord({
          id: `${Date.now().toString(36)}-${sourceId}-${i}`,
          at: new Date().toISOString(),
          tool: sourceId,
          source: outcome.sourceName,
          query: line,
          queryKind: bulkKind,
          status: outcome.ok ? (outcome.resultCount > 0 ? "ok" : "empty") : "error",
          summary: outcome.summary,
          resultCount: outcome.resultCount,
          durationMs: outcome.durationMs,
          error: outcome.error,
          data: outcome.data,
        });
      }
      const entities = collected.reduce((n, o) => n + (o.ok ? extractFromUnknown(o.data, 60).length : 0), 0);
      setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ok, failed, entities, state: "done" } : r)));
      if (autoImport && collected.some((o) => o.ok)) {
        onImport(line, undefined, collected);
        importedTotal += 1;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    setRunning(false);
    onToast(`Bulk concluído: ${lines.length} alvo(s)${autoImport ? `, ${importedTotal} importado(s)` : ""}.`, "ok");
  };

  const canImport = outcomes.some((o) => o.ok) && Boolean(value.trim());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-[#182432] px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"><Search className="h-3.5 w-3.5" /></span>
        <div className="text-[11px] font-semibold text-[#e6eef7]">Multi-source search</div>
        <div className="ml-auto flex rounded-md border border-[#243546] p-0.5">
          {(["single", "bulk"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cx("rounded px-1.5 py-0.5 text-[9.5px]", mode === m ? "bg-cyan-400/15 text-cyan-200" : "text-[#71879c]")}>{m === "single" ? "Individual" : "Bulk"}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
        {mode === "single" ? (
          <>
            <PalField label="Alvo" hint={node ? `Entidade selecionada: ${NODE_KIND_LABEL[node.kind]}` : "Digite ou selecione uma entidade no canvas"}>
              <div className="flex gap-1">
                <input className={inputCls} value={value} onChange={(e) => setValue(e.target.value)} placeholder="exemplo.com, 203.0.113.10, @usuario…" />
                <PalButton variant="primary" onClick={() => void run()} disabled={running || !value.trim() || !sources.length} className="!px-2">
                  {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                </PalButton>
              </div>
            </PalField>

            <div>
              <div className="flex items-center justify-between">
                <PalLabel>Fontes ({sources.length}/{available.length})</PalLabel>
                <div className="flex gap-1 text-[9px]">
                  <button className="text-cyan-300 hover:underline" onClick={() => setSources(available.map((s) => s.id))}>todas</button>
                  <button className="text-[#71879c] hover:underline" onClick={() => setSources(node ? defaultSourcesFor(node.kind) : [])}>recomendadas</button>
                </div>
              </div>
              <div className="mt-1 grid grid-cols-1 gap-1">
                {available.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-1.5 rounded border border-transparent px-1 py-0.5 text-[10px] text-[#a5b9cc] hover:border-[#243546]">
                    <input type="checkbox" checked={sources.includes(s.id)} onChange={() => toggle(s.id)} className="h-3 w-3 accent-cyan-400" />
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-[8.5px] text-[#5f7488]">grátis</span>
                  </label>
                ))}
              </div>
            </div>

            {running && <div className="text-[9.5px] text-[#7f94a9]">Consultando {progress.done + 1}/{progress.total}…</div>}

            {outcomes.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <PalLabel>Resultados ({outcomes.length})</PalLabel>
                  {canImport && !readOnly && (
                    <PalButton size="sm" variant="soft" onClick={() => onImport(value.trim(), node?.id, outcomes)}>
                      <Plus className="h-3 w-3" /> Importar entidades
                    </PalButton>
                  )}
                </div>
                {outcomes.map((o) => (
                  <div key={o.sourceId} className={cx("rounded-lg border p-2", o.ok ? "border-[#1e2c3a] bg-[#0a1118]" : "border-rose-400/20 bg-rose-400/[0.04]")}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[10px] font-medium text-[#dbe7f4]">{o.sourceName}</span>
                      <span className={cx("rounded px-1 text-[8.5px]", o.ok ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300")}>{o.ok ? `${o.resultCount} achado(s)` : "falhou"}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[9.5px] leading-relaxed text-[#8399ae]">{o.summary}</p>
                    <div className="mt-1 flex items-center gap-2 text-[8.5px] text-[#5f7488]">
                      <span>{o.durationMs} ms</span>
                      <span className="text-[#37485a]">·</span>
                      <span>{o.ok ? `${extractFromUnknown(o.data, 40).length} candidatos` : "sem dados"}</span>
                      <button onClick={() => setExpanded(expanded === o.sourceId ? null : o.sourceId)} className="ml-auto inline-flex items-center gap-0.5 text-cyan-300 hover:underline">
                        payload {expanded === o.sourceId ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                    {expanded === o.sourceId && <div className="mt-1 max-h-[220px] overflow-auto rounded border border-[#1b2836] bg-black/40 p-1.5"><ValueView value={o.data} /></div>}
                  </div>
                ))}
                <p className="text-[8.5px] leading-relaxed text-[#5f7488]">A importação abre a revisão de entidades extraídas; nada entra no caso sem confirmação.</p>
              </div>
            )}
          </>
        ) : (
          <>
            <PalField label="Lista de alvos" hint="Um por linha (ou separados por vírgula). Máximo 30 por execução; duas fontes recomendadas por alvo.">
              <textarea className={cx(inputCls, "min-h-[90px] resize-y !text-[10.5px]")} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"exemplo.com\noutro.com\n203.0.113.10"} />
            </PalField>
            <PalField label="Tipo dos alvos">
              <select className={selectCls} value={bulkKind} onChange={(e) => setBulkKind(e.target.value as PaletteNode["kind"])}>
                {(["domain", "ipv4", "url", "username", "email", "hash", "asn", "cve", "company"] as PaletteNode["kind"][]).map((k) => <option key={k} value={k}>{NODE_KIND_LABEL[k]}</option>)}
              </select>
            </PalField>
            <label className="flex items-center gap-2 text-[10px] text-[#a5b9cc]"><Toggle checked={autoImport} onChange={setAutoImport} label="Importar automaticamente" /> Importar automaticamente as entidades extraídas (sem revisão)</label>
            <PalButton variant="primary" onClick={() => void runBulk()} disabled={running || !bulk.trim()}>
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Executar bulk
            </PalButton>
            {bulkRows.length > 0 && (
              <div className="overflow-auto rounded border border-[#1e2c3a]">
                <table className="w-full text-[9.5px]">
                  <thead className="bg-[#0c141d] text-[#71879c]"><tr><th className="px-1.5 py-1 text-left">Alvo</th><th>OK</th><th>Falhas</th><th>Candidatos</th><th>Estado</th></tr></thead>
                  <tbody>
                    {bulkRows.map((r) => (
                      <tr key={r.value} className="border-t border-[#16212d] text-[#b6c8da]">
                        <td className="max-w-[120px] truncate px-1.5 py-1">{r.value}</td>
                        <td className="text-center text-emerald-300">{r.ok}</td>
                        <td className="text-center text-rose-300">{r.failed}</td>
                        <td className="text-center">{r.entities}</td>
                        <td className="text-center text-[8.5px] text-[#71879c]">{r.state}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[8.5px] leading-relaxed text-[#5f7488]">Consultas sequenciais para respeitar rate limits das fontes públicas. Cada resultado é registrado na timeline e pode ser reimportado depois.</p>
          </>
        )}

        <div className="border-t border-[#182432] pt-2">
          <PalLabel>Histórico de consultas ({c.searches.length})</PalLabel>
          <div className="mt-1 space-y-1">
            {c.searches.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-[9px] text-[#8399ae]">
                <span className="truncate">{s.source} · <span className="text-[#b6c8da]">{s.query}</span></span>
                <span className={s.status === "ok" ? "text-emerald-300" : s.status === "empty" ? "text-amber-300" : "text-rose-300"}>{s.status}</span>
              </div>
            ))}
            {c.searches.length === 0 && <p className="text-[9.5px] text-[#5f7488]">Nenhuma consulta ainda.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaletteSourceCatalog({ onRun }: { onRun: (tool: string) => void }) {
  return (
    <div className="space-y-1.5">
      {Object.values(SEARCH_SOURCES).map((s) => (
        <div key={s.id} className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-medium text-[#dbe7f4]">{s.name}</span>
            <button onClick={() => onRun(s.id)} className="text-[9px] text-cyan-300 hover:underline">executar</button>
          </div>
          <p className="mt-0.5 text-[9.5px] text-[#7f94a9]">{s.description}</p>
        </div>
      ))}
    </div>
  );
}

export function AiHint({ children }: { children: React.ReactNode }) {
  return <div className="flex items-start gap-1.5 rounded-lg border border-violet-400/20 bg-violet-400/[0.04] p-2 text-[9.5px] leading-relaxed text-[#b0a6d8]"><ShieldQuestion className="mt-0.5 h-3 w-3 flex-none" />{children}</div>;
}

export { ArrowUpRight, Copy, Layers, X };
