/**
 * Server-only outbound request layer.
 * - Allowlisted public data sources
 * - SSRF protection (private/reserved ranges, manual redirect validation)
 * - Timeouts, TTL cache and per-IP rate limiting
 */

const BLOCKED_HOST_SUFFIXES = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home", ".corp", ".onion"];

export class UpstreamError extends Error {
  status: number;
  source: string;
  constructor(message: string, status = 502, source = "upstream") {
    super(message);
    this.status = status;
    this.source = source;
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, p) => acc * 256 + Number(p), 0);
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];

export function isBlockedAddress(ip: string): boolean {
  if (!ip) return true;
  if (ip.includes(":")) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return true;
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

/* ------------------------------ DNS over HTTPS ---------------------------- */

export type DnsRecord = { name: string; type: number; TTL?: number; data: string };
export type DnsAnswer = {
  Status: number;
  AD?: boolean;
  Answer?: DnsRecord[];
  Authority?: DnsRecord[];
  resolver: string;
};

export const RESOLVERS = {
  google: { name: "Google Public DNS", url: "https://dns.google/resolve" },
  cloudflare: { name: "Cloudflare 1.1.1.1", url: "https://cloudflare-dns.com/dns-query" },
  adguard: { name: "AdGuard DNS", url: "https://dns.adguard-dns.com/resolve" },
} as const;

export type ResolverId = keyof typeof RESOLVERS;

const DNS_TYPE_IDS: Record<string, number> = {
  A: 1, NS: 2, CNAME: 5, SOA: 6, PTR: 12, MX: 15, TXT: 16, AAAA: 28,
  SRV: 33, DS: 43, DNSKEY: 48, CAA: 257, ANY: 255,
};
export const DNS_TYPES = Object.keys(DNS_TYPE_IDS);

export async function doh(name: string, type: string, resolver: ResolverId = "google"): Promise<DnsAnswer> {
  const typeId = DNS_TYPE_IDS[type.toUpperCase()] ?? 1;
  const url = `${RESOLVERS[resolver].url}?name=${encodeURIComponent(name)}&type=${typeId}`;
  const res = await fetch(url, {
    headers: { accept: "application/dns-json", "user-agent": "LifeAgency-OSINT/3.0" },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new UpstreamError(`${RESOLVERS[resolver].name} respondeu ${res.status}`, res.status, "dns");
  const json = (await res.json()) as Omit<DnsAnswer, "resolver">;
  return { ...json, resolver: RESOLVERS[resolver].name };
}

export async function resolveHost(host: string): Promise<string[]> {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return [host];
  const out = new Set<string>();
  for (const type of ["A", "AAAA"]) {
    try {
      const ans = await doh(host, type, "cloudflare");
      for (const rec of ans.Answer ?? []) {
        if (rec.type === 1 || rec.type === 28) out.add(rec.data);
      }
    } catch {
      /* resolver failure */
    }
  }
  return [...out];
}

/* -------------------------------- SSRF guard ------------------------------ */

export type UrlCheck = { ok: boolean; reason?: string };
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);

export async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UpstreamError("URL inválida.", 400, "validation");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UpstreamError("Apenas http e https são permitidos.", 400, "validation");
  }
  if (url.username || url.password) throw new UpstreamError("URL com credenciais não é permitida.", 400, "validation");
  if (!ALLOWED_PORTS.has(url.port)) throw new UpstreamError(`Porta ${url.port} não permitida.`, 400, "validation");
  const host = url.hostname.toLowerCase();
  if (!host) throw new UpstreamError("Host ausente.", 400, "validation");
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UpstreamError("Destino interno bloqueado.", 403, "ssrf");
  }
  const addresses = await resolveHost(host);
  if (addresses.length === 0 && !host.includes(".")) throw new UpstreamError("Host não resolvido.", 400, "validation");
  for (const ip of addresses) {
    if (isBlockedAddress(ip)) {
      throw new UpstreamError(`Destino privado/interno bloqueado (${ip}).`, 403, "ssrf");
    }
  }
  return url;
}

export type SafeFetchResult = {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  finalUrl: string;
  chain: Array<{ url: string; status: number }>;
  contentType: string;
};

export async function safeFetch(
  raw: string,
  opts: { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<SafeFetchResult> {
  const { timeoutMs = 12000, maxBytes = 300_000, maxRedirects = 5 } = opts;
  const chain: Array<{ url: string; status: number }> = [];
  let current = raw;
  for (let attempt = 0; attempt <= maxRedirects; attempt++) {
    const url = await assertSafeUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method: opts.method ?? "GET",
        redirect: "manual",
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; LifeAgency-OSINT/3.0; +https://furrys.life/agency)",
          accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          ...opts.headers,
        },
        body: opts.body,
        signal: controller.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof Error && e.name === "AbortError") throw new UpstreamError(`Tempo esgotado ao consultar ${url.hostname}.`, 504, "timeout");
      throw new UpstreamError(`Falha de conexão com ${url.hostname}: ${(e as Error).message}`, 502, "network");
    }
    clearTimeout(timer);
    chain.push({ url: url.toString(), status: res.status });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, url).toString();
      continue;
    }
    const reader = res.body?.getReader();
    let received = 0;
    let truncated = false;
    const chunks: Uint8Array[] = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          chunks.push(value.slice(0, Math.max(0, value.byteLength - (received - maxBytes))));
          truncated = true;
          await reader.cancel().catch(() => {});
          break;
        }
        chunks.push(value);
      }
    }
    const buffer = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
    let offset = 0;
    for (const c of chunks) { buffer.set(c, offset); offset += c.byteLength; }
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    return {
      status: res.status,
      ok: res.ok,
      headers,
      body: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      truncated,
      finalUrl: url.toString(),
      chain,
      contentType: res.headers.get("content-type") ?? "",
    };
  }
  const last = chain[chain.length - 1];
  return {
    status: last?.status ?? 0,
    ok: false,
    headers: {},
    body: "",
    truncated: false,
    finalUrl: current,
    chain,
    contentType: "",
  };
}

