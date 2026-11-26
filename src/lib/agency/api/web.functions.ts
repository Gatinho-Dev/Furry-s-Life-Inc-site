import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { assertDomain, cached, enforceRateLimit, fetchJson, safeFetch, stripTags, UpstreamError } from "@/lib/agency/http.server";

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

/* ========================================================================== */
/* URL analysis                                                               */
/* ========================================================================== */

export type UrlAnalysis = {
  input: string;
  normalized: string;
  queriedAt: string;
  parsed: {
    protocol: string;
    host: string;
    port: string;
    path: string;
    query: string;
    fragment: string;
    registrableDomain: string;
    isIpHost: boolean;
    username?: string;
  };
  queryParams: Array<{ key: string; value: string; suspicious: boolean }>;
  redirectChain: Array<{ url: string; status: number }>;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  securityHeaders: Array<{ header: string; present: boolean; value?: string }>;
  title?: string;
  server?: string;
  contentLength: number;
  isShortened: boolean;
  shortenerName?: string;
  indicators: Array<{ label: string; severity: "low" | "medium" | "high"; detail: string }>;
  riskScore: number;
  sources: SourceStatus[];
};

const SHORTENERS: Record<string, string> = {
  "bit.ly": "Bitly", "tinyurl.com": "TinyURL", "t.co": "X/Twitter", "goo.gl": "Google",
  "ow.ly": "Hootsuite", "is.gd": "is.gd", "buff.ly": "Buffer", "cutt.ly": "Cuttly",
  "rb.gy": "Rebrandly", "shorturl.at": "ShortURL", "rebrand.ly": "Rebrandly",
  "tiny.cc": "Tiny.cc", "lnkd.in": "LinkedIn", "youtu.be": "YouTube",
};

const SUSPICIOUS_PARAMS = ["redirect", "url", "next", "continue", "return", "goto", "dest", "target", "r", "u", "q", "token", "password", "passwd", "pwd", "session", "auth", "key", "apikey", "email"];

const PHISHING_WORDS = ["login", "signin", "verify", "account", "secure", "update", "confirm", "wallet", "recover", "unlock", "billing", "invoice", "password", "suporte", "seguranca", "atualizar"];

