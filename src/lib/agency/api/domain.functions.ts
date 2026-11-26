import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertDomain,
  cached,
  doh,
  enforceRateLimit,
  fetchJson,
  firstMatch,
  safeFetch,
  stripTags,
  txtValue,
  UpstreamError,
} from "@/lib/agency/http.server";

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

export type DomainLookupResult = {
  domain: string;
  queriedAt: string;
  rdap: {
    handle?: string;
    name?: string;
    status?: string[];
    registrar?: string;
    registrarIanaId?: string;
    created?: string;
    expires?: string;
    updated?: string;
    nameservers?: string[];
    dnssec?: string | null;
    abuseEmail?: string;
    raw_url?: string;
  } | null;
  dns: {
    a: string[];
    aaaa: string[];
    mx: string[];
    ns: string[];
  };
  sources: SourceStatus[];
};

export type DnsResult = {
  domain: string;
  queriedAt: string;
  resolver: string;
  records: Record<string, Array<{ value: string; ttl?: number; detail?: string }>>;
  dnssecValidated: boolean;
  status: string;
  sources: SourceStatus[];
};

export type SubdomainResult = {
  domain: string;
  queriedAt: string;
  total: number;
  subdomains: Array<{ name: string; firstSeen?: string; issuer?: string }>;
  certificates: Array<{ id: number; commonName: string; issuer: string; notBefore: string; notAfter: string; entryTimestamp: string; nameValue?: string }>;
  source: SourceStatus;
};

export type SslResult = {
  domain: string;
  queriedAt: string;
  certificates: Array<{
    id: number;
    commonName: string;
    nameValue: string;
    issuer: string;
    notBefore: string;
    notAfter: string;
    expired: boolean;
    daysToExpiry: number;
    san: string[];
    serialNumber?: string;
    signatureAlgorithm?: string;
  }>;
  source: SourceStatus;
};

export type WebsiteResult = {
  url: string;
  finalUrl: string;
  status: number;
  statusText: string;
  chain: Array<{ url: string; status: number }>;
  headers: Record<string, string>;
  title?: string;
  description?: string;
  metaTags: Record<string, string>;
  h1: string[];
  technologies: Array<{ name: string; evidence: string; category: string }>;
  robots: { url: string; ok: boolean; status: number; content: string } | null;
  sitemap: { url: string; ok: boolean; status: number; entries: number; sample: string[] } | null;
  favicon: { url: string; sha256?: string; status?: number } | null;
  securityHeaders: Array<{ header: string; present: boolean; value?: string; note: string }>;
  serverIp?: string;
  contentLength: number;
  truncated: boolean;
  queriedAt: string;
  sources: SourceStatus[];
};

export type WaybackResult = {
  domain: string;
  queriedAt: string;
  closest: { url: string; timestamp: string; available: boolean } | null;
  captures: Array<{ timestamp: string; url: string; statusCode?: string; mimeType?: string; length?: string }>;
  totalCaptures: number;
  source: SourceStatus;
};

/* ========================================================================== */
/* RDAP                                                                       */
/* ========================================================================== */

type RdapEntity = {
  roles?: string[];
  vcardArray?: [string, Array<[string, unknown, string, unknown]>];
  publicIds?: Array<{ type: string; identifier: string }>;
  entities?: RdapEntity[];
};

type RdapDomain = {
  handle?: string;
  ldhName?: string;
  status?: string[];
  events?: Array<{ eventAction: string; eventDate: string }>;
  nameservers?: Array<{ ldhName?: string }>;
  secureDNS?: { delegationSigned?: boolean };
  entities?: RdapEntity[];
  links?: Array<{ rel: string; href: string }>;
};

function vcardField(entity: RdapEntity | undefined, field: string): string | undefined {
  const vcard = entity?.vcardArray?.[1];
  if (!vcard) return undefined;
  const row = vcard.find((r) => r[0] === field);
  if (!row) return undefined;
  const value = row[3];
  if (Array.isArray(value)) return value.filter(Boolean).join(" / ");
  return typeof value === "string" ? value : undefined;
}

