import type { PaletteEdge, PaletteNode } from "./types";

/**
 * Deterministic layouts (no external layout engine).
 * hierarchy: ranks by distance from entry nodes; radial: one ring per depth.
 */
export function computeLayout(
  nodes: PaletteNode[],
  edges: PaletteEdge[],
  mode: "hierarchy" | "radial",
): Record<string, { x: number; y: number }> {
  if (nodes.length === 0) return {};
  const out = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const n of nodes) { out.set(n.id, []); indeg.set(n.id, 0); }
  for (const e of edges) {
    if (!out.has(e.source) || !out.has(e.target)) continue;
    out.get(e.source)!.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
  }
  const roots = nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id);
  const start = roots.length ? roots : [nodes[0].id];
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const id of start) { depth.set(id, 0); queue.push(id); }
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of out.get(id) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, (depth.get(id) ?? 0) + 1);
        queue.push(next);
      }
    }
  }
  let maxDepth = 0;
  for (const d of depth.values()) maxDepth = Math.max(maxDepth, d);
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1);

  const positions: Record<string, { x: number; y: number }> = {};
  if (mode === "hierarchy") {
    const byDepth = new Map<number, string[]>();
    for (const n of nodes) {
      const d = depth.get(n.id) ?? 0;
      byDepth.set(d, [...(byDepth.get(d) ?? []), n.id]);
    }
    for (const [d, ids] of byDepth) {
      ids.sort((a, b) => {
        const na = nodes.find((n) => n.id === a)!;
        const nb = nodes.find((n) => n.id === b)!;
        return na.kind.localeCompare(nb.kind) || na.title.localeCompare(nb.title);
      });
      ids.forEach((id, i) => {
        positions[id] = { x: d * 300, y: i * 150 - (ids.length - 1) * 75 };
      });
    }
    return positions;
  }

  const radius = 260;
  const rings = new Map<number, string[]>();
  for (const n of nodes) {
    const d = depth.get(n.id) ?? 0;
    rings.set(d, [...(rings.get(d) ?? []), n.id]);
  }
  for (const [d, ids] of rings) {
    ids.forEach((id, i) => {
      const angle = (i / Math.max(ids.length, 1)) * Math.PI * 2;
      positions[id] = {
        x: Math.round(Math.cos(angle) * radius * (d + 1)),
        y: Math.round(Math.sin(angle) * radius * (d + 1)),
      };
    });
  }
  return positions;
}
