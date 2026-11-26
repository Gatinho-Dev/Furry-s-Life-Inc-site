/**
 * Life Multi-Source Intelligence — source registry and client connector.
 *
 * Every provider below is a free, public source already implemented by the
 * platform's server functions. The browser never imports server code: it posts
 * {tool, value} to /api/palette/search, which applies rate limits and the SSRF
 * guard. A source is only reported as consulted when the request actually ran.
 */

import type { InvestigationDepth, PaletteNodeKind, SearchState, SourceCategory } from "./types";

export type PaletteSearchSource = {
  id: string;
  name: string;
  description: string;
  category: SourceCategory;
  /** 1 = quick, 2 = standard, 3 = deep. Deep always includes the lower tiers. */
  tier: 1 | 2 | 3;
  kinds: PaletteNodeKind[];
  /** Optional key configured on the server. Unavailable without it, never faked. */
  optionalKey?: string;
  /** Public page or API endpoint backing the result. */
  reference?: (value: string) => string;
  /** Extracts the number of findings when the payload shape is known. */
  count?: (data: unknown) => number;
};

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  infrastructure: "Infraestrutura",
  registration: "Registro",
  certificates: "Certificados",
  security: "Segurança",
  profiles: "Perfis públicos",
  archives: "Arquivos históricos",
  companies: "Empresas",
  search: "Busca pública",
};

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const enc = (v: string) => encodeURIComponent(v.trim());

const countArray = (data: unknown, ...keys: string[]): number => {
  const record = asRecord(data);
  for (const key of keys) if (Array.isArray(record[key])) return (record[key] as unknown[]).length;
  return 0;
};

/** Generic finding count: arrays, totals, or a single returned payload. */
export function countFindings(data: unknown): number {
  if (data == null) return 0;
  if (Array.isArray(data)) return data.length;
  const record = asRecord(data);
  if (record.available === false) return 0;
  for (const key of ["total", "totalResults", "count", "matched", "resultCount"]) {
    if (typeof record[key] === "number") return record[key] as number;
  }
  let arrays = 0;
  for (const value of Object.values(record)) if (Array.isArray(value)) arrays += value.length;
  if (arrays > 0) return arrays;
  const scalarKeys = Object.keys(record).filter((k) => !["note", "queriedAt", "source", "sources", "available", "reason", "signup"].includes(k));
  return scalarKeys.length > 0 ? 1 : 0;
}