export const domainLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(1).max(253) }))
  .handler(async ({ data }): Promise<DomainLookupResult> => {
    await enforceRateLimit("domain-lookup", 1);
    const domain = assertDomain(data.domain);
    const sources: SourceStatus[] = [];

    const [rdapResult, a, aaaa, mx, ns] = await Promise.all([
      cached(`rdap:${domain}`, 10 * 60_000, async () => {
        try {
          const json = await fetchJson<RdapDomain>(`https://rdap.org/domain/${encodeURIComponent(domain)}`, { timeoutMs: 12000 });
          sources.push({ name: "RDAP (rdap.org)", ok: true });
          return json;
        } catch (e) {
          sources.push({ name: "RDAP (rdap.org)", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(`dns:a:${domain}`, 120_000, () => safeAnswers(domain, "A")),
      cached(`dns:aaaa:${domain}`, 120_000, () => safeAnswers(domain, "AAAA")),
      cached(`dns:mx:${domain}`, 120_000, () => safeAnswers(domain, "MX")),
      cached(`dns:ns:${domain}`, 120_000, () => safeAnswers(domain, "NS")),
    ]);

    let rdap: DomainLookupResult["rdap"] = null;
    if (rdapResult) {
      const registrarEntity = (rdapResult.entities ?? []).find((e) => e.roles?.includes("registrar"));
      const abuse = registrarEntity?.entities?.find((e) => e.roles?.includes("abuse"));
      const events = rdapResult.events ?? [];
      const ev = (action: string) => events.find((e) => e.eventAction === action)?.eventDate;
      rdap = {
        handle: rdapResult.handle,
        name: rdapResult.ldhName ?? domain,
        status: rdapResult.status,
        registrar: vcardField(registrarEntity, "fn"),
        registrarIanaId: registrarEntity?.publicIds?.find((p) => p.type.toLowerCase().includes("iana"))?.identifier,
        created: ev("registration"),
        expires: ev("expiration"),
        updated: ev("last changed") ?? ev("last update of RDAP database"),
        nameservers: (rdapResult.nameservers ?? []).map((n) => n.ldhName).filter(Boolean) as string[],
        dnssec: rdapResult.secureDNS ? (rdapResult.secureDNS.delegationSigned ? "assinado" : "não assinado") : null,
        abuseEmail: vcardField(abuse, "email"),
        raw_url: `https://rdap.org/domain/${domain}`,
      };
    }

    sources.push({ name: "Google Public DNS", ok: a.length + aaaa.length > 0 || a.length === 0 });
    return {
      domain,
      queriedAt: new Date().toISOString(),
      rdap,
      dns: { a, aaaa, mx, ns },
      sources,
    };
  });

async function safeAnswers(name: string, type: string): Promise<string[]> {
  try {
    const ans = await doh(name, type, "google");
    return (ans.Answer ?? []).filter((r) => r.type === typeId(type)).map((r) => r.data);
  } catch {
    return [];
  }
}

function typeId(type: string): number {
  const map: Record<string, number> = { A: 1, AAAA: 28, MX: 15, NS: 2, TXT: 16, CNAME: 5, SOA: 6, PTR: 12, CAA: 257, DS: 43, DNSKEY: 48 };
  return map[type] ?? 1;
}

/* ========================================================================== */
/* DNS                                                                        */
/* ========================================================================== */

const DNS_STATUS: Record<number, string> = {
  0: "NOERROR",
  1: "FORMERR",
  2: "SERVFAIL",
  3: "NXDOMAIN",
  4: "NOTIMP",
  5: "REFUSED",
};

export const dnsLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    domain: z.string().min(1).max(253),
    resolver: z.enum(["google", "cloudflare", "adguard"]).optional(),
  }))
  .handler(async ({ data }): Promise<DnsResult> => {
    await enforceRateLimit(`dns-lookup:${data.resolver ?? "google"}`, 1);
    const domain = assertDomain(data.domain);
    const types = ["A", "AAAA", "MX", "TXT", "NS", "CNAME", "SOA", "CAA", "DS", "DNSKEY", "PTR"];
    const records: DnsResult["records"] = {};
    let dnssec = false;
    let status = "NOERROR";
    const answers = await Promise.all(
      types.map(async (t) => {
        try {
          const ans = await doh(t === "PTR" ? toPtrName(domain) : domain, t, data.resolver ?? "google");
          if (ans.Status !== 0) status = DNS_STATUS[ans.Status] ?? String(ans.Status);
          if (ans.AD) dnssec = true;
          return [t, ans] as const;
        } catch {
          return [t, null] as const;
        }
      }),
    );
    for (const [t, ans] of answers) {
      if (!ans?.Answer?.length) continue;
      records[t] = ans.Answer.map((r) => ({
        value: t === "TXT" ? txtValue(r.data) : r.data,
        ttl: r.TTL,
        detail: r.name !== domain ? `nome: ${r.name}` : undefined,
      }));
    }
    return {
      domain,
      queriedAt: new Date().toISOString(),
      resolver: data.resolver === "cloudflare" ? "Cloudflare 1.1.1.1" : data.resolver === "adguard" ? "AdGuard DNS" : "Google Public DNS",
      records,
      dnssecValidated: dnssec,
      status,
      sources: [{ name: "DNS over HTTPS", ok: true }],
    };
  });

function toPtrName(ipOrDomain: string): string {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ipOrDomain)) {
    return `${ipOrDomain.split(".").reverse().join(".")}.in-addr.arpa`;
  }
  return ipOrDomain;
}

