import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, NodeResizer, Position,
  ReactFlow, ReactFlowProvider, useReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, type OnMoveEnd,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import {
  Check, ChevronDown, Download, Expand, Eye, EyeOff, GitBranch, Image as ImageIcon, Layers,
  Maximize2, Minimize2, Plus, Redo2, Search, Trash2, Undo2, X,
} from "lucide-react";
import { CONFIDENCE_LABEL, NODE_KIND_LABEL, type ConfidenceLevel, type PaletteCase, type PaletteGroup, type PaletteNode, type PaletteNodeKind, type PalettePrefs } from "@/lib/palette/types";
import { CONF_COLOR, KIND_COLOR, KindIcon, KindPill, PalButton, PalField, selectCls, inputCls } from "./kit";
import { cx } from "@/components/agency/kit";

type EntityData = { node: PaletteNode; size: PalettePrefs["nodeSize"] };
type GroupData = { group: PaletteGroup; onResize?: (p: { x: number; y: number; width: number; height: number }) => void };

type EntityFlowNode = Node<EntityData, "entity">;
type GroupFlowNode = Node<GroupData, "groupbox">;

function EntityCard({ data, selected }: NodeProps<EntityFlowNode>) {
  const { node, size } = data;
  const color = KIND_COLOR[node.kind];
  const width = size === "compact" ? 156 : size === "large" ? 216 : 184;
  const conf = CONF_COLOR[node.confidence];
  return (
    <div
      className={cx(
        "rounded-xl border bg-[#0b131c]/95 text-left shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)] backdrop-blur-sm transition-shadow",
        selected ? "border-cyan-300/70" : "border-[#243546] hover:border-[#38556f]",
      )}
      style={{ width, borderLeft: `3px solid ${color}`, boxShadow: selected ? `0 0 0 2px rgba(34,211,238,.25), 0 12px 30px -18px #000` : undefined }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-cyan-300/50" />
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-cyan-300/50" />
      <div className="px-2.5 py-2">
        <div className="flex items-start gap-1.5">
          <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md" style={{ background: `${color}18`, color, border: `1px solid ${color}44` }}>
            <KindIcon kind={node.kind} className="h-3 w-3" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11.5px] font-semibold leading-tight text-[#e8f1fb]" title={node.title}>{node.title}</div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wide text-[#6f859a]">{NODE_KIND_LABEL[node.kind]}</div>
          </div>
          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full" style={{ background: conf.dot }} title={CONFIDENCE_LABEL[node.confidence]} />
        </div>
        {node.subtitle && <div className="mt-1 truncate text-[9.5px] text-[#8298ad]">{node.subtitle}</div>}
        <div className="mt-1.5 flex items-center justify-between gap-1 border-t border-white/[0.05] pt-1.5">
          <span className="truncate text-[8.5px] text-[#647a8f]" title={node.sources.join(", ")}>{node.sources[0] ?? "sem fonte"}{node.sources.length > 1 ? ` +${node.sources.length - 1}` : ""}</span>
          <span className="flex items-center gap-1 text-[8.5px] text-[#647a8f]">
            {node.evidenceIds.length > 0 && <span className="rounded bg-emerald-400/10 px-1 text-emerald-300">{node.evidenceIds.length} ev</span>}
            {node.groupId && <Layers className="h-2.5 w-2.5" />}
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-cyan-300/50" />
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-cyan-300/50" />
    </div>
  );
}

function GroupBox({ data, selected }: NodeProps<GroupFlowNode>) {
  const { group } = data;
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={220}
        minHeight={140}
        lineStyle={{ borderColor: group.color }}
        handleStyle={{ background: group.color, border: "none", width: 8, height: 8 }}
        onResizeEnd={(_, params) => data.onResize?.({ x: params.x, y: params.y, width: params.width, height: params.height })}
      />
      <div
        className="h-full w-full rounded-xl border-2 border-dashed"
        style={{ borderColor: `${group.color}66`, background: `${group.color}0d` }}
      >
        <div className="flex items-center gap-1.5 rounded-t-[10px] px-2 py-1" style={{ background: `${group.color}22` }}>
          <Layers className="h-3 w-3" style={{ color: group.color }} />
          <span className="truncate text-[10px] font-semibold" style={{ color: group.color }}>{group.title}</span>
          <span className="ml-auto rounded bg-black/30 px-1 text-[8.5px] text-[#b8c8d8]">{group.collapsed ? "recolhido" : "grupo"}</span>
        </div>
      </div>
    </>
  );
}

