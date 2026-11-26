import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Bot, Check, ChevronDown, ChevronLeft, CircleHelp, FileBarChart, FileSearch,
  FolderKanban, History, Layers, LayoutDashboard, Library, Loader2, Menu, Plus, Radar,
  Search, Settings2, Share2, Sparkles, Users, Wand2, X,
} from "lucide-react";
import {
  appendTimeline, caseStats, createCase, decodeShare, deleteCase, duplicateCase, encodeShare,
  exportCaseJson, getCase, getMemory, getPrefs, importSharedCase, isReadOnly, listAllVisibleCases,
  listCases, mergeNodes, newEvidence, saveCase, saveMemory, savePrefs,
  subscribePalette, timelineEntry, uid,
  type DuplicateGroup,
} from "@/lib/palette/store";
import { ensureSeedKnowledge, invalidateKnowledgeCache } from "@/lib/palette/knowledge";
import { extractFromUnknown, normalizeEntityValue, relationForSource } from "@/lib/palette/extract";
import type { InputCandidate } from "@/lib/palette/classify";
import { computeLayout } from "@/lib/palette/layout";
import { planFromTemplate, PALETTE_TEMPLATES } from "@/lib/palette/templates";
import { runSource, SEARCH_SOURCES, CATEGORY_LABEL, type SearchOutcome } from "@/lib/palette/search";
import { DEPTH_META } from "@/lib/palette/plan";
import { executiveSummary } from "@/lib/palette/ai";
import { reportToGraphMl } from "@/lib/palette/report";
import {
  CASE_STATUS_LABEL, CONFIDENCE_LABEL, NODE_KIND_LABEL,
  type AiAction, type CaseStatus, type ConfidenceLevel, type InvestigationDepth, type PaletteCase,
  type PaletteGroup, type PaletteNode, type PaletteNodeKind, type PalettePrefs, type PaletteSearchRecord,
} from "@/lib/palette/types";
import { KindPill, PalButton, PalEmpty, PalField, PalLabel, inputCls, selectCls, Modal } from "./kit";
import { PaletteCanvas, type CanvasSelection } from "./PaletteCanvas";
import { EdgeInspector, EntityInspector, RelationPicker } from "./PaletteInspector";
import { PaletteAiPanel, PaletteSearchPanel } from "./PaletteIntelligence";
import { PaletteComments, PaletteEvidenceBoard, PaletteInsights, PaletteNotes, PaletteSourceView, PaletteTableView, PaletteTimeline } from "./PaletteData";
import {
  PaletteCases, PaletteKnowledge, PaletteLibrary, PaletteReports, PaletteSettings, PaletteTemplates,
} from "./PaletteViews";
import {
  AddEntityModal, EvidenceModal, ExtractReviewModal, NewCaseModal, PaletteGlobalSearch, ShareModal,
  type ImportPayload, type NewCasePayload,
} from "./PaletteModals";
import { PaletteInputEngine, type IngestValue } from "./PaletteInputEngine";
import { cx } from "@/components/agency/kit";

export type PaletteView = "overview" | "cases" | "recent" | "shared" | "templates" | "library" | "knowledge" | "sources" | "ai" | "reports" | "settings";
export type WorkspaceTab = "canvas" | "ingest" | "table" | "timeline" | "evidence" | "insights" | "reports" | "notes" | "comments";

const WORKBENCH_VIEWS: PaletteView[] = ["overview", "cases", "recent", "shared", "templates", "library", "knowledge", "sources", "ai", "reports", "settings"];

const NAV: Array<{ key: PaletteView; label: string; icon: typeof LayoutDashboard; aliases?: PaletteView[] }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "cases", label: "Investigations", icon: FolderKanban, aliases: ["recent", "shared"] },
  { key: "templates", label: "Templates", icon: Library },
  { key: "library", label: "Entities", icon: Layers },
  { key: "sources", label: "Sources", icon: Radar },
  { key: "knowledge", label: "Knowledge Base", icon: FileSearch },
  { key: "reports", label: "Reports", icon: FileBarChart },
];

const WORKSPACE_TABS: Array<[WorkspaceTab, string]> = [
  ["canvas", "Canvas"], ["ingest", "Input"], ["table", "Table"], ["timeline", "Timeline"],
  ["evidence", "Evidence"], ["insights", "Analysis"], ["reports", "Reports"], ["notes", "Notes"], ["comments", "Comments"],
];

type Toast = { id: string; message: string; tone: "ok" | "warn" | "info" };