/* ========================================================================== */
/* crt.sh                                                                     */
/* ========================================================================== */

type CrtRow = {
  id: number;
  common_name?: string;
  name_value?: string;
  issuer_name?: string;
  not_before?: string;
  not_after?: string;
  entry_timestamp?: string;
  serial_number?: string;
  signature_algorithm?: string;
};

export const subdomainFinder = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(1).max(253) }))
  .handler(async ({ data }): Promise<SubdomainResult> => {
    await enforceRateLimit("crt", 1, 20);
    const domain = assertDomain(data.domain);
    const rows = await cached(`crt:${domain}`, 15 * 60_000, async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`, {
          headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT/3.0" },
          signal: controller.signal,
        });
        if (!res.ok) throw new UpstreamError(`crt.sh respondeu ${res.status}`, res.status, "crt.sh");
        const text = await res.text();
        if (!text.trim().startsWith("[")) throw new UpstreamError("crt.sh não retornou JSON (limite de consultas temporário).", 429, "crt.sh");
        return JSON.parse(text) as CrtRow[];
      } catch (e) {
        if (e instanceof UpstreamError) throw e;
        if (e instanceof Error && e.name === "AbortError") throw new UpstreamError("crt.sh excedeu o tempo limite. Domínios grandes demoram mais — tente novamente.", 504, "crt.sh");
        throw new UpstreamError(`Falha no crt.sh: ${(e as Error).message}`, 502, "crt.sh");
      } finally {
        clearTimeout(timer);
      }
    });

    const names = new Map<string, { firstSeen?: string; issuer?: string }>();
    for (const row of rows) {
      for (const raw of (row.name_value ?? row.common_name ?? "").split(/\n/)) {
        const name = raw.trim().toLowerCase().replace(/^\*\./, "");
        if (!name || !name.endsWith(domain)) continue;
        const existing = names.get(name);
        const seen = row.entry_timestamp ?? row.not_before;
        if (!existing) names.set(name, { firstSeen: seen, issuer: row.issuer_name });
        else if (seen && existing.firstSeen && seen < existing.firstSeen) existing.firstSeen = seen;
      }
    }
    const subdomains = [...names.entries()]
      .map(([name, meta]) => ({ name, ...meta }))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 1500);

    const certificates = rows
      .slice()
      .sort((a, b) => (b.not_before ?? "").localeCompare(a.not_before ?? ""))
      .slice(0, 120)
      .map((r) => ({
        id: r.id,
        commonName: (r.common_name ?? "").replace(/^\*\./, ""),
        issuer: shortIssuer(r.issuer_name ?? ""),
        notBefore: r.not_before ?? "",
        notAfter: r.not_after ?? "",
        entryTimestamp: r.entry_timestamp ?? "",
        nameValue: r.name_value,
      }));

    return {
      domain,
      queriedAt: new Date().toISOString(),
      total: names.size,
      subdomains,
      certificates,
      source: { name: "crt.sh (Certificate Transparency)", ok: true },
    };
  });

function shortIssuer(issuer: string): string {
  const cn = issuer.match(/CN=([^,]+)/i);
  if (cn) return cn[1].trim();
  const o = issuer.match(/O=([^,]+)/i);
  return o ? o[1].trim() : issuer.slice(0, 80);
}

export const sslAnalyzer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(1).max(253) }))
  .handler(async ({ data }): Promise<SslResult> => {
    await enforceRateLimit("crt", 1, 20);
    const domain = assertDomain(data.domain);
    const rows = await cached(`crt:exact:${domain}`, 10 * 60_000, async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch(`https://crt.sh/?q=${encodeURIComponent(domain)}&output=json`, {
            headers: { accept: "application/json", "user-agent": "LifeAgency-OSINT/3.0" },
            signal: AbortSignal.timeout(30000),
          });
          if (!res.ok) throw new UpstreamError(`crt.sh respondeu ${res.status}`, res.status, "crt.sh");
          const text = await res.text();
          if (!text.trim().startsWith("[")) return [] as CrtRow[];
          return JSON.parse(text) as CrtRow[];
        } catch (e) {
          lastError = e;
          if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 900));
        }
      }
      throw new UpstreamError(
        `crt.sh não respondeu em 30s por duas tentativas (${(lastError as Error)?.message ?? "timeout"}). Consulta de Certificate Transparency é lenta para domínios populares — tente novamente em instantes.`,
        504,
        "crt.sh",
      );
    });
    const now = Date.now();
    const certificates = rows
      .slice()
      .sort((a, b) => (b.not_after ?? "").localeCompare(a.not_after ?? ""))
      .slice(0, 30)
      .map((r) => {
        const expiry = new Date(r.not_after ?? "").getTime();
        return {
          id: r.id,
          commonName: (r.common_name ?? "").replace(/^\*\./, ""),
          nameValue: r.name_value ?? "",
          issuer: shortIssuer(r.issuer_name ?? ""),
          notBefore: r.not_before ?? "",
          notAfter: r.not_after ?? "",
          expired: Number.isFinite(expiry) ? expiry < now : false,
          daysToExpiry: Number.isFinite(expiry) ? Math.round((expiry - now) / 86400000) : 0,
          san: [...new Set((r.name_value ?? "").split(/\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 60),
          serialNumber: r.serial_number,
          signatureAlgorithm: r.signature_algorithm,
        };
      });
    return {
      domain,
      queriedAt: new Date().toISOString(),
      certificates,
      source: {
        name: "crt.sh (Certificate Transparency)",
        ok: true,
        detail: "Dados de certificados públicos registrados em logs CT. A configuração TLS ativa não é inspecionada.",
      },
    };
  });