const NODE_TYPES = { entity: EntityCard, groupbox: GroupBox };
const CONF_LEVELS: ConfidenceLevel[] = ["verified", "high", "medium", "low", "unverified"];

function edgeColor(level: ConfidenceLevel): string {
  return level === "verified" ? "#34d399" : level === "high" ? "#22d3ee" : level === "medium" ? "#fbbf24" : level === "low" ? "#fb923c" : "#a78bfa";
}
function dash(style: "solid" | "dashed" | "dotted"): string | undefined {
  return style === "dashed" ? "7 5" : style === "dotted" ? "1.5 5" : undefined;
}

export type CanvasSelection = { nodeId?: string; edgeId?: string };

export function PaletteCanvas(props: {
  data: PaletteCase;
  prefs: PalettePrefs;
  readOnly: boolean;
  selection: CanvasSelection;
  canUndo: boolean;
  canRedo: boolean;
  onChange: (patch: Partial<Pick<PaletteCase, "nodes" | "edges" | "groups">>, opts?: { history?: boolean; log?: string }) => void;
  onSelect: (sel: CanvasSelection) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAutoLayout: (mode: "hierarchy" | "radial") => void;
  onAddNode: (position?: { x: number; y: number }) => void;
  onEditNode: (id: string) => void;
  onEditEdge: (id: string) => void;
  onRequestEvidence: (nodeId: string) => void;
  onViewport: (vp: { x: number; y: number; zoom: number }) => void;
  onToast: (message: string, tone?: "ok" | "warn" | "info") => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function CanvasInner({
  data, prefs, readOnly, selection, canUndo, canRedo, onChange, onSelect, onUndo, onRedo,
  onAutoLayout, onAddNode, onEditNode, onEditEdge, onRequestEvidence, onViewport, onToast,
}: Parameters<typeof PaletteCanvas>[0]) {
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [extraSelected, setExtraSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | PaletteNodeKind>("all");
  const [confFilter, setConfFilter] = useState<"all" | ConfidenceLevel>("all");
  const [menu, setMenu] = useState<{ x: number; y: number; kind: "node" | "edge" | "pane"; id?: string } | null>(null);
  const [exporting, setExporting] = useState(false);
  const flowWrap = useRef<HTMLDivElement>(null);
  const { fitView, setCenter, zoomIn, zoomOut, getViewport } = useReactFlow();
  const dragStart = useRef<{ id: string; x: number; y: number; members: Array<{ id: string; x: number; y: number }> } | null>(null);

  useEffect(() => { setPositions({}); setMenu(null); setExtraSelected([]); }, [data.id]);

  const visibleNodes = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return data.nodes.filter((n) => {
      if (kindFilter !== "all" && n.kind !== kindFilter) return false;
      if (confFilter !== "all" && n.confidence !== confFilter) return false;
      if (term && !`${n.title} ${n.subtitle ?? ""} ${n.tags.join(" ")} ${n.sources.join(" ")}`.toLowerCase().includes(term)) return false;
      const group = n.groupId ? data.groups.find((g) => g.id === n.groupId) : undefined;
      if (group?.collapsed) return false;
      return true;
    });
  }, [data.nodes, data.groups, filter, kindFilter, confFilter]);

  const visibleIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  const rfNodes: Array<EntityFlowNode | GroupFlowNode> = useMemo(() => {
    const groups: GroupFlowNode[] = data.groups.map((g) => ({
      id: g.id,
      type: "groupbox",
      position: positions[g.id] ?? { x: g.x, y: g.y },
      data: {
        group: g,
        onResize: (p) => onChange({ groups: data.groups.map((x) => (x.id === g.id ? { ...x, x: p.x, y: p.y, width: p.width, height: p.height } : x)) }, { history: true, log: `Grupo redimensionado: ${g.title}` }),
      },
      style: { width: g.width, height: g.height, zIndex: 0 },
      selected: selection.nodeId === g.id || extraSelected.includes(g.id),
      draggable: !readOnly,
      selectable: true,
      connectable: false,
    }));
    const nodes: EntityFlowNode[] = data.nodes.map((n) => ({
      id: n.id,
      type: "entity",
      position: positions[n.id] ?? { x: n.x, y: n.y },
      data: { node: n, size: prefs.nodeSize },
      hidden: !visibleIds.has(n.id),
      selected: selection.nodeId === n.id || extraSelected.includes(n.id),
      draggable: !readOnly,
      zIndex: 2,
    }));
    return [...groups, ...nodes];
  }, [data.groups, data.nodes, positions, selection.nodeId, prefs.nodeSize, readOnly, visibleIds, extraSelected, onChange]);

  const rfEdges: Edge[] = useMemo(() => data.edges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target) && (kindFilter === "all" || true))
    .map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.relation,
      labelShowBg: true,
      labelBgStyle: { fill: "#0a1118", fillOpacity: 0.92, stroke: "#223244", strokeWidth: 1 },
      labelBgPadding: [5, 2] as [number, number],
      labelBgBorderRadius: 4,
      labelStyle: { fill: "#a9bccf", fontSize: 9, fontWeight: 500 },
      style: {
        stroke: e.color ?? edgeColor(e.confidence),
        strokeWidth: e.width ?? (e.confidence === "verified" ? 2 : 1.4),
        strokeDasharray: dash(e.style),
        opacity: e.confidence === "unverified" ? 0.75 : 1,
      },
      animated: e.confidence === "verified",
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color ?? edgeColor(e.confidence), width: 14, height: 14 },
      markerStart: e.directed ? undefined : { type: MarkerType.ArrowClosed, color: e.color ?? edgeColor(e.confidence), width: 14, height: 14 },
      selected: selection.edgeId === e.id,
    })), [data.edges, visibleIds, selection.edgeId, kindFilter]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const next: Record<string, { x: number; y: number }> = {};
    const selectChanges: Array<{ id: string; selected: boolean }> = [];
    for (const change of changes) {
      if (change.type === "position" && change.position) next[change.id] = change.position;
      if (change.type === "select") selectChanges.push({ id: change.id, selected: Boolean(change.selected) });
    }
    if (Object.keys(next).length) setPositions((prev) => ({ ...prev, ...next }));
    if (selectChanges.length) {
      setExtraSelected((prev) => {
        const set = new Set(prev);
        for (const sc of selectChanges) { if (sc.selected) set.add(sc.id); else set.delete(sc.id); }
        return [...set];
      });
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removed = changes.filter((c) => c.type === "remove").map((c) => c.id);
    if (removed.length && !readOnly) {
      onChange({ edges: data.edges.filter((e) => !removed.includes(e.id)) }, { history: true, log: `${removed.length} relação(ões) removida(s)` });
    }
  }, [data.edges, onChange, readOnly]);

  const onConnect = useCallback((conn: Connection) => {
    if (readOnly || !conn.source || !conn.target || conn.source === conn.target) return;
    // The parent owns edge creation so it can open the relationship editor.
    onEditEdge(`new:${conn.source}:${conn.target}`);
  }, [readOnly, onEditEdge]);

  const persistPositions = useCallback(() => {
    if (readOnly) return;
    const nodes = data.nodes.map((n) => (positions[n.id] ? { ...n, x: positions[n.id].x, y: positions[n.id].y, updatedAt: new Date().toISOString() } : n));
    const groups = data.groups.map((g) => (positions[g.id] ? { ...g, x: positions[g.id].x, y: positions[g.id].y } : g));
    const changed = nodes.some((n, i) => n.x !== data.nodes[i].x || n.y !== data.nodes[i].y) || groups.some((g, i) => g.x !== data.groups[i].x || g.y !== data.groups[i].y);
    if (changed) onChange({ nodes, groups }, { history: true, log: "Posições atualizadas no canvas" });
  }, [data.nodes, data.groups, positions, onChange, readOnly]);

  const handleDragStart = useCallback((_: unknown, node: Node) => {
    const group = data.groups.find((g) => g.id === node.id);
    const members = group ? data.nodes.filter((n) => n.groupId === group.id) : [];
    dragStart.current = {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      members: members.map((m) => ({ id: m.id, x: positions[m.id]?.x ?? m.x, y: positions[m.id]?.y ?? m.y })),
    };
  }, [data.groups, data.nodes, positions]);

  const handleDrag = useCallback((_: unknown, node: Node) => {
    if (!dragStart.current || dragStart.current.id !== node.id) return;
    const dx = node.position.x - dragStart.current.x;
    const dy = node.position.y - dragStart.current.y;
    if (!dragStart.current.members.length || (!dx && !dy)) return;
    setPositions((prev) => {
      const next = { ...prev };
      for (const m of dragStart.current!.members) next[m.id] = { x: m.x + dx, y: m.y + dy };
      return next;
    });
  }, []);

  const exportPng = async () => {
    const viewport = flowWrap.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewport) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(viewport, { backgroundColor: "#060b11", pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${data.code}-canvas.png`;
      a.click();
      onToast("Canvas exportado em PNG.", "ok");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Falha ao exportar PNG.", "warn");
    } finally {
      setExporting(false);
    }
  };

  const onMoveEnd: OnMoveEnd = useCallback((_, vp) => { onViewport({ x: vp.x, y: vp.y, zoom: vp.zoom }); }, [onViewport]);

  const menuNode = menu?.kind === "node" && menu.id ? data.nodes.find((n) => n.id === menu.id) : null;
  const menuGroup = menu?.kind === "node" && menu.id ? data.groups.find((g) => g.id === menu.id) : null;

  const selectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selection.nodeId && data.nodes.some((n) => n.id === selection.nodeId)) ids.add(selection.nodeId);
    for (const id of extraSelected) if (data.nodes.some((n) => n.id === id)) ids.add(id);
    return [...ids];
  }, [selection.nodeId, extraSelected, data.nodes]);
  const singleSelected = selectedNodeIds.length === 1 ? data.nodes.find((n) => n.id === selectedNodeIds[0]) : null;

  const groupSelected = () => {
    if (readOnly || selectedNodeIds.length < 2) return;
    const members = data.nodes.filter((n) => selectedNodeIds.includes(n.id));
    const minX = Math.min(...members.map((n) => n.x)) - 28;
    const minY = Math.min(...members.map((n) => n.y)) - 54;
    const maxX = Math.max(...members.map((n) => n.x)) + 216;
    const maxY = Math.max(...members.map((n) => n.y)) + 150;
    const group: PaletteGroup = {
      id: `group-${Math.random().toString(36).slice(2, 9)}`,
      title: `Grupo ${data.groups.length + 1}`,
      color: "#22d3ee", x: minX, y: minY, width: maxX - minX, height: maxY - minY, collapsed: false,
    };
    onChange(
      { groups: [...data.groups, group], nodes: data.nodes.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, groupId: group.id } : n)) },
      { history: true, log: `Grupo criado com ${members.length} entidades` },
    );
    setExtraSelected([]);
  };

  const ungroupSelected = () => {
    if (readOnly || !singleSelected?.groupId) return;
    onChange(
      { nodes: data.nodes.map((n) => (n.id === singleSelected.id ? { ...n, groupId: undefined } : n)) },
      { history: true, log: `Entidade desagrupada: ${singleSelected.title}` },
    );
  };

  return (
    <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-xl border border-[#1b2836] bg-[#060b11]" ref={flowWrap}>
      <div className="flex flex-wrap items-center gap-1 border-b border-[#16212d] bg-[#080e15]/90 px-2 py-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#5f758b]" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar nós" className="w-[130px] rounded-md border border-[#1e2c3a] bg-[#0a1118] py-1 pl-6 pr-2 text-[10.5px] text-[#dbe7f4] outline-none focus:border-cyan-400/50" />
        </div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className="rounded-md border border-[#1e2c3a] bg-[#0a1118] px-1.5 py-1 text-[10px] text-[#b9cadb] outline-none">
          <option value="all">Todos os tipos</option>
          {(Object.keys(NODE_KIND_LABEL) as PaletteNodeKind[]).map((k) => <option key={k} value={k}>{NODE_KIND_LABEL[k]}</option>)}
        </select>
        <select value={confFilter} onChange={(e) => setConfFilter(e.target.value as typeof confFilter)} className="rounded-md border border-[#1e2c3a] bg-[#0a1118] px-1.5 py-1 text-[10px] text-[#b9cadb] outline-none">
          <option value="all">Toda confiança</option>
          {CONF_LEVELS.map((l) => <option key={l} value={l}>{CONFIDENCE_LABEL[l]}</option>)}
        </select>
        <span className="mx-1 h-4 w-px bg-[#1e2c3a]" />
        <button onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white disabled:opacity-35"><Undo2 className="h-3.5 w-3.5" /></button>
        <button onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Shift+Z)" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white disabled:opacity-35"><Redo2 className="h-3.5 w-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-[#1e2c3a]" />
        <button onClick={() => void fitView({ padding: 0.2, duration: 300 })} title="Ajustar conteúdo" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white"><Maximize2 className="h-3.5 w-3.5" /></button>
        <button onClick={() => { const vp = getViewport(); void setCenter(-vp.x / vp.zoom + 300, -vp.y / vp.zoom + 200, { zoom: vp.zoom, duration: 300 }); }} title="Centralizar investigação" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white"><Minimize2 className="h-3.5 w-3.5" /></button>
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden items-center gap-1 sm:flex">
            <button onClick={() => onAutoLayout("hierarchy")} title="Layout hierárquico" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white"><GitBranch className="h-3.5 w-3.5" /></button>
            <button onClick={() => onAutoLayout("radial")} title="Layout radial" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white"><Expand className="h-3.5 w-3.5" /></button>
          </div>
          <button onClick={() => void exportPng()} disabled={exporting} title="Exportar PNG" className="rounded p-1 text-[#8fa4b8] hover:bg-white/5 hover:text-white disabled:opacity-40"><ImageIcon className="h-3.5 w-3.5" /></button>
          {!readOnly && (
            <button onClick={() => onAddNode()} className="ml-1 inline-flex items-center gap-1 rounded-md border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-200 hover:bg-cyan-400/20">
              <Plus className="h-3 w-3" /> Nó
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {!readOnly && (selectedNodeIds.length > 1 || singleSelected?.groupId) && (
          <div className="absolute right-2 top-2 z-20 flex items-center gap-1 rounded-lg border border-[#22323f] bg-[#080f16]/95 p-1 shadow-lg backdrop-blur">
            {selectedNodeIds.length > 1 && (
              <button onClick={groupSelected} className="inline-flex items-center gap-1 rounded-md border border-cyan-400/35 bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-100 hover:bg-cyan-400/20">
                <Layers className="h-3 w-3" /> Agrupar {selectedNodeIds.length}
              </button>
            )}
            {singleSelected?.groupId && (
              <button onClick={ungroupSelected} className="inline-flex items-center gap-1 rounded-md border border-[#2a3c4c] px-2 py-1 text-[10px] text-[#b4c7d8] hover:bg-white/5">
                <X className="h-3 w-3" /> Desagrupar
              </button>
            )}
          </div>
        )}
        <ReactFlow
          key={data.id}
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={handleDragStart}
          onNodeDrag={handleDrag}
          onNodeDragStop={() => { persistPositions(); dragStart.current = null; }}
          onNodeClick={(_, n) => onSelect({ nodeId: n.id })}
          onEdgeClick={(_, e) => onSelect({ edgeId: e.id })}
          onNodeDoubleClick={(_, n) => { if (data.nodes.some((x) => x.id === n.id)) onEditNode(n.id); }}
          onPaneClick={() => { onSelect({}); setMenu(null); setExtraSelected([]); }}
          onNodeContextMenu={(e, n) => { e.preventDefault(); onSelect({ nodeId: n.id }); setMenu({ x: e.clientX, y: e.clientY, kind: "node", id: n.id }); }}
          onEdgeContextMenu={(e, edge) => { e.preventDefault(); onSelect({ edgeId: edge.id }); setMenu({ x: e.clientX, y: e.clientY, kind: "edge", id: edge.id }); }}
          onPaneContextMenu={(e) => { e.preventDefault(); setMenu({ x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY, kind: "pane" }); }}
          onMoveEnd={onMoveEnd}
          defaultViewport={data.viewport}
          minZoom={0.12}
          maxZoom={2.4}
          fitView={data.nodes.length > 0 && data.viewport.zoom === 1 && !data.viewport.x && !data.viewport.y}
          fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag={false}
          selectionKeyCode="Shift"
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          panOnScroll
          zoomOnDoubleClick={false}
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          edgesReconnectable={false}
          elementsSelectable
          defaultEdgeOptions={{ type: "default" }}
          className="ag-palette-flow"
        >
          {prefs.showGrid && <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#18242f" />}
          {prefs.showMinimap && (
            <MiniMap
              pannable
              zoomable
              className="!bottom-2 !right-2 !h-[90px] !w-[140px] !rounded-lg !border !border-[#243546] !bg-black/70"
              maskColor="rgba(3,7,12,.7)"
              nodeColor={(n) => {
                const d = n.data as EntityData | GroupData;
                return "node" in d ? KIND_COLOR[d.node.kind] : d.group.color;
              }}
            />
          )}
          <Controls showInteractive={false} className="!bottom-2 !left-2 !rounded-lg !border !border-[#243546] !bg-[#0a1118] !shadow-none [&>button]:!border-[#1e2c3a] [&>button]:!bg-[#0a1118] [&>button]:!text-[#a5b8ca] [&>button:hover]:!bg-[#142030]" />
        </ReactFlow>

        {data.nodes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-xl border border-dashed border-[#27394b] bg-[#080f16]/80 p-5 text-center backdrop-blur">
              <Layers className="mx-auto mb-2 h-6 w-6 text-[#4d6a82]" />
              <div className="text-[12.5px] font-medium text-[#cfe0f0]">Canvas vazio</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-[#7b91a6]">Adicione a semente da investigação, consulte uma fonte e importe as entidades extraídas. As posições, grupos e zoom são salvos automaticamente.</p>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-2 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-lg border border-[#1e2c3a] bg-black/60 px-2 py-1 text-[8.5px] text-[#7f94a9] backdrop-blur md:flex">
          <span className="inline-flex items-center gap-1"><span className="h-px w-5 bg-emerald-400" /> evidência</span>
          <span className="inline-flex items-center gap-1"><span className="h-px w-5 border-t border-dashed border-amber-400" /> possível</span>
          <span className="inline-flex items-center gap-1"><span className="h-px w-5 border-t border-dotted border-violet-400" /> hipótese</span>
          <span className="text-[#4d6276]">·</span>
          <span>Shift + arrastar = seleção</span>
          <span className="text-[#4d6276]">·</span>
          <span>duplo clique = editar</span>
        </div>
      </div>

      {menu && (
        <div className="fixed z-[70] w-52 overflow-hidden rounded-lg border border-[#253646] bg-[#0a1118] py-1 shadow-2xl" style={{ left: Math.min(menu.x, window.innerWidth - 220), top: Math.min(menu.y, window.innerHeight - 240) }} onMouseLeave={() => setMenu(null)}>
          {menu.kind === "pane" && (
            <>
              <MenuItem icon={<Plus className="h-3 w-3" />} label="Adicionar entidade" onClick={() => { onAddNode(); setMenu(null); }} disabled={readOnly} />
              <MenuItem icon={<Maximize2 className="h-3 w-3" />} label="Ajustar à tela" onClick={() => { void fitView({ padding: 0.2 }); setMenu(null); }} />
              <MenuItem icon={<Search className="h-3 w-3" />} label="Buscar no caso" onClick={() => { window.dispatchEvent(new CustomEvent("palette:global-search")); setMenu(null); }} />
            </>
          )}
          {menu.kind === "node" && menuNode && (
            <>
              <MenuItem icon={<Eye className="h-3 w-3" />} label="Abrir inspetor" onClick={() => { onEditNode(menuNode.id); setMenu(null); }} />
              <MenuItem icon={<GitBranch className="h-3 w-3" />} label="Investigar entidade" onClick={() => { onEditNode(menuNode.id); setMenu(null); }} />
              <MenuItem icon={<Check className="h-3 w-3" />} label="Anexar evidência" onClick={() => { onRequestEvidence(menuNode.id); setMenu(null); }} />
              <MenuItem icon={<Plus className="h-3 w-3" />} label="Definir confiança" onClick={() => { onEditNode(menuNode.id); setMenu(null); }} />
              {menuNode.groupId && (
                <MenuItem icon={<X className="h-3 w-3" />} label="Desagrupar entidade" onClick={() => { onSelect({ nodeId: menuNode.id }); ungroupSelected(); setMenu(null); }} disabled={readOnly} />
              )}
              <div className="my-1 h-px bg-[#1b2836]" />
              <MenuItem danger icon={<Trash2 className="h-3 w-3" />} label="Remover entidade" onClick={() => {
                onChange({ nodes: data.nodes.filter((n) => n.id !== menuNode.id), edges: data.edges.filter((e) => e.source !== menuNode.id && e.target !== menuNode.id) }, { history: true, log: `Entidade removida: ${menuNode.title}` });
                onSelect({}); setMenu(null);
              }} disabled={readOnly} />
            </>
          )}
          {menu.kind === "node" && menuGroup && (
            <>
              <MenuItem icon={menuGroup.collapsed ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />} label={menuGroup.collapsed ? "Expandir grupo" : "Recolher grupo"} onClick={() => {
                onChange({ groups: data.groups.map((g) => (g.id === menuGroup.id ? { ...g, collapsed: !g.collapsed } : g)) }, { history: true, log: "Grupo alterado" });
                setMenu(null);
              }} />
              <MenuItem danger icon={<Trash2 className="h-3 w-3" />} label="Excluir grupo" onClick={() => {
                onChange({ groups: data.groups.filter((g) => g.id !== menuGroup.id), nodes: data.nodes.map((n) => (n.groupId === menuGroup.id ? { ...n, groupId: undefined } : n)) }, { history: true, log: "Grupo removido" });
                setMenu(null);
              }} disabled={readOnly} />
            </>
          )}
          {menu.kind === "edge" && menu.id && (
            <>
              <MenuItem icon={<GitBranch className="h-3 w-3" />} label="Editar relação" onClick={() => { onEditEdge(menu.id!); setMenu(null); }} />
              <MenuItem danger icon={<Trash2 className="h-3 w-3" />} label="Remover relação" onClick={() => {
                onChange({ edges: data.edges.filter((e) => e.id !== menu.id) }, { history: true, log: "Relação removida" });
                onSelect({}); setMenu(null);
              }} disabled={readOnly} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={cx("flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors disabled:opacity-40", danger ? "text-rose-300 hover:bg-rose-500/10" : "text-[#c2d2e2] hover:bg-white/[0.05]")}>
      {icon}{label}
    </button>
  );
}

/* Re-exported helpers used by modal selects */
export function NodeKindSelect({ value, onChange }: { value: PaletteNodeKind; onChange: (v: PaletteNodeKind) => void }) {
  return (
    <PalField label="Tipo de entidade">
      <select className={selectCls} value={value} onChange={(e) => onChange(e.target.value as PaletteNodeKind)}>
        {(Object.keys(NODE_KIND_LABEL) as PaletteNodeKind[]).map((k) => <option key={k} value={k}>{NODE_KIND_LABEL[k]}</option>)}
      </select>
    </PalField>
  );
}

export function NodeSummary({ node }: { node: PaletteNode }) {
  return (
    <div className="flex items-center gap-2">
      <KindPill kind={node.kind} />
      <span className="truncate text-[11px] text-[#dbe7f4]">{node.title}</span>
      {node.groupId && <span className="text-[9px] text-[#647a8f]"><Layers className="inline h-2.5 w-2.5" /></span>}
    </div>
  );
}

export { inputCls, PalButton, Download, X };
