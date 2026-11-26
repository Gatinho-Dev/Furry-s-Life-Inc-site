/**
 * Local entity extraction (regex + validation, no external model).
 * Every candidate keeps the exact matched text so the analyst can verify it.
 */

import type { PaletteNodeKind } from "./types";

export type EntityCandidate = {
  kind: PaletteNodeKind;
  value: string;
  label?: string;
  matched: string;
};

const URL_RE = /\bhttps?:\/\/[^\s"'<>)\]]{3,2048}/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}\b/gi;
const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_RE = /[0-9a-f]{1,4}(?::[0-9a-f]{0,4}){2,7}|\b::[0-9a-f]{1,4}\b/gi;
const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24})\b/gi;
const HASH_RE = /\b[a-f0-9]{64}\b|\b[a-f0-9]{40}\b|\b[a-f0-9]{32}\b/gi;
const CVE_RE = /\bCVE-\d{4}-\d{4,}\b/gi;
const ASN_RE = /\bAS\d{1,10}\b/g;
const CERT_CN_RE = /\bCN\s*=\s*([A-Z0-9*._-]+\.[A-Z]{2,24})\b/gi;

const FILE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "css", "js", "mjs", "json", "xml", "txt", "pdf",
  "zip", "gz", "tar", "mp4", "mp3", "woff", "woff2", "ico", "html", "php", "aspx", "jsp",
]);

export function isProbablyIpv6(value: string): boolean {
  if (!/^[0-9a-f:]+$/i.test(value)) return false;
  const colons = (value.match(/:/g) ?? []).length;
  const groups = value.split(":").filter(Boolean);
  if (value.includes("::")) return colons >= 2 && groups.length >= 2;
  return colons === 7 && groups.length === 8;
}

export function isProbablyDomain(value: string): boolean {
  const tld = value.split(".").pop()?.toLowerCase() ?? "";
  return value.includes(".") && !FILE_EXTENSIONS.has(tld) && tld.length >= 2;
}

export function normalizeEntityValue(kind: PaletteNodeKind, value: string): string {
  const v = value.trim();
  switch (kind) {
    case "domain":
    case "subdomain":
    case "website":
      return v.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
    case "email":
      return v.toLowerCase();
    case "hash":
      return v.toLowerCase();
    case "cve":
      return v.toUpperCase();
    case "asn":
      return v.toUpperCase();
    case "url":
      return v.replace(/[.,;]$/, "");
    default:
      return v;
  }
}

function pushUnique(list: EntityCandidate[], candidate: EntityCandidate) {
  const norm = normalizeEntityValue(candidate.kind, candidate.value);
  if (list.some((c) => c.kind === candidate.kind && normalizeEntityValue(c.kind, c.value) === norm)) return;
  list.push({ ...candidate, value: candidate.value.trim(), matched: candidate.matched.trim() });
}

export function extractEntities(text: string, opts: { allowPrivate?: boolean; allowUsernames?: boolean } = {}): EntityCandidate[] {
  const out: EntityCandidate[] = [];
  const source = text.slice(0, 2_000_000);

  for (const match of source.matchAll(URL_RE)) {
    pushUnique(out, { kind: "url", value: match[0].replace(/[.,;]$/, ""), matched: match[0] });
  }
  for (const match of source.matchAll(EMAIL_RE)) {
    pushUnique(out, { kind: "email", value: match[0].toLowerCase(), matched: match[0] });
  }
  for (const match of source.matchAll(CERT_CN_RE)) {
    pushUnique(out, { kind: "domain", value: match[1], matched: match[0] });
  }
  for (const match of source.matchAll(CVE_RE)) {
    pushUnique(out, { kind: "cve", value: match[0].toUpperCase(), matched: match[0] });
  }
  for (const match of source.matchAll(HASH_RE)) {
    const value = match[0];
    if (/^[a-f0-9]{32,64}$/i.test(value)) pushUnique(out, { kind: "hash", value: value.toLowerCase(), matched: value });
  }
  for (const match of source.matchAll(IPV4_RE)) {
    const parts = match[0].split(".").map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n > 255)) continue;
    if (!opts.allowPrivate && isPrivateV4(parts)) continue;
    if (parts[0] === 0) continue;
    pushUnique(out, { kind: "ipv4", value: match[0], matched: match[0] });
  }
  for (const match of source.matchAll(IPV6_RE)) {
    const value = match[0].replace(/^\s+|\s+$/g, "");
    if (!isProbablyIpv6(value)) continue;
    pushUnique(out, { kind: "ipv6", value, matched: value });
  }
  for (const match of source.matchAll(DOMAIN_RE)) {
    const value = match[0];
    if (out.some((c) => c.kind === "email" && c.value.endsWith(`@${value.toLowerCase()}`))) continue;
    if (!isProbablyDomain(value)) continue;
    pushUnique(out, { kind: "domain", value, matched: value });
  }
  for (const match of source.matchAll(ASN_RE)) {
    pushUnique(out, { kind: "asn", value: match[0].toUpperCase(), matched: match[0] });
  }

  return out.sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || a.value.localeCompare(b.value));
}

function isPrivateV4(p: number[]): boolean {
  if (p[0] === 10) return true;
  if (p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  return false;
}

function kindOrder(kind: PaletteNodeKind): number {
  return ["domain", "subdomain", "ipv4", "ipv6", "asn", "url", "certificate", "email", "hash", "cve"].indexOf(kind);
}

/** Extract candidates from an arbitrary JSON/search payload, following keys as provenance hints. */
export function extractFromUnknown(data: unknown, limit = 200): EntityCandidate[] {
  const found: EntityCandidate[] = [];
  const seen = new Set<string>();
  const walk = (value: unknown, path: string, depth: number) => {
    if (found.length >= limit || depth > 6) return;
    if (typeof value === "string") {
      if (value.length > 4 && value.length < 2048) {
        for (const candidate of extractEntities(value)) {
          const key = `${candidate.kind}:${candidate.value.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          found.push({ ...candidate, label: path.split(".").slice(-2).join(".") });
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.slice(0, 40).forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, path ? `${path}.${k}` : k, depth + 1);
    }
  };
  walk(data, "", 0);
  return found;
}

/** Suggest a relationship label from a tool/source name, for imported entities. */
export function relationForSource(tool: string): string {
  const t = tool.toLowerCase();
  if (t.includes("dns") || t.includes("resolve")) return "Resolves to";
  if (t.includes("rdap") || t.includes("registr")) return "Registered by";
  if (t.includes("crt") || t.includes("ssl") || t.includes("cert")) return "Uses certificate";
  if (t.includes("subdomain")) return "Subdomain of";
  if (t.includes("asn") || t.includes("bgp") || t.includes("prefix")) return "Announced by";
  if (t.includes("wayback") || t.includes("archive")) return "Observed in";
  if (t.includes("urlhaus") || t.includes("threat") || t.includes("otx")) return "Potentially related to";
  return "Associated with";
}