/* ========================================================================== */
/* Website analyzer                                                           */
/* ========================================================================== */

const TECH_RULES: Array<{ name: string; category: string; test: RegExp; where: "html" | "header" }> = [
  { name: "WordPress", category: "CMS", test: /wp-content|wp-includes|wp-json/i, where: "html" },
  { name: "Drupal", category: "CMS", test: /drupal|sites\/default\/files/i, where: "html" },
  { name: "Joomla", category: "CMS", test: /\/media\/jui\/|joomla/i, where: "html" },
  { name: "Shopify", category: "E-commerce", test: /cdn\.shopify\.com|shopify\.theme/i, where: "html" },
  { name: "WooCommerce", category: "E-commerce", test: /woocommerce/i, where: "html" },
  { name: "Magento", category: "E-commerce", test: /magento|mage\/cookies/i, where: "html" },
  { name: "Next.js", category: "Framework", test: /__NEXT_DATA__|\/_next\/static/i, where: "html" },
  { name: "Nuxt", category: "Framework", test: /__NUXT__|\/_nuxt\//i, where: "html" },
  { name: "React", category: "Framework", test: /data-reactroot|react\.production\.min\.js|__REACT/i, where: "html" },
  { name: "Vue.js", category: "Framework", test: /vue(\.runtime)?(\.min)?\.js|data-v-[0-9a-f]{6}/i, where: "html" },
  { name: "Angular", category: "Framework", test: /ng-version=|angular\.min\.js/i, where: "html" },
  { name: "Svelte", category: "Framework", test: /svelte-[a-z0-9]{6}|__sveltekit/i, where: "html" },
  { name: "Tailwind CSS", category: "CSS", test: /tailwind|class="[^"]*\b(flex|grid)\b[^"]*\bpx-\d/i, where: "html" },
  { name: "Bootstrap", category: "CSS", test: /bootstrap(\.min)?\.css/i, where: "html" },
  { name: "jQuery", category: "Library", test: /jquery(-\d|\.min)?\.js/i, where: "html" },
  { name: "Google Analytics", category: "Analytics", test: /gtag\(|googletagmanager\.com|ga\('create'/i, where: "html" },
  { name: "Google Tag Manager", category: "Analytics", test: /googletagmanager\.com\/gtm\.js/i, where: "html" },
  { name: "Meta Pixel", category: "Analytics", test: /connect\.facebook\.net\/.*fbevents/i, where: "html" },
  { name: "Cloudflare", category: "CDN", test: /cloudflare/i, where: "header" },
  { name: "Nginx", category: "Server", test: /nginx/i, where: "header" },
  { name: "Apache", category: "Server", test: /apache/i, where: "header" },
  { name: "LiteSpeed", category: "Server", test: /litespeed/i, where: "header" },
  { name: "Microsoft IIS", category: "Server", test: /microsoft-iis/i, where: "header" },
  { name: "Amazon CloudFront", category: "CDN", test: /cloudfront/i, where: "header" },
  { name: "Vercel", category: "Hosting", test: /vercel/i, where: "header" },
  { name: "Netlify", category: "Hosting", test: /netlify/i, where: "header" },
  { name: "GitHub Pages", category: "Hosting", test: /github\.com|github\.io/i, where: "header" },
  { name: "Varnish", category: "Cache", test: /varnish/i, where: "header" },
  { name: "HSTS", category: "Security", test: /strict-transport-security/i, where: "header" },
];

export const websiteAnalyzer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string().min(3).max(2048) }))
  .handler(async ({ data }): Promise<WebsiteResult> => {
    await enforceRateLimit("website", 1, 20);
    const target = /^https?:\/\//i.test(data.url) ? data.url : `https://${data.url}`;
    const page = await safeFetch(target, { timeoutMs: 15000, maxBytes: 600_000 });
    const html = page.body;
    const headerText = Object.entries(page.headers).map(([k, v]) => `${k}: ${v}`).join("\n");

    const metaTags: Record<string, string> = {};
    for (const m of html.matchAll(/<meta\s+([^>]+)>/gi)) {
      const attrs = m[1];
      const name = attrs.match(/(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1];
      const content = attrs.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
      if (name && content && Object.keys(metaTags).length < 40) metaTags[name.toLowerCase()] = content.slice(0, 300);
    }

    const h1 = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)]
      .map((m) => stripTags(m[1]).slice(0, 160))
      .filter(Boolean)
      .slice(0, 8);

    const technologies: WebsiteResult["technologies"] = [];
    for (const rule of TECH_RULES) {
      const haystack = rule.where === "html" ? html : headerText;
      if (rule.test.test(haystack)) {
        technologies.push({ name: rule.name, category: rule.category, evidence: rule.where === "html" ? "HTML" : "HTTP header" });
      }
    }

    const origin = new URL(page.finalUrl).origin;

    const robots = await (async () => {
      try {
        const r = await safeFetch(`${origin}/robots.txt`, { timeoutMs: 7000, maxBytes: 60_000 });
        return { url: `${origin}/robots.txt`, ok: r.status === 200, status: r.status, content: r.body.slice(0, 6000) };
      } catch {
        return null;
      }
    })();

    const sitemap = await (async () => {
      try {
        const r = await safeFetch(`${origin}/sitemap.xml`, { timeoutMs: 8000, maxBytes: 200_000 });
        const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
        return { url: `${origin}/sitemap.xml`, ok: r.status === 200, status: r.status, entries: locs.length, sample: locs.slice(0, 20) };
      } catch {
        return null;
      }
    })();

    const faviconUrl = (() => {
      const declared = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1]
        ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*icon[^"']*["']/i)?.[1];
      if (declared) {
        try { return new URL(declared, page.finalUrl).toString(); } catch { /* ignore */ }
      }
      return `${origin}/favicon.ico`;
    })();

    let favicon: WebsiteResult["favicon"] = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(faviconUrl, { signal: controller.signal, headers: { "user-agent": "LifeAgency-OSINT/3.0" } }).finally(() => clearTimeout(timer));
      if (res.ok) {
        const buf = new Uint8Array(await res.arrayBuffer()).slice(0, 300_000);
        const digest = await crypto.subtle.digest("SHA-256", buf.slice().buffer as ArrayBuffer);
        const sha256 = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
        favicon = { url: faviconUrl, sha256, status: res.status };
      } else favicon = { url: faviconUrl, status: res.status };
    } catch {
      favicon = { url: faviconUrl };
    }

    const securityHeaders = [
      { header: "strict-transport-security", note: "Força HTTPS (HSTS)." },
      { header: "content-security-policy", note: "Mitiga XSS e injeção de conteúdo." },
      { header: "x-frame-options", note: "Proteção contra clickjacking." },
      { header: "x-content-type-options", note: "Evita sniffing de MIME." },
      { header: "referrer-policy", note: "Controla vazamento de referrer." },
      { header: "permissions-policy", note: "Restringe APIs do navegador." },
    ].map((h) => ({ ...h, present: Boolean(page.headers[h.header]), value: page.headers[h.header] }));

    let serverIp: string | undefined;
    try {
      const host = new URL(page.finalUrl).hostname;
      const ans = await doh(host, "A", "google");
      serverIp = ans.Answer?.find((r) => r.type === 1)?.data;
    } catch { /* optional */ }

    return {
      url: target,
      finalUrl: page.finalUrl,
      status: page.status,
      statusText: statusText(page.status),
      chain: page.chain,
      headers: page.headers,
      title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
      description: metaTags["description"] ?? metaTags["og:description"],
      metaTags,
      h1,
      technologies,
      robots,
      sitemap,
      favicon,
      securityHeaders,
      serverIp,
      contentLength: html.length,
      truncated: page.truncated,
      queriedAt: new Date().toISOString(),
      sources: [
        { name: "Requisição HTTP direta (servidor Life Agency)", ok: page.ok, detail: `status ${page.status}`, url: page.finalUrl },
        { name: "Google Public DNS", ok: Boolean(serverIp) },
      ],
    };
  });

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: "OK", 201: "Created", 204: "No Content", 301: "Moved Permanently", 302: "Found",
    304: "Not Modified", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 405: "Method Not Allowed", 429: "Too Many Requests",
    500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
  };
  return map[code] ?? "";
}