export const SEARCH_SOURCES: Record<string, PaletteSearchSource> = {
  domainLookup: {
    id: "domainLookup", name: "RDAP + DNS", category: "registration", tier: 1,
    description: "Registro RDAP, A/AAAA, NS, MX e TXT via Google DNS.",
    kinds: ["domain", "subdomain", "public-service"],
    reference: (v) => `https://lookup.icann.org/en/lookup?name=${enc(v)}`,
  },
  dnsLookup: {
    id: "dnsLookup", name: "DNS (Cloudflare)", category: "infrastructure", tier: 1,
    description: "Resolução independente via DoH da Cloudflare.",
    kinds: ["domain", "subdomain"],
    reference: (v) => `https://dns.google/query?name=${enc(v)}&type=A`,
  },
  dnsPropagation: {
    id: "dnsPropagation", name: "DNS · propagação", category: "infrastructure", tier: 2,
    description: "Compara a resposta entre resolvedores públicos.",
    kinds: ["domain", "subdomain"],
    reference: (v) => `https://dnschecker.org/#A/${enc(v)}`,
  },
  subdomainFinder: {
    id: "subdomainFinder", name: "crt.sh · subdomínios", category: "certificates", tier: 2,
    description: "Certificate Transparency: certificados e subdomínios.",
    kinds: ["domain"], count: (d) => countArray(d, "subdomains"),
    reference: (v) => `https://crt.sh/?q=%25.${enc(v)}`,
  },
  sslAnalyzer: {
    id: "sslAnalyzer", name: "crt.sh · certificados", category: "certificates", tier: 2,
    description: "Certificados emitidos para o domínio exato.",
    kinds: ["domain", "certificate"], count: (d) => countArray(d, "certificates"),
    reference: (v) => `https://crt.sh/?q=${enc(v)}`,
  },
  websiteAnalyzer: {
    id: "websiteAnalyzer", name: "Website", category: "infrastructure", tier: 1,
    description: "Cabeçalhos, título, meta, tecnologias e robots.",
    kinds: ["domain", "url", "website", "subdomain", "social-profile"],
  },
  robotsSitemap: {
    id: "robotsSitemap", name: "robots.txt / sitemap", category: "infrastructure", tier: 3,
    description: "Arquivos públicos de indexação declarados pelo site.",
    kinds: ["domain", "website"],
    reference: (v) => `https://${v.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/robots.txt`,
  },
  waybackHistory: {
    id: "waybackHistory", name: "Wayback Machine", category: "archives", tier: 2,
    description: "Capturas históricas e primeira/última observação.",
    kinds: ["domain", "url", "website"], count: (d) => countArray(d, "snapshots"),
    reference: (v) => `https://web.archive.org/web/*/${enc(v)}`,
  },
  ipLookup: {
    id: "ipLookup", name: "IP · RDAP/ASN", category: "registration", tier: 1,
    description: "Rede, ASN, prefixo, geolocalização aproximada e PTR.",
    kinds: ["ipv4", "ipv6"],
    reference: (v) => `https://rdap.org/ip/${enc(v)}`,
  },
  reverseDnsLookup: {
    id: "reverseDnsLookup", name: "Reverse DNS", category: "infrastructure", tier: 1,
    description: "Consulta PTR em resolvedor público.",
    kinds: ["ipv4", "ipv6"],
    reference: (v) => `https://dns.google/query?name=${enc(v)}&type=PTR`,
  },
  ipReputation: {
    id: "ipReputation", name: "Reputação de IP", category: "security", tier: 2,
    description: "Indicadores públicos de abuso. Chaves opcionais ampliam a cobertura.",
    kinds: ["ipv4", "ipv6"], optionalKey: "ABUSEIPDB_API_KEY",
    reference: (v) => `https://www.abuseipdb.com/check/${enc(v)}`,
  },
  asnLookup: {
    id: "asnLookup", name: "RIPEstat · ASN", category: "registration", tier: 1,
    description: "Prefixo, holder, anúncios e vizinhos BGP.",
    kinds: ["asn", "network"],
    reference: (v) => `https://stat.ripe.net/${enc(v)}`,
  },
  bgpLookup: {
    id: "bgpLookup", name: "RIPEstat · BGP", category: "infrastructure", tier: 2,
    description: "Estado de anúncio e histórico de roteamento.",
    kinds: ["asn", "network", "ipv4", "ipv6"],
    reference: (v) => `https://stat.ripe.net/${enc(v)}`,
  },
  usernameScan: {
    id: "usernameScan", name: "Perfis públicos", category: "profiles", tier: 1,
    description: "26 plataformas verificadas por HTTP direto.",
    kinds: ["username"],
    count: (d) => arr(asRecord(d).results).filter((r) => asRecord(r).status === "found").length,
  },
  githubUser: {
    id: "githubUser", name: "GitHub · usuário", category: "profiles", tier: 1,
    description: "Perfil público, repositórios e datas via API oficial.",
    kinds: ["username"],
    reference: (v) => `https://github.com/${enc(v)}`,
  },
  identityGithub: {
    id: "identityGithub", name: "GitHub · identidade", category: "profiles", tier: 3,
    description: "Campos públicos do perfil e chaves declaradas.",
    kinds: ["username"],
    reference: (v) => `https://github.com/${enc(v)}`,
  },
  identityGitlab: {
    id: "identityGitlab", name: "GitLab", category: "profiles", tier: 3,
    description: "Perfil público no GitLab.",
    kinds: ["username"],
    reference: (v) => `https://gitlab.com/${enc(v)}`,
  },
  identityKeybase: {
    id: "identityKeybase", name: "Keybase", category: "profiles", tier: 3,
    description: "Chaves e provas públicas declaradas.",
    kinds: ["username"],
    reference: (v) => `https://keybase.io/${enc(v)}`,
  },
  identityMastodon: {
    id: "identityMastodon", name: "Mastodon", category: "profiles", tier: 3,
    description: "Perfil público na instância informada.",
    kinds: ["username"],
    reference: (v) => `https://mastodon.social/@${enc(v)}`,
  },
  identityDevto: {
    id: "identityDevto", name: "dev.to", category: "profiles", tier: 3,
    description: "Perfil e artigos públicos.",
    kinds: ["username"],
    reference: (v) => `https://dev.to/${enc(v)}`,
  },
  identityHackerNews: {
    id: "identityHackerNews", name: "Hacker News", category: "profiles", tier: 3,
    description: "Conta pública e data de criação.",
    kinds: ["username"],
    reference: (v) => `https://news.ycombinator.com/user?id=${enc(v)}`,
  },
  emailAnalysis: {
    id: "emailAnalysis", name: "E-mail · DNS", category: "registration", tier: 1,
    description: "MX, SPF, DMARC, DKIM e provedor do domínio.",
    kinds: ["email"],
  },
  cveLookup: {
    id: "cveLookup", name: "NVD · CVE", category: "security", tier: 1,
    description: "Descrição oficial, CVSS, CWE, KEV e EPSS.",
    kinds: ["cve"],
    reference: (v) => `https://nvd.nist.gov/vuln/detail/${enc(v.toUpperCase())}`,
  },
  kevSearch: {
    id: "kevSearch", name: "CISA KEV", category: "security", tier: 2,
    description: "Catálogo oficial de vulnerabilidades exploradas.",
    kinds: ["cve"], count: (d) => countArray(d, "entries"),
    reference: (v) => `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${enc(v)}`,
  },
  otxIndicator: {
    id: "otxIndicator", name: "AlienVault OTX", category: "security", tier: 2,
    description: "Pulsos públicos de ameaça para o indicador.",
    kinds: ["ipv4", "ipv6", "domain", "url", "hash"],
    reference: (v) => `https://otx.alienvault.com/indicator/${/^\d{1,3}(\.\d{1,3}){3}$/.test(v) ? "ip" : v.includes("://") ? "url" : "domain"}/${enc(v)}`,
  },
  urlhausLookup: {
    id: "urlhausLookup", name: "URLhaus", category: "security", tier: 2,
    description: "URLs maliciosas conhecidas. Requer Auth-Key gratuita do abuse.ch.",
    kinds: ["domain", "url", "ipv4"], optionalKey: "ABUSECH_AUTH_KEY",
    reference: (v) => `https://urlhaus.abuse.ch/browse.php?search=${enc(v)}`,
  },
  threatFoxLookup: {
    id: "threatFoxLookup", name: "ThreatFox", category: "security", tier: 3,
    description: "Indicadores de comprometimento. Requer Auth-Key gratuita.",
    kinds: ["domain", "ipv4", "hash"], optionalKey: "ABUSECH_AUTH_KEY",
    reference: (v) => `https://threatfox.abuse.ch/browse.php?search=${enc(v)}`,
  },
  virusTotalLookup: {
    id: "virusTotalLookup", name: "VirusTotal", category: "security", tier: 3,
    description: "Reputação multiavigor. Chave gratuita opcional (4 req/min).",
    kinds: ["domain", "url", "ipv4", "hash"], optionalKey: "VT_API_KEY",
    reference: (v) => `https://www.virustotal.com/gui/search/${enc(v)}`,
  },
  safeBrowsingLookup: {
    id: "safeBrowsingLookup", name: "Google Safe Browsing", category: "security", tier: 2,
    description: "Sinal de phishing/malware. Chave gratuita opcional.",
    kinds: ["url", "domain"], optionalKey: "GOOGLE_SAFE_BROWSING_KEY",
    reference: (v) => `https://transparencyreport.google.com/safe-browsing/search?url=${enc(v)}`,
  },
  hashLookup: {
    id: "hashLookup", name: "Hash público", category: "security", tier: 1,
    description: "MalwareBazaar / VirusTotal quando há chave opcional.",
    kinds: ["hash", "file"], optionalKey: "ABUSECH_AUTH_KEY",
    reference: (v) => `https://www.virustotal.com/gui/search/${enc(v)}`,
  },
  urlAnalyzer: {
    id: "urlAnalyzer", name: "URL", category: "infrastructure", tier: 1,
    description: "Componentes, redirecionamentos e indicadores técnicos.",
    kinds: ["url", "social-profile", "website"],
  },
  cnpjLookup: {
    id: "cnpjLookup", name: "CNPJ · Receita", category: "companies", tier: 1,
    description: "Razão social, sócios e situação cadastral via BrasilAPI.",
    kinds: ["company", "organization"],
    reference: (v) => `https://brasilapi.com.br/api/cnpj/v1/${v.replace(/\D/g, "")}`,
  },
  companyOpenDataLinks: {
    id: "companyOpenDataLinks", name: "Registros empresariais", category: "companies", tier: 2,
    description: "Links para bases públicas de registro por jurisdição.",
    kinds: ["company", "organization"], count: (d) => countArray(d, "links", "jurisdictions", "results"),
  },
  githubSearch: {
    id: "githubSearch", name: "GitHub · busca", category: "search", tier: 3,
    description: "Usuários e repositórios públicos que mencionam o termo.",
    kinds: ["person", "organization", "company", "username"],
    count: (d) => countArray(d, "users", "repositories", "results", "items"),
    reference: (v) => `https://github.com/search?q=${enc(v)}&type=users`,
  },
  hackerNewsSearch: {
    id: "hackerNewsSearch", name: "Hacker News · busca", category: "search", tier: 3,
    description: "Menções públicas em notícias e discussões técnicas.",
    kinds: ["person", "organization", "company", "domain"],
    reference: (v) => `https://hn.algolia.com/?q=${enc(v)}`,
  },
};

