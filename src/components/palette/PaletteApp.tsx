import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Bot, CaseSensitive, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Command, FileBarChart, FileSearch, FolderKanban, GitBranch,
  History, LayoutDashboard, Layers, Library, Loader2, Menu, Plus, Radar, Search, Settings2,
  Share2, Sparkles, Users, X,
} from "lucide-react";
import {
  appendTimeline, caseStats, createCase, decodeShare, deleteCase, duplicateCase, encodeShare,
  exportCaseJson, getCase, getMemory, getPrefs, importSharedCase, isReadOnly, listAllVisibleCases,
  listCases, listKnowledge, mergeNodes, newEvidence, newSearchRecord, saveCase, saveMemory, savePrefs,
  subscribePalette, timelineEntry, uid,
  type DuplicateGroup,
} from "@/lib/palette/store";
import { ensureSeedKnowledge, invalidateKnowledgeCache } from "@/lib/palette/knowledge";
import { extractFromUnknown, normalizeEntityValue, relationForSource } from "@/lib/palette/extract";
import { computeLayout } from "@/lib/palette/layout";
import { planFromTemplate } from "@/lib/palette/templates";
import { runSource, SEARCH_SOURCES, type SearchOutcome } from "@/lib/palette/search";
import { executiveSummary } from "@/lib/palette/ai";
import { buildReport, reportToHtml, downloadReportPdf } from "@/lib/palette/report";
import {
  CONFIDENCE_LABEL, NODE_KIND_LABEL,
  type AiAction, type CaseStatus, type ConfidenceLevel, type EdgeStyle, type PaletteCase,
  type PaletteGroup, type PaletteNode, type PaletteNodeKind, type PalettePrefs,
  type PaletteSearchRecord,
} from "@/lib/palette/types";
import { KindPill, PalButton, PalEmpty, PalField, PalLabel, inputCls, selectCls, Modal, ConfidencePill } from "./kit";
import { PaletteCanvas, type CanvasSelection } from "./PaletteCanvas";
import { EdgeInspector, EntityInspector, RelationPicker } from "./PaletteInspector";
import { PaletteAiPanel, PaletteSearchPanel } from "./PaletteIntelligence";
import { PaletteComments, PaletteEvidenceBoard, PaletteInsights, PaletteNotes, PaletteSourceView, PaletteTableView, PaletteTimeline } from "./PaletteData";
import {
  PaletteCases, PaletteKnowledge, PaletteLibrary, PaletteOverview, PaletteReports, PaletteSettings,
  PaletteTemplates,
} from "./PaletteViews";
import {
  AddEntityModal, EvidenceModal, ExtractReviewModal, NewCaseModal, PaletteGlobalSearch, ShareModal,
  type ImportPayload, type NewCasePayload,
} from "./PaletteModals";
import { cx } from "@/components/agency/kit";

export type PaletteView = "overview" | "cases" | "recent" | "shared" | "templates" | "library" | "knowledge" | "sources" | "ai" | "reports" | "settings";
export type WorkspaceTab = "canvas" | "table" | "timeline" | "evidence" | "insights" | "reports" | "notes" | "comments";