/* ========================================================================== */
/* Wayback                                                                    */
/* ========================================================================== */

export const waybackHistory = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(1).max(253), limit: z.number().min(1).max(200).optional() }))
  .handler(async ({ data }): Promise<WaybackResult> => {
    await enforceRateLimit("wayback", 1, 20);
    const domain = assertDomain(data.domain);
    const limit = data.limit ?? 60;

    const [availability, cdx] = await Promise.all([
      cached(`wb:avail:${domain}`, 30 * 60_000, async () => {
        try {
          return await fetchJson<{ archived_snapshots?: { closest?: { url: string; timestamp: string; available: boolean } } }>(
            `https://archive.org/wayback/available?url=${encodeURIComponent(domain)}`,
            { timeoutMs: 12000 },
          );
        } catch {
          return null;
        }
      }),
      cached(`wb:cdx:${domain}:${limit}`, 30 * 60_000, async () => {
        try {
          const res = await fetch(
            `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp,original,statuscode,mimetype,length&filter=statuscode:200&collapse=timestamp:6&limit=${limit}`,
            { headers: { "user-agent": "LifeAgency-OSINT/3.0" }, signal: AbortSignal.timeout(20000) },
          );
          if (!res.ok) throw new UpstreamError(`CDX ${res.status}`, res.status, "wayback");
          const json = (await res.json()) as string[][];
          return json;
        } catch {
          return [] as string[][];
        }
      }),
    ]);

    const rows = (cdx ?? []).slice(1);
    return {
      domain,
      queriedAt: new Date().toISOString(),
      closest: availability?.archived_snapshots?.closest
        ? {
            url: availability.archived_snapshots.closest.url.replace(/^http:/, "https:"),
            timestamp: availability.archived_snapshots.closest.timestamp,
            available: availability.archived_snapshots.closest.available,
          }
        : null,
      captures: rows.map((r) => ({
        timestamp: r[0],
        url: r[1],
        statusCode: r[2],
        mimeType: r[3],
        length: r[4],
      })),
      totalCaptures: rows.length,
      source: {
        name: "Wayback Machine (Internet Archive)",
        ok: Boolean(availability) || rows.length > 0,
        detail: rows.length === 0 ? "Nenhuma captura retornada — o domínio pode não estar arquivado." : undefined,
      },
    };
  });