export function PaletteApp({
  initialCaseId, initialView = "overview", onNavigate,
}: {
  initialCaseId?: string;
  initialView?: PaletteView;
  onNavigate?: (state: { view: PaletteView; caseId?: string }) => void;
}) {
  const [view, setView] = useState<PaletteView>(initialCaseId ? "cases" : initialView);
  const [cases, setCases] = useState<PaletteCase[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(initialCaseId);
  const [active, setActive] = useState<PaletteCase | null>(null);
  const [prefs, setPrefs] = useState<PalettePrefs>(getPrefs());
  const [selection, setSelection] = useState<CanvasSelection>({});
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("canvas");
  const [rightTab, setRightTab] = useState<"ai" | "inspector" | "search" | "sources">("ai");
  const [rightOpen, setRightOpen] = useState(true);
  const [navOpen, setNavOpen] = useState(false);
  const [memories, setMemories] = useState(getMemory());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [saving, setSaving] = useState(false);
  const [newCaseOpen, setNewCaseOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState<string | undefined>();
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceNodeId, setEvidenceNodeId] = useState<string | undefined>();
  const [shareOpen, setShareOpen] = useState(false);
  const [globalOpen, setGlobalOpen] = useState(false);
  const [edgeDraft, setEdgeDraft] = useState<{ source: string; target: string } | null>(null);
  const [importPayload, setImportPayload] = useState<ImportPayload | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: "case" | "node" | "edge" | "group"; id: string; label: string } | null>(null);
  const activeRef = useRef<PaletteCase | null>(null);
  const history = useRef<Array<Pick<PaletteCase, "nodes" | "edges" | "groups">>>([]);
  const future = useRef<Array<Pick<PaletteCase, "nodes" | "edges" | "groups">>>([]);
  const [, forceHistory] = useState(0);
  const clipboard = useRef<PaletteNode | null>(null);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = uid("toast");
    setToasts((prev) => [...prev.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  /* ------------------------------ boot & sync ------------------------------ */

  useEffect(() => {
    ensureSeedKnowledge();
    setCases(listAllVisibleCases());
    // Keep the server-rendered layout stable and collapse the intelligence
    // panel only after hydration on narrow viewports.
    if (window.innerWidth < 1024) setRightOpen(false);
    return subscribePalette(() => setCases(listAllVisibleCases()));
  }, []);

  useEffect(() => {
    // Deep link only. When the paletted URL is updated by an in-progress ingest,
    // the case is already active and the Input Engine must not be unmounted.
    if (!initialCaseId || activeRef.current?.id === initialCaseId) return;
    const c = getCase(initialCaseId);
    if (c) { setActive(c); activeRef.current = c; setActiveId(c.id); setView("cases"); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaseId]);

  useEffect(() => {
    if (!activeId) { setActive(null); activeRef.current = null; return; }
    const c = getCase(activeId);
    if (c) { setActive(c); activeRef.current = c; }
  }, [activeId]);

  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    if (!active || readOnly) return;
    const timer = setTimeout(() => {
      const saved = saveCase({ ...active, viewport: active.viewport }, false);
      activeRef.current = saved;
      setCases(listAllVisibleCases());
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.viewport.x, active?.viewport.y, active?.viewport.zoom, active?.id]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("share") : null;
    if (!token) return;
    const shared = decodeShare(token);
    if (!shared) return;
    const imported = importSharedCase(shared);
    setCases(listAllVisibleCases());
    setActiveId(imported.id);
    setView("cases");
    toast("Snapshot read-only importado para Shared Cases.", "ok");
    const url = new URL(window.location.href);
    url.searchParams.delete("share");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { onNavigate?.({ view, caseId: activeId }); }, [view, activeId, onNavigate]);

  const readOnly = active ? Boolean(active.shared?.readOnly || isReadOnly(active.id)) : true;
  const caseMemories = active ? memories.perCase[active.id] ?? [] : [];
  const memoryNote = caseMemories.map((m) => m.body).join("\n");

  /* -------------------------------- mutations ------------------------------ */

  const pushHistory = (c: PaletteCase) => {
    history.current = [...history.current.slice(-39), { nodes: structuredClone(c.nodes), edges: structuredClone(c.edges), groups: structuredClone(c.groups) }];
    future.current = [];
    forceHistory((n) => n + 1);
  };

  const apply = (fn: (c: PaletteCase) => PaletteCase, opts: { history?: boolean; log?: string } = {}) => {
    const cur = activeRef.current;
    if (!cur) return;
    if (opts.history && !readOnly) pushHistory(cur);
    let next = fn(cur);
    if (opts.log) next = appendTimeline(next, timelineEntry("canvas", opts.log));
    if (!readOnly) {
      setSaving(true);
      next = saveCase(next);
      setTimeout(() => setSaving(false), 350);
    }
    activeRef.current = next;
    setActive(next);
    setCases(listAllVisibleCases());
  };

  const patch = (p: Partial<PaletteCase>, opts: { history?: boolean; log?: string } = {}) => apply((c) => ({ ...c, ...p }), opts);

  const undo = () => {
    const cur = activeRef.current;
    if (!cur || !history.current.length) return;
    future.current = [...future.current, { nodes: structuredClone(cur.nodes), edges: structuredClone(cur.edges), groups: structuredClone(cur.groups) }];
    const prev = history.current.pop()!;
    const next = saveCase({ ...cur, ...prev });
    activeRef.current = next; setActive(next); setCases(listAllVisibleCases()); forceHistory((n) => n + 1);
    toast("Alteração desfeita.", "info");
  };
  const redo = () => {
    const cur = activeRef.current;
    if (!cur || !future.current.length) return;
    history.current = [...history.current, { nodes: structuredClone(cur.nodes), edges: structuredClone(cur.edges), groups: structuredClone(cur.groups) }];
    const nextState = future.current.pop()!;
    const next = saveCase({ ...cur, ...nextState });
    activeRef.current = next; setActive(next); setCases(listAllVisibleCases()); forceHistory((n) => n + 1);
    toast("Alteração refeita.", "info");
  };

  /* --------------------------------- cases --------------------------------- */

  const goView = (key: PaletteView) => {
    setView(key);
    setNavOpen(false);
    // "Investigations" always means the list, even with a case open.
    if (key === "cases" && activeRef.current) {
      setActive(null);
      activeRef.current = null;
      setActiveId(undefined);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("case");
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  const openCase = (id: string) => {
    const c = getCase(id);
    if (!c) { toast("Caso não encontrado.", "warn"); return; }
    activeRef.current = c;
    setActiveId(id); setActive(c); setView("cases"); setSelection({}); setWorkspaceTab("canvas");
    history.current = []; future.current = [];
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("case", id);
      url.searchParams.delete("view");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const handleNewCase = (p: NewCasePayload) => {
    const c = createCase({
      title: p.title, description: p.description, objective: p.objective,
      priority: p.priority, templateId: p.templateId, tags: p.tags,
      plan: planFromTemplate(p.templateId),
    });
    let next = c;
    if (p.seedKind && p.seedValue) {
      next = appendTimeline({
        ...next,
        nodes: [{
          id: uid("node"), kind: p.seedKind, title: p.seedValue,
          subtitle: "Semente da investigação", description: "",
          identifiers: [], properties: {}, tags: [], confidence: "unverified", sources: [], evidenceIds: [],
          x: 260, y: 220, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
      }, timelineEntry("entity", "Entidade semente adicionada", `${NODE_KIND_LABEL[p.seedKind]}: ${p.seedValue}`));
      next = saveCase(next);
    }
    setCases(listAllVisibleCases());
    setNewCaseOpen(false);
    activeRef.current = next;
    setActiveId(next.id); setActive(next); setView("cases"); setWorkspaceTab("canvas");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("case", next.id);
      window.history.replaceState({}, "", url.toString());
    }
    toast(`Investigação ${next.code} criada.`, "ok");
  };

  const removeCase = (id: string) => {
    const c = getCase(id);
    if (!c) return;
    setDeleteConfirm({ kind: "case", id, label: `${c.code} — ${c.title}` });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.kind === "case") {
      deleteCase(deleteConfirm.id);
      if (activeId === deleteConfirm.id) { setActive(null); setActiveId(undefined); setView("cases"); }
      setCases(listAllVisibleCases());
      toast("Caso excluído.", "ok");
    } else if (deleteConfirm.kind === "node") {
      const id = deleteConfirm.id;
      patch({ nodes: active?.nodes.filter((n) => n.id !== id) ?? [], edges: active?.edges.filter((e) => e.source !== id && e.target !== id) ?? [] }, { history: true, log: `Entidade removida: ${deleteConfirm.label}` });
      setSelection({}); toast("Entidade removida.", "ok");
    } else if (deleteConfirm.kind === "edge") {
      patch({ edges: active?.edges.filter((e) => e.id !== deleteConfirm.id) ?? [] }, { history: true, log: "Relação removida" });
      setSelection({}); toast("Relação removida.", "ok");
    } else {
      const id = deleteConfirm.id;
      patch({ groups: active?.groups.filter((g) => g.id !== id) ?? [], nodes: active?.nodes.map((n) => (n.groupId === id ? { ...n, groupId: undefined } : n)) ?? [] }, { history: true, log: "Grupo removido" });
      toast("Grupo removido.", "ok");
    }
    setDeleteConfirm(null);
  };

  const exportGraphMl = (c: PaletteCase) => {
    const blob = new Blob([reportToGraphMl(c)], { type: "application/graphml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.code}-graph.graphml`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast("GraphML exportado.", "ok");
  };

  /* -------------------------------- entities ------------------------------- */

  const addNodes = (values: Array<{ kind: PaletteNodeKind; title: string; description: string; confidence: ConfidenceLevel; source: string; groupId?: string; tags: string[]; subtitle?: string }>, near?: { x: number; y: number }, quiet = false) => {
    if (!activeRef.current) return;
    if (readOnly) { toast("Caso read-only. Duplique para editar.", "warn"); return; }
    const now = new Date().toISOString();
    const current = activeRef.current;
    let merged = 0;
    const created: PaletteNode[] = [];
    const nextNodes = [...current.nodes];
    values.forEach((v) => {
      const value = v.title.trim();
      if (!value) return;
      const norm = normalizeEntityValue(v.kind, value);
      const existing = nextNodes.find((n) => n.kind === v.kind && normalizeEntityValue(n.kind, n.title) === norm);
      if (existing) {
        merged += 1;
        const idx = nextNodes.findIndex((n) => n.id === existing.id);
        nextNodes[idx] = {
          ...existing,
          sources: [...new Set([...existing.sources, v.source].filter(Boolean))],
          tags: [...new Set([...existing.tags, ...v.tags])],
          subtitle: existing.subtitle || v.subtitle,
          updatedAt: now,
        };
        return;
      }
      const base = near ?? { x: 200 + (current.nodes.length % 4) * 230, y: 180 + Math.floor(current.nodes.length / 4) * 140 };
      created.push({
        id: uid("node"), kind: v.kind, title: value, subtitle: v.subtitle,
        description: v.description, identifiers: [], properties: {}, tags: v.tags,
        confidence: v.confidence, sources: v.source ? [v.source] : [], evidenceIds: [],
        groupId: v.groupId,
        x: base.x + (created.length % 3) * 60, y: base.y + created.length * 80,
        createdAt: now, updatedAt: now,
      });
    });
    patch({ nodes: [...nextNodes, ...created] }, {
      history: true,
      log: `${created.length} entidade(s) adicionada(s)${merged ? ` · ${merged} consolidada(s)` : ""}`,
    });
    if (!quiet) toast(`${created.length} entidade(s) adicionada(s)${merged ? `, ${merged} já existia(m) e foi(ram) consolidada(s)` : ""}.`, merged && !created.length ? "info" : "ok");
  };

  const updateNode = (node: PaletteNode) => {
    const cur = activeRef.current;
    if (!cur || readOnly) return;
    patch({ nodes: cur.nodes.map((n) => (n.id === node.id ? node : n)) });
  };

  const updateEdge = (edge: PaletteCase["edges"][number]) => {
    const cur = activeRef.current;
    if (!cur || readOnly) return;
    patch({ edges: cur.edges.map((e) => (e.id === edge.id ? edge : e)) });
  };

  const createEdge = (input: Omit<PaletteCase["edges"][number], "id">) => {
    const cur = activeRef.current;
    if (!cur || readOnly) return;
    const edge = { ...input, id: uid("edge") };
    patch({ edges: [...cur.edges, edge] }, { history: true, log: `Relação criada: ${input.relation}` });
    setSelection({ edgeId: edge.id });
    setRightTab("inspector"); setRightOpen(true);
    setEdgeDraft(null);
    toast("Relação criada.", "ok");
  };

  const startConnection = () => {
    const cur = activeRef.current;
    if (!cur || !selection.nodeId) return;
    const target = cur.nodes.find((n) => n.id !== selection.nodeId);
    if (!target) { toast("Adicione outra entidade para conectar.", "warn"); return; }
    setEdgeDraft({ source: selection.nodeId, target: target.id });
    toast("Escolha a entidade de destino na janela de relação.", "info");
  };

  const addEvidence = (e: ReturnType<typeof newEvidence>) => {
    const cur = activeRef.current;
    if (!cur || readOnly) return;
    const changed = cur.nodes.map((n) => (e.nodeIds.includes(n.id) ? { ...n, evidenceIds: [...new Set([...n.evidenceIds, e.id])] } : n));
    patch({ evidence: [e, ...cur.evidence], nodes: changed }, { history: true, log: `Evidência registrada: ${e.title}` });
    toast("Evidência registrada.", "ok");
  };

  const deleteEvidence = (id: string) => {
    const cur = activeRef.current;
    if (!cur || readOnly) return;
    patch({
      evidence: cur.evidence.filter((e) => e.id !== id),
      nodes: cur.nodes.map((n) => ({ ...n, evidenceIds: n.evidenceIds.filter((x) => x !== id) })),
    }, { history: true, log: "Evidência removida" });
    toast("Evidência removida.", "ok");
  };

  /* ------------------------------ input engine ----------------------------- */

  const handleIngest = (values: IngestValue[], meta: { depth: InvestigationDepth; investigate: boolean }): { caseId?: string } => {
    if (readOnly && active) { toast("Caso read-only. Duplique o caso para editar.", "warn"); return {}; }
    let caseId: string | undefined;
    let cur = activeRef.current;
    if (!cur) {
      const primary = values[0];
      const title = primary ? `Investigação ${primary.value}` : `Investigação ${new Date().toISOString().slice(0, 10)}`;
      const created = createCase({
        title: title.slice(0, 90),
        description: "Caso criado pelo Life Intelligence Input Engine.",
        objective: "",
        tags: [...new Set(values.map((v) => v.kind))].slice(0, 6),
        plan: [],
      });
      cur = created;
      caseId = created.id;
      activeRef.current = created;
      setActiveId(created.id);
      setActive(created);
      // Deliberately stay on the current surface: the Input Engine owns the
      // progress UI until the run finishes (unmounting it would abort the queue).
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("case", created.id);
        window.history.replaceState({}, "", url.toString());
      }
    }

    const now = new Date().toISOString();
    const nodes: PaletteNode[] = [...cur.nodes];
    const edges = [...cur.edges];
    const createdNodes: PaletteNode[] = [];
    const idByCandidate = new Map<string, string>();
    const primary = values[0];

    values.forEach((value, index) => {
      const norm = normalizeEntityValue(value.kind, value.value);
      const key = `${value.kind}:${norm.toLowerCase()}`;
      const existing = nodes.find((n) => n.kind === value.kind && normalizeEntityValue(n.kind, n.title).toLowerCase() === norm.toLowerCase());
      if (existing) {
        existing.sources = [...new Set([...existing.sources, "Input Engine"])];
        existing.updatedAt = now;
        idByCandidate.set(key, existing.id);
        return;
      }
      // Deterministic investigation layout: primary in the centre, identifiers
      // derived from it on the left, the remaining findings on the right.
      const ring = index === 0 ? 0 : Math.ceil(index / 5);
      const slot = index === 0 ? 0 : (index - 1) % 5;
      const angle = (slot / 5) * Math.PI * 2 + ring * 0.35;
      const x = index === 0 ? 320 : 320 + Math.cos(angle) * (300 + (ring - 1) * 260) - (value.kind === "domain" ? -120 : 0);
      const y = index === 0 ? 240 : 240 + Math.sin(angle) * (220 + (ring - 1) * 200);
      const node: PaletteNode = {
        id: uid("node"),
        kind: value.kind,
        title: value.value,
        subtitle: value.context.slice(0, 90),
        description: value.derivedFromValue ? `Derivado de ${value.derivedFromValue} (${value.derivedRelation}).` : "",
        identifiers: [],
        properties: {},
        tags: ["input-engine", ...(value.score < 60 ? ["revisar"] : [])],
        confidence: value.score >= 80 ? "high" : value.score >= 60 ? "medium" : "low",
        sources: ["Input Engine"],
        evidenceIds: [],
        classification: {
          score: value.score,
          status: value.score >= 80 ? "confirmed" : value.score >= 60 ? "probable" : "ambiguous",
          context: value.context,
          alternates: value.alternates,
        },
        x, y,
        createdAt: now, updatedAt: now,
      };
      nodes.push(node);
      createdNodes.push(node);
      idByCandidate.set(key, node.id);
    });

    // Structural relations declared by the parser (email → domain, URL → host).
    for (const value of values) {
      if (!value.derivedFromValue || !value.derivedRelation) continue;
      const targetId = idByCandidate.get(`${value.kind}:${normalizeEntityValue(value.kind, value.value).toLowerCase()}`);
      const parentKind = values.find((v) => v.value === value.derivedFromValue)?.kind;
      const parentId = parentKind
        ? idByCandidate.get(`${parentKind}:${normalizeEntityValue(parentKind, value.derivedFromValue).toLowerCase()}`)
        : undefined;
      if (!targetId || !parentId || targetId === parentId) continue;
      if (edges.some((e) => e.source === parentId && e.target === targetId && e.relation === value.derivedRelation)) continue;
      edges.push({
        id: uid("edge"), source: parentId, target: targetId, relation: value.derivedRelation!,
        description: `Relação estrutural derivada do identificador ${value.derivedFromValue}.`,
        sourceLabel: "Input Engine", confidence: "high", discoveredAt: now,
        style: "solid", directed: true, notes: "", evidenceIds: [], origin: "source",
      });
    }

    const next = appendTimeline(
      { ...cur, nodes, edges, plan: meta.investigate ? [...cur.plan] : cur.plan },
      timelineEntry("entity", "Entrada analisada", `${createdNodes.length} nova(s) entidade(s) · profundidade ${DEPTH_META[meta.depth].short}${meta.investigate ? " · pesquisa autorizada" : " · sem pesquisa"}`),
    );
    const saved = saveCase(next);
    activeRef.current = saved;
    setActive(saved);
    setCases(listAllVisibleCases());
    return { caseId };
  };

  const handleSearchResults = (outcomes: SearchOutcome[], meta: { depth: InvestigationDepth; values: IngestValue[]; durationMs: number }) => {
    if (!activeRef.current) return;
    const now = new Date().toISOString();
    const records: PaletteSearchRecord[] = outcomes.map((o) => ({
      id: uid("search"),
      at: now,
      tool: o.sourceId,
      source: o.sourceName,
      query: o.query ?? meta.values[0]?.value ?? "",
      queryKind: "input-engine",
      status: o.ok ? (o.resultCount > 0 ? "ok" : "empty") : "error",
      summary: o.summary,
      resultCount: o.resultCount,
      durationMs: o.durationMs,
      error: o.error,
    }));
    // Records do not keep raw payloads (localStorage budget); evidence is archived on review.
    const values = meta.values.map((v) => v.value).slice(0, 5).join(", ");
    const failures = outcomes.filter((o) => !o.ok).length;
    apply((prev) => appendTimeline(
      { ...prev, searches: [...records, ...prev.searches] },
      timelineEntry("search", `Input Engine · ${outcomes.length} consultas`, `${values}${failures ? ` · ${failures} falha(s)` : ""} · ${meta.durationMs} ms`),
    ));
  };

  /* ------------------------------ AI / search ------------------------------ */

  const handleRecord = (r: PaletteSearchRecord) => {
    if (!activeRef.current) return;
    const clean: PaletteSearchRecord = { ...r, id: r.id || uid("search"), data: undefined };
    apply((prev) => appendTimeline(
      { ...prev, searches: [clean, ...prev.searches] },
      timelineEntry("search", `Consulta: ${clean.source}`, `${clean.query} — ${clean.status}${clean.error ? `: ${clean.error}` : ""}`),
    ));
  };

  const openImport = (query: string, nodeId: string | undefined, outcomes: SearchOutcome[]) => {
    setImportPayload({ query, nodeId, outcomes: outcomes.map((o) => ({ sourceId: o.sourceId, sourceName: o.sourceName, ok: o.ok, data: o.data })) });
  };

  const confirmImport = async (
    values: Array<{ candidate: { kind: PaletteNodeKind; value: string; source: string; confidence: ConfidenceLevel; label?: string } }>,
    opts: { relation: string; confidence: ConfidenceLevel; linkToQuery: boolean; archiveEvidence: boolean },
  ) => {
    if (!active || !importPayload || readOnly) return;
    const now = new Date().toISOString();
    const nodes = [...active.nodes];
    const edges = [...active.edges];
    const evidence = [...active.evidence];
    const nodeIdsForEvidence: string[] = [];
    let created = 0;
    let merged = 0;
    const sourceNames = [...new Set(importPayload.outcomes.filter((o) => o.ok).map((o) => o.sourceName))];
    const sourceName = sourceNames.join(", ") || "Consulta em fonte pública";

    const anchor = importPayload.nodeId ? nodes.find((n) => n.id === importPayload.nodeId) : undefined;
    const origin = anchor ? { x: anchor.x, y: anchor.y } : { x: 320, y: 260 };
    for (const [i, { candidate }] of values.entries()) {
      const norm = normalizeEntityValue(candidate.kind, candidate.value);
      const existing = nodes.find((n) => n.kind === candidate.kind && normalizeEntityValue(n.kind, n.title) === norm);
      let nodeId: string;
      if (existing) {
        merged += 1;
        nodeId = existing.id;
        // Attribute only the source that actually returned this candidate, not
        // every source that ran for the query.
        const attributed = candidate.source || sourceName;
        if (!existing.sources.includes(attributed)) existing.sources = [...existing.sources, attributed];
        existing.updatedAt = now;
        nodeIdsForEvidence.push(existing.id);
      } else {
        const node: PaletteNode = {
          id: uid("node"), kind: candidate.kind, title: candidate.value,
          description: candidate.label ? `Extraído de ${candidate.label}` : "",
          identifiers: [], properties: {}, tags: ["importado"],
          confidence: opts.confidence, sources: [candidate.source || sourceName], evidenceIds: [],
          x: origin.x + 240 + (i % 4) * 60, y: origin.y + Math.floor(i / 4) * 120 + (i % 4) * 24,
          createdAt: now, updatedAt: now,
        };
        nodes.push(node);
        created += 1;
        nodeId = node.id;
        nodeIdsForEvidence.push(node.id);
      }
      if (opts.linkToQuery && anchor && nodeId !== anchor.id && !edges.some((e) => (e.source === anchor.id && e.target === nodeId && e.relation === opts.relation) || (e.source === nodeId && e.target === anchor.id))) {
        edges.push({
          id: uid("edge"), source: anchor.id, target: nodeId, relation: opts.relation || relationForSource(sourceName),
          description: `Derivada da consulta ${importPayload.query} em ${sourceName}.`,
          sourceLabel: sourceName, confidence: opts.confidence,
          discoveredAt: now, style: opts.confidence === "verified" || opts.confidence === "high" ? "solid" : opts.confidence === "medium" ? "dashed" : "dotted",
          directed: true, notes: "", evidenceIds: [], origin: "source",
        });
      }
    }

    if (opts.archiveEvidence) {
      for (const o of importPayload.outcomes.filter((x) => x.ok && x.data)) {
        const payload = JSON.stringify(o.data);
        const ev = newEvidence({
          title: `Payload ${o.sourceName} — ${importPayload.query}`,
          description: `Resposta bruta da consulta ${importPayload.query}.`,
          kind: "text",
          content: payload.slice(0, 180_000),
          source: o.sourceName,
          nodeIds: nodeIdsForEvidence,
        });
        ev.sha256 = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload)).then((buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""));
        evidence.unshift(ev);
        for (const node of nodes) if (nodeIdsForEvidence.includes(node.id)) node.evidenceIds = [...new Set([...node.evidenceIds, ev.id])];
      }
    }

    const next = appendTimeline(
      { ...active, nodes, edges, evidence },
      timelineEntry("entity", "Importação revisada", `${created} nova(s), ${merged} consolidada(s)${opts.archiveEvidence ? " · payload arquivado" : ""}`, importPayload.nodeId),
    );
    const saved = saveCase(next);
    activeRef.current = saved;
    setActive(saved); setCases(listAllVisibleCases());
    setImportPayload(null);
    toast(`Importação concluída: ${created} nova(s), ${merged} consolidada(s).`, "ok");
  };

  const runAiAction = async (action: AiAction) => {
    if (!active) return;
    if (action.type === "run_search") {
      const outcome = await runSource(action.tool, action.value);
      handleRecord({
        id: uid("search"), at: new Date().toISOString(), tool: action.tool, source: outcome.sourceName,
        query: action.value, queryKind: "ai", status: outcome.ok ? (outcome.resultCount ? "ok" : "empty") : "error",
        summary: outcome.summary, resultCount: outcome.resultCount, durationMs: outcome.durationMs, error: outcome.error, data: outcome.data,
      });
      if (outcome.ok) {
        setRightTab("search"); setRightOpen(true);
        const anchor = activeRef.current?.nodes.find((n) => n.title.toLowerCase() === action.value.trim().toLowerCase());
        openImport(action.value, anchor?.id, [outcome]);
        toast(`${outcome.sourceName} respondeu. Revise as entidades extraídas.`, "ok");
      } else toast(`${outcome.sourceName}: ${outcome.error}`, "warn");
      return;
    }
    if (action.type === "create_note" || action.type === "summarize") {
      const body = action.type === "create_note" ? action.body : executiveSummary(active);
      patch({
        notes: [{ id: uid("note"), at: new Date().toISOString(), author: prefs.analystName, body }, ...active.notes],
        timeline: [timelineEntry("ai", action.type === "create_note" ? "Nota criada pela IA" : "Resumo executivo gerado"), ...active.timeline],
      }, { history: true });
      setWorkspaceTab("notes");
      toast("Nota registrada no caso.", "ok");
      return;
    }
    if (action.type === "add_node") {
      addNodes([{ kind: action.kind, title: action.value, description: action.reason, confidence: action.confidence, source: "Life AI", tags: ["ai"] }]);
      return;
    }
    if (action.type === "create_edge") {
      const from = active.nodes.find((n) => n.id === action.from);
      const to = active.nodes.find((n) => n.id === action.to);
      if (!from || !to) { toast("Entidades não encontradas no caso.", "warn"); return; }
      createEdge({
        source: action.from, target: action.to, relation: action.relation, description: action.reason,
        sourceLabel: "Sugestão Life AI", confidence: action.confidence, discoveredAt: new Date().toISOString(),
        style: action.confidence === "verified" ? "solid" : "dotted", directed: true, notes: action.reason,
        evidenceIds: [], origin: "ai",
      });
      return;
    }
    if (action.type === "create_group") {
      const ids = action.nodeIds.filter((id) => active.nodes.some((n) => n.id === id));
      if (!ids.length) { toast("Nenhuma entidade válida para agrupar.", "warn"); return; }
      const members = active.nodes.filter((n) => ids.includes(n.id));
      const minX = Math.min(...members.map((n) => n.x)) - 30;
      const minY = Math.min(...members.map((n) => n.y)) - 50;
      const maxX = Math.max(...members.map((n) => n.x)) + 240;
      const maxY = Math.max(...members.map((n) => n.y)) + 160;
      const group: PaletteGroup = { id: uid("group"), title: action.title, color: "#22d3ee", x: minX, y: minY, width: maxX - minX, height: maxY - minY, collapsed: false };
      patch({ groups: [...active.groups, group], nodes: active.nodes.map((n) => (ids.includes(n.id) ? { ...n, groupId: group.id } : n)) }, { history: true, log: `Grupo criado: ${action.title}` });
      toast("Grupo criado.", "ok");
    }
  };

  const saveMemoryNote = (note: string) => {
    if (!active) return;
    const next = { ...memories, perCase: { ...memories.perCase, [active.id]: note.trim() ? [{ id: uid("mem"), at: new Date().toISOString(), body: note.trim() }] : [] } };
    setMemories(next); saveMemory(next); toast("Memória da investigação atualizada.", "ok");
  };

  const runSearchFromPanel = (tool: string, value: string) => {
    setRightTab("search"); setRightOpen(true);
    void runAiAction({ type: "run_search", tool, value, reason: "Execução manual" });
  };

  const handleSuggestion = (text: string, nodeId?: string, tool?: string) => {
    if (!active) return;
    if (tool) {
      const node = active.nodes.find((n) => n.id === nodeId);
      if (node) void runAiAction({ type: "run_search", tool, value: node.title, reason: text });
      return;
    }
    if (nodeId) {
      setSelection({ nodeId }); setRightTab("inspector"); setRightOpen(true);
      setWorkspaceTab("canvas");
      return;
    }
    toast(text, "info");
  };

  const handleMerge = (group: DuplicateGroup) => {
    if (!active || readOnly) return;
    const keep = group.nodes[0];
    const drops = group.nodes.slice(1).map((n) => n.id);
    const merged = mergeNodes(active, keep.id, drops);
    const saved = saveCase(merged);
    activeRef.current = saved;
    setActive(saved); setCases(listAllVisibleCases());
    toast(`Duplicatas consolidadas em “${keep.title}”.`, "ok");
  };

  /* -------------------------------- sharing -------------------------------- */

  const importSharedFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { kind?: string; case?: PaletteCase } | PaletteCase;
      const c = "case" in parsed && parsed.case ? parsed.case : parsed as PaletteCase;
      if (!c?.id || !c.nodes) throw new Error("Arquivo não é um caso Life Palette válido.");
      importSharedCase({ ...c, shared: { readOnly: true, importedFrom: new Date().toISOString() } });
      setCases(listAllVisibleCases());
      toast("Snapshot importado em Shared Cases.", "ok");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao importar arquivo.", "warn");
    }
  };

  /* -------------------------------- keyboard ------------------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setGlobalOpen(true); return; }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "n") { e.preventDefault(); if (active && !readOnly) setAddEntityOpen(true); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); if (active && !readOnly) { saveCase(active); toast("Caso salvo.", "ok"); } return; }
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && e.key.toLowerCase() === "c" && selection.nodeId) {
        const n = active?.nodes.find((x) => x.id === selection.nodeId);
        if (n) { clipboard.current = structuredClone(n); toast("Entidade copiada.", "info"); }
        return;
      }
      if (mod && e.key.toLowerCase() === "v" && clipboard.current && active && !readOnly) {
        const src = clipboard.current;
        addNodes([{ kind: src.kind, title: src.title, description: src.description, confidence: src.confidence, source: src.sources[0] ?? "Inserção manual", tags: src.tags }]);
        toast("Entidade colada (duplicata consolidada se igual).", "info");
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && active && !readOnly) {
        if (selection.nodeId) {
          const n = active.nodes.find((x) => x.id === selection.nodeId);
          if (n) { e.preventDefault(); setDeleteConfirm({ kind: "node", id: n.id, label: n.title }); }
        } else if (selection.edgeId) {
          const edge = active.edges.find((x) => x.id === selection.edgeId);
          if (edge) { e.preventDefault(); setDeleteConfirm({ kind: "edge", id: edge.id, label: edge.relation }); }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, selection, readOnly, undo, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------------- render -------------------------------- */

  const stats = active ? caseStats(active) : null;
  const selectedNode = active?.nodes.find((n) => n.id === selection.nodeId) ?? null;
  const selectedEdge = active?.edges.find((e) => e.id === selection.edgeId) ?? null;
  const regularCases = cases.filter((c) => !c.shared?.readOnly);
  const sharedCases = cases.filter((c) => c.shared?.readOnly);
  const recentCases = [...regularCases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const listMode: "cases" | "recent" | "shared" = view === "recent" || view === "shared" ? view : "cases";

  const selectNode = (caseId: string, nodeId: string) => {
    if (caseId !== active?.id) openCase(caseId);
    setTimeout(() => { setSelection({ nodeId }); setRightTab("inspector"); setRightOpen(true); setWorkspaceTab("canvas"); }, 40);
  };

  const exportJson = (c: PaletteCase) => {
    const blob = new Blob([exportCaseJson(c)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${c.code}-palette.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast("Caso exportado.", "ok");
  };

  return (
    <div className="palette-root -mx-4 -my-4 flex h-[calc(100dvh-62px)] min-h-[560px] flex-col overflow-hidden bg-[#050a0f] text-[#c6d6e6] md:-mx-6 md:-my-6">
      {/* ------------------------------ top bar ------------------------------ */}
      <header className="flex flex-none flex-wrap items-center gap-1.5 border-b border-[#131e29] bg-[#060c12] px-2 py-1.5 sm:px-3">
        <button onClick={() => setNavOpen((v) => !v)} className="rounded p-1 text-[#7f94a9] hover:bg-white/5 md:hidden" aria-label="Abrir navegação">
          <Menu className="h-4 w-4" />
        </button>
        <button onClick={() => { setView("overview"); setNavOpen(false); }} className="flex items-center gap-1.5" title="Life Palette 2.0">
          <span className="relative flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
            <Layers className="h-3.5 w-3.5 text-cyan-200" />
          </span>
          <span className="hidden text-[12px] font-semibold tracking-tight text-[#eaf3fb] sm:inline">Life Palette</span>
          <span className="rounded border border-cyan-400/30 px-1 text-[7.5px] font-semibold uppercase tracking-wide text-cyan-300">2.0</span>
        </button>

        <nav className="ml-1 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.key || Boolean(item.aliases?.includes(view));
            return (
              <button key={item.key} onClick={() => goView(item.key)}
                className={cx("flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] transition-colors", isActive ? "bg-cyan-400/10 text-cyan-100" : "text-[#8ba1b6] hover:bg-white/[0.04] hover:text-[#d8e5f1]")}>
                <Icon className={cx("h-3 w-3", isActive ? "text-cyan-300" : "text-[#5c748a]")} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setGlobalOpen(true)} title="Busca global (Ctrl+K)" className="palette-top-icon"><Search className="h-3.5 w-3.5" /></button>
          <button onClick={() => setView("ai")} title="AI Assistant" className={cx("palette-top-icon", view === "ai" && "!text-violet-300")}><Bot className="h-3.5 w-3.5" /></button>
          <button onClick={() => setView("settings")} title="Settings" className={cx("palette-top-icon", view === "settings" && "!text-cyan-300")}><Settings2 className="h-3.5 w-3.5" /></button>
          <PalButton size="sm" variant="primary" onClick={() => { setNewTemplate(undefined); setNewCaseOpen(true); }}>
            <Plus className="h-3 w-3" /> <span className="hidden sm:inline">Nova investigação</span><span className="sm:hidden">Novo</span>
          </PalButton>
        </div>
      </header>

      {navOpen && (
        <nav className="grid flex-none grid-cols-2 gap-1 border-b border-[#131e29] bg-[#070e15] p-2 sm:grid-cols-4 md:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.key || Boolean(item.aliases?.includes(view));
            return (
              <button key={item.key} onClick={() => goView(item.key)}
                className={cx("flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px]", isActive ? "bg-cyan-400/10 text-cyan-100" : "text-[#8ba1b6] hover:bg-white/[0.04]")}>
                <Icon className="h-3.5 w-3.5" /> {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* ----------------------------- case bar ----------------------------- */}
      {active && (
        <div className="flex flex-none flex-wrap items-center gap-1.5 border-b border-[#131e29] bg-[#070d14] px-2 py-1.5 sm:px-3">
          <button onClick={() => { setActive(null); setActiveId(undefined); setView("cases"); if (typeof window !== "undefined") { const u = new URL(window.location.href); u.searchParams.delete("case"); window.history.replaceState({}, "", u.toString()); } }}
            className="rounded p-1 text-[#7f94a9] hover:bg-white/5" title="Fechar caso"><ChevronLeft className="h-4 w-4" /></button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[8.5px] text-cyan-400/80">
              <span className="font-mono">{active.code}</span>
              {readOnly && <span className="rounded border border-amber-400/40 px-1 text-[7.5px] text-amber-300">read-only</span>}
            </div>
            <input value={active.title} disabled={readOnly} onChange={(e) => patch({ title: e.target.value })}
              className="w-[180px] max-w-[46vw] truncate bg-transparent text-[12.5px] font-semibold text-[#eaf3fb] outline-none focus:border-b focus:border-cyan-400/40 sm:w-[300px]" />
          </div>
          <select value={active.status} disabled={readOnly} onChange={(e) => patch({ status: e.target.value as CaseStatus })}
            className="rounded border border-[#1e2c3a] bg-[#0a1118] px-1.5 py-0.5 text-[9px] text-[#a5b9cc]">
            {(Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((s) => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
          </select>
          <select value={active.priority} disabled={readOnly} onChange={(e) => patch({ priority: e.target.value as PaletteCase["priority"] })}
            className="hidden rounded border border-[#1e2c3a] bg-[#0a1118] px-1.5 py-0.5 text-[9px] text-[#a5b9cc] sm:block">
            {["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <span className="hidden items-center gap-1 text-[8.5px] text-[#5c748a] md:flex">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-400/70" />} {saving ? "salvando" : "salvo local"}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setShareOpen(true)} title="Compartilhar snapshot" className="palette-top-icon"><Share2 className="h-3.5 w-3.5" /></button>
            <button onClick={() => exportGraphMl(active)} title="Exportar GraphML" className="palette-top-icon"><Share2 className="hidden h-3.5 w-3.5 rotate-90" /><FileBarChart className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setWorkspaceTab("ingest"); setRightOpen(false); }} title="Nova entrada inteligente" className="palette-top-icon"><Wand2 className="h-3.5 w-3.5" /></button>
            <button onClick={() => setRightOpen((v) => !v)} title="Painel de inteligência" className={cx("palette-top-icon", rightOpen && "!text-cyan-300")}><Bot className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}

      {/* ------------------------------ content ------------------------------ */}
      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden">
          {active && view === "cases" ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex flex-none flex-wrap items-center gap-x-0.5 border-b border-[#131e29] px-1.5">
                {WORKSPACE_TABS.map(([key, label]) => (
                  <button key={key} onClick={() => setWorkspaceTab(key)}
                    className={cx("relative whitespace-nowrap px-1.5 py-1.5 text-[9.5px] transition-colors", workspaceTab === key ? "text-cyan-200" : "text-[#71879c] hover:text-[#c6d6e6]")}>
                    {label}
                    {workspaceTab === key && <span className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-cyan-400/70" />}
                  </button>
                ))}
                <span className="ml-auto hidden flex-none pr-2 text-[8.5px] text-[#4f6377] sm:inline">
                  {stats?.nodes} entidades · {stats?.edges} relações · {stats?.evidence} evidências
                </span>
              </div>

              {active.plan.length > 0 && workspaceTab === "canvas" && (
                <div className="flex flex-none flex-wrap items-center gap-1 border-b border-[#111c27] bg-[#070d14] px-2 py-1">
                  <span className="text-[8px] uppercase tracking-wide text-[#5c748a]">plano</span>
                  {active.plan.map((s) => (
                    <button key={s.id} disabled={readOnly} onClick={() => patch({ plan: active.plan.map((p) => (p.id === s.id ? { ...p, done: !p.done } : p)) }, { log: `${s.done ? "Reaberta" : "Concluída"} etapa: ${s.label}` })}
                      title={s.hint} className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8.5px]", s.done ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[#243546] text-[#8399ae] hover:border-cyan-400/40")}>
                      {s.done ? <Check className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full border border-current" />} {s.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="min-h-0 flex-1">
                {workspaceTab === "canvas" && (
                  <PaletteCanvas
                    data={active} prefs={prefs} readOnly={readOnly} selection={selection}
                    canUndo={history.current.length > 0} canRedo={future.current.length > 0}
                    onChange={(p, opts) => patch(p, { history: opts?.history, log: opts?.log })}
                    onSelect={(sel) => { setSelection(sel); if (sel.nodeId || sel.edgeId) { setRightTab("inspector"); setRightOpen(true); } }}
                    onUndo={undo} onRedo={redo}
                    onAutoLayout={(mode) => {
                      const pos = computeLayout(active.nodes, active.edges, mode);
                      patch({ nodes: active.nodes.map((n) => ({ ...n, x: Math.round(pos[n.id]?.x ?? n.x) + 120, y: Math.round(pos[n.id]?.y ?? n.y) + 180 })) }, { history: true, log: `Layout ${mode} aplicado` });
                      toast("Layout aplicado.", "ok");
                    }}
                    onAddNode={() => setAddEntityOpen(true)}
                    onEditNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }}
                    onEditEdge={(id) => {
                      if (id.startsWith("new:")) {
                        const [, source, target] = id.split(":");
                        if (readOnly) { toast("Caso read-only.", "warn"); return; }
                        setEdgeDraft({ source, target });
                        return;
                      }
                      setSelection({ edgeId: id }); setRightTab("inspector"); setRightOpen(true);
                    }}
                    onRequestEvidence={(nodeId) => { setEvidenceNodeId(nodeId); setEvidenceOpen(true); }}
                    onViewport={(vp) => { if (active.viewport.x !== vp.x || active.viewport.y !== vp.y || active.viewport.zoom !== vp.zoom) setActive((prev) => (prev ? { ...prev, viewport: vp } : prev)); }}
                    onToast={toast}
                  />
                )}
                {workspaceTab === "ingest" && (
                  <div className="h-full overflow-y-auto p-2 sm:p-4">
                    <div className="mx-auto max-w-3xl">
                      <PaletteInputEngine compact cases={cases} active={active} readOnly={readOnly}
                        onIngest={handleIngest} onSearchResults={handleSearchResults}
                        onReview={(query, outcomes) => { const anchor = active.nodes.find((n) => n.title.toLowerCase() === query.toLowerCase()); openImport(query, anchor?.id, outcomes); setRightOpen(false); }}
                        onOpenCanvas={() => setWorkspaceTab("canvas")} onOpenCase={openCase} onToast={toast} />
                    </div>
                  </div>
                )}
                {workspaceTab === "table" && <div className="h-full overflow-y-auto p-2"><PaletteTableView c={active} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} /></div>}
                {workspaceTab === "timeline" && <div className="h-full overflow-y-auto p-2"><PaletteTimeline c={active} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} /></div>}
                {workspaceTab === "evidence" && <div className="h-full overflow-y-auto p-2"><PaletteEvidenceBoard c={active} onAdd={() => { setEvidenceNodeId(selectedNode?.id); setEvidenceOpen(true); }} onDelete={deleteEvidence} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} /></div>}
                {workspaceTab === "insights" && <div className="h-full overflow-y-auto p-2"><PaletteInsights c={active} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} onMergeDuplicates={handleMerge} onRunSuggestion={handleSuggestion} /></div>}
                {workspaceTab === "reports" && <div className="h-full overflow-y-auto p-2"><PaletteReports cases={[active]} initialCaseId={active.id} onToast={toast} /></div>}
                {workspaceTab === "notes" && <div className="h-full overflow-y-auto p-3"><PaletteNotes c={active} onAdd={(body) => patch({ notes: [{ id: uid("note"), at: new Date().toISOString(), author: prefs.analystName, body }, ...active.notes] }, { log: "Nota adicionada" })} /></div>}
                {workspaceTab === "comments" && <div className="h-full overflow-y-auto p-3"><PaletteComments c={active} onAdd={(body) => patch({ comments: [{ id: uid("comment"), at: new Date().toISOString(), author: prefs.analystName, body, resolved: false }, ...active.comments] })} /></div>}
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <div className={cx("mx-auto w-full p-3 sm:p-5", view === "overview" ? "max-w-[1180px]" : "max-w-[1240px]")}>
                {view === "overview" && (
                  <Home
                    cases={cases} recent={recentCases} shared={sharedCases.length} activeCase={active}
                    onOpen={openCase} onNew={() => { setNewTemplate(undefined); setNewCaseOpen(true); }}
                    onTemplates={() => setView("templates")} onKnowledge={() => setView("knowledge")}
                    onToast={toast} onIngest={handleIngest} onSearchResults={handleSearchResults}
                    onReview={(query, outcomes) => { openImport(query, undefined, outcomes); }}
                    onOpenCase={(id) => { openCase(id); }}
                    onOpenCanvas={() => { if (activeRef.current) openCase(activeRef.current.id); else setView("cases"); }}
                  />
                )}
                {(listMode === "cases" || listMode === "recent" || listMode === "shared") && ["cases", "recent", "shared"].includes(view) && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {([["cases", "Todas"], ["recent", "Recentes"], ["shared", "Compartilhados"]] as Array<[PaletteView, string]>).map(([key, label]) => (
                        <button key={key} onClick={() => setView(key)} className={cx("rounded-md border px-2 py-0.5 text-[10px]", listMode === key ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-[#1e2c3a] text-[#8399ae] hover:text-white")}>
                          {label}{key === "cases" ? ` (${regularCases.length})` : key === "shared" ? ` (${sharedCases.length})` : ""}
                        </button>
                      ))}
                    </div>
                    <PaletteCases cases={listMode === "shared" ? sharedCases : listMode === "recent" ? recentCases.slice(0, 8) : regularCases}
                      title={listMode === "shared" ? "Shared Cases" : listMode === "recent" ? "Recent Cases" : "Investigations"}
                      subtitle={listMode === "shared" ? "Snapshots read-only importados. Sincronização em tempo real entre colaboradores exige backend e não está habilitada." : "Tudo persistido neste navegador. Canvas, entidades, fontes e evidências ficam no caso."}
                      onOpen={openCase} onDelete={removeCase}
                      onDuplicate={(id) => { const copy = duplicateCase(id); if (copy) { setCases(listAllVisibleCases()); openCase(copy.id); toast("Caso duplicado.", "ok"); } }}
                      onExport={(id) => { const c = getCase(id); if (c) exportJson(c); }}
                      onShare={(id) => { const c = getCase(id); if (c) { setActive(c); activeRef.current = c; setActiveId(id); setShareOpen(true); } }}
                      onNew={() => { setNewTemplate(undefined); setNewCaseOpen(true); }} />
                  </div>
                )}
                {view === "templates" && <PaletteTemplates onUse={(id) => { setNewTemplate(id); setNewCaseOpen(true); }} />}
                {view === "library" && <PaletteLibrary cases={cases} onOpenCase={(cid, nid) => { openCase(cid); selectNode(cid, nid); }} />}
                {view === "knowledge" && <PaletteKnowledge onToast={toast} />}
                {view === "sources" && <SourcesView active={active} selectedNode={selectedNode} onRun={runSearchFromPanel} />}
                {view === "ai" && (
                  <div className="mx-auto max-w-3xl">
                    <div className="mb-2">
                      <h2 className="font-display text-[18px] font-semibold text-[#eaf3fb]">Life Intelligence AI</h2>
                      <p className="text-[11px] text-[#71879c]">Copiloto contextual ao caso aberto: responde apenas com os registros, fontes e a Life Knowledge.</p>
                    </div>
                    {active ? (
                      <div className="h-[calc(100dvh-210px)] min-h-[420px] overflow-hidden rounded-xl border border-[#1e2c3a] bg-[#080f16]">
                        <PaletteAiPanel c={active} selected={selectedNode} memoryNote={memoryNote} onAction={(a) => void runAiAction(a)} onCitation={(ref, kind) => {
                          if (kind === "knowledge") { setView("knowledge"); return; }
                          if (kind === "edge") { setSelection({ edgeId: ref }); setRightTab("inspector"); setRightOpen(true); return; }
                          setSelection({ nodeId: ref }); setRightTab("inspector"); setRightOpen(true);
                        }} onSaveMemory={saveMemoryNote} onToast={toast} />
                      </div>
                    ) : <PalEmpty icon={Bot} title="Nenhum caso aberto" hint="Abra uma investigação para usar o Life Intelligence AI com contexto." action={<PalButton variant="soft" onClick={() => setView("cases")}>Abrir Investigations</PalButton>} />}
                  </div>
                )}
                {view === "reports" && <PaletteReports cases={cases} initialCaseId={activeId} onToast={toast} />}
                {view === "settings" && (
                  <PaletteSettings prefs={prefs} onChange={(p) => { const next = savePrefs(p); setPrefs(next); }} onToast={toast} onReset={() => {
                    for (const key of ["life-palette.cases.v1", "life-palette.shared.v1", "life-palette.knowledge.v1", "life-palette.memory.v1", "life-palette.feedback.v1", "life-palette.prefs.v1"]) window.localStorage.removeItem(key);
                    invalidateKnowledgeCache(); ensureSeedKnowledge();
                    setCases([]); setActive(null); activeRef.current = null; setActiveId(undefined); setMemories(getMemory()); setPrefs(getPrefs());
                    toast("Dados locais apagados.", "ok");
                  }} />
                )}
              </div>
            </div>
          )}
        </main>

        {active && view === "cases" && rightOpen && (
          <aside className="flex w-[302px] flex-none flex-col overflow-hidden border-l border-[#131e29] bg-[#070d14] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-[86vw] max-lg:shadow-[-24px_0_48px_rgba(0,0,0,0.55)] xl:w-[340px]">
            <div className="flex flex-none items-center gap-0.5 border-b border-[#16212d] px-1.5 py-1">
              {([["ai", Bot, "AI"], ["inspector", Layers, "Inspector"], ["search", Search, "Search"], ["sources", Radar, "Sources"]] as const).map(([key, Icon, label]) => (
                <button key={key} onClick={() => setRightTab(key)}
                  className={cx("flex flex-1 items-center justify-center gap-1 rounded px-1 py-1 text-[9px]", rightTab === key ? "bg-cyan-400/10 text-cyan-200" : "text-[#71879c] hover:text-white")}>
                  <Icon className="h-3 w-3" /> {label}
                </button>
              ))}
              <button onClick={() => setRightOpen(false)} className="ml-0.5 rounded p-1 text-[#5c748a] hover:text-white" aria-label="Fechar painel"><X className="h-3 w-3" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {rightTab === "ai" && <PaletteAiPanel c={active} selected={selectedNode} memoryNote={memoryNote} onAction={(a) => void runAiAction(a)} onCitation={(ref, kind) => {
                if (kind === "knowledge") { setView("knowledge"); return; }
                if (kind === "edge") { setSelection({ edgeId: ref }); setRightTab("inspector"); return; }
                setSelection({ nodeId: ref }); setRightTab("inspector");
              }} onSaveMemory={saveMemoryNote} onToast={toast} />}
              {rightTab === "inspector" && selectedNode && <div className="h-full overflow-y-auto"><EntityInspector c={active} node={selectedNode} readOnly={readOnly}
                onUpdate={updateNode} onDelete={() => setDeleteConfirm({ kind: "node", id: selectedNode.id, label: selectedNode.title })}
                onAddConnection={startConnection} onInvestigate={() => runSearchFromPanel(defaultTool(selectedNode.kind), selectedNode.title)}
                onAsk={(q) => { setRightTab("ai"); setTimeout(() => window.dispatchEvent(new CustomEvent("palette:ask", { detail: q })), 30); }}
                onAddEvidence={() => { setEvidenceNodeId(selectedNode.id); setEvidenceOpen(true); }}
                onSelect={(id) => setSelection({ nodeId: id })} onClose={() => setRightTab("ai")} /></div>}
              {rightTab === "inspector" && !selectedNode && selectedEdge && <div className="h-full overflow-y-auto"><EdgeInspector c={active} edge={selectedEdge} readOnly={readOnly} onUpdate={updateEdge} onDelete={() => setDeleteConfirm({ kind: "edge", id: selectedEdge.id, label: selectedEdge.relation })} onClose={() => setRightTab("ai")} onSelect={(id) => setSelection({ nodeId: id })} /></div>}
              {rightTab === "inspector" && !selectedNode && !selectedEdge && (
                <div className="p-3"><PalEmpty icon={Layers} title="Nenhum elemento selecionado" hint="Clique em uma entidade ou relação no canvas para inspecionar propriedades, fontes, evidências e histórico." /></div>
              )}
              {rightTab === "search" && <PaletteSearchPanel c={active} node={selectedNode} readOnly={readOnly} onRecord={handleRecord} onImport={openImport} onToast={toast} />}
              {rightTab === "sources" && <div className="h-full overflow-y-auto p-2"><PaletteSourceView c={active} onRun={runSearchFromPanel} /></div>}
            </div>
          </aside>
        )}
      </div>

      {/* --------------------------- status bar --------------------------- */}
      <footer className="flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#131e29] bg-[#060c12] px-3 py-1 text-[8.5px] text-[#5c748a]">
        <span className="inline-flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400" /> dados locais · sem upload</span>
        {active ? (
          <>
            <span>{stats?.nodes ?? 0} entidades · {stats?.edges ?? 0} relações · {stats?.searches ?? 0} consultas</span>
            <span className="hidden sm:inline">confiança: {stats?.verified ?? 0} verificadas · {stats?.high ?? 0} alta · {stats?.unverified ?? 0} não verificadas</span>
            {stats && stats.isolatedNodes > 0 && <span className="text-amber-400/80">{stats.isolatedNodes} isolada(s)</span>}
          </>
        ) : <span>{cases.length} investigação(ões) neste navegador</span>}
        <span className="ml-auto hidden md:inline">Ctrl+K busca · Ctrl+S salva · Ctrl+Z desfaz · N nova entidade</span>
      </footer>

      {/* ------------------------------ modals ------------------------------ */}
      <NewCaseModal open={newCaseOpen} initialTemplate={newTemplate} onClose={() => setNewCaseOpen(false)} onCreate={handleNewCase} />
      <AddEntityModal open={addEntityOpen} groups={active?.groups ?? []} suggestedKind={selectedNode?.kind} onClose={() => setAddEntityOpen(false)} onAdd={(vals) => addNodes(vals)} />
      <EvidenceModal open={evidenceOpen} c={active ?? emptyCase()} nodeId={evidenceNodeId} onClose={() => setEvidenceOpen(false)} onSave={addEvidence} onToast={toast} />
      <ExtractReviewModal open={Boolean(importPayload)} c={active ?? emptyCase()} payload={importPayload} onClose={() => setImportPayload(null)} onConfirm={(values, opts) => void confirmImport(values, opts)} />
      <ShareModal open={shareOpen && Boolean(active)} c={active} onClose={() => setShareOpen(false)} onToast={toast}
        onImportToken={(token) => { const c = decodeShare(token); if (!c) { toast("Token inválido ou corrompido.", "warn"); return; } const imported = importSharedCase(c); setCases(listAllVisibleCases()); setActiveId(imported.id); setActive(imported); setView("cases"); toast("Snapshot importado.", "ok"); }}
        onImportFile={(file) => void importSharedFile(file)} />
      <PaletteGlobalSearch open={globalOpen} cases={cases} onClose={() => setGlobalOpen(false)} onOpenCase={(id) => { setView("cases"); openCase(id); }} onOpenNode={(cid, nid) => { openCase(cid); selectNode(cid, nid); }} />

      {edgeDraft && active && (
        <Modal open onClose={() => setEdgeDraft(null)} title="Nova relação" subtitle="Relações precisam de tipo, fonte e confiança. Sem evidência, use hipótese (pontilhada).">
          <div className="mb-2">
            <PalField label="Entidade de destino">
              <select className={selectCls} value={edgeDraft.target} onChange={(e) => setEdgeDraft({ ...edgeDraft, target: e.target.value })}>
                {active.nodes.filter((n) => n.id !== edgeDraft.source).map((n) => <option key={n.id} value={n.id}>{NODE_KIND_LABEL[n.kind]}: {n.title}</option>)}
              </select>
            </PalField>
          </div>
          <RelationPicker c={active} sourceId={edgeDraft.source} targetId={edgeDraft.target} onConfirm={createEdge} onClose={() => setEdgeDraft(null)} />
        </Modal>
      )}

      {deleteConfirm && (
        <Modal open onClose={() => setDeleteConfirm(null)} title="Confirmar exclusão" subtitle="Esta ação registra o evento na timeline do caso."
          footer={<><PalButton variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</PalButton><PalButton variant="danger" onClick={confirmDelete}>Excluir</PalButton></>}>
          <p className="text-[11.5px] leading-relaxed text-[#b6c8da]">Excluir <b className="text-[#eaf3fb]">{deleteConfirm.label}</b>? {deleteConfirm.kind === "case" ? "O caso e suas evidências locais serão removidos." : "As conexões associadas também serão removidas."}</p>
        </Modal>
      )}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[90] flex w-[300px] flex-col gap-1.5">
        {toasts.map((t) => (
          <div key={t.id} className={cx("pointer-events-auto flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[10.5px] shadow-xl backdrop-blur", t.tone === "ok" ? "border-emerald-400/30 bg-emerald-950/80 text-emerald-100" : t.tone === "warn" ? "border-amber-400/30 bg-amber-950/80 text-amber-100" : "border-[#2a3b4d] bg-[#0a1118]/95 text-[#c6d6e6]")}>
            {t.tone === "ok" ? <Check className="mt-0.5 h-3 w-3 flex-none" /> : t.tone === "warn" ? <CircleHelp className="mt-0.5 h-3 w-3 flex-none" /> : <Sparkles className="mt-0.5 h-3 w-3 flex-none" />}
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- home ---------------------------------- */

function Home({
  cases, recent, shared, activeCase, onOpen, onNew, onTemplates, onKnowledge, onToast, onIngest, onSearchResults, onReview, onOpenCase, onOpenCanvas,
}: {
  cases: PaletteCase[];
  recent: PaletteCase[];
  shared: number;
  activeCase: PaletteCase | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onTemplates: () => void;
  onKnowledge: () => void;
  onToast: (m: string, t?: "ok" | "warn" | "info") => void;
  onIngest: (values: IngestValue[], meta: { depth: InvestigationDepth; investigate: boolean }) => { caseId?: string } | void;
  onSearchResults: (outcomes: SearchOutcome[], meta: { depth: InvestigationDepth; values: IngestValue[]; durationMs: number }) => void;
  onReview: (query: string, outcomes: SearchOutcome[]) => void;
  onOpenCase: (id: string) => void;
  onOpenCanvas: () => void;
}) {
  const totals = useMemo(() => cases.reduce((acc, c) => {
    acc.nodes += c.nodes.length;
    acc.searches += c.searches.length;
    acc.evidence += c.evidence.length;
    return acc;
  }, { nodes: 0, searches: 0, evidence: 0 }), [cases]);

  return (
    <div className="space-y-4">
      <PaletteInputEngine
        cases={cases}
        active={activeCase}
        readOnly={false}
        onIngest={onIngest}
        onSearchResults={onSearchResults}
        onReview={onReview}
        onOpenCanvas={onOpenCanvas}
        onOpenCase={onOpenCase}
        onToast={onToast}
      />

      <div className="grid gap-2 sm:grid-cols-4">
        {[
          { label: "Investigations", value: cases.filter((c) => !c.shared?.readOnly).length, hint: "neste navegador", action: () => {} },
          { label: "Registered entities", value: totals.nodes, hint: "todas as entidades", action: () => {} },
          { label: "Executed searches", value: totals.searches, hint: "consultas registradas", action: () => {} },
          { label: "Available sources", value: Object.keys(SEARCH_SOURCES).length, hint: "conectores gratuitos", action: () => {} },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[#1a2836] bg-[#08111a] px-3 py-2">
            <div className="text-[8.5px] uppercase tracking-[0.14em] text-[#5f7488]">{card.label}</div>
            <div className="mt-0.5 font-display text-[22px] font-semibold leading-none text-[#eaf3fb]">{card.value}</div>
            <div className="mt-0.5 text-[8.5px] text-[#4f6377]">{card.hint}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <PalButton variant="soft" onClick={onNew}><Plus className="h-3.5 w-3.5" /> New Investigation</PalButton>
        <PalButton variant="ghost" onClick={() => onOpen(recent[0]?.id ?? "")} disabled={!recent.length}><ArrowRight className="h-3.5 w-3.5" /> Open Investigation</PalButton>
        <PalButton variant="ghost" onClick={onTemplates}><Library className="h-3.5 w-3.5" /> Templates</PalButton>
        <PalButton variant="ghost" onClick={onKnowledge}><FileSearch className="h-3.5 w-3.5" /> Knowledge Base</PalButton>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-[#5f7488]"><Users className="h-3 w-3" /> {shared} snapshot(s) compartilhado(s) read-only</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-xl border border-[#1a2836] bg-[#08111a]">
          <div className="flex items-center justify-between gap-2 border-b border-[#111c27] px-3 py-2">
            <div>
              <PalLabel>Recent investigations</PalLabel>
              <p className="text-[9.5px] text-[#657b90]">Retome o canvas, as fontes e as evidências de onde parou.</p>
            </div>
            <PalButton size="sm" variant="ghost" onClick={onNew}><Plus className="h-3 w-3" /></PalButton>
          </div>
          {recent.length === 0 ? (
            <div className="p-3">
              <PalEmpty icon={FolderKanban} title="Nenhuma investigação ainda" hint="Cole qualquer informação na caixa acima ou comece por um template. Nada é preenchido com dados fictícios." />
            </div>
          ) : (
            <ul className="divide-y divide-[#0f1922]">
              {recent.slice(0, 6).map((c) => {
                const s = caseStats(c);
                return (
                  <li key={c.id}>
                    <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-[#26394c] bg-[#0d1721] text-[8.5px] font-semibold text-cyan-300">{c.code.slice(-3)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] font-medium text-[#e3edf8]">{c.title}</span>
                        <span className="block text-[8.5px] text-[#657b90]">{CASE_STATUS_LABEL[c.status]} · {s.nodes} entidades · {s.edges} relações · {s.evidence} evidências</span>
                      </span>
                      <span className="flex-none text-[8.5px] text-[#4f6377]">{c.updatedAt.slice(0, 10)}</span>
                      <ArrowRight className="h-3 w-3 flex-none text-[#3f5a73]" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-[#1a2836] bg-[#08111a]">
          <div className="border-b border-[#111c27] px-3 py-2">
            <PalLabel>Investigation templates</PalLabel>
            <p className="text-[9.5px] text-[#657b90]">Planos de coleta com fontes compatíveis.</p>
          </div>
          <ul className="divide-y divide-[#0f1922]">
            {PALETTE_TEMPLATES.filter((t) => t.id !== "custom").slice(0, 5).map((t) => (
              <li key={t.id}>
                <button onClick={onTemplates} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/[0.03]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[10.5px] text-[#dbe7f4]">{t.name}</span>
                    <span className="block truncate text-[8.5px] text-[#657b90]">{t.steps.length} etapa(s) · {t.description}</span>
                  </span>
                  <ChevronDown className="h-3 w-3 -rotate-90 flex-none text-[#3f5a73]" />
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-[#111c27] px-3 py-2">
            <p className="text-[8.5px] leading-relaxed text-[#5f7488]">
              Colaboração em tempo real e permissões multiusuário não estão habilitadas: o compartilhamento é um snapshot comprimido read-only.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

/* -------------------------------- sources -------------------------------- */

function SourcesView({ active, selectedNode, onRun }: {
  active: PaletteCase | null;
  selectedNode: PaletteNode | null;
  onRun: (tool: string, value: string) => void;
}) {
  const [category, setCategory] = useState<string>("all");
  const [term, setTerm] = useState("");
  const list = Object.values(SEARCH_SOURCES).filter((s) =>
    (category === "all" || s.category === category) &&
    (!term.trim() || `${s.name} ${s.description} ${s.kinds.join(" ")}`.toLowerCase().includes(term.toLowerCase())));
  const categories = ["all", ...Object.keys(CATEGORY_LABEL)];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[18px] font-semibold text-[#eaf3fb]">Intelligence Sources</h2>
          <p className="text-[10.5px] text-[#71879c]">
            {Object.keys(SEARCH_SOURCES).length} conectores gratuitos já implementados na plataforma. Toda consulta passa pelas server functions com rate limit e proteção SSRF.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <input className={cx(inputCls, "!w-44 !py-1 !text-[10.5px]")} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="filtrar fonte" />
          <select className={cx(selectCls, "!w-auto !py-1 !text-[10.5px]")} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c} value={c}>{c === "all" ? "Todas as categorias" : CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}</option>)}
          </select>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#1a2836]">
        <table className="w-full text-[10px]">
          <thead className="bg-[#0a131c] text-[#657b90]">
            <tr>
              <th className="px-2 py-1.5 text-left">Fonte</th>
              <th className="px-2 text-left">Categoria</th>
              <th className="px-2 text-left">Tipos compatíveis</th>
              <th className="px-2 text-left">Camada</th>
              <th className="px-2 text-left">Chave</th>
              <th className="px-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className="border-t border-[#111c27] align-top">
                <td className="px-2 py-1.5">
                  <div className="font-medium text-[#dbe7f4]">{s.name}</div>
                  <div className="max-w-[320px] text-[8.5px] leading-snug text-[#657b90]">{s.description}</div>
                </td>
                <td className="whitespace-nowrap px-2 text-[#8399ae]">{CATEGORY_LABEL[s.category]}</td>
                <td className="max-w-[200px] px-2 text-[8.5px] text-[#7f94a9]">{s.kinds.slice(0, 5).join(", ")}{s.kinds.length > 5 ? "…" : ""}</td>
                <td className="whitespace-nowrap px-2 text-[#8399ae]">{s.tier === 1 ? "quick" : s.tier === 2 ? "standard" : "deep"}</td>
                <td className="whitespace-nowrap px-2">{s.optionalKey ? <span className="rounded border border-amber-400/30 px-1 text-[8px] text-amber-300">opcional</span> : <span className="rounded border border-emerald-400/30 px-1 text-[8px] text-emerald-300">grátis</span>}</td>
                <td className="px-2 text-right">
                  {active && selectedNode && s.kinds.includes(selectedNode.kind) && (
                    <button onClick={() => onRun(s.id, selectedNode.title)} className="text-[9px] text-cyan-300 hover:underline">consultar</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active && (
        <div className="rounded-xl border border-[#1a2836] bg-[#08111a] p-3">
          <PalLabel>Uso neste caso</PalLabel>
          <div className="mt-1"><PaletteSourceView c={active} onRun={onRun} /></div>
        </div>
      )}
      <p className="text-[9px] leading-relaxed text-[#5f7488]">
        Fontes com chave opcional continuam listadas, mas retornam “indisponível” sem a chave — nunca um resultado simulado. Chaves ficam apenas no servidor.
      </p>
    </div>
  );
}

function defaultTool(kind: PaletteNodeKind): string {
  switch (kind) {
    case "domain": case "subdomain": return "domainLookup";
    case "ipv4": case "ipv6": return "ipLookup";
    case "asn": case "network": return "bgpLookup";
    case "username": return "usernameScan";
    case "email": return "emailAnalysis";
    case "cve": return "cveLookup";
    case "hash": case "file": return "hashLookup";
    case "company": return "cnpjLookup";
    case "url": case "website": case "social-profile": return "urlAnalyzer";
    default: return "domainLookup";
  }
}

function emptyCase(): PaletteCase {
  return {
    id: "empty", code: "LP-0000-0000", title: "", description: "", objective: "", owner: "", status: "draft",
    priority: "normal", tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    nodes: [], edges: [], groups: [], evidence: [], searches: [], timeline: [], notes: [], comments: [],
    participants: [], viewport: { x: 0, y: 0, zoom: 1 }, plan: [],
  };
}
