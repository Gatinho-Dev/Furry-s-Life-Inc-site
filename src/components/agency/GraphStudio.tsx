import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background, Controls, MiniMap, ReactFlow,
  type Connection, type Edge, type EdgeChange, type Node, type NodeChange, type NodeProps, Handle, Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng, toSvg } from "html-to-image";
import {
  Download, Expand, Filter, Image as ImageIcon, Plus, Save, Search, Trash2, X, FileJson,
} from "lucide-react";
import { domainLookup, sslAnalyzer, subdomainFinder } from "@/lib/agency/api/domain.functions";
import { ipLookup } from "@/lib/agency/api/ip.functions";
import { usernameScan } from "@/lib/agency/api/social.functions";
import {
  deleteGraph, getGraph, listGraphs, listInvestigations, saveGraph, uid,
  type EntityKind, type GraphDoc, type GraphEdge, type GraphNode,
} from "@/lib/agency/store";
import { ENTITY_LABELS } from "@/lib/agency/types";
import { download, formatDate } from "@/lib/agency/format";
import { Badge, Button, Empty, Field, Notice, Panel, Spinner, cx, errorMessage } from "./kit";

const KIND_COLOR: Record<string, string> = {
  domain: "#3b82f6", subdomain: "#60a5fa", ip: "#0ea5e9", asn: "#22d3ee",
  organization: "#eab308", certificate: "#a78bfa", url: "#ec4899", cve: "#fb7185",
  hash: "#f97316", username: "#34d399", email: "#f472b6", person: "#e5e7eb", note: "#64748b",
};

type NodeData = { kind: EntityKind; label: string; source: string; confidence: string; at: string };

function EntityNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const color = KIND_COLOR[d.kind] ?? "#64748b";
  return (
    <div className="flex flex-col items-center gap-1" style={{ minWidth: 92 }}>
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-white/25" />
      <div
        className="flex h-10 w-10 items-center justify-center rounded-lg border text-[10px] font-bold uppercase"
        style={{
          background: `${color}22`, borderColor: `${color}88`, color,
          boxShadow: selected ? `0 0 0 3px ${color}55` : undefined,
        }}
      >
        {d.kind.slice(0, 3)}
      </div>
      <div className="max-w-[150px] truncate rounded border border-[#26333f] bg-black/80 px-1.5 py-0.5 text-[10px] text-white" title={d.label}>
        {d.label}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-white/25" />
    </div>
  );
}

const NODE_TYPES = { entity: EntityNode };

