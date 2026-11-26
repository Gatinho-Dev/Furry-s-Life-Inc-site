import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, ArrowUpRight, BookOpen, Bot, CalendarClock, Check, CircleAlert, Copy, Download,
  FileBarChart, FileJson, FileText, FolderKanban, Globe, GraduationCap, LayoutGrid, Layers,
  Lock, Plus, Radar, Search, Settings2, Share2, Sparkles, Star, Trash2, Upload, Users, X,
} from "lucide-react";
import { caseStats, deleteKnowledge, duplicateCase, exportCaseJson, getPrefs, listFeedback, listKnowledge, savePrefs, updateFeedback, upsertKnowledge, type DuplicateGroup } from "@/lib/palette/store";
import { ensureSeedKnowledge, extractDocumentText, invalidateKnowledgeCache, knowledgeStats, makeKnowledgeDoc, KNOWLEDGE_CATEGORIES } from "@/lib/palette/knowledge";
import { PALETTE_TEMPLATES, planFromTemplate } from "@/lib/palette/templates";
import { REPORT_LABEL, buildReport, reportToCsv, reportToHtml, reportToMarkdown, downloadReportPdf, type ReportType } from "@/lib/palette/report";
import { CONFIDENCE_LABEL, NODE_KIND_LABEL, CASE_STATUS_LABEL, type PaletteCase, type PaletteNodeKind, type PalettePrefs } from "@/lib/palette/types";
import { PalButton, PalEmpty, PalField, PalLabel, inputCls, selectCls, Toggle, KindPill, ConfidencePill, KIND_COLOR } from "./kit";
import { cx } from "@/components/agency/kit";
import { download, formatDate } from "@/lib/agency/format";

/* -------------------------------- overview -------------------------------- */