export const SOURCE_LIST = Object.values(SEARCH_SOURCES);

const BY_KIND = new Map<PaletteNodeKind, PaletteSearchSource[]>();
for (const source of SOURCE_LIST) {
  for (const kind of source.kinds) {
    const list = BY_KIND.get(kind) ?? [];
    list.push(source);
    BY_KIND.set(kind, list);
  }
}

export function sourcesForKind(kind: PaletteNodeKind): PaletteSearchSource[] {
  return [...(BY_KIND.get(kind) ?? [])].sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name));
}

export function defaultSourcesFor(kind: PaletteNodeKind): string[] {
  return sourcesForKind(kind).map((s) => s.id);
}

const DEPTH_MAX: Record<InvestigationDepth, number> = { quick: 2, standard: 5, deep: 9 };

/** Sources compatible with the entity kind, limited by depth and budget. */
export function planSourcesFor(kind: PaletteNodeKind, depth: InvestigationDepth = "standard"): PaletteSearchSource[] {
  const tierLimit = depth === "quick" ? 1 : depth === "standard" ? 2 : 3;
  return sourcesForKind(kind).filter((s) => s.tier <= tierLimit).slice(0, DEPTH_MAX[depth]);
}

export function sourceById(id: string): PaletteSearchSource | undefined {
  return SEARCH_SOURCES[id];
}