function registrableDomain(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const twoLevel = ["com.br", "net.br", "org.br", "gov.br", "edu.br", "co.uk", "org.uk", "co.jp", "com.au", "co.za"];
  const lastTwo = parts.slice(-2).join(".");
  if (twoLevel.includes(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

export const urlAnalyzer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string().min(3).max(2048) }))
  .handler(async ({ data }): Promise<UrlAnalysis> => {
    await enforceRateLimit("url-analyzer", 1, 20);
    const normalized = /^https?:\/\//i.test(data.url) ? data.url.trim() : `https://${data.url.trim()}`;
    let url: URL;
    try { url = new URL(normalized); } catch { throw new UpstreamError("URL inválida.", 400, "validation"); }
    const host = url.hostname;
    const isIpHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
    const domain = isIpHost ? host : registrableDomain(host);
    const indicators: UrlAnalysis["indicators"] = [];

    if (url.protocol === "http:") indicators.push({ label: "Sem HTTPS", severity: "medium", detail: "A URL usa HTTP simples; o conteúdo pode ser interceptado." });
    if (isIpHost) indicators.push({ label: "Host é um IP literal", severity: "high", detail: "URLs legítimas raramente usam o endereço IP diretamente no host." });
    if (url.username || url.password) indicators.push({ label: "Credenciais embutidas na URL", severity: "high", detail: "Padrão comum em phishing (https://usuario@host-falso)." });
    if (host.split(".").length > 4) indicators.push({ label: "Muitos subdomínios", severity: "medium", detail: `${host.split(".").length} níveis — possível imitação de domínio.` });
    if (host.length > 45) indicators.push({ label: "Host muito longo", severity: "low", detail: "Hosts longos são usados para esconder o domínio real." });
    if (/[а-яё]/i.test(host) || /xn--/.test(host)) indicators.push({ label: "Possível homógrafo/Punycode", severity: "high", detail: "O host contém caracteres não latinos ou IDN — verifique visualmente." });
    if (host.includes("-") && PHISHING_WORDS.some((w) => host.includes(w))) indicators.push({ label: "Palavra sensível no host", severity: "medium", detail: "Termos típicos de páginas de login/verificação no próprio domínio." });
    if (/\.(zip|mov|top|xyz|click|shop|live|icu|rest|fit|cfd)$/i.test(host)) indicators.push({ label: "TLD de alto abuso", severity: "medium", detail: "Essa extensão é frequentemente usada em campanhas maliciosas." });
    if (normalized.length > 200) indicators.push({ label: "URL muito longa", severity: "low", detail: "URLs longas podem ocultar parâmetros maliciosos." });

    const queryParams = [...url.searchParams.entries()].map(([key, value]) => ({
      key,
      value: value.slice(0, 300),
      suspicious: SUSPICIOUS_PARAMS.includes(key.toLowerCase()) || /^(https?:)?\/\//i.test(value),
    }));
    for (const p of queryParams.filter((p) => p.suspicious)) {
      indicators.push({ label: `Parâmetro sensível: ${p.key}`, severity: "medium", detail: "Pode conter URL de redirecionamento, token ou credencial." });
    }

    const lowHost = host.toLowerCase();
    const isShortened = Boolean(SHORTENERS[registrableDomain(lowHost)]);
    if (isShortened) indicators.push({ label: "Encurtador de URL", severity: "low", detail: `Destino intermediado por ${SHORTENERS[registrableDomain(lowHost)]}; o destino final é mostrado após a expansão.` });

    const sources: SourceStatus[] = [];
    let page: { status: number; headers: Record<string, string>; chain: Array<{ url: string; status: number }>; finalUrl: string; body: string };
    try {
      page = await safeFetch(normalized, { timeoutMs: 12000, maxBytes: 250_000 });
      sources.push({ name: "Requisição HTTP (servidor Life Agency)", ok: page.status > 0, detail: `status ${page.status}` });
    } catch (e) {
      sources.push({ name: "Requisição HTTP", ok: false, detail: (e as Error).message });
      page = { status: 0, headers: {}, chain: [], finalUrl: normalized, body: "" };
    }

    if (page.chain.length > 3) indicators.push({ label: "Cadeia de redirecionamentos longa", severity: "low", detail: `${page.chain.length} saltos até o destino final.` });
    if (page.chain.some((c) => c.status >= 400)) indicators.push({ label: "Redirecionamento com erro", severity: "low", detail: "Um dos saltos retornou erro HTTP." });

    const securityHeaders = [
      "strict-transport-security", "content-security-policy", "x-frame-options",
      "x-content-type-options", "referrer-policy", "permissions-policy",
    ].map((h) => ({ header: h, present: Boolean(page.headers[h]), value: page.headers[h] }));

    const title = page.body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const riskScore = Math.min(
      100,
      indicators.reduce((sum, i) => sum + (i.severity === "high" ? 30 : i.severity === "medium" ? 15 : 5), 0),
    );

    return {
      input: data.url,
      normalized,
      queriedAt: new Date().toISOString(),
      parsed: {
        protocol: url.protocol.replace(":", ""),
        host,
        port: url.port || (url.protocol === "https:" ? "443" : "80"),
        path: url.pathname || "/",
        query: url.search,
        fragment: url.hash,
        registrableDomain: domain,
        isIpHost,
        username: url.username || undefined,
      },
      queryParams,
      redirectChain: page.chain,
      finalUrl: page.finalUrl,
      status: page.status,
      headers: page.headers,
      securityHeaders,
      title: title ? stripTags(title).slice(0, 200) : undefined,
      server: page.headers.server,
      contentLength: page.body.length,
      isShortened,
      shortenerName: isShortened ? SHORTENERS[domain] : undefined,
      indicators,
      riskScore,
      sources,
    };
  });

/* ========================================================================== */
/* abuse.ch (free Auth-Key required) + VirusTotal / Safe Browsing            */
/* ========================================================================== */

function abuseKey(keys?: Record<string, string>): string | undefined {
  return keys?.ABUSECH_AUTH_KEY || undefined;
}

export const urlhausLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    url: z.string().min(3).max(2048).optional(),
    host: z.string().min(1).max(253).optional(),
    keys: z.record(z.string(), z.string().max(200)).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("urlhaus", 1, 12);
    const key = abuseKey(data.keys);
    if (!key) {
      return {
        available: false as const,
        reason: "A API do abuse.ch passou a exigir uma Auth-Key gratuita. Configure ABUSECH_AUTH_KEY no API Center para habilitar URLhaus, MalwareBazaar e ThreatFox.",
        signup: "https://auth.abuse.ch/",
        queriedAt: new Date().toISOString(),
        sources: [{ name: "abuse.ch URLhaus", ok: false, detail: "Auth-Key obrigatória (gratuita).", url: "https://auth.abuse.ch/" }],
      };
    }
    const params = new URLSearchParams();
    if (data.url) params.set("url", data.url);
    else if (data.host) params.set("host", data.host);
    else throw new UpstreamError("Informe URL ou host.", 400, "validation");
    const endpoint = data.url ? "url" : "host";
    const json = await fetchJson<Record<string, any>>(`https://urlhaus-api.abuse.ch/v1/${endpoint}/`, {
      method: "POST",
      body: params.toString(),
      headers: { "content-type": "application/x-www-form-urlencoded", "Auth-Key": key },
      timeoutMs: 15000,
    });
    return {
      available: true as const,
      query: data.url ?? data.host,
      queriedAt: new Date().toISOString(),
      data: json,
      sources: [{ name: "abuse.ch URLhaus", ok: true }],
    };
  });