export function GraphStudio({ caseId }: { caseId?: string }) {
  const [graphs, setGraphs] = useState<GraphDoc[]>([]);
  const [doc, setDoc] = useState<GraphDoc>(() => blankGraph());
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [addKind, setAddKind] = useState<EntityKind>("domain");
  const [addValue, setAddValue] = useState("");
  const [expanding, setExpanding] = useState(false);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGraphs(listGraphs());
    if (caseId) {
      const inv = listInvestigations().find((i) => i.id === caseId);
      if (inv) {
        const nodes: GraphNode[] = inv.entities.map((e, i) => ({
          id: e.id, kind: e.kind, label: e.value, source: e.source,
          confidence: e.confidence, at: e.at,
          x: 120 + (i % 4) * 190, y: 100 + Math.floor(i / 4) * 130,
        }));
        setDoc({ id: uid("graph"), name: `${inv.code} — ${inv.name}`, nodes, edges: [], updatedAt: new Date().toISOString() });
      }
    }
  }, [caseId]);

  const nodes: Node<NodeData>[] = useMemo(() => doc.nodes.map((n) => ({
    id: n.id, type: "entity", position: { x: n.x, y: n.y },
    data: { kind: n.kind, label: n.label, source: n.source, confidence: n.confidence, at: n.at },
    hidden: (kindFilter !== "all" && n.kind !== kindFilter) || (filter.trim() !== "" && !n.label.toLowerCase().includes(filter.trim().toLowerCase())),
  })), [doc.nodes, kindFilter, filter]);

  const edges: Edge[] = useMemo(() => doc.edges.map((e) => ({
    id: e.id, source: e.from, target: e.to, label: e.label,
    labelStyle: { fill: "#9fb0c3", fontSize: 9 }, labelBgStyle: { fill: "#0b0f15" },
    style: { stroke: e.confidence === "confirmed" ? "#22d3ee" : "#64748b", strokeWidth: 1.6 },
    animated: e.confidence === "confirmed",
  })), [doc.edges]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setDoc((d) => {
      const positions = new Map(d.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
      const removed = new Set<string>();
      for (const change of changes) {
        if (change.type === "position" && change.position) positions.set(change.id, change.position);
        if (change.type === "remove") removed.add(change.id);
      }
      return {
        ...d,
        nodes: d.nodes
          .filter((n) => !removed.has(n.id))
          .map((n) => ({ ...n, x: positions.get(n.id)?.x ?? n.x, y: positions.get(n.id)?.y ?? n.y })),
        edges: d.edges.filter((e) => !removed.has(e.from) && !removed.has(e.to)),
      };
    });
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setDoc((d) => {
      const removed = new Set(changes.filter((c) => c.type === "remove").map((c) => (c as { id: string }).id));
      return { ...d, edges: d.edges.filter((e) => !removed.has(e.id)) };
    });
  }, []);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;
    setDoc((d) => ({
      ...d,
      edges: [...d.edges, {
        id: uid("edge"), from: conn.source!, to: conn.target!, label: "relacionado a",
        source: "Manual", confidence: "unconfirmed", at: new Date().toISOString(),
      }],
    }));
  }, []);

  const addNode = () => {
    if (!addValue.trim()) return;
    const node: GraphNode = {
      id: uid("node"), kind: addKind, label: addValue.trim(), source: "Manual",
      confidence: "unconfirmed", at: new Date().toISOString(),
      x: 160 + Math.random() * 320, y: 120 + Math.random() * 240,
    };
    setDoc((d) => ({ ...d, nodes: [...d.nodes, node] }));
    setAddValue("");
  };

  const selectedNode = doc.nodes.find((n) => n.id === selected) ?? null;

  const expand = async () => {
    if (!selectedNode) return;
    setExpanding(true); setExpandError(null);
    const at = new Date().toISOString();
    const addedNodes: GraphNode[] = [];
    const addedEdges: GraphEdge[] = [];
    const add = (kind: EntityKind, label: string, source: string, confidence: GraphEdge["confidence"], rel: string) => {
      if (!label || addedNodes.some((n) => n.label.toLowerCase() === label.toLowerCase())) return;
      const id = uid("node");
      const idx = addedNodes.length;
      addedNodes.push({ id, kind, label, source, confidence, at, x: selectedNode.x + 220 + (idx % 3) * 60, y: selectedNode.y + 90 + idx * 70 });
      addedEdges.push({ id: uid("edge"), from: selectedNode.id, to: id, label: rel, source, confidence, at });
    };

    try {
      if (selectedNode.kind === "domain" || selectedNode.kind === "subdomain") {
        const [lookup, subs] = await Promise.all([
          domainLookup({ data: { domain: selectedNode.label } }),
          subdomainFinder({ data: { domain: selectedNode.label } }).catch(() => null),
        ]);
        for (const ip of lookup.dns.a.slice(0, 8)) add("ip", ip, "Google DNS (A)", "confirmed", "resolve para");
        for (const ns of lookup.dns.ns.slice(0, 5)) add("domain", ns, "Google DNS (NS)", "confirmed", "nameserver");
        if (lookup.rdap?.registrar) add("organization", lookup.rdap.registrar, "RDAP", "confirmed", "registrador");
        if (subs) {
          for (const s of subs.subdomains.slice(0, 15)) add("subdomain", s.name, "crt.sh", "confirmed", "subdomínio de");
          const cert = subs.certificates[0];
          if (cert) add("certificate", cert.commonName, "crt.sh", "confirmed", "certificado");
        }
        const ssl = await sslAnalyzer({ data: { domain: selectedNode.label } }).catch(() => null);
        if (ssl?.certificates[0]) add("certificate", ssl.certificates[0].commonName, "crt.sh (SSL)", "confirmed", "certificado");
      } else if (selectedNode.kind === "ip") {
        const lookup = await ipLookup({ data: { ip: selectedNode.label } });
        if (lookup.network.asn) add("asn", lookup.network.asn, "RIPEstat / Team Cymru", "confirmed", "anunciado por");
        if (lookup.network.organization) add("organization", lookup.network.organization, "RDAP / ipwho.is", "probable", "operado por");
        for (const ptr of lookup.reverseDns.slice(0, 4)) add("domain", ptr, "Google DNS (PTR)", "confirmed", "PTR");
        if (lookup.network.prefix) add("asn", lookup.network.prefix, "RIPEstat", "confirmed", "prefixo");
      } else if (selectedNode.kind === "username") {
        const scan = await usernameScan({ data: { username: selectedNode.label } });
        for (const r of scan.results.filter((x) => x.status === "found").slice(0, 10)) add("url", r.url, r.platform, "probable", "perfil público");
      } else {
        setExpandError("Expansão automática disponível para domínio, subdomínio, IP e username.");
      }
      if (addedNodes.length) setDoc((d) => ({ ...d, nodes: [...d.nodes, ...addedNodes], edges: [...d.edges, ...addedEdges] }));
      else if (!expandError) setExpandError("Nenhuma relação adicional foi retornada pelas fontes públicas.");
    } catch (e) {
      setExpandError(errorMessage(e));
    } finally {
      setExpanding(false);
    }
  };

  const persist = () => {
    const saved = saveGraph(doc);
    setGraphs(listGraphs());
    setDoc(saved);
    setSavedAt(saved.updatedAt);
    setTimeout(() => setSavedAt(null), 2000);
  };

  const exportPng = async () => {
    const viewport = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewport) return;
    const dataUrl = await toPng(viewport, { backgroundColor: "#06080b", pixelRatio: 2, cacheBust: true });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${doc.name || "graph"}.png`;
    a.click();
  };

  const exportSvg = async () => {
    const viewport = flowRef.current?.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewport) return;
    const dataUrl = await toSvg(viewport, { backgroundColor: "#06080b" });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${doc.name || "graph"}.svg`;
    a.click();
  };

  return (
    <div className="space-y-3">
      <Panel className="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] flex-1">
            <input
              className="ag-input !py-1.5 !text-[12px]"
              value={doc.name}
              onChange={(e) => setDoc({ ...doc, name: e.target.value })}
              placeholder="Nome do grafo"
            />
          </div>
          <div className="relative min-w-[150px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--ag-faint)]" />
            <input className="ag-input !py-1.5 !pl-7 !text-[11px]" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar nós" />
          </div>
          <select className="ag-select !w-auto !py-1.5 !text-[11px]" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">Todos os tipos</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Button size="sm" variant="primary" onClick={persist}><Save className="h-3 w-3" /> {savedAt ? "Salvo" : "Salvar"}</Button>
          <Button size="sm" variant="ghost" onClick={() => void exportPng()}><ImageIcon className="h-3 w-3" /> PNG</Button>
          <Button size="sm" variant="ghost" onClick={() => void exportSvg()}><Download className="h-3 w-3" /> SVG</Button>
          <Button size="sm" variant="ghost" onClick={() => download(`${doc.name || "graph"}.json`, JSON.stringify(doc, null, 2), "application/json")}><FileJson className="h-3 w-3" /> JSON</Button>
        </div>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <div className="min-w-[120px]">
            <select className="ag-select !py-1.5 !text-[11px]" value={addKind} onChange={(e) => setAddKind(e.target.value as EntityKind)}>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="min-w-[180px] flex-1">
            <input className="ag-input !py-1.5 !text-[11px]" value={addValue} onChange={(e) => setAddValue(e.target.value)} placeholder="valor do nó (ex.: exemplo.com)" onKeyDown={(e) => { if (e.key === "Enter") addNode(); }} />
          </div>
          <Button size="sm" onClick={addNode}><Plus className="h-3 w-3" /> Adicionar nó</Button>
          <Button size="sm" variant="ghost" onClick={() => setDoc(blankGraph())}>Novo</Button>
        </div>
      </Panel>

      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        <div className="ag-graph relative h-[560px] overflow-hidden rounded-2xl border border-[var(--ag-border)] bg-[#06080b]" ref={flowRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, n) => setSelected(n.id)}
            onPaneClick={() => setSelected(null)}
            fitView
            minZoom={0.2}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1b2532" gap={22} />
            <MiniMap pannable zoomable className="!bg-black/60" maskColor="rgba(0,0,0,0.65)" />
            <Controls />
          </ReactFlow>
          {doc.nodes.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="text-center text-[12px] text-[var(--ag-faint)]">
                <Filter className="mx-auto mb-2 h-5 w-5" />
                Nenhum nó. Adicione manualmente ou carregue um caso para importar entidades.
              </div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-lg border border-[var(--ag-border)] bg-black/70 px-2 py-1 text-[9px] backdrop-blur">
            {Object.entries(KIND_COLOR).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 text-[var(--ag-muted)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: v }} />{ENTITY_LABELS[k] ?? k}</span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Panel title="Detalhes do nó" className="!p-3">
            {!selectedNode ? (
              <p className="text-[11.5px] text-[var(--ag-faint)]">Selecione um nó para ver detalhes, expandir relações e remover.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Badge tone="cyan">{ENTITY_LABELS[selectedNode.kind] ?? selectedNode.kind}</Badge>
                    <div className="ag-mono mt-1.5 break-all text-[11px] text-[#dbe7f4]">{selectedNode.label}</div>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-[var(--ag-faint)] hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="space-y-1 text-[10.5px] text-[var(--ag-muted)]">
                  <div><span className="text-[var(--ag-faint)]">Fonte:</span> {selectedNode.source}</div>
                  <div><span className="text-[var(--ag-faint)]">Confiança:</span> {selectedNode.confidence}</div>
                  <div><span className="text-[var(--ag-faint)]">Observado:</span> {formatDate(selectedNode.at)}</div>
                  <div><span className="text-[var(--ag-faint)]">Conexões:</span> {doc.edges.filter((e) => e.from === selectedNode.id || e.to === selectedNode.id).length}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => void expand()} disabled={expanding}>
                    {expanding ? <Spinner label="" /> : <Expand className="h-3 w-3" />} Expandir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setDoc((d) => ({ ...d, nodes: d.nodes.filter((n) => n.id !== selectedNode.id), edges: d.edges.filter((e) => e.from !== selectedNode.id && e.to !== selectedNode.id) }));
                    setSelected(null);
                  }}><Trash2 className="h-3 w-3" /></Button>
                </div>
                {expandError && <Notice tone="warn">{expandError}</Notice>}
                <div className="text-[10px] text-[var(--ag-faint)]">Expansão usa fontes reais (RDAP, DNS, crt.sh, RIPEstat) e registra fonte, data e confiança em cada aresta.</div>
              </div>
            )}
          </Panel>

          <Panel title="Grafos salvos" className="!p-3">
            {graphs.length === 0 ? <Empty title="Nenhum grafo salvo" /> : (
              <ul className="space-y-1">
                {graphs.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <button onClick={() => { const loaded = getGraph(g.id); if (loaded) { setDoc(loaded); setSelected(null); } }} className="min-w-0 flex-1 truncate text-left text-[11.5px] text-[#dbe7f4] hover:text-cyan-300">
                      {g.name || "(sem nome)"} <span className="text-[9.5px] text-[var(--ag-faint)]">· {g.nodes.length} nós</span>
                    </button>
                    <button onClick={() => { deleteGraph(g.id); setGraphs(listGraphs()); }} className="text-[var(--ag-faint)] hover:text-rose-300"><Trash2 className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Notice tone="info" title="Confiança das conexões">
            Arestas automáticas são marcadas como <strong>confirmed</strong> quando vêm de registro/DNS/CT e <strong>probable</strong> quando derivadas de heurística. Arrastar conexões cria arestas manuais não confirmadas.
          </Notice>
        </div>
      </div>
    </div>
  );
}

function blankGraph(): GraphDoc {
  return { id: uid("graph"), name: "Novo grafo", nodes: [], edges: [], updatedAt: new Date().toISOString() };
}

export function GraphLegendBadge() {
  return <span className={cx("hidden")} />;
}