const NAV_ITEMS: Array<{ key: PaletteView; label: string; icon: typeof LayoutDashboard; group: string }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, group: "Workspace" },
  { key: "cases", label: "My Investigations", icon: FolderKanban, group: "Workspace" },
  { key: "recent", label: "Recent Cases", icon: History, group: "Workspace" },
  { key: "shared", label: "Shared Cases", icon: Users, group: "Workspace" },
  { key: "templates", label: "Templates", icon: Library, group: "Workspace" },
  { key: "library", label: "Entity Library", icon: Layers, group: "Intelligence" },
  { key: "sources", label: "Intelligence Sources", icon: Radar, group: "Intelligence" },
  { key: "ai", label: "AI Assistant", icon: Bot, group: "Intelligence" },
  { key: "knowledge", label: "Life Knowledge", icon: BookOpen, group: "Intelligence" },
  { key: "reports", label: "Reports", icon: FileBarChart, group: "Deliverables" },
  { key: "settings", label: "Settings", icon: Settings2, group: "Platform" },
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    const unsub = subscribePalette(() => setCases(listAllVisibleCases()));
    return unsub;
  }, []);

  useEffect(() => {
    if (!initialCaseId) return;
    const c = getCase(initialCaseId);
    if (c) { setActive(c); setActiveId(c.id); setView("cases"); }
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
      const node: PaletteNode = {
        id: uid("node"), kind: p.seedKind, title: p.seedValue,
        subtitle: "Semente da investigação", description: "",
        identifiers: [], properties: {}, tags: [],
        confidence: "unverified", sources: [], evidenceIds: [],
        x: 260, y: 220, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      next = appendTimeline({ ...next, nodes: [node] }, timelineEntry("entity", "Entidade semente adicionada", `${NODE_KIND_LABEL[node.kind]}: ${node.title}`));
      next = saveCase(next);
    }
    setCases(listAllVisibleCases());
    setNewCaseOpen(false);
    activeRef.current = next;
    setActiveId(next.id); setActive(next); setView("cases");
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

  /* -------------------------------- entities ------------------------------- */

  const addNodes = (values: Array<{ kind: PaletteNodeKind; title: string; description: string; confidence: ConfidenceLevel; source: string; groupId?: string; tags: string[] }>, near?: { x: number; y: number }, quiet = false) => {
    if (!activeRef.current) return;
    if (readOnly) { toast("Caso read-only. Duplique para editar.", "warn"); return; }
    const now = new Date().toISOString();
    const current = activeRef.current;
    let merged = 0;
    const created: PaletteNode[] = [];
    const nextNodes = [...current.nodes];
    values.forEach((v, i) => {
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
          confidence: v.confidence === "verified" ? existing.confidence : existing.confidence,
          updatedAt: now,
        };
        return;
      }
      const base = near ?? { x: 200 + (current.nodes.length % 4) * 230, y: 180 + Math.floor(current.nodes.length / 4) * 140 };
      created.push({
        id: uid("node"), kind: v.kind, title: value,
        description: v.description, identifiers: [], properties: {}, tags: v.tags,
        confidence: v.confidence, sources: v.source ? [v.source] : [], evidenceIds: [],
        groupId: v.groupId,
        x: base.x + (created.length % 3) * 60, y: base.y + created.length * 80,
        createdAt: now, updatedAt: now,
      });
    });
    const next = [...nextNodes, ...created];
    patch({ nodes: next }, {
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
        if (!existing.sources.includes(sourceName)) existing.sources = [...existing.sources, sourceName];
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
    setActive(saved); setCases(listAllVisibleCases());
    setImportPayload(null);
    toast(`Importação concluída: ${created} nova(s), ${merged} consolidada(s).`, "ok");
  };

  /* ---------------------------------- AI ---------------------------------- */

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

  /* -------------------------------- search -------------------------------- */

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

  /* ------------------------------ duplicates ------------------------------ */

  const handleMerge = (group: DuplicateGroup) => {
    if (!active || readOnly) return;
    const keep = group.nodes[0];
    const drops = group.nodes.slice(1).map((n) => n.id);
    const merged = mergeNodes(active, keep.id, drops);
    const saved = saveCase(merged);
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
    const openSearch = () => setGlobalOpen(true);
    window.addEventListener("palette:global-search", openSearch);
    return () => { window.removeEventListener("keydown", handler); window.removeEventListener("palette:global-search", openSearch); };
  }, [active, selection, readOnly, undo, redo]); // eslint-disable-line react-hooks/exhaustive-deps

  /* --------------------------------- render -------------------------------- */

  const stats = active ? caseStats(active) : null;
  const selectedNode = active?.nodes.find((n) => n.id === selection.nodeId) ?? null;
  const selectedEdge = active?.edges.find((e) => e.id === selection.edgeId) ?? null;
  const recentCases = [...cases].filter((c) => !c.shared?.readOnly).slice(0, 8);
  const sharedCases = cases.filter((c) => c.shared?.readOnly);
  const workbenchViews: PaletteView[] = ["overview", "cases", "recent", "shared", "templates", "library", "knowledge", "sources", "reports", "settings"];
  const showWorkbench = !active || workbenchViews.includes(view);

  const selectNode = (caseId: string, nodeId: string) => {
    if (caseId !== active?.id) openCase(caseId);
    setTimeout(() => { setSelection({ nodeId }); setRightTab("inspector"); setRightOpen(true); setWorkspaceTab("canvas"); }, 40);
  };

  return (
    <div className="palette-root flex min-h-[calc(100vh-64px)] bg-[#050a0f] text-[#c6d6e6]" style={{ ["--palette-accent" as string]: "#22d3ee" }}>
      {/* Sidebar */}
      {sidebarOpen && (
        <aside className={cx("w-[212px] flex-none border-r border-[#131e29] bg-[#060c12]", sidebarOpen ? "fixed inset-y-0 left-0 z-40 block shadow-2xl lg:static lg:z-auto lg:shadow-none" : "hidden lg:block")}>
          <div className="flex h-full flex-col">
            <div className="border-b border-[#131e29] px-3 py-3">
              <div className="flex items-center gap-2">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/20 to-violet-500/20">
                  <Layers className="h-4 w-4 text-cyan-200" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold leading-tight text-[#eaf3fb]">Life Palette</div>
                  <div className="text-[8px] uppercase tracking-[0.16em] text-[#5c748a]">Life Agency</div>
                </div>
              </div>
              <p className="mt-1.5 text-[8.5px] leading-snug text-[#5c748a]">See Connections. Discover Intelligence.</p>
            </div>
            <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
              {["Workspace", "Intelligence", "Deliverables", "Platform"].map((group) => (
                <div key={group}>
                  <div className="px-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#45596d]">{group}</div>
                  <div className="mt-1 space-y-0.5">
                    {NAV_ITEMS.filter((n) => n.group === group).map((item) => {
                      const Icon = item.icon;
                      const isActive = view === item.key || (view === "cases" && item.key === "cases" && Boolean(active));
                      const badge = item.key === "cases" ? recentCases.length : item.key === "shared" ? sharedCases.length : item.key === "reports" ? active?.evidence.length : undefined;
                      return (
                        <button key={item.key} onClick={() => { setView(item.key); if (item.key === "cases" && !active) setActive(null); }}
                          className={cx("flex w-full items-center gap-2 rounded-lg px-2 py-[5px] text-left text-[10.5px] transition-colors", isActive ? "bg-cyan-400/10 text-cyan-100" : "text-[#8ba1b6] hover:bg-white/[0.03] hover:text-[#d8e5f1]")}>
                          <Icon className={cx("h-3.5 w-3.5", isActive ? "text-cyan-300" : "text-[#5c748a]")} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {badge !== undefined && badge > 0 && <span className="rounded bg-white/[0.06] px-1 text-[8px] text-[#8ba1b6]">{badge}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-[#131e29] p-2">
              <button onClick={() => setView("settings")} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[10px] text-[#8ba1b6] hover:bg-white/[0.03]">
                <Settings2 className="h-3.5 w-3.5 text-[#5c748a]" /> Preferências
              </button>
              <div className="mt-1 flex items-center gap-1 rounded-lg border border-[#16212d] bg-[#080f16] px-2 py-1 text-[8px] text-[#5c748a]">
                <span className="h-1 w-1 rounded-full bg-emerald-400" /> dados locais · sem upload
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Mobile nav */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-[#131e29] bg-[#060c12]/95 px-3 py-2 backdrop-blur">
          <button onClick={() => setSidebarOpen((v) => !v)} className="rounded p-1 text-[#7f94a9] hover:bg-white/5 lg:hidden"><Menu className="h-4 w-4" /></button>
          {active ? (
            <>
              <button onClick={() => { setActive(null); setView("cases"); }} className="rounded p-1 text-[#7f94a9] hover:bg-white/5" title="Voltar"><ChevronLeft className="h-4 w-4" /></button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[8.5px] text-cyan-400/80"><span className="font-mono">{active.code}</span>{readOnly && <span className="rounded border border-amber-400/40 px-1 text-[7.5px] text-amber-300">read-only</span>}</div>
                <input value={active.title} disabled={readOnly} onChange={(e) => patch({ title: e.target.value })} className="w-[240px] max-w-[40vw] truncate bg-transparent text-[12.5px] font-semibold text-[#eaf3fb] outline-none focus:border-b focus:border-cyan-400/40" />
              </div>
              <select value={active.status} disabled={readOnly} onChange={(e) => patch({ status: e.target.value as CaseStatus })} className="rounded border border-[#1e2c3a] bg-[#0a1118] px-1.5 py-0.5 text-[9px] text-[#a5b9cc]">
                {(["draft", "active", "analyzing", "review", "completed", "archived"] as CaseStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={active.priority} disabled={readOnly} onChange={(e) => patch({ priority: e.target.value as PaletteCase["priority"] })} className="rounded border border-[#1e2c3a] bg-[#0a1118] px-1.5 py-0.5 text-[9px] text-[#a5b9cc]">
                {["low", "normal", "high", "critical"].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="ml-auto flex items-center gap-1">
                <span className="hidden items-center gap-1 text-[8.5px] text-[#5c748a] sm:flex">{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-400/70" />} {saving ? "salvando" : "salvo local"}</span>
                <button onClick={() => setGlobalOpen(true)} title="Busca global (Ctrl+K)" className="rounded p-1 text-[#7f94a9] hover:bg-white/5"><Search className="h-3.5 w-3.5" /></button>
                <button onClick={() => setShareOpen(true)} title="Compartilhar" className="rounded p-1 text-[#7f94a9] hover:bg-white/5"><Share2 className="h-3.5 w-3.5" /></button>
                <button onClick={() => setRightOpen((v) => !v)} title="Painel de inteligência" className={cx("rounded p-1", rightOpen ? "text-cyan-300" : "text-[#7f94a9] hover:bg-white/5")}><Bot className="h-3.5 w-3.5" /></button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-cyan-300" /><span className="text-[13px] font-semibold text-[#eaf3fb]">Life Palette</span><span className="hidden text-[8.5px] text-[#5c748a] sm:inline">See Connections. Discover Intelligence.</span></div>
              <div className="ml-auto flex items-center gap-1.5">
                <button onClick={() => setGlobalOpen(true)} className="rounded-lg border border-[#1e2c3a] px-2 py-1 text-[9.5px] text-[#8ba1b6] hover:border-cyan-400/40"><Search className="mr-1 inline h-3 w-3" /> Buscar <span className="ml-1 hidden text-[8px] text-[#4f6377] sm:inline">Ctrl K</span></button>
                <PalButton size="sm" variant="primary" onClick={() => { setNewTemplate(undefined); setNewCaseOpen(true); }}><Plus className="h-3 w-3" /> Nova investigação</PalButton>
              </div>
            </>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto p-3">
            {!active || (view !== "cases" && workbenchViews.includes(view)) ? (
              <>
                {view === "overview" && <PaletteOverview cases={cases} onOpen={openCase} onNew={() => { setNewTemplate(undefined); setNewCaseOpen(true); }} />}
                {view === "cases" && <PaletteCases cases={recentCases} title="My Investigations" subtitle="Casos criados neste navegador. Canvas, entidades e evidências são persistidos localmente."
                  onOpen={openCase} onDelete={removeCase} onDuplicate={(id) => { const copy = duplicateCase(id); if (copy) { setCases(listAllVisibleCases()); openCase(copy.id); toast("Caso duplicado.", "ok"); } }}
                  onExport={(id) => { const c = getCase(id); if (c) { const blob = new Blob([exportCaseJson(c)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${c.code}-palette.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("Caso exportado.", "ok"); } }}
                  onShare={(id) => { const c = getCase(id); if (c) { setActiveId(id); setActive(c); setShareOpen(true); } }}
                  onNew={() => { setNewTemplate(undefined); setNewCaseOpen(true); }} />}
                {view === "recent" && <PaletteCases cases={recentCases.slice(0, 8)} title="Recent Cases" subtitle="Últimos casos abertos ou atualizados."
                  onOpen={openCase} onDelete={removeCase} onDuplicate={(id) => { const copy = duplicateCase(id); if (copy) { setCases(listAllVisibleCases()); openCase(copy.id); } }}
                  onExport={(id) => { const c = getCase(id); if (c) { const blob = new Blob([exportCaseJson(c)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${c.code}-palette.json`; a.click(); } }}
                  onShare={(id) => { const c = getCase(id); if (c) { setActive(c); setActiveId(id); setShareOpen(true); } }} onNew={() => setNewCaseOpen(true)} />}
                {view === "shared" && <PaletteCases cases={sharedCases} title="Shared Cases" subtitle="Snapshots read-only importados. A sincronização em tempo real entre colaboradores exige backend e não está habilitada."
                  onOpen={openCase} onDelete={removeCase} onDuplicate={(id) => { const copy = duplicateCase(id); if (copy) { setCases(listAllVisibleCases()); openCase(copy.id); toast("Cópia editável criada em My Investigations.", "ok"); } }}
                  onExport={(id) => { const c = getCase(id); if (c) { const blob = new Blob([exportCaseJson(c)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${c.code}-palette.json`; a.click(); } }}
                  onShare={(id) => { const c = getCase(id); if (c) { setActive(c); setActiveId(id); setShareOpen(true); } }} onNew={() => setNewCaseOpen(true)} />}
                {view === "templates" && <PaletteTemplates onUse={(id) => { setNewTemplate(id); setNewCaseOpen(true); }} />}
                {view === "library" && <PaletteLibrary cases={cases} onOpenCase={(cid, nid) => { openCase(cid); setSelection({ nodeId: nid }); setRightTab("inspector"); setRightOpen(true); }} />}
                {view === "knowledge" && <PaletteKnowledge onToast={toast} />}
                {view === "sources" && (
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-[15px] font-semibold text-[#eaf3fb]">Intelligence Sources</h2>
                      <p className="text-[10.5px] text-[#71879c]">Fontes gratuitas já usadas pela plataforma. Todas as consultas passam pelas server functions com rate limit e SSRF guard.</p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {Object.values(SEARCH_SOURCES).map((s) => (
                        <div key={s.id} className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-2.5">
                          <div className="flex items-center justify-between"><span className="text-[10.5px] font-medium text-[#e3edf8]">{s.name}</span><span className="rounded bg-emerald-400/10 px-1 text-[8px] text-emerald-300">grátis</span></div>
                          <p className="mt-0.5 text-[9.5px] leading-relaxed text-[#7f94a9]">{s.description}</p>
                          {active && <PalButton size="sm" variant="ghost" className="mt-1 !px-1.5" onClick={() => runSearchFromPanel(s.id, selectedNode?.title ?? "")}>consultar</PalButton>}
                        </div>
                      ))}
                    </div>
                    {active && <div className="rounded-xl border border-[#1e2c3a] bg-[#080f16] p-3"><PalLabel>Uso neste caso</PalLabel><PaletteSourceView c={active} onRun={runSearchFromPanel} /></div>}
                  </div>
                )}
                {view === "ai" && (
                  <div className="mx-auto max-w-2xl">
                    <div className="mb-2">
                      <h2 className="text-[15px] font-semibold text-[#eaf3fb]">AI Assistant</h2>
                      <p className="text-[10.5px] text-[#71879c]">A IA é contextual ao caso aberto. Abra um caso para conversar com o analista.</p>
                    </div>
                    {active ? (
                      <div className="h-[64vh] overflow-hidden rounded-xl border border-[#1e2c3a] bg-[#080f16]">
                        <PaletteAiPanel c={active} selected={selectedNode} memoryNote={memoryNote} onAction={(a) => void runAiAction(a)} onCitation={(ref, kind) => {
                          if (kind === "knowledge") { setView("knowledge"); return; }
                          if (kind === "edge") { setSelection({ edgeId: ref }); setRightTab("inspector"); setRightOpen(true); return; }
                          setSelection({ nodeId: ref }); setRightTab("inspector"); setRightOpen(true);
                        }} onSaveMemory={saveMemoryNote} onToast={toast} />
                      </div>
                    ) : <PalEmpty icon={Bot} title="Nenhum caso aberto" hint="Abra uma investigação para usar o Life Intelligence AI com contexto." />}
                  </div>
                )}
                {view === "reports" && <PaletteReports cases={cases} initialCaseId={activeId} onToast={toast} />}
                {view === "settings" && <PaletteSettings prefs={prefs} onChange={(p) => { const next = savePrefs(p); setPrefs(next); }} onToast={toast} onReset={() => {
                  for (const key of ["life-palette.cases.v1", "life-palette.shared.v1", "life-palette.knowledge.v1", "life-palette.memory.v1", "life-palette.feedback.v1", "life-palette.prefs.v1"]) window.localStorage.removeItem(key);
                  invalidateKnowledgeCache(); ensureSeedKnowledge();
                  setCases([]); setActive(null); setActiveId(undefined); setMemories(getMemory()); setPrefs(getPrefs());
                  toast("Dados locais apagados.", "ok");
                }} />}
              </>
            ) : (
              active && (
                <div className="flex h-full min-h-[70vh] flex-col">
                  {/* plan */}
                  {active.plan.length > 0 && (
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#1b2836] bg-[#080f16] px-2 py-1.5">
                      <span className="text-[8.5px] uppercase tracking-wide text-[#5c748a]">plano</span>
                      {active.plan.map((s) => (
                        <button key={s.id} disabled={readOnly} onClick={() => patch({ plan: active.plan.map((p) => (p.id === s.id ? { ...p, done: !p.done } : p)) }, { log: `${s.done ? "Reaberta" : "Concluída"} etapa: ${s.label}` })}
                          title={s.hint} className={cx("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[8.5px]", s.done ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[#243546] text-[#8399ae] hover:border-cyan-400/40")}>
                          {s.done ? <Check className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full border border-current" />} {s.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mb-2 flex flex-wrap items-center gap-1">
                    {([["canvas", "Canvas"], ["table", "Tabela"], ["timeline", "Timeline"], ["evidence", "Evidências"], ["insights", "Análise"], ["reports", "Relatórios"], ["notes", "Notas"], ["comments", "Comentários"]] as Array<[WorkspaceTab, string]>).map(([key, label]) => (
                      <button key={key} onClick={() => setWorkspaceTab(key)} className={cx("rounded-md px-2 py-1 text-[10px] transition-colors", workspaceTab === key ? "bg-cyan-400/10 text-cyan-200" : "text-[#71879c] hover:bg-white/[0.03] hover:text-[#c6d6e6]")}>{label}</button>
                    ))}
                    <div className="ml-auto flex items-center gap-1">
                      <span className="hidden text-[8.5px] text-[#4f6377] sm:inline">{stats?.nodes} nós · {stats?.edges} relações · {stats?.evidence} evidências</span>
                      <button onClick={() => setGlobalOpen(true)} className="rounded p-1 text-[#7f94a9] hover:bg-white/5"><Search className="h-3 w-3" /></button>
                    </div>
                  </div>

                  <div className={cx("grid min-h-0 flex-1 gap-2", rightOpen && "lg:grid-cols-[minmax(0,1fr)_330px]")}>
                    <div className="min-w-0">
                      {workspaceTab === "canvas" && (
                        <div className="h-[calc(100vh-250px)] min-h-[460px]">
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
                        </div>
                      )}
                      {workspaceTab === "table" && <div className="rounded-xl border border-[#1b2836] bg-[#080f16] p-2"><PaletteTableView c={active} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} /></div>}
                      {workspaceTab === "timeline" && <div className="rounded-xl border border-[#1b2836] bg-[#080f16] p-2"><PaletteTimeline c={active} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} /></div>}
                      {workspaceTab === "evidence" && <div className="rounded-xl border border-[#1b2836] bg-[#080f16] p-2"><PaletteEvidenceBoard c={active} onAdd={() => { setEvidenceNodeId(selectedNode?.id); setEvidenceOpen(true); }} onDelete={deleteEvidence} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} /></div>}
                      {workspaceTab === "insights" && <PaletteInsights c={active} onSelectNode={(id) => { setSelection({ nodeId: id }); setRightTab("inspector"); setRightOpen(true); }} onMergeDuplicates={handleMerge} onRunSuggestion={handleSuggestion} />}
                      {workspaceTab === "reports" && <div className="rounded-xl border border-[#1b2836] bg-[#080f16] p-2"><PaletteReports cases={[active]} initialCaseId={active.id} onToast={toast} /></div>}
                      {workspaceTab === "notes" && <div className="rounded-xl border border-[#1b2836] bg-[#080f16] p-3"><PaletteNotes c={active} onAdd={(body) => patch({ notes: [{ id: uid("note"), at: new Date().toISOString(), author: prefs.analystName, body }, ...active.notes] }, { log: "Nota adicionada" })} /></div>}
                      {workspaceTab === "comments" && <div className="rounded-xl border border-[#1b2836] bg-[#080f16] p-3"><PaletteComments c={active} onAdd={(body) => patch({ comments: [{ id: uid("comment"), at: new Date().toISOString(), author: prefs.analystName, body, resolved: false }, ...active.comments] })} /></div>}
                    </div>

                    {rightOpen && (
                      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-[#1b2836] bg-[#070d14] lg:h-[calc(100vh-250px)] lg:min-h-[460px]">
                        <div className="flex items-center gap-0.5 border-b border-[#16212d] px-1.5 py-1">
                          {([["ai", Bot, "Life AI"], ["inspector", CaseSensitive, "Inspetor"], ["search", Search, "Busca"], ["sources", Radar, "Fontes"]] as const).map(([key, Icon, label]) => (
                            <button key={key} onClick={() => setRightTab(key)} className={cx("flex flex-1 items-center justify-center gap-1 rounded px-1 py-1 text-[9px]", rightTab === key ? "bg-cyan-400/10 text-cyan-200" : "text-[#71879c] hover:text-white")}><Icon className="h-3 w-3" /> {label}</button>
                          ))}
                          <button onClick={() => setRightOpen(false)} className="ml-0.5 rounded p-1 text-[#5c748a] hover:text-white"><X className="h-3 w-3" /></button>
                        </div>
                        <div className="min-h-0 flex-1">
                          {rightTab === "ai" && <PaletteAiPanel c={active} selected={selectedNode} memoryNote={memoryNote} onAction={(a) => void runAiAction(a)} onCitation={(ref, kind) => {
                            if (kind === "knowledge") { setView("knowledge"); return; }
                            if (kind === "edge") { setSelection({ edgeId: ref }); setRightTab("inspector"); return; }
                            setSelection({ nodeId: ref }); setRightTab("inspector");
                          }} onSaveMemory={saveMemoryNote} onToast={toast} />}
                          {rightTab === "inspector" && selectedNode && <EntityInspector c={active} node={selectedNode} readOnly={readOnly}
                            onUpdate={updateNode} onDelete={() => setDeleteConfirm({ kind: "node", id: selectedNode.id, label: selectedNode.title })}
                            onAddConnection={startConnection} onInvestigate={() => runSearchFromPanel(SEARCH_SOURCES[defaultTool(selectedNode.kind)]?.id ?? "domainLookup", selectedNode.title)}
                            onAsk={(q) => { setRightTab("ai"); setTimeout(() => window.dispatchEvent(new CustomEvent("palette:ask", { detail: q })), 30); }}
                            onAddEvidence={() => { setEvidenceNodeId(selectedNode.id); setEvidenceOpen(true); }}
                            onSelect={(id) => { setSelection({ nodeId: id }); }} onClose={() => setRightTab("ai")} />}
                          {rightTab === "inspector" && !selectedNode && selectedEdge && <EdgeInspector c={active} edge={selectedEdge} readOnly={readOnly} onUpdate={updateEdge} onDelete={() => setDeleteConfirm({ kind: "edge", id: selectedEdge.id, label: selectedEdge.relation })} onClose={() => setRightTab("ai")} onSelect={(id) => setSelection({ nodeId: id })} />}
                          {rightTab === "inspector" && !selectedNode && !selectedEdge && (
                            <div className="p-3"><PalEmpty icon={CaseSensitive} title="Nenhum elemento selecionado" hint="Clique em uma entidade ou relação no canvas para inspecionar propriedades, fontes, evidências e histórico." /></div>
                          )}
                          {rightTab === "search" && <PaletteSearchPanel c={active} node={selectedNode} readOnly={readOnly} onRecord={handleRecord} onImport={openImport} onToast={toast} />}
                          {rightTab === "sources" && <div className="h-full overflow-y-auto p-3"><PaletteSourceView c={active} onRun={runSearchFromPanel} /></div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
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
          footer={<><PalButton variant="ghost" onClick={() => setDeleteConfirm(null)}>Cancelar</PalButton><PalButton variant="danger" onClick={confirmDelete}><Trash2Icon /> Excluir</PalButton></>}>
          <p className="text-[11.5px] leading-relaxed text-[#b6c8da]">Excluir <b className="text-[#eaf3fb]">{deleteConfirm.label}</b>? {deleteConfirm.kind === "case" ? "O caso e suas evidências locais serão removidos." : "As conexões associadas também serão removidas."}</p>
        </Modal>
      )}

      {/* toasts */}
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
    case "url": case "website": return "urlAnalyzer";
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

function Trash2Icon() { return <X className="h-3.5 w-3.5" />; }

export { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, ConfidencePill, Command, FileSearch, GitBranch, KindPill, PalLabel, UserIcon };

function UserIcon() { return <Users className="h-4 w-4" />; }
