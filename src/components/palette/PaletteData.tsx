import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, Clock3, Copy, FileSearch, GitMerge, Hash, Layers, Plus,
  Radar, Search, Sparkles, Trash2,
} from "lucide-react";
import { caseStats, findDuplicates, type DuplicateGroup } from "@/lib/palette/store";
import { nextStepSuggestions } from "@/lib/palette/ai";
import { CONFIDENCE_LABEL, NODE_KIND_LABEL, type PaletteCase, type PaletteEvidence, type TimelineType } from "@/lib/palette/types";
import { ConfidencePill, KindPill, PalButton, PalEmpty, PalField, PalLabel, inputCls, selectCls, KIND_COLOR } from "./kit";
import { cx } from "@/components/agency/kit";
import { formatDate } from "@/lib/agency/format";

/* -------------------------------- timeline -------------------------------- */

const TIMELINE_TYPES: Array<{ key: TimelineType | "all"; label: string }> = [
  { key: "all", label: "Tudo" },
  { key: "case", label: "Caso" },
  { key: "entity", label: "Entidades" },
  { key: "relationship", label: "Relações" },
  { key: "search", label: "Consultas" },
  { key: "evidence", label: "Evidências" },
  { key: "note", label: "Notas" },
  { key: "ai", label: "IA" },
  { key: "canvas", label: "Canvas" },
  { key: "report", label: "Relatórios" },
  { key: "comment", label: "Comentários" },
];