export function PaletteOverview({ cases, onOpen, onNew }: { cases: PaletteCase[]; onOpen: (id: string) => void; onNew: () => void }) {
  const totals = cases.reduce((acc, c) => {
    const s = caseStats(c);
    acc.nodes += s.nodes; acc.edges += s.edges; acc.evidence += s.evidence; acc.searches += s.searches;
    return acc;
  }, { nodes: 0, edges: 0, evidence: 0, searches: 0 });
  const recent = cases.slice(0, 4);
  const activity = cases.flatMap((c) => c.timeline.slice(0, 4).map((t) => ({ ...t, caseId: c.id, caseTitle: c.title, code: c.code }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Investigações", value: cases.length, Icon: FolderKanban },
          { label: "Entidades mapeadas", value: totals.nodes, Icon: Layers },
          { label: "Relações", value: totals.edges, Icon: Share2 },
          { label: "Evidências", value: totals.evidence, Icon: FileText },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-[#1e2c3a] bg-gradient-to-b from-[#0b141d] to-[#080f16] p-3">
            <div className="flex items-center justify-between"><PalLabel>{label}</PalLabel><Icon className="h-3.5 w-3.5 text-[#3f5a73]" /></div>
            <div className="mt-1 text-[24px] font-semibold leading-none text-[#eaf3fb]">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
          <div className="flex items-center justify-between">
            <div><PalLabel>Investigações recentes</PalLabel><div className="mt-0.5 text-[10px] text-[#657b90]">Retome de onde parou</div></div>
            <PalButton size="sm" variant="primary" onClick={onNew}><Plus className="h-3 w-3" /> Nova</PalButton>
          </div>
          <div className="mt-2 space-y-1.5">
            {recent.length === 0 && <PalEmpty icon={FolderKanban} title="Nenhuma investigação" hint="Crie um caso a partir de um template (domínio, IP, ameaça, empresa ou identidade)." action={<PalButton size="sm" onClick={onNew}><Plus className="h-3 w-3" /> Criar investigação</PalButton>} />}
            {recent.map((c) => {
              const s = caseStats(c);
              return (
                <button key={c.id} onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 rounded-lg border border-[#1b2836] bg-[#0a1118] p-2 text-left transition-colors hover:border-cyan-400/35">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-[#26394c] bg-[#0d1721] text-[9px] font-semibold text-cyan-300">{c.code.slice(-3)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11.5px] font-medium text-[#e3edf8]">{c.title}</span>
                    <span className="block text-[9px] text-[#657b90]">{CASE_STATUS_LABEL[c.status]} · {s.nodes} entidades · {s.edges} relações · {s.evidence} evidências</span>
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 flex-none text-[#4f6a82]" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
          <PalLabel>Atividade recente</PalLabel>
          <ol className="mt-1.5 space-y-1.5">
            {activity.length === 0 && <p className="text-[10px] text-[#657b90]">Sem atividade registrada.</p>}
            {activity.map((t) => (
              <li key={`${t.caseId}-${t.id}`} className="flex gap-1.5 text-[9.5px]">
                <span className="mt-1 h-1 w-1 flex-none rounded-full bg-cyan-400/70" />
                <div className="min-w-0">
                  <div className="truncate text-[#b6c8da]">{t.title}</div>
                  <button onClick={() => onOpen(t.caseId)} className="text-[8.5px] text-[#5f7488] hover:text-cyan-300">{t.code} · {formatDate(t.at)}</button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-violet-400/20 bg-violet-400/[0.03] p-3">
        <div className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-violet-300" /><PalLabel>Como o Life Palette trabalha</PalLabel></div>
        <div className="mt-1 grid gap-2 text-[10px] leading-relaxed text-[#9db0c4] sm:grid-cols-3">
          <p><b className="text-[#dbe7f4]">Canvas + registros.</b> Toda posição, grupo, zoom e conexão é salva automaticamente neste navegador.</p>
          <p><b className="text-[#dbe7f4]">Proveniência obrigatória.</b> Relações sem fonte ficam marcadas como hipótese; confiança tem justificativa auditável.</p>
          <p><b className="text-[#dbe7f4]">IA contextual local.</b> Sem LLM externo: ela compõe respostas apenas dos registros e da base Life Knowledge, com citações.</p>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- cases ---------------------------------- */

export function PaletteCases({
  cases, title, subtitle, onOpen, onDelete, onDuplicate, onExport, onShare, onNew,
}: {
  cases: PaletteCase[]; title: string; subtitle: string;
  onOpen: (id: string) => void; onDelete: (id: string) => void; onDuplicate: (id: string) => void;
  onExport: (id: string) => void; onShare: (id: string) => void; onNew: () => void;
}) {
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const rows = cases.filter((c) => (status === "all" || c.status === status) && (!term.trim() || `${c.title} ${c.code} ${c.tags.join(" ")}`.toLowerCase().includes(term.toLowerCase())));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-[#eaf3fb]">{title}</h2>
          <p className="text-[10.5px] text-[#71879c]">{subtitle}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#5f758b]" />
            <input className={cx(inputCls, "!w-44 !py-1 !pl-6 !text-[10.5px]")} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="buscar caso" />
          </div>
          <select className={cx(selectCls, "!w-auto !py-1 !text-[10.5px]")} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos os status</option>
            {Object.entries(CASE_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <PalButton size="sm" variant="primary" onClick={onNew}><Plus className="h-3 w-3" /> Nova investigação</PalButton>
        </div>
      </div>
      {rows.length === 0 ? <PalEmpty icon={FolderKanban} title="Nenhum caso encontrado" hint="Ajuste os filtros ou crie uma nova investigação a partir de um template." /> : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => {
            const s = caseStats(c);
            return (
              <div key={c.id} className="group rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3 transition-colors hover:border-cyan-400/30">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => onOpen(c.id)} className="min-w-0 text-left">
                    <div className="text-[9px] font-medium tracking-wide text-cyan-400/80">{c.code}</div>
                    <div className="truncate text-[12.5px] font-semibold text-[#e8f1fb] group-hover:text-white">{c.title}</div>
                  </button>
                  <span className={cx("rounded-full border px-1.5 py-0.5 text-[8.5px]", c.status === "active" ? "border-emerald-400/30 text-emerald-300" : c.status === "completed" ? "border-cyan-400/30 text-cyan-300" : "border-[#2a3b4d] text-[#8399ae]")}>{CASE_STATUS_LABEL[c.status]}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[9.5px] leading-relaxed text-[#7f94a9]">{c.objective || c.description || "Sem objetivo registrado."}</p>
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[8.5px] text-[#657b90]">
                  {[["Nós", s.nodes], ["Relações", s.edges], ["Evid.", s.evidence], ["Consultas", s.searches]].map(([l, v]) => (
                    <div key={String(l)} className="rounded border border-[#16212d] bg-[#0b141d] py-0.5"><div className="text-[10.5px] font-semibold text-[#c6d6e6]">{v}</div>{l}</div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-1 text-[8.5px] text-[#5f7488]">
                  <span>atualizado {formatDate(c.updatedAt)}</span>
                  <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button title="Duplicar" onClick={() => onDuplicate(c.id)} className="rounded p-0.5 hover:text-cyan-300"><Copy className="h-3 w-3" /></button>
                    <button title="Exportar JSON" onClick={() => onExport(c.id)} className="rounded p-0.5 hover:text-cyan-300"><Download className="h-3 w-3" /></button>
                    <button title="Compartilhar snapshot" onClick={() => onShare(c.id)} className="rounded p-0.5 hover:text-cyan-300"><Share2 className="h-3 w-3" /></button>
                    <button title="Excluir" onClick={() => onDelete(c.id)} className="rounded p-0.5 hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- templates -------------------------------- */

export function PaletteTemplates({ onUse }: { onUse: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[#eaf3fb]">Investigation templates</h2>
        <p className="text-[10.5px] text-[#71879c]">Cada template cria um caso com plano de coleta, semente opcional e checklist rastreável. Nenhum dado fictício é inserido.</p>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {PALETTE_TEMPLATES.map((t) => (
          <div key={t.id} className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
            <div className="flex items-center justify-between"><PalLabel>{t.name}</PalLabel><FileBarChart className="h-3 w-3 text-[#3f5a73]" /></div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#8399ae]">{t.description}</p>
            <div className="mt-1.5 flex flex-wrap gap-1">{t.tags.map((tag) => <span key={tag} className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[8.5px] text-[#9db0c4]">#{tag}</span>)}</div>
            <div className="mt-2 space-y-0.5">
              {t.steps.slice(0, 3).map((s) => <div key={s.label} className="text-[9px] text-[#657b90]">• {s.label}</div>)}
              {t.steps.length > 3 && <div className="text-[8.5px] text-[#4f6377]">+{t.steps.length - 3} etapa(s)</div>}
            </div>
            <PalButton size="sm" variant="primary" className="mt-2 w-full" onClick={() => onUse(t.id)}><Plus className="h-3 w-3" /> Usar template</PalButton>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- entity library ---------------------------- */

export function PaletteLibrary({ cases, onOpenCase }: { cases: PaletteCase[]; onOpenCase: (caseId: string, nodeId: string) => void }) {
  const [term, setTerm] = useState("");
  const [kind, setKind] = useState<"all" | PaletteNodeKind>("all");
  const entries = cases.flatMap((c) => c.nodes.map((n) => ({ n, c })));
  const filtered = entries.filter(({ n }) => (kind === "all" || n.kind === kind) && (!term.trim() || n.title.toLowerCase().includes(term.toLowerCase())));
  const byKind = entries.reduce<Record<string, number>>((acc, { n }) => { acc[n.kind] = (acc[n.kind] ?? 0) + 1; return acc; }, {});
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[#eaf3fb]">Entity Library</h2>
        <p className="text-[10.5px] text-[#71879c]">Entidades de todos os casos locais. Abra para revisar a proveniência no caso de origem.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input className={cx(inputCls, "!w-52 !py-1 !text-[10.5px]")} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="buscar entidade" />
        <select className={cx(selectCls, "!w-auto !py-1 !text-[10.5px]")} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="all">Todos os tipos ({entries.length})</option>
          {Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => <option key={k} value={k}>{NODE_KIND_LABEL[k as PaletteNodeKind]} ({v})</option>)}
        </select>
        <span className="ml-auto text-[9.5px] text-[#5f7488]">{filtered.length} resultado(s)</span>
      </div>
      {filtered.length === 0 ? <PalEmpty icon={Layers} title="Nenhuma entidade" hint="As entidades aparecem aqui quando você as adiciona aos casos." /> : (
        <div className="overflow-auto rounded-lg border border-[#1b2836]">
          <table className="w-full text-[10px]">
            <thead className="bg-[#0b141d] text-[#71879c]"><tr><th className="px-2 py-1.5 text-left">Entidade</th><th className="text-left">Tipo</th><th className="text-left">Confiança</th><th className="text-left">Fontes</th><th className="text-left">Caso</th></tr></thead>
            <tbody>
              {filtered.slice(0, 300).map(({ n, c }) => (
                <tr key={`${c.id}-${n.id}`} className="cursor-pointer border-t border-[#15202c] text-[#b6c8da] hover:bg-white/[0.03]" onClick={() => onOpenCase(c.id, n.id)}>
                  <td className="max-w-[280px] truncate px-2 py-1.5 text-[#e6eef7]">{n.title}</td>
                  <td className="whitespace-nowrap">{NODE_KIND_LABEL[n.kind]}</td>
                  <td><ConfidencePill level={n.confidence} small /></td>
                  <td className="max-w-[200px] truncate text-[#8399ae]">{n.sources.join(", ") || "—"}</td>
                  <td className="whitespace-nowrap text-[9px] text-cyan-400/80">{c.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- knowledge -------------------------------- */

export function PaletteKnowledge({ onToast }: { onToast: (m: string, t?: "ok" | "warn" | "info") => void }) {
  const [docs, setDocs] = useState(() => listKnowledge());
  const [stats, setStats] = useState(() => knowledgeStats());
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(KNOWLEDGE_CATEGORIES[0]);
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState(listFeedback());
  const refresh = () => { setDocs(listKnowledge()); setStats(knowledgeStats()); };
  useEffect(() => { ensureSeedKnowledge(); refresh(); }, []);

  const importFile = async (file: File) => {
    setBusy(true);
    try {
      const { text: content, warning } = await extractDocumentText(file);
      if (warning) onToast(warning, "warn");
      if (!content.trim()) throw new Error("O arquivo não contém texto extraível.");
      const doc = makeKnowledgeDoc({ title: title.trim() || file.name.replace(/\.[a-z0-9]+$/i, ""), category, source: source.trim() || file.name, text: content });
      upsertKnowledge(doc);
      invalidateKnowledgeCache();
      refresh();
      onToast(`“${doc.title}” indexado em ${doc.chunkCount} trecho(s).`, "ok");
      setTitle(""); setText("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao importar documento.", "warn");
    } finally {
      setBusy(false);
    }
  };

  const addText = () => {
    if (!text.trim() || !title.trim()) { onToast("Informe título e conteúdo.", "warn"); return; }
    const doc = makeKnowledgeDoc({ title: title.trim(), category, source: source.trim() || "Manual", text: text.trim() });
    upsertKnowledge(doc);
    invalidateKnowledgeCache();
    refresh();
    setTitle(""); setText("");
    onToast("Documento indexado localmente.", "ok");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#eaf3fb]">AI Knowledge Center</h2>
          <p className="text-[10.5px] text-[#71879c]">Base local de metodologia e documentação. Indexação por trechos com recuperação lexical BM25 — não é um modelo de embeddings.</p>
        </div>
        <div className="flex gap-2 text-center">
          {[["Docs", stats.docs], ["Trechos", stats.chunks], ["Categorias", Object.keys(stats.categories).length]].map(([l, v]) => (
            <div key={String(l)} className="rounded-lg border border-[#1e2c3a] bg-[#0b141d] px-3 py-1"><div className="text-[14px] font-semibold text-[#e8f1fb]">{v}</div><div className="text-[8px] uppercase tracking-wide text-[#657b90]">{l}</div></div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
          <PalLabel>Adicionar conhecimento</PalLabel>
          <div className="mt-2 space-y-2">
            <PalField label="Título"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ex.: Metodologia de análise de certificados" /></PalField>
            <div className="grid grid-cols-2 gap-2">
              <PalField label="Categoria">
                <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {KNOWLEDGE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </PalField>
              <PalField label="Fonte"><input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} placeholder="autor / URL / interno" /></PalField>
            </div>
            <PalField label="Conteúdo (texto/Markdown)">
              <textarea className={cx(inputCls, "min-h-[110px] resize-y")} value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole aqui documentação, guia técnico ou metodologia…" />
            </PalField>
            <div className="flex flex-wrap gap-1.5">
              <PalButton size="sm" variant="primary" onClick={addText} disabled={busy}><Plus className="h-3 w-3" /> Indexar texto</PalButton>
              <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.json,.csv,.html,.htm,.log" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
              <PalButton size="sm" variant="soft" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="h-3 w-3" /> Importar arquivo</PalButton>
            </div>
            <p className="text-[8.5px] leading-relaxed text-[#5f7488]">Aceita TXT, MD, JSON, CSV, HTML e LOG até 2 MB. PDF/DOCX não são extraídos nesta versão (converta antes). Nada é enviado para servidor externo.</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between"><PalLabel>Documentos ({docs.length})</PalLabel><span className="text-[8.5px] text-[#5f7488]">última atualização {stats.lastUpdated ? formatDate(stats.lastUpdated) : "—"}</span></div>
          <div className="max-h-[290px] space-y-1.5 overflow-y-auto pr-1">
            {docs.map((d) => (
              <div key={d.id} className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[10.5px] font-medium text-[#e3edf8]">{d.title}</div>
                    <div className="text-[8.5px] text-[#71879c]">{d.category} · {d.chunkCount} trechos · {d.builtIn ? "interno" : "importado"} · {d.source}</div>
                  </div>
                  <button onClick={() => { deleteKnowledge(d.id); invalidateKnowledgeCache(); refresh(); onToast("Documento removido da base.", "ok"); }} className="text-[#657b90] hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.03] p-2 text-[9px] leading-relaxed text-amber-100/80">
            <CircleAlert className="mr-1 inline h-3 w-3" /> Recuperação lexical local. Não há fine-tuning nem embeddings neste deployment; documentos enviados ficam no navegador.
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
        <div className="flex items-center justify-between"><PalLabel>Feedback das respostas ({feedback.length})</PalLabel><span className="text-[8.5px] text-[#5f7488]">Revisão manual · não altera regras automaticamente</span></div>
        {feedback.length === 0 ? <p className="mt-1 text-[10px] text-[#657b90]">Nenhuma avaliação ainda. Use as setas no painel da IA.</p> : (
          <div className="mt-1.5 space-y-1">
            {feedback.slice(0, 8).map((f) => (
              <div key={f.id} className="flex flex-wrap items-center gap-2 rounded border border-[#1b2836] bg-[#0a1118] px-2 py-1 text-[9px]">
                <span className={cx("rounded px-1", f.rating === "useful" ? "bg-emerald-400/10 text-emerald-300" : f.rating === "incorrect" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-300")}>{f.rating}</span>
                <span className="min-w-0 flex-1 truncate text-[#a5b9cc]">{f.question}</span>
                <label className="flex items-center gap-1 text-[#71879c]"><input type="checkbox" checked={f.reviewed} onChange={(e) => { updateFeedback(f.id, { reviewed: e.target.checked }); setFeedback(listFeedback()); }} /> revisado</label>
                <label className="flex items-center gap-1 text-[#71879c]"><input type="checkbox" checked={f.approved} onChange={(e) => { updateFeedback(f.id, { approved: e.target.checked, reviewed: true }); setFeedback(listFeedback()); }} /> aprovado</label>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- reports --------------------------------- */

export function PaletteReports({ cases, initialCaseId, onToast }: { cases: PaletteCase[]; initialCaseId?: string; onToast: (m: string, t?: "ok" | "warn" | "info") => void }) {
  const [caseId, setCaseId] = useState(initialCaseId ?? cases[0]?.id ?? "");
  const [type, setType] = useState<ReportType>("summary");
  const c = cases.find((x) => x.id === caseId) ?? cases[0];
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => (c ? buildReport(c, type) : null), [c, type]);

  if (!c) return <PalEmpty icon={FileBarChart} title="Nenhum caso para relatar" hint="Crie uma investigação primeiro." />;

  const fileBase = `life-palette-${type}-${c.code}`;
  return (
    <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
      <div className="space-y-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#eaf3fb]">Report Generator</h2>
          <p className="text-[10.5px] text-[#71879c]">Relatórios gerados exclusivamente dos registros do caso.</p>
        </div>
        <PalField label="Caso">
          <select className={selectCls} value={c.id} onChange={(e) => setCaseId(e.target.value)}>
            {cases.map((x) => <option key={x.id} value={x.id}>{x.code} — {x.title}</option>)}
          </select>
        </PalField>
        <PalField label="Tipo">
          <select className={selectCls} value={type} onChange={(e) => setType(e.target.value as ReportType)}>
            {Object.entries(REPORT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </PalField>
        <div className="grid grid-cols-2 gap-1.5">
          <PalButton size="sm" variant="primary" onClick={() => { download(`${fileBase}.html`, reportToHtml(c, type), "text/html"); onToast("HTML exportado.", "ok"); }}><Download className="h-3 w-3" /> HTML</PalButton>
          <PalButton size="sm" variant="soft" onClick={() => { void downloadReportPdf(c, type).then(() => onToast("PDF gerado.", "ok")).catch(() => onToast("Falha ao gerar PDF.", "warn")); }}><FileText className="h-3 w-3" /> PDF</PalButton>
          <PalButton size="sm" variant="soft" onClick={() => { download(`${fileBase}.json`, JSON.stringify({ report: preview, case: c }, null, 2), "application/json"); onToast("JSON exportado.", "ok"); }}><FileJson className="h-3 w-3" /> JSON</PalButton>
          <PalButton size="sm" variant="soft" onClick={() => { download(`${fileBase}.csv`, reportToCsv(c, type), "text/csv"); onToast("CSV exportado.", "ok"); }}><Download className="h-3 w-3" /> CSV</PalButton>
          <PalButton size="sm" variant="soft" onClick={() => { download(`${fileBase}.md`, reportToMarkdown(c, type), "text/markdown"); onToast("Markdown exportado.", "ok"); }}><Download className="h-3 w-3" /> MD</PalButton>
          <PalButton size="sm" variant="soft" onClick={() => { download(`${fileBase}-case.json`, exportCaseJson(c), "application/json"); onToast("Caso completo exportado.", "ok"); }}><Download className="h-3 w-3" /> Caso</PalButton>
        </div>
        <div className="rounded-lg border border-[#1e2c3a] bg-[#0a1118] p-2 text-[9px] leading-relaxed text-[#71879c]">
          PNG do canvas: use o botão de imagem na barra do canvas. PDF e HTML incluem identificação, objetivo, metodologia, entidades, relações, fontes, evidências, confiança, limitações e conclusão.
        </div>
      </div>
      <div className="min-w-0 rounded-xl border border-[#1e2c3a] bg-white/[0.02] p-2">
        {preview && (
          <div className="max-h-[62vh] overflow-y-auto rounded bg-white p-5 text-[#111827]">
            <div className="border-b-2 border-sky-500 pb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">Life Palette · Life Agency</div>
              <h1 className="text-[18px] font-bold">{preview.title}</h1>
              <div className="text-[11px] text-gray-600">{c.code} — {c.title}</div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-0.5 text-[9px] text-gray-600">
              {preview.meta.map((m) => <div key={m.label}><span className="text-gray-400">{m.label}:</span> {m.value}</div>)}
            </div>
            {preview.sections.map((s) => (
              <section key={s.heading} className="mt-3">
                <h2 className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">{s.heading}</h2>
                {s.paragraphs.map((p, i) => <p key={i} className="mt-1 whitespace-pre-wrap text-[9px] leading-relaxed">{p}</p>)}
                {s.table && (
                  <table className="mt-1 w-full border-collapse text-[8px]">
                    <thead><tr>{s.table.columns.map((h) => <th key={h} className="border border-gray-300 bg-gray-100 px-1 py-0.5 text-left">{h}</th>)}</tr></thead>
                    <tbody>{s.table.rows.slice(0, 40).map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j} className="border border-gray-300 px-1 py-0.5">{cell}</td>)}</tr>)}</tbody>
                  </table>
                )}
              </section>
            ))}
            <p className="mt-3 border-t pt-1 text-[8px] text-gray-500">Gerado em {preview.generatedAt}. Baseado exclusivamente nos registros do caso; verifique as fontes originais antes de decisões críticas.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- settings -------------------------------- */

export function PaletteSettings({ prefs, onChange, onReset, onToast }: { prefs: PalettePrefs; onChange: (p: Partial<PalettePrefs>) => void; onReset: () => void; onToast: (m: string, t?: "ok" | "warn" | "info") => void }) {
  const [draft, setDraft] = useState(prefs);
  const save = () => { onChange(draft); onToast("Preferências salvas.", "ok"); };
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[15px] font-semibold text-[#eaf3fb]">Life Palette Settings</h2>
        <p className="text-[10.5px] text-[#71879c]">Aparência, canvas, IA e salvamento. Preferências valem para este navegador.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
          <PalLabel>Canvas e aparência</PalLabel>
          <div className="mt-2 space-y-2">
            <PalField label="Tamanho dos nós">
              <select className={selectCls} value={draft.nodeSize} onChange={(e) => setDraft({ ...draft, nodeSize: e.target.value as PalettePrefs["nodeSize"] })}>
                <option value="compact">Compacto</option>
                <option value="regular">Regular</option>
                <option value="large">Grande</option>
              </select>
            </PalField>
            <PalField label="Densidade">
              <select className={selectCls} value={draft.density} onChange={(e) => setDraft({ ...draft, density: e.target.value as PalettePrefs["density"] })}>
                <option value="comfortable">Confortável</option>
                <option value="compact">Compacta</option>
              </select>
            </PalField>
            <PalField label="Estilo padrão das conexões">
              <select className={selectCls} value={draft.edgeStyle} onChange={(e) => setDraft({ ...draft, edgeStyle: e.target.value as PalettePrefs["edgeStyle"] })}>
                <option value="solid">Contínua</option>
                <option value="dashed">Tracejada</option>
                <option value="dotted">Pontilhada</option>
              </select>
            </PalField>
            <div className="flex items-center justify-between text-[10.5px] text-[#a5b9cc]"><span>Minimapa</span><Toggle checked={draft.showMinimap} onChange={(v) => setDraft({ ...draft, showMinimap: v })} label="Minimapa" /></div>
            <div className="flex items-center justify-between text-[10.5px] text-[#a5b9cc]"><span>Grade de fundo</span><Toggle checked={draft.showGrid} onChange={(v) => setDraft({ ...draft, showGrid: v })} label="Grade" /></div>
            <div className="flex items-center justify-between text-[10.5px] text-[#a5b9cc]"><span>Reduzir animações</span><Toggle checked={draft.reduceMotion} onChange={(v) => setDraft({ ...draft, reduceMotion: v })} label="Reduzir animações" /></div>
          </div>
        </div>
        <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
          <PalLabel>Investigação, IA e privacidade</PalLabel>
          <div className="mt-2 space-y-2">
            <PalField label="Nome do analista"><input className={inputCls} value={draft.analystName} onChange={(e) => setDraft({ ...draft, analystName: e.target.value })} /></PalField>
            <PalField label="Confiança padrão de novas entidades">
              <select className={selectCls} value={draft.defaultConfidence} onChange={(e) => setDraft({ ...draft, defaultConfidence: e.target.value as PalettePrefs["defaultConfidence"] })}>
                {Object.entries(CONFIDENCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </PalField>
            <div className="flex items-center justify-between text-[10.5px] text-[#a5b9cc]"><span>Salvamento automático</span><Toggle checked={draft.autoSave} onChange={(v) => setDraft({ ...draft, autoSave: v })} label="Salvamento automático" /></div>
            <div className="flex items-center justify-between text-[10.5px] text-[#a5b9cc]"><span>Confirmar ações destrutivas</span><Toggle checked={draft.confirmDestructive} onChange={(v) => setDraft({ ...draft, confirmDestructive: v })} label="Confirmação" /></div>
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.03] p-2 text-[9px] leading-relaxed text-amber-100/80">
              Dados de caso, conhecimento e memória ficam no localStorage deste navegador. Compartilhar gera um snapshot comprimido read-only que você decide exportar.
            </div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PalButton variant="primary" onClick={save}><Check className="h-3.5 w-3.5" /> Salvar preferências</PalButton>
        <PalButton variant="danger" onClick={() => { if (confirm("Apagar TODOS os casos, conhecimento, memória e feedback do Life Palette neste navegador? Esta ação não pode ser desfeita.")) onReset(); }}><Trash2 className="h-3.5 w-3.5" /> Apagar dados locais</PalButton>
      </div>
      <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3">
        <PalLabel>Atalhos</PalLabel>
        <div className="mt-1.5 grid gap-1 text-[9.5px] text-[#9db0c4] sm:grid-cols-2">
          {[["Ctrl + K", "Busca global"], ["Ctrl + N", "Nova entidade"], ["Ctrl + Z / Ctrl + Shift + Z", "Desfazer / refazer"], ["Ctrl + S", "Salvar agora"], ["Ctrl + A", "Selecionar todos os nós"], ["Ctrl + C / Ctrl + V", "Copiar / colar nós"], ["Delete", "Remover seleção"], ["Duplo clique", "Editar nó"], ["Clique direito", "Menu contextual"], ["Shift + arrastar", "Seleção múltipla"]].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 border-b border-[#14202b] py-0.5"><span>{v}</span><span className="ag-mono text-[8.5px] text-[#6f859a]">{k}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { Bot, Globe, GraduationCap, Lock, Users, Star, LeafIcon };

function LeafIcon() { return <LayoutGrid className="h-4 w-4" />; }
