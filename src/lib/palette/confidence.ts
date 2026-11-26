/**
 * Explainable confidence engine.
 * This is a rule-based classification, not a calibrated probability. The UI
 * must never present these values as percentages or statistical likelihood.
 */

import type { ConfidenceLevel } from "./types";

export type ConfidenceSignals = {
  /** How many independent sources returned the same fact. */
  sourceCount: number;
  /** At least one source is a primary registry/API response (DNS, RDAP, CT, official API). */
  primarySource: boolean;
  /** Evidence was archived in the case (hash, capture, payload). */
  hasEvidence: boolean;
  /** Exact identifier match vs. name/handle similarity. */
  match: "exact" | "partial" | "weak";
  /** The fact came from a profile's own declaration (self-declared). */
  selfDeclared?: boolean;
};

export type ConfidenceResult = {
  level: ConfidenceLevel;
  reasons: string[];
  caveats: string[];
};

const ORDER: ConfidenceLevel[] = ["verified", "high", "medium", "low", "unverified"];

export function classifyConfidence(signals: ConfidenceSignals): ConfidenceResult {
  const reasons: string[] = [];
  const caveats: string[] = [];
  let score = 0;

  if (signals.match === "exact") { score += 2; reasons.push("Identificador exato (sem heurística de semelhança)."); }
  else if (signals.match === "partial") { score += 1; reasons.push("Correspondência parcial do identificador."); }
  else { caveats.push("Correspondência apenas por semelhança de nome/handle."); }

  if (signals.primarySource) { score += 2; reasons.push("Resposta primária de registro/API oficial."); }
  else { caveats.push("Nenhuma fonte primária confirmou o dado."); }

  if (signals.sourceCount >= 2) { score += 2; reasons.push(`${signals.sourceCount} fontes independentes concordam.`); }
  else if (signals.sourceCount === 1) { score += 1; caveats.push("Apenas uma fonte retornou o dado."); }
  else { caveats.push("Nenhuma fonte registrada."); }

  if (signals.hasEvidence) { score += 1; reasons.push("Evidência arquivada no caso."); }
  else { caveats.push("Sem evidência arquivada (payload/captura/hash)."); }

  if (signals.selfDeclared) { reasons.push("Declaração pública do próprio titular (não verifica identidade)."); }

  let level: ConfidenceLevel = "unverified";
  if (score >= 6 && signals.hasEvidence && signals.primarySource && signals.sourceCount >= 2) level = "verified";
  else if (score >= 4) level = "high";
  else if (score >= 3) level = "medium";
  else if (score >= 1) level = "low";

  if (level === "verified") caveats.push("Verificação vale para o dado nesta data; pode mudar na fonte.");
  return { level, reasons, caveats };
}

export function levelRank(level: ConfidenceLevel): number {
  return ORDER.indexOf(level);
}

export function worstLevel(levels: ConfidenceLevel[]): ConfidenceLevel {
  return levels.reduce<ConfidenceLevel>((worst, lvl) => (levelRank(lvl) > levelRank(worst) ? lvl : worst), "verified");
}

/** Confidence for a relationship based on how it was created. */
export function relationshipConfidence(origin: "user" | "source" | "ai", evidenceCount: number, primary: boolean): ConfidenceResult {
  return classifyConfidence({
    sourceCount: primary || evidenceCount > 0 ? 1 : 0,
    primarySource: primary,
    hasEvidence: evidenceCount > 0,
    match: "exact",
  });
}