export async function fetchJson<T>(url: string, opts: { timeoutMs?: number; headers?: Record<string, string>; method?: string; body?: string } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000);
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0 (compatible; LifeAgency-OSINT/3.0)", ...opts.headers },
      body: opts.body,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      let detail = text.slice(0, 240);
      try {
        const parsed = JSON.parse(text);
        detail = (parsed.error as string) ?? (parsed.message as string) ?? (parsed.errors ? JSON.stringify(parsed.errors).slice(0, 200) : detail);
      } catch { /* keep raw */ }
      throw new UpstreamError(`${new URL(url).hostname} respondeu ${res.status}${detail ? `: ${detail}` : ""}`, res.status, new URL(url).hostname);
    }
    if (!text) return {} as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new UpstreamError("Resposta não é JSON válido.", 502, new URL(url).hostname);
    }
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    if (e instanceof Error && e.name === "AbortError") throw new UpstreamError("Tempo esgotado na consulta.", 504, new URL(url).hostname);
    throw new UpstreamError(`Falha de rede: ${(e as Error).message}`, 502, new URL(url).hostname);
  } finally {
    clearTimeout(timer);
  }
}

/* --------------------------------- cache ---------------------------------- */

type CacheRow = { expires: number; value: unknown };
const cache = new Map<string, CacheRow>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  if (cache.size > 400) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
    if (cache.size > 400) cache.clear();
  }
  cache.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

/* ------------------------------ rate limiting ----------------------------- */

const buckets = new Map<string, { tokens: number; updated: number }>();

async function clientKey(): Promise<string> {
  try {
    // Dynamically imported so the client bundle never pulls the server runtime.
    const { getRequest } = await import("@tanstack/react-start/server");
    const req = getRequest();
    const ip = req.headers.get("cf-connecting-ip")
      ?? req.headers.get("x-real-ip")
      ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "local";
    return ip || "local";
  } catch {
    return "local";
  }
}

export async function enforceRateLimit(scope: string, cost = 1, limitPerMinute = 40): Promise<void> {
  const key = `${scope}:${await clientKey()}`;
  const now = Date.now();
  const row = buckets.get(key) ?? { tokens: limitPerMinute, updated: now };
  const refill = ((now - row.updated) / 60000) * limitPerMinute;
  row.tokens = Math.min(limitPerMinute, row.tokens + refill);
  row.updated = now;
  if (row.tokens < cost) {
    buckets.set(key, row);
    throw new UpstreamError("Limite de consultas por minuto atingido. Aguarde alguns segundos.", 429, "rate-limit");
  }
  row.tokens -= cost;
  buckets.set(key, row);
  if (buckets.size > 2000) buckets.clear();
}

/* ------------------------------- validation ------------------------------- */

const DOMAIN_RE = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;
export function assertDomain(value: unknown): string {
  const v = String(value ?? "").trim().toLowerCase();
  if (!DOMAIN_RE.test(v)) throw new UpstreamError("Domínio inválido.", 400, "validation");
  return v;
}

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
export function assertIp(value: unknown): string {
  const v = String(value ?? "").trim();
  if (!IPV4_RE.test(v) && !/^[0-9a-f:]+$/i.test(v)) throw new UpstreamError("Endereço IP inválido.", 400, "validation");
  return v;
}

export function assertAsn(value: unknown): string {
  const v = String(value ?? "").trim().toUpperCase().replace(/^AS/, "");
  if (!/^\d{1,10}$/.test(v)) throw new UpstreamError("ASN inválido (ex.: AS15169).", 400, "validation");
  return v;
}

export function assertText(value: unknown, max = 200): string {
  const v = String(value ?? "").trim();
  if (!v) throw new UpstreamError("Informe um valor.", 400, "validation");
  if (v.length > max) throw new UpstreamError(`Valor muito longo (máx. ${max}).`, 400, "validation");
  return v;
}

/* --------------------------------- utils ---------------------------------- */

export function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

export function firstMatch(html: string, re: RegExp): string | undefined {
  const m = html.match(re);
  return m?.[1] ? decodeEntities(m[1].trim()) : undefined;
}

/** Convert DNS TXT record data (quoted, possibly split) to plain text. */
export function txtValue(data: string): string {
  return data.replace(/"\s+"/g, "").replace(/^"|"$/g, "");
}

export function truncate(value: string, n = 400): string {
  return value.length > n ? `${value.slice(0, n)}…` : value;
}