export function PaletteTimeline({ c, onSelectNode }: { c: PaletteCase; onSelectNode?: (id: string) => void }) {
  const [type, setType] = useState<TimelineType | "all">("all");
  const [actor, setActor] = useState("all");
  const [term, setTerm] = useState("");
  const actors = [...new Set(c.timeline.map((t) => t.actor).filter(Boolean))];
  const rows = useMemo(() => c.timeline.filter((t) => {
    if (type !== "all" && t.type !== type) return false;
    if (actor !== "all" && t.actor !== actor) return false;
    if (term.trim() && !`${t.title} ${t.detail ?? ""}`.toLowerCase().includes(term.toLowerCase())) return false;
    return true;
  }), [c.timeline, type, actor, term]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <select className={cx(selectCls, "!w-auto !text-[10px]")} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          {TIMELINE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select className={cx(selectCls, "!w-auto !text-[10px]")} value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="all">Todos os autores</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input className={cx(inputCls, "!w-40 !py-1 !text-[10px]")} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="filtrar evento" />
        <span className="ml-auto text-[9.5px] text-[#5f7488]">{rows.length} de {c.timeline.length}</span>
      </div>
      {rows.length === 0 ? <PalEmpty icon={Clock3} title="Nenhum evento com esse filtro" /> : (
        <ol className="space-y-1.5">
          {rows.slice(0, 200).map((t) => (
            <li key={t.id} className="flex gap-2 rounded-lg border border-[#182432] bg-[#080f16] p-2">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md bg-white/[0.04] text-[9px] uppercase text-[#8fa4b8]">{t.type.slice(0, 2)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <span className="text-[10.5px] font-medium text-[#dbe7f4]">{t.title}</span>
                  <span className="text-[8.5px] text-[#5f7488]">{formatDate(t.at)} · {t.actor}</span>
                </div>
                {t.detail && <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#8399ae]">{t.detail}</p>}
                {t.refId && c.nodes.some((n) => n.id === t.refId) && onSelectNode && (
                  <button onClick={() => onSelectNode(t.refId!)} className="mt-0.5 text-[8.5px] text-cyan-300 hover:underline">abrir entidade</button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* --------------------------------- table ---------------------------------- */

export function PaletteTableView({ c, onSelectNode }: { c: PaletteCase; onSelectNode: (id: string) => void }) {
  const [tab, setTab] = useState<"nodes" | "edges" | "searches" | "evidence">("nodes");
  const [term, setTerm] = useState("");
  const t = term.trim().toLowerCase();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {([["nodes", `Entidades (${c.nodes.length})`], ["edges", `Relações (${c.edges.length})`], ["searches", `Consultas (${c.searches.length})`], ["evidence", `Evidências (${c.evidence.length})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cx("rounded-md border px-2 py-1 text-[10px]", tab === k ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-[#1e2c3a] text-[#8399ae] hover:text-white")}>{label}</button>
        ))}
        <input className={cx(inputCls, "ml-auto !w-40 !py-1 !text-[10px]")} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="filtrar" />
      </div>
      <div className="max-h-[52vh] overflow-auto rounded-lg border border-[#1b2836]">
        <table className="w-full border-collapse text-[10px]">
          {tab === "nodes" && (
            <>
              <thead className="sticky top-0 bg-[#0b141d] text-[#71879c]"><tr><th className="px-2 py-1.5 text-left">Entidade</th><th className="text-left">Tipo</th><th className="text-left">Confiança</th><th className="text-left">Fontes</th><th className="text-left">Ligações</th><th className="text-left">Ev.</th></tr></thead>
              <tbody>
                {c.nodes.filter((n) => !t || n.title.toLowerCase().includes(t)).map((n) => (
                  <tr key={n.id} onClick={() => onSelectNode(n.id)} className="cursor-pointer border-t border-[#15202c] text-[#b6c8da] hover:bg-white/[0.03]">
                    <td className="max-w-[240px] truncate px-2 py-1.5 text-[#e6eef7]">{n.title}</td>
                    <td className="whitespace-nowrap">{NODE_KIND_LABEL[n.kind]}</td>
                    <td><ConfidencePill level={n.confidence} small /></td>
                    <td className="max-w-[200px] truncate text-[#8399ae]">{n.sources.join(", ") || "—"}</td>
                    <td>{c.edges.filter((e) => e.source === n.id || e.target === n.id).length}</td>
                    <td>{n.evidenceIds.length}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "edges" && (
            <>
              <thead className="sticky top-0 bg-[#0b141d] text-[#71879c]"><tr><th className="px-2 py-1.5 text-left">Origem</th><th className="text-left">Relação</th><th className="text-left">Destino</th><th className="text-left">Confiança</th><th className="text-left">Fonte</th></tr></thead>
              <tbody>
                {c.edges.filter((e) => !t || `${e.relation} ${e.sourceLabel}`.toLowerCase().includes(t)).map((e) => (
                  <tr key={e.id} className="border-t border-[#15202c] text-[#b6c8da]">
                    <td className="max-w-[160px] truncate px-2 py-1.5">{c.nodes.find((n) => n.id === e.source)?.title ?? e.source}</td>
                    <td className="whitespace-nowrap text-[#c6d6e6]">{e.relation}</td>
                    <td className="max-w-[160px] truncate">{c.nodes.find((n) => n.id === e.target)?.title ?? e.target}</td>
                    <td><ConfidencePill level={e.confidence} small /></td>
                    <td className="max-w-[160px] truncate text-[#8399ae]">{e.sourceLabel || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "searches" && (
            <>
              <thead className="sticky top-0 bg-[#0b141d] text-[#71879c]"><tr><th className="px-2 py-1.5 text-left">Data</th><th className="text-left">Fonte</th><th className="text-left">Consulta</th><th className="text-left">Status</th><th className="text-left">Resumo</th></tr></thead>
              <tbody>
                {c.searches.filter((s) => !t || `${s.query} ${s.source}`.toLowerCase().includes(t)).map((s) => (
                  <tr key={s.id} className="border-t border-[#15202c] text-[#b6c8da]">
                    <td className="whitespace-nowrap px-2 py-1.5 text-[#71879c]">{s.at.slice(0, 16).replace("T", " ")}</td>
                    <td>{s.source}</td>
                    <td className="max-w-[160px] truncate">{s.query}</td>
                    <td className={s.status === "ok" ? "text-emerald-300" : s.status === "empty" ? "text-amber-300" : "text-rose-300"}>{s.status}</td>
                    <td className="max-w-[280px] truncate text-[#8399ae]">{s.summary}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
          {tab === "evidence" && (
            <>
              <thead className="sticky top-0 bg-[#0b141d] text-[#71879c]"><tr><th className="px-2 py-1.5 text-left">Título</th><th className="text-left">Tipo</th><th className="text-left">Coletada</th><th className="text-left">Responsável</th><th className="text-left">SHA-256</th></tr></thead>
              <tbody>
                {c.evidence.filter((e) => !t || e.title.toLowerCase().includes(t)).map((e) => (
                  <tr key={e.id} className="border-t border-[#15202c] text-[#b6c8da]">
                    <td className="max-w-[220px] truncate px-2 py-1.5">{e.title}</td>
                    <td>{e.kind}</td>
                    <td>{e.collectedAt.slice(0, 10)}</td>
                    <td>{e.responsible}</td>
                    <td className="ag-mono max-w-[160px] truncate text-[8.5px] text-[#71879c]">{e.sha256 ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>
    </div>
  );
}

/* -------------------------------- insights -------------------------------- */

export function PaletteInsights({
  c, onSelectNode, onMergeDuplicates, onRunSuggestion,
}: {
  c: PaletteCase;
  onSelectNode: (id: string) => void;
  onMergeDuplicates: (group: DuplicateGroup) => void;
  onRunSuggestion: (text: string, nodeId?: string, tool?: string) => void;
}) {
  const stats = caseStats(c);
  const dupes = findDuplicates(c);
  const suggestions = nextStepSuggestions(c);
  const sources = Object.entries(c.nodes.reduce<Record<string, number>>((acc, n) => {
    for (const s of n.sources) acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxKind = Math.max(1, ...Object.values(stats.kinds));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
        <PalLabel>Progresso da investigação</PalLabel>
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          {[["Entidades", stats.nodes], ["Relações", stats.edges], ["Evidências", stats.evidence], ["Consultas", stats.searches]].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-[#1b2836] bg-[#0b141d] py-1.5">
              <div className="text-[16px] font-semibold text-[#e8f1fb]">{value}</div>
              <div className="text-[8.5px] uppercase tracking-wide text-[#657b90]">{label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[9.5px] text-[#8399ae]"><span>Cobertura de proveniência</span><span>{stats.coverage}%</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${stats.coverage}%` }} /></div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9.5px] text-[#8399ae]">
          <span>Verificados: <b className="text-emerald-300">{stats.verified}</b></span>
          <span>Alta: <b className="text-cyan-300">{stats.high}</b></span>
          <span>Média: <b className="text-amber-300">{stats.medium}</b></span>
          <span>Baixa/não ver.: <b className="text-violet-300">{stats.low + stats.unverified}</b></span>
          <span>Isoladas: <b className="text-[#c6d6e6]">{stats.isolatedNodes}</b></span>
          <span>Relações frágeis: <b className="text-[#c6d6e6]">{stats.unverifiedEdges}</b></span>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
        <PalLabel>Distribuição por tipo</PalLabel>
        <div className="mt-1.5 space-y-1">
          {Object.entries(stats.kinds).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([kind, count]) => (
            <div key={kind} className="flex items-center gap-2 text-[9.5px] text-[#a5b9cc]">
              <span className="w-24 truncate">{NODE_KIND_LABEL[kind as keyof typeof NODE_KIND_LABEL] ?? kind}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]"><span className="block h-full rounded-full" style={{ width: `${(count / maxKind) * 100}%`, background: KIND_COLOR[kind as keyof typeof KIND_COLOR] ?? "#38bdf8" }} /></span>
              <span className="w-5 text-right text-[#8399ae]">{count}</span>
            </div>
          ))}
          {Object.keys(stats.kinds).length === 0 && <p className="text-[10px] text-[#657b90]">Sem entidades.</p>}
        </div>
        <div className="mt-3 border-t border-[#16212d] pt-2">
          <PalLabel>Fontes mais usadas</PalLabel>
          <div className="mt-1 space-y-0.5">
            {sources.map(([s, n]) => <div key={s} className="flex justify-between gap-2 text-[9.5px] text-[#a5b9cc]"><span className="truncate">{s}</span><span className="text-[#71879c]">{n}</span></div>)}
            {sources.length === 0 && <p className="text-[10px] text-[#657b90]">Nenhuma fonte registrada.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
        <div className="flex items-center justify-between"><PalLabel>Duplicatas exatas</PalLabel><GitMerge className="h-3 w-3 text-[#71879c]" /></div>
        {dupes.length === 0 ? <p className="mt-1 text-[10px] text-[#657b90]">Nenhuma duplicata exata por tipo + valor.</p> : (
          <div className="mt-1.5 space-y-1.5">
            {dupes.slice(0, 5).map((g) => (
              <div key={g.key} className="rounded-lg border border-[#1e2c3a] bg-[#0b141d] p-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] text-[#dbe7f4]">{g.nodes[0].title}</span>
                  <button onClick={() => onMergeDuplicates(g)} className="rounded border border-cyan-400/30 px-1.5 py-0.5 text-[8.5px] text-cyan-200 hover:bg-cyan-400/10">mesclar {g.nodes.length}</button>
                </div>
                <div className="text-[8.5px] text-[#71879c]">{NODE_KIND_LABEL[g.kind]} · {g.nodes.map((n) => n.id).join(", ")}</div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1 text-[8.5px] leading-relaxed text-[#5f7488]">Semelhança de nome não é mesclada automaticamente.</p>
      </div>

      <div className="rounded-xl border border-violet-400/25 bg-violet-400/[0.03] p-3">
        <div className="flex items-center gap-1.5"><Sparkles className="h-3 w-3 text-violet-300" /><PalLabel>Próximos passos sugeridos</PalLabel></div>
        <div className="mt-1.5 space-y-1">
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => onRunSuggestion(s.text, s.nodeId, s.tool)} className="flex w-full items-start gap-1.5 rounded-lg border border-[#243244] bg-[#0a1118] px-1.5 py-1 text-left text-[9.5px] text-[#c2d2e2] hover:border-violet-400/40">
              <ArrowUpRight className="mt-0.5 h-2.5 w-2.5 flex-none text-violet-300" /> {s.text}
            </button>
          ))}
          {suggestions.length === 0 && <p className="text-[10px] text-[#657b90]">Sem lacunas evidentes. Continue expandindo a partir das fontes.</p>}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- evidence -------------------------------- */

export function PaletteEvidenceBoard({ c, onAdd, onDelete, onSelectNode }: { c: PaletteCase; onAdd: () => void; onDelete: (id: string) => void; onSelectNode: (id: string) => void }) {
  const [term, setTerm] = useState("");
  const rows = c.evidence.filter((e) => !term.trim() || `${e.title} ${e.source} ${e.description}`.toLowerCase().includes(term.toLowerCase()));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cx(inputCls, "!w-48 !py-1 !text-[10px]")} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="buscar evidência" />
        <PalButton size="sm" variant="primary" onClick={onAdd}><Plus className="h-3 w-3" /> Nova evidência</PalButton>
        <span className="ml-auto text-[9.5px] text-[#5f7488]">{c.evidence.length} itens · preservados localmente</span>
      </div>
      {rows.length === 0 ? <PalEmpty icon={FileSearch} title="Nenhuma evidência" hint="Registre payload, captura ou arquivo com data, fonte e hash SHA-256. Sem evidência, o achado continua sendo pista." action={<PalButton size="sm" onClick={onAdd}><Plus className="h-3 w-3" /> Registrar</PalButton>} /> : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => <EvidenceCard key={e.id} e={e} c={c} onDelete={() => onDelete(e.id)} onSelectNode={onSelectNode} />)}
        </div>
      )}
    </div>
  );
}

function EvidenceCard({ e, c, onDelete, onSelectNode }: { e: PaletteEvidence; c: PaletteCase; onDelete: () => void; onSelectNode: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5"><FileSearch className="h-3 w-3 text-emerald-300" /><span className="text-[10.5px] font-medium text-[#e6eef7]">{e.title}</span></div>
        <span className="rounded bg-white/[0.05] px-1 text-[8px] uppercase text-[#8399ae]">{e.kind}</span>
      </div>
      {e.description && <p className="mt-1 line-clamp-2 text-[9.5px] leading-relaxed text-[#8399ae]">{e.description}</p>}
      <div className="mt-1 text-[8.5px] text-[#657b90]">{e.source} · {e.collectedAt.slice(0, 10)} · {e.responsible}</div>
      {e.sha256 && <div className="ag-mono mt-1 flex items-center gap-1 break-all text-[8px] text-[#5f7488]"><Hash className="h-2 w-2" />{e.sha256.slice(0, 28)}…</div>}
      <div className="mt-1 flex flex-wrap gap-1">
        {e.nodeIds.slice(0, 4).map((id) => (
          <button key={id} onClick={() => onSelectNode(id)} className="rounded bg-cyan-400/10 px-1 text-[8.5px] text-cyan-200">{c.nodes.find((n) => n.id === id)?.title ?? id}</button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-[9px] text-cyan-300 hover:underline">fonte <ArrowUpRight className="h-2.5 w-2.5" /></a>}
        {e.content && <button onClick={() => setOpen((v) => !v)} className="text-[9px] text-[#9db0c4] hover:text-white">{open ? "ocultar" : "ver conteúdo"}</button>}
        <button onClick={onDelete} className="ml-auto text-[#657b90] hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
      </div>
      {open && e.content && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-[#1b2836] bg-black/40 p-1.5 text-[8px] text-[#8399ae]">{e.content.slice(0, 20_000)}</pre>}
    </div>
  );
}

/* ------------------------------ sources view ------------------------------ */

export function PaletteSourceView({ c, onRun }: { c: PaletteCase; onRun: (tool: string, value: string) => void }) {
  const byTool = c.searches.reduce<Record<string, number>>((acc, s) => { acc[s.tool] = (acc[s.tool] ?? 0) + 1; return acc; }, {});
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {Object.entries(byTool).length === 0 && <PalEmpty icon={Radar} title="Nenhuma fonte consultada neste caso" hint="Use o painel de busca para consultar RDAP, DNS, crt.sh, Wayback, NVD, RIPEstat e outras fontes gratuitas." />}
      {Object.entries(byTool).map(([tool, n]) => (
        <div key={tool} className="rounded-lg border border-[#1e2c3a] bg-[#080f16] p-2">
          <div className="flex items-center justify-between"><span className="text-[10.5px] text-[#dbe7f4]">{tool}</span><span className="text-[9px] text-[#71879c]">{n} consulta(s)</span></div>
          <div className="mt-1 space-y-0.5">
            {c.searches.filter((s) => s.tool === tool).slice(0, 3).map((s) => (
              <button key={s.id} onClick={() => onRun(tool, s.query)} className="flex w-full items-center justify-between gap-2 text-left text-[9px] text-[#8399ae] hover:text-cyan-200">
                <span className="truncate">{s.query}</span><span className={s.status === "ok" ? "text-emerald-300" : "text-rose-300"}>{s.status}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PaletteNotes({ c, onAdd }: { c: PaletteCase; onAdd: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <PalField label="Nova anotação">
        <textarea className={cx(inputCls, "min-h-[70px] resize-y")} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hipótese, decisão, pendência ou observação metodológica." />
      </PalField>
      <PalButton size="sm" variant="primary" onClick={() => { if (body.trim()) { onAdd(body.trim()); setBody(""); } }}><Plus className="h-3 w-3" /> Salvar nota</PalButton>
      {c.notes.map((n) => (
        <div key={n.id} className="rounded-lg border border-[#1e2c3a] bg-[#080f16] p-2">
          <div className="flex justify-between text-[8.5px] text-[#657b90]"><span>{n.author}</span><span>{n.at.slice(0, 16).replace("T", " ")}</span></div>
          <p className="mt-1 whitespace-pre-wrap text-[10.5px] leading-relaxed text-[#b6c8da]">{n.body}</p>
        </div>
      ))}
    </div>
  );
}

export function PaletteComments({ c, onAdd }: { c: PaletteCase; onAdd: (body: string) => void }) {
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-amber-400/25 bg-amber-400/[0.04] p-2 text-[9.5px] leading-relaxed text-amber-100/80">
        <AlertTriangle className="mr-1 inline h-3 w-3" /> Comentários são armazenados neste dispositivo. Sincronização em tempo real entre colaboradores não está habilitada sem backend.
      </div>
      <textarea className={cx(inputCls, "min-h-[60px] resize-y")} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Comentário para o caso…" />
      <PalButton size="sm" onClick={() => { if (body.trim()) { onAdd(body.trim()); setBody(""); } }}><Plus className="h-3 w-3" /> Comentar</PalButton>
      {c.comments.length === 0 ? <p className="text-[10px] text-[#657b90]">Nenhum comentário.</p> : c.comments.map((cm) => (
        <div key={cm.id} className="rounded-lg border border-[#1e2c3a] bg-[#080f16] p-2">
          <div className="flex justify-between text-[8.5px] text-[#657b90]"><span>{cm.author}</span><span>{cm.at.slice(0, 16).replace("T", " ")}</span></div>
          <p className="mt-0.5 whitespace-pre-wrap text-[10.5px] text-[#b6c8da]">{cm.body}</p>
        </div>
      ))}
    </div>
  );
}

export { Copy, Layers, Search };