export const safeBrowsingLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ url: z.string().min(3).max(2048), keys: z.record(z.string(), z.string().max(200)).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("safe-browsing", 1, 10);
    const key = data.keys?.GOOGLE_SAFE_BROWSING_KEY;
    if (!key) {
      return {
        available: false as const,
        reason: "Google Safe Browsing exige uma chave gratuita (cota diária). Configure GOOGLE_SAFE_BROWSING_KEY no API Center.",
        signup: "https://developers.google.com/safe-browsing/v4/get-started",
        queriedAt: new Date().toISOString(),
      };
    }
    const json = await fetchJson<{ matches?: any[] }>(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "life-agency", clientVersion: "3.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url: data.url }],
          },
        }),
        timeoutMs: 12000,
      },
    );
    return { available: true as const, queriedAt: new Date().toISOString(), matches: json.matches ?? [], safe: (json.matches ?? []).length === 0 };
  });

export const virusTotalLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    target: z.string().min(1).max(2048),
    kind: z.enum(["url", "domain", "ip", "file"]),
    keys: z.record(z.string(), z.string().max(200)).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("virustotal", 1, 8);
    const key = data.keys?.VT_API_KEY;
    if (!key) {
      return {
        available: false as const,
        reason: "VirusTotal é opcional e exige chave. Configure VT_API_KEY no API Center (plano gratuito: 4 requisições/min).",
        signup: "https://www.virustotal.com/gui/join-us",
        queriedAt: new Date().toISOString(),
      };
    }
    const map: Record<string, string> = { url: "urls", domain: "domains", ip: "ip_addresses", file: "files" };
    let id = data.target;
    if (data.kind === "url") {
      let binary = "";
      for (const byte of new TextEncoder().encode(data.target)) binary += String.fromCharCode(byte);
      id = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    if (data.kind === "file") id = data.target;
    const json = await fetchJson<{ data?: { attributes?: Record<string, any> } }>(
      `https://www.virustotal.com/api/v3/${map[data.kind]}/${encodeURIComponent(id)}`,
      { headers: { "x-apikey": key }, timeoutMs: 12000 },
    );
    const attr = json.data?.attributes ?? {};
    return {
      available: true as const,
      queriedAt: new Date().toISOString(),
      stats: attr.last_analysis_stats ?? null,
      reputation: attr.reputation ?? null,
      names: attr.names ?? null,
      tags: attr.tags ?? null,
      lastAnalysis: attr.last_analysis_date ?? null,
      sources: [{ name: "VirusTotal", ok: true }],
    };
  });

/* ========================================================================== */
/* Search operators (external, real links)                                    */
/* ========================================================================== */

export const searchLinks = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    query: z.string().min(1).max(300),
    kind: z.enum(["web", "social", "news", "company"]).optional(),
  }))
  .handler(async ({ data }) => {
    const q = encodeURIComponent(data.query);
    const links = [
      { name: "Google", url: `https://www.google.com/search?q=${q}` },
      { name: "Bing", url: `https://www.bing.com/search?q=${q}` },
      { name: "DuckDuckGo", url: `https://duckduckgo.com/?q=${q}` },
      { name: "Google (arquivos)", url: `https://www.google.com/search?q=${q}+filetype%3Apdf` },
      { name: "Google (cache/índice)", url: `https://www.google.com/search?q=site%3A+${q}` },
      { name: "Startpage", url: `https://www.startpage.com/sp/search?query=${q}` },
      { name: "Reddit", url: `https://www.reddit.com/search/?q=${q}` },
      { name: "Mastodon (via Fediverse)", url: `https://mastodon.social/tags/${q}` },
      { name: "Wayback Machine", url: `https://web.archive.org/web/*/${q}` },
      { name: "GitHub", url: `https://github.com/search?q=${q}` },
    ];
    return { query: data.query, links, queriedAt: new Date().toISOString() };
  });

/* ========================================================================== */
/* Domain ↔ email helpers exposed elsewhere                                   */
/* ========================================================================== */

export const robotsSitemap = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(1).max(253) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("robots", 1, 20);
    const domain = assertDomain(data.domain);
    const result = await cached(`robots:${domain}`, 30 * 60_000, async () => {
      const out: Record<string, { status: number; content: string } | null> = {};
      for (const path of ["/robots.txt", "/sitemap.xml", "/.well-known/security.txt"]) {
        try {
          const r = await safeFetch(`https://${domain}${path}`, { timeoutMs: 8000, maxBytes: 120_000 });
          out[path] = { status: r.status, content: r.body.slice(0, 12000) };
        } catch {
          out[path] = null;
        }
      }
      return out;
    });
    return { domain, queriedAt: new Date().toISOString(), files: result };
  });
