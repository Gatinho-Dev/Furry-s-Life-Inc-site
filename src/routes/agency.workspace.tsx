import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft, Brain, CalendarClock, ClipboardList, Download, FileBarChart, FolderOpen, Plus, Save,
  Trash2, UserPlus, X,
} from "lucide-react";
import {
  addEntity, addNote, addEvidence, createInvestigation, deleteInvestigation, getInvestigation,
  listInvestigations, removeEntity, removeEvidence, removeNote, subscribeStore,
  updateInvestigation, type EntityKind, type Investigation,
} from "@/lib/agency/store";
import { STATUS_LABELS, ENTITY_LABELS, type InvestigationStatus } from "@/lib/agency/types";
import { analyzeInvestigation, executiveSummary } from "@/lib/agency/assistant";
import { download, formatDate, timeAgo } from "@/lib/agency/format";
import {
  Badge, Button, Collapse, DataTable, Empty, Field, Notice, PageHeader, Panel, Tabs, ValueView, cx,
} from "@/components/agency/kit";

export const Route = createFileRoute("/agency/workspace")({
  validateSearch: (s: Record<string, unknown>) => ({ case: typeof s.case === "string" ? s.case : undefined }),
  head: () => ({ meta: [{ title: "Investigation Workspace — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: WorkspacePage,
});

const STATUS_TONE: Record<InvestigationStatus, "neutral" | "cyan" | "amber" | "green" | "violet"> = {
  draft: "neutral", active: "cyan", under_review: "amber", completed: "green", archived: "violet",
};

function WorkspacePage() {
  const { case: caseId } = Route.useSearch();
  const [investigations, setInvestigations] = useState<Investigation[]>(() => listInvestigations());
  const [selectedId, setSelectedId] = useState<string | null>(caseId ?? null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setInvestigations(listInvestigations());
    return subscribeStore(() => {
      setInvestigations(listInvestigations());
    });
  }, []);

  useEffect(() => {
    if (caseId) setSelectedId(caseId);
  }, [caseId]);

  const selected = useMemo(() => investigations.find((i) => i.id === selectedId) ?? (selectedId ? getInvestigation(selectedId) : null), [investigations, selectedId]);

  if (selected) return <CaseDetail inv={selected} onBack={() => setSelectedId(null)} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Workbench"
        title="Investigation Workspace"
        subtitle="Casos com identificação, objetivo, entidades, evidências, notas, linha do tempo e conclusão. Armazenamento local no navegador, com exportação em JSON e relatórios."
        actions={<Button variant="primary" onClick={() => setShowCreate(!showCreate)}><Plus className="h-3.5 w-3.5" /> Nova investigação</Button>}
      />

      {showCreate && <CreateCase onDone={(id) => { setSelectedId(id); setShowCreate(false); }} />}

      {investigations.length === 0 ? (
        <Empty title="Nenhuma investigação criada" hint="Crie um caso para registrar entidades, evidências e conclusões com trilha de auditoria." icon={<FolderOpen className="h-6 w-6" />} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {investigations.map((inv) => (
            <article key={inv.id} className="ag-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="ag-mono text-[10px] text-[var(--ag-faint)]">{inv.code}</div>
                  <button onClick={() => setSelectedId(inv.id)} className="text-left text-[14px] font-semibold text-[#e6eef8] hover:text-cyan-300">{inv.name}</button>
                </div>
                <Badge tone={STATUS_TONE[inv.status]}>{STATUS_LABELS[inv.status]}</Badge>
              </div>
              {inv.description && <p className="mt-1.5 line-clamp-2 text-[11.5px] text-[var(--ag-muted)]">{inv.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[10.5px] text-[var(--ag-faint)]">
                <span>{inv.entities.length} entidades</span>
                <span>· {inv.evidence.length} evidências</span>
                <span>· {inv.notes.length} notas</span>
                <span>· {timeAgo(inv.updatedAt)}</span>
              </div>
              {inv.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">{inv.tags.map((t) => <span key={t} className="rounded-full border border-[var(--ag-border)] px-1.5 py-0.5 text-[9.5px] text-[var(--ag-muted)]">{t}</span>)}</div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setSelectedId(inv.id)}>Abrir</Button>
                <Link to="/agency/reports" search={{ case: inv.id }} className="ag-btn ag-btn-ghost !px-2.5 !py-1.5 !text-[11px]"><FileBarChart className="h-3 w-3" /> Relatório</Link>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Excluir ${inv.code}?`)) deleteInvestigation(inv.id); }}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateCase({ onDone }: { onDone: (id: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [tags, setTags] = useState("");
  return (
    <Panel title="Nova investigação" description="Um caso agrupa evidências de qualquer módulo da plataforma.">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome"><input className="ag-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Infraestrutura do domínio suspeito" /></Field>
        <Field label="Tags" hint="separadas por vírgula"><input className="ag-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="phishing, financeiro" /></Field>
        <Field label="Descrição"><textarea className="ag-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Objetivo"><textarea className="ag-textarea" rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="O que precisa ser respondido?" /></Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          variant="primary"
          disabled={!name.trim()}
          onClick={() => {
            const inv = createInvestigation({
              name,
              description,
              objective,
              tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
            });
            onDone(inv.id);
          }}
        >
          Criar investigação
        </Button>
      </div>
    </Panel>
  );
}

type Tab = "summary" | "evidence" | "entities" | "notes" | "timeline" | "assistant";

function CaseDetail({ inv, onBack }: { inv: Investigation; onBack: () => void }) {
  const [tab, setTab] = useState<Tab>("summary");
  const [description, setDescription] = useState(inv.description);
  const [objective, setObjective] = useState(inv.objective);
  const [conclusion, setConclusion] = useState(inv.conclusion);
  const [tagInput, setTagInput] = useState("");
  const [note, setNote] = useState("");
  const [entityKind, setEntityKind] = useState<EntityKind>("domain");
  const [entityValue, setEntityValue] = useState("");
  const [eventTitle, setEventTitle] = useState("");

  const analysis = useMemo(() => analyzeInvestigation(inv), [inv]);
  const summary = useMemo(() => executiveSummary(inv, analysis), [inv, analysis]);

  const saveFields = () => updateInvestigation(inv.id, { description, objective, conclusion });

  const exportJson = () => download(`${inv.code}-${inv.name.replace(/\s+/g, "-").toLowerCase()}.json`, JSON.stringify(inv, null, 2), "application/json");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="ag-btn ag-btn-ghost !px-2 !py-1.5"><ArrowLeft className="h-3.5 w-3.5" /> Casos</button>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/agency/graph" search={{ case: inv.id }} className="ag-btn ag-btn-ghost !text-[11px]">Link Analysis</Link>
          <Link to="/agency/reports" search={{ case: inv.id }} className="ag-btn !text-[11px]"><FileBarChart className="h-3 w-3" /> Gerar relatório</Link>
          <Button size="sm" variant="ghost" onClick={exportJson}><Download className="h-3 w-3" /> JSON</Button>
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="ag-mono text-[10.5px] text-[var(--ag-faint)]">{inv.code}</div>
            <h1 className="text-[22px] font-bold leading-tight">{inv.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--ag-faint)]">
              {inv.seed && <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-cyan-200">semente: {inv.seed.value}</span>}
              <span>criado {formatDate(inv.createdAt)}</span>
              <span>· atualizado {timeAgo(inv.updatedAt)}</span>
              <span>· {inv.entities.length} entidades · {inv.evidence.length} evidências</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="ag-select !w-auto !py-1.5 !text-[11px]"
              value={inv.status}
              onChange={(e) => updateInvestigation(inv.id, { status: e.target.value as InvestigationStatus })}
            >
              {(Object.keys(STATUS_LABELS) as InvestigationStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {inv.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full border border-[var(--ag-border)] px-2 py-0.5 text-[10px] text-[var(--ag-muted)]">
              {t}
              <button onClick={() => updateInvestigation(inv.id, { tags: inv.tags.filter((x) => x !== t) })}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tagInput.trim()) {
                e.preventDefault();
                updateInvestigation(inv.id, { tags: [...new Set([...inv.tags, tagInput.trim()])] });
                setTagInput("");
              }
            }}
            placeholder="+ tag"
            className="w-20 rounded-full border border-[var(--ag-border)] bg-transparent px-2 py-0.5 text-[10px] outline-none placeholder:text-[var(--ag-faint)]"
          />
        </div>
      </Panel>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "summary", label: "Resumo" },
          { key: "evidence", label: "Evidências", count: inv.evidence.length },
          { key: "entities", label: "Entidades", count: inv.entities.length },
          { key: "notes", label: "Notas", count: inv.notes.length },
          { key: "timeline", label: "Linha do tempo", count: inv.timeline.length },
          { key: "assistant", label: "Life AI" },
        ]}
      />

      {tab === "summary" && (
        <Panel title="Identificação e objetivo">
          <div className="grid gap-3">
            <Field label="Descrição"><textarea className="ag-textarea" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <Field label="Objetivo"><textarea className="ag-textarea" rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} /></Field>
            <Field label="Conclusão"><textarea className="ag-textarea" rows={4} value={conclusion} onChange={(e) => setConclusion(e.target.value)} placeholder="Conclusão analítica, separando fatos de hipóteses." /></Field>
            <div className="flex justify-end"><Button variant="primary" onClick={saveFields}><Save className="h-3.5 w-3.5" /> Salvar</Button></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--ag-border)] p-3"><div className="ag-label">Evidências</div><div className="font-display text-xl">{inv.evidence.length}</div></div>
            <div className="rounded-xl border border-[var(--ag-border)] p-3"><div className="ag-label">Fontes distintas</div><div className="font-display text-xl">{new Set(inv.evidence.map((e) => e.source)).size}</div></div>
            <div className="rounded-xl border border-[var(--ag-border)] p-3"><div className="ag-label">Ferramentas</div><div className="font-display text-xl">{new Set(inv.evidence.map((e) => e.tool)).size}</div></div>
          </div>
        </Panel>
      )}

      {tab === "evidence" && (
        <Panel title="Evidências públicas" description="Resultados reais coletados pelas ferramentas, com fonte e horário.">
          {inv.evidence.length === 0 ? (
            <Empty title="Nenhuma evidência registrada" hint="Use “Registrar evidência” em qualquer ferramenta para adicionar resultados aqui." icon={<ClipboardList className="h-6 w-6" />} />
          ) : (
            <div className="space-y-2">
              {inv.evidence.map((ev) => (
                <Collapse key={ev.id} title={`${ev.tool} · ${ev.input || "—"} · ${formatDate(ev.at)}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--ag-faint)]">
                      <Badge tone="blue">{ev.source}</Badge>
                      <span className="ag-mono">{ev.toolId}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => download(`${inv.code}-${ev.toolId}.json`, JSON.stringify(ev, null, 2), "application/json")}><Download className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => removeEvidence(inv.id, ev.id)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <p className="mb-2 text-[11px] text-[var(--ag-muted)]">{ev.summary}</p>
                  <ValueView value={strip(ev.data)} />
                </Collapse>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "entities" && (
        <Panel title="Entidades" description="Domínios, IPs, organizações, certificados, CVEs, hashes e perfis públicos.">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[130px]"><Field label="Tipo">
              <select className="ag-select" value={entityKind} onChange={(e) => setEntityKind(e.target.value as EntityKind)}>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field></div>
            <div className="min-w-[200px] flex-1"><Field label="Valor"><input className="ag-input" value={entityValue} onChange={(e) => setEntityValue(e.target.value)} placeholder="exemplo.com" /></Field></div>
            <Button onClick={() => { if (entityValue.trim()) { addEntity(inv.id, { kind: entityKind, value: entityValue.trim(), source: "Manual", confidence: "unconfirmed" }); setEntityValue(""); } }}>
              <UserPlus className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
          <div className="mt-3">
            {inv.entities.length === 0 ? <Empty title="Nenhuma entidade" hint="Entidades são adicionadas automaticamente ao registrar evidências." /> : (
              <DataTable
                columns={["tipo", "valor", "fonte", "confiança", "data", ""]}
                rows={inv.entities.map((e) => ({
                  tipo: ENTITY_LABELS[e.kind] ?? e.kind,
                  valor: <span className="ag-mono text-[11px]">{e.value}</span>,
                  fonte: e.source,
                  confiança: <Badge tone={e.confidence === "confirmed" ? "green" : e.confidence === "probable" ? "amber" : "neutral"}>{e.confidence}</Badge>,
                  data: formatDate(e.at),
                  "": <button onClick={() => removeEntity(inv.id, e.id)} className="text-[var(--ag-faint)] hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>,
                }))}
              />
            )}
          </div>
        </Panel>
      )}

      {tab === "notes" && (
        <Panel title="Notas do analista" description="Anotações livres, datadas e vinculadas ao caso.">
          <div className="flex gap-2">
            <textarea className="ag-textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hipótese, observação, pendência…" />
            <Button variant="primary" onClick={() => { if (note.trim()) { addNote(inv.id, note); setNote(""); } }}><Plus className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="mt-3 space-y-2">
            {inv.notes.length === 0 ? <Empty title="Nenhuma nota" /> : inv.notes.map((n) => (
              <div key={n.id} className="rounded-xl border border-[var(--ag-border)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="whitespace-pre-wrap text-[11.5px] text-[#d6e2ef]">{n.body}</p>
                  <button onClick={() => removeNote(inv.id, n.id)} className="text-[var(--ag-faint)] hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
                </div>
                <div className="mt-1 text-[10px] text-[var(--ag-faint)]">{formatDate(n.at)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {tab === "timeline" && (
        <Panel title="Linha do tempo" description="Eventos do caso em ordem cronológica.">
          <div className="flex items-end gap-2">
            <div className="flex-1"><Field label="Novo evento"><input className="ag-input" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Ex.: Recebido relatório externo" /></Field></div>
            <Button onClick={() => {
              if (!eventTitle.trim()) return;
              updateInvestigation(inv.id, { timeline: [...inv.timeline, { id: `tl-${Date.now()}`, at: new Date().toISOString(), title: eventTitle.trim() }] });
              setEventTitle("");
            }}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
          </div>
          <ol className="mt-4 space-y-3 border-l border-[var(--ag-border)] pl-4">
            {[...inv.timeline].sort((a, b) => b.at.localeCompare(a.at)).map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-cyan-400" />
                <div className="text-[11.5px] font-medium text-[#dce8f5]">{t.title}</div>
                <div className="text-[10px] text-[var(--ag-faint)]">{formatDate(t.at)}</div>
                {t.detail && <div className="text-[10.5px] text-[var(--ag-muted)]">{t.detail}</div>}
              </li>
            ))}
          </ol>
        </Panel>
      )}

      {tab === "assistant" && (
        <div className="space-y-4">
          <Panel
            title="Life Intelligence AI — análise assistida"
            description="Motor determinístico que lê apenas as evidências deste caso. Não gera dados novos e separa fatos, não confirmados, hipóteses e limitações."
            actions={<Badge tone="violet"><Brain className="h-3 w-3" /> local · sem API externa</Badge>}
          >
            <p className="rounded-xl border border-[var(--ag-border)] bg-black/25 p-3 text-[12px] leading-relaxed text-[#d6e2ef]">{summary}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <AnalysisBlock title="Fatos confirmados" tone="green" items={analysis.facts} emptyHint="Nenhum fato derivado das evidências atuais." />
              <AnalysisBlock title="Informações não confirmadas" tone="amber" items={analysis.unconfirmed} emptyHint="Nenhum ponto pendente de validação." />
              <AnalysisBlock title="Hipóteses" tone="cyan" items={analysis.hypotheses} emptyHint="Nenhuma hipótese sugerida com a base atual." />
              <AnalysisBlock title="Limitações" tone="rose" items={analysis.limitations} />
            </div>
            <div className="mt-3">
              <AnalysisBlock title="Sugestões de fontes públicas adicionais" tone="violet" items={analysis.suggestions} emptyHint="Nenhuma sugestão adicional." />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigator.clipboard.writeText([summary, "", "FATOS:", ...analysis.facts, "", "NÃO CONFIRMADO:", ...analysis.unconfirmed, "", "HIPÓTESES:", ...analysis.hypotheses, "", "LIMITAÇÕES:", ...analysis.limitations].join("\n"))}>Copiar análise</Button>
              <Button size="sm" variant="ghost" onClick={() => updateInvestigation(inv.id, { notes: [...inv.notes, { id: `note-${Date.now()}`, at: new Date().toISOString(), body: summary }] })}>Salvar resumo como nota</Button>
              <Link to="/agency/reports" search={{ case: inv.id }} className="ag-btn ag-btn-ghost !px-2.5 !py-1.5 !text-[11px]">Incluir no relatório</Link>
            </div>
          </Panel>
          <Notice tone="info" title="Escopo do assistente">
            A integração com modelos externos de IA é opcional e não foi habilitada por padrão. Este motor não inventa indicadores, não afirma identidades e não substitui análise humana.
          </Notice>
        </div>
      )}

      <div className="flex items-center gap-2 text-[10px] text-[var(--ag-faint)]"><CalendarClock className="h-3 w-3" /> Dados armazenados localmente neste navegador.</div>
    </div>
  );
}

function AnalysisBlock({ title, tone, items, emptyHint }: { title: string; tone: "green" | "amber" | "cyan" | "rose" | "violet"; items: string[]; emptyHint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--ag-border)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-[#dce8f5]">{title}</span>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-[10.5px] text-[var(--ag-faint)]">{emptyHint ?? "—"}</p>
      ) : (
        <ul className={cx("space-y-1 text-[11px] leading-relaxed", tone === "rose" ? "text-rose-100/80" : "text-[var(--ag-muted)]")}>
          {items.map((i, idx) => <li key={idx}>• {i}</li>)}
        </ul>
      )}
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
