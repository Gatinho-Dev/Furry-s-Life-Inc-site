/**
 * Palette search engine — maps each entity kind to the free OSINT sources
 * already used by Life Agency. Calls go through /api/palette/search, which
 * keeps every provider on the server (no server imports in the client bundle).
 */

import type { PaletteNodeKind } from "./types";

export type PaletteSearchSource = {
  id: string;
  name: string;
  description: string;
  /** Extracts the number of findings for the summary when the shape is known. */
  count?: (data: unknown) => number;
};

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const SEARCH_SOURCES: Record<string, PaletteSearchSource> = {
  domainLookup: { id: "domainLookup", name: "RDAP + DNS", description: "Registro RDAP, A/AAAA, NS, MX e TXT via Google DNS." },
  dnsLookup: { id: "dnsLookup", name: "DNS (Cloudflare)", description: "Resolução independente via DoH da Cloudflare." },
  subdomainFinder: { id: "subdomainFinder", name: "crt.sh · subdomínios", description: "Certificate Transparency: certificados e subdomínios.", count: (d) => arr(asRecord(d).subdomains).length },
  sslAnalyzer: { id: "sslAnalyzer", name: "crt.sh · certificados", description: "Certificados emitidos para o domínio exato.", count: (d) => arr(asRecord(d).certificates).length },
  websiteAnalyzer: { id: "websiteAnalyzer", name: "Website", description: "Cabeçalhos, título, meta, tecnologias e robots." },
  waybackHistory: { id: "waybackHistory", name: "Wayback Machine", description: "Capturas históricas e primeira/última observação.", count: (d) => arr(asRecord(d).snapshots).length },
  ipLookup: { id: "ipLookup", name: "IP · RDAP/ASN", description: "Rede, ASN, prefixo, geolocalização aproximada e PTR." },
  reverseDnsLookup: { id: "reverseDnsLookup", name: "Reverse DNS", description: "Consulta PTR em resolvedor público." },
  asnLookup: { id: "asnLookup", name: "RIPEstat · ASN", description: "Prefixo, holder, anúncios e vizinhos BGP." },
  bgpLookup: { id: "bgpLookup", name: "RIPEstat · BGP", description: "Estado de anúncio e histórico de roteamento." },
  usernameScan: { id: "usernameScan", name: "Perfis públicos", description: "26 plataformas verificadas por HTTP direto.", count: (d) => arr(asRecord(d).results).filter((r) => asRecord(r).status === "found").length },
  emailAnalysis: { id: "emailAnalysis", name: "E-mail · DNS", description: "MX, SPF, DMARC, DKIM e provedor do domínio." },
  cveLookup: { id: "cveLookup", name: "NVD · CVE", description: "Descrição oficial, CVSS, CWE e referências." },
  hashLookup: { id: "hashLookup", name: "Hash público", description: "MalwareBazaar / VirusTotal quando há chave opcional." },
  urlAnalyzer: { id: "urlAnalyzer", name: "URL", description: "Componentes, redirecionamentos e indicadores técnicos." },
  cnpjLookup: { id: "cnpjLookup", name: "CNPJ · Receita", description: "Razão social, sócios e situação cadastral via BrasilAPI." },
};

const BY_KIND: Record<PaletteNodeKind, string[]> = {
  domain: ["domainLookup", "dnsLookup", "subdomainFinder", "sslAnalyzer", "websiteAnalyzer", "waybackHistory"],
  subdomain: ["dnsLookup", "websiteAnalyzer", "subdomainFinder"],
  ipv4: ["ipLookup", "reverseDnsLookup", "bgpLookup"],
  ipv6: ["ipLookup", "reverseDnsLookup"],
  asn: ["asnLookup", "bgpLookup"],
  network: ["bgpLookup", "asnLookup"],
  url: ["urlAnalyzer", "websiteAnalyzer"],
  certificate: ["sslAnalyzer"],
  "dns-record": ["dnsLookup"],
  username: ["usernameScan"],
  email: ["emailAnalysis"],
  hash: ["hashLookup"],
  cve: ["cveLookup"],
  company: ["cnpjLookup"],
  organization: ["cnpjLookup"],
  website: ["websiteAnalyzer", "waybackHistory"],
  "public-service": ["domainLookup"],
  file: ["hashLookup"],
  document: [],
  event: [],
  observation: [],
  evidence: [],
  source: [],
  note: [],
};

export type SearchOutcome = {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  summary: string;
  resultCount: number;
  data?: unknown;
  error?: string;
  durationMs: number;
};

export async function runSource(sourceId: string, value: string): Promise<SearchOutcome> {
  const source = SEARCH_SOURCES[sourceId];
  const started = performance.now();
  if (!source) {
    return { sourceId, sourceName: sourceId, ok: false, summary: "Fonte desconhecida.", resultCount: 0, error: "Fonte desconhecida", durationMs: 0 };
  }
  try {
    const res = await fetch("/api/palette/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: sourceId, value: value.trim() }),
    });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; data?: unknown; error?: string } | null;
    if (!res.ok || !payload?.ok) {
      const message = payload?.error || `HTTP ${res.status}`;
      return { sourceId, sourceName: source.name, ok: false, summary: message, resultCount: 0, error: message, durationMs: Math.round(performance.now() - started) };
    }
    const data = payload.data;
    const record = asRecord(data);
    const count = source.count ? source.count(data) : 1;
    const note = typeof record.note === "string" ? record.note : "";
    return {
      sourceId,
      sourceName: source.name,
      ok: true,
      summary: note || `${source.name}: resposta recebida para ${value.trim()}.`,
      resultCount: count,
      data,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { sourceId, sourceName: source.name, ok: false, summary: message, resultCount: 0, error: message, durationMs: Math.round(performance.now() - started) };
  }
}

export function defaultSourcesFor(kind: PaletteNodeKind): string[] {
  return [...(BY_KIND[kind] ?? [])];
}

export function sourceById(id: string): PaletteSearchSource | undefined {
  return SEARCH_SOURCES[id];
}

export const SOURCE_KIND_HINT: Partial<Record<string, string>> = {
  domainLookup: "domínio", dnsLookup: "domínio", subdomainFinder: "domínio", sslAnalyzer: "domínio",
  websiteAnalyzer: "domínio ou URL", waybackHistory: "domínio", ipLookup: "IP", reverseDnsLookup: "IP",
  asnLookup: "ASN", bgpLookup: "ASN, IP ou prefixo", usernameScan: "username", emailAnalysis: "e-mail",
  cveLookup: "CVE", hashLookup: "hash MD5/SHA1/SHA256", urlAnalyzer: "URL", cnpjLookup: "CNPJ",
};