export function referenceFor(sourceId: string, value: string): string | undefined {
  return SEARCH_SOURCES[sourceId]?.reference?.(value);
}

export type SearchOutcome = {
  sourceId: string;
  sourceName: string;
  /** Value that was queried (attached by the queue for record keeping). */
  query?: string;
  category: SourceCategory;
  ok: boolean;
  state: SearchState;
  summary: string;
  resultCount: number;
  data?: unknown;
  error?: string;
  durationMs: number;
  startedAt: string;
  reference?: string;
  optionalKey?: string;
};

export async function runSource(sourceId: string, value: string, signal?: AbortSignal): Promise<SearchOutcome> {
  const source = SEARCH_SOURCES[sourceId];
  const startedAt = new Date().toISOString();
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const elapsed = () => Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
  if (!source) {
    return {
      sourceId, sourceName: sourceId, category: "infrastructure", ok: false, state: "error",
      summary: "Fonte desconhecida.", resultCount: 0, error: "Fonte desconhecida", durationMs: 0, startedAt,
    };
  }
  const reference = referenceFor(sourceId, value);
  try {
    const res = await fetch("/api/palette/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: sourceId, value: value.trim() }),
      signal,
    });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; data?: unknown; error?: string } | null;
    if (res.status === 429) {
      return {
        sourceId, sourceName: source.name, category: source.category, ok: false, state: "rate-limited",
        summary: "Limite de requisições da fonte atingido; tente novamente em instantes.",
        resultCount: 0, error: "rate limited", durationMs: elapsed(), startedAt, reference,
      };
    }
    const record = asRecord(payload?.data);
    if (record.available === false) {
      const reason = typeof record.reason === "string" ? record.reason : "Fonte indisponível sem chave opcional.";
      return {
        sourceId, sourceName: source.name, category: source.category, ok: false, state: "unavailable",
        summary: reason, resultCount: 0, error: reason, durationMs: elapsed(), startedAt, reference,
        optionalKey: source.optionalKey,
      };
    }
    if (!res.ok || !payload?.ok) {
      const message = payload?.error || `HTTP ${res.status}`;
      return {
        sourceId, sourceName: source.name, category: source.category, ok: false, state: "error",
        summary: message, resultCount: 0, error: message, durationMs: elapsed(), startedAt, reference,
      };
    }
    const data = payload.data;
    const count = source.count ? source.count(data) : countFindings(data);
    const note = typeof record.note === "string" ? record.note : "";
    return {
      sourceId,
      sourceName: source.name,
      category: source.category,
      ok: true,
      state: count > 0 ? "completed" : "empty",
      summary: note || (count > 0
        ? `${source.name}: ${count} resultado(s) para ${value.trim()}.`
        : `${source.name}: consulta concluída sem resultados para ${value.trim()}.`),
      resultCount: count,
      data,
      durationMs: elapsed(),
      startedAt,
      reference,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return {
        sourceId, sourceName: source.name, category: source.category, ok: false, state: "error",
        summary: "Consulta cancelada pelo analista.", resultCount: 0, error: "cancelled",
        durationMs: elapsed(), startedAt, reference,
      };
    }
    const message = e instanceof Error ? e.message : String(e);
    return {
      sourceId, sourceName: source.name, category: source.category, ok: false, state: "error",
      summary: message, resultCount: 0, error: message, durationMs: elapsed(), startedAt, reference,
    };
  }
}

export const SOURCE_KIND_HINT: Partial<Record<string, string>> = Object.fromEntries(
  SOURCE_LIST.map((s) => [s.id, s.kinds.slice(0, 3).join(", ")]),
);
