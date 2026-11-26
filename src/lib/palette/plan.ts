/**
 * Life Automatic Investigation Engine — turns recognised entities into a
 * finite, explainable plan of compatible free sources. No plan step is added
 * for an entity type that has no working connector.
 */

import { planSourcesFor, type PaletteSearchSource } from "./search";
import type { InvestigationDepth, PaletteNodeKind } from "./types";

export const DEPTH_META: Record<InvestigationDepth, {
  label: string;
  short: string;
  description: string;
  perEntity: number;
  estimate: string;
}> = {
  quick: {
    label: "Quick Investigation",
    short: "Quick",
    description: "Consultas essenciais que confirmam o identificador em fontes primárias.",
    perEntity: 2,
    estimate: "~2 fontes por entidade",
  },
  standard: {
    label: "Standard Investigation",
    short: "Standard",
    description: "Cruza múltiplas fontes, detecta duplicatas e amplia relações.",
    perEntity: 5,
    estimate: "até 5 fontes por entidade",
  },
  deep: {
    label: "Deep Investigation",
    short: "Deep",
    description: "Mais fontes públicas, verificação de conflitos e grafo mais completo.",
    perEntity: 9,
    estimate: "até 9 fontes por entidade",
  },
};

export type InvestigationTarget = {
  key: string;
  kind: PaletteNodeKind;
  value: string;
};

export type PlannedTarget = InvestigationTarget & {
  sources: PaletteSearchSource[];
  /** Honest explanation when no free connector covers this type. */
  limitation?: string;
};

export type InvestigationPlan = {
  depth: InvestigationDepth;
  targets: PlannedTarget[];
  totalQueries: number;
  skipped: number;
  uncovered: PaletteNodeKind[];
  notes: string[];
};

const UNCOVERED_REASON: Partial<Record<PaletteNodeKind, string>> = {
  phone: "Não há conector gratuito confiável para telefone nesta instalação. O número fica registrado como entidade sem consulta automática.",
  wallet: "Não há explorador de blockchain integrado. A carteira fica registrada sem consulta automática.",
  location: "Geocodificação pública não está integrada. A localização fica registrada como entidade.",
  person: "Pessoas só são pesquisadas nas Fontes de busca pública (GitHub, Hacker News) no nível Deep.",
  event: "Eventos não possuem fonte pública compatível; use notas e evidências.",
  note: "Notas não geram consultas.",
  evidence: "Evidências não geram consultas.",
  source: "Fontes não geram consultas.",
  observation: "Observações não geram consultas.",
  document: "Documentos são indexados na Life Knowledge, não consultados em fontes externas.",
};

export function planEntity(kind: PaletteNodeKind, value: string, depth: InvestigationDepth): PlannedTarget {
  let sources = planSourcesFor(kind, depth);
  // Registry lookup only makes sense for an actual CNPJ; a company name uses
  // the open-data jurisdiction links and public search instead.
  if (kind === "company" || kind === "organization") {
    const isCnpj = /^\d{14}$/.test(value.replace(/\D/g, "")) && value.replace(/\D/g, "").length === 14;
    sources = isCnpj
      ? sources.filter((s) => s.id === "cnpjLookup" || s.id === "companyOpenDataLinks")
      : sources.filter((s) => s.id !== "cnpjLookup");
  }
  return {
    key: `${kind}:${value}`,
    kind,
    value,
    sources,
    limitation: sources.length === 0 ? (UNCOVERED_REASON[kind] ?? "Nenhuma fonte gratuita compatível com este tipo.") : undefined,
  };
}

export function buildInvestigationPlan(targets: InvestigationTarget[], depth: InvestigationDepth): InvestigationPlan {
  const planned = targets
    .filter((t) => t.value.trim().length > 0)
    .map((t) => planEntity(t.kind, t.value, depth));
  const totalQueries = planned.reduce((n, t) => n + t.sources.length, 0);
  const uncovered = [...new Set(planned.filter((t) => t.sources.length === 0).map((t) => t.kind))];
  const notes: string[] = [];
  if (uncovered.length > 0) {
    notes.push(`${uncovered.length} tipo(s) sem conector gratuito: ${uncovered.join(", ")}. Eles serão adicionados ao caso sem consulta automática.`);
  }
  if (depth === "deep") {
    notes.push("Deep respeita o orçamento por entidade e o rate limit de cada fonte; ele não equivale a uma varredura ilimitada.");
  }
  return {
    depth,
    targets: planned,
    totalQueries,
    skipped: planned.filter((t) => t.sources.length === 0).length,
    uncovered,
    notes,
  };
}
