/**
 * Deterministic identity correlation.
 * Merges signals from several public sources, deduplicates them, and derives
 * only relationships that the data actually supports. Nothing here guesses.
 */

import type {
  DerivedMatch, IdentityConfidence, IdentitySignal, IdentitySourceResult, SignalKind,
} from "./types";

const RANK: Record<IdentityConfidence, number> = { confirmed: 3, probable: 2, unconfirmed: 1 };

export function strongest(a: IdentityConfidence, b: IdentityConfidence): IdentityConfidence {
  return RANK[a] >= RANK[b] ? a : b;
}

function norm(kind: SignalKind, value: string): string {
  const v = value.trim().toLowerCase();
  if (kind === "email" || kind === "domain" || kind === "username" || kind === "crypto_key") return v.replace(/^@/, "");
  if (kind === "url") return v.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return v;
}

/** Deduplicate signals by kind+value, keeping the strongest confidence and every source. */
export function mergeSignals(results: IdentitySourceResult[]): IdentitySignal[] {
  const map = new Map<string, IdentitySignal & { sourceIds: Set<string> }>();
  for (const result of results) {
    for (const signal of result.signals) {
      const key = `${signal.kind}:${norm(signal.kind, signal.value)}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { ...signal, sourceIds: new Set([signal.sourceId]) });
        continue;
      }
      const confidence = strongest(existing.confidence, signal.confidence);
      const reason = existing.reason.includes(signal.reason) ? existing.reason : `${existing.reason} · ${signal.reason}`;
      map.set(key, {
        ...existing,
        confidence,
        reason: confidence === signal.confidence ? reason : `${reason} (fontes: ${[...existing.sourceIds, signal.sourceId].join(", ")})`,
        sourceIds: new Set([...existing.sourceIds, signal.sourceId]),
      });
    }
  }
  return [...map.values()]
    .map(({ sourceIds, ...s }) => ({ ...s, source: [...sourceIds].length > 1 ? `${s.source} +${sourceIds.size - 1}` : s.source }))
    .sort((a, b) => RANK[b.confidence] - RANK[a.confidence] || a.kind.localeCompare(b.kind));
}

/** Profiles that publish byte-identical avatars are a strong (not conclusive) link. */
export function deriveMatches(results: IdentitySourceResult[], signals: IdentitySignal[]): DerivedMatch[] {
  const matches: DerivedMatch[] = [];

  const byAvatar = new Map<string, Array<{ source: string; url?: string }>>();
  for (const result of results) {
    for (const profile of result.profiles) {
      if (!profile.avatarHash) continue;
      const rows = byAvatar.get(profile.avatarHash) ?? [];
      rows.push({ source: result.name, url: profile.url });
      byAvatar.set(profile.avatarHash, rows);
    }
  }
  let n = 0;
  for (const [hash, rows] of byAvatar) {
    if (rows.length < 2) continue;
    for (let i = 1; i < rows.length; i++) {
      matches.push({
        id: `match-avatar-${n++}`,
        type: "avatar",
        a: rows[0].url ?? rows[0].source,
        b: rows[i].url ?? rows[i].source,
        confidence: "probable",
        reason: `Avatar idêntico (SHA-256 ${hash.slice(0, 12)}…) publicado em ${rows[0].source} e ${rows[i].source}.`,
      });
    }
  }

  const emails = signals.filter((s) => s.kind === "email");
  const usernames = signals.filter((s) => s.kind === "username");
  if (emails.length && usernames.length) {
    for (const email of emails) {
      const domain = email.value.split("@")[1] ?? "";
      matches.push({
        id: `match-contact-${n++}`,
        type: "contact",
        a: email.value,
        b: usernames[0].value,
        confidence: email.confidence === "confirmed" ? "probable" : "unconfirmed",
        reason: `E-mail ${email.confidence === "confirmed" ? "declarado publicamente" : "observado"} ${domain ? `no domínio ${domain}` : ""} ao lado do identificador ${usernames[0].value}. Exige confirmação do titular.`,
      });
    }
  }

  return matches;
}

export function confidenceCounts(signals: IdentitySignal[]): Record<IdentityConfidence, number> {
  return signals.reduce(
    (acc, s) => ({ ...acc, [s.confidence]: acc[s.confidence] + 1 }),
    { confirmed: 0, probable: 0, unconfirmed: 0 } as Record<IdentityConfidence, number>,
  );
}

/** Map a signal to the entity kind used by the investigation workspace. */
export function toEntityKind(kind: SignalKind): "username" | "email" | "url" | "domain" | "organization" | "person" | "key" | "note" {
  if (kind === "crypto_key") return "key";
  if (kind === "location") return "note";
  return kind;
}

export function ribbon(seed: string, signals: IdentitySignal[]): Array<{ value: string; kind: SignalKind; confidence: IdentityConfidence }> {
  const order: SignalKind[] = ["username", "person", "email", "crypto_key", "url", "domain", "organization"];
  return signals
    .filter((s) => s.confidence !== "unconfirmed")
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .slice(0, 6)
    .map((s) => ({ value: s.value === seed ? s.value : s.value, kind: s.kind, confidence: s.confidence }));
}
