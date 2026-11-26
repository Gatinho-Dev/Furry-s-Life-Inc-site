import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cached, doh, enforceRateLimit, fetchJson } from "@/lib/agency/http.server";

export type FeedItem = {
  id: string;
  title: string;
  category: "vulnerability" | "exploited" | "advisory" | "malware" | "c2" | "news";
  severity?: string;
  date: string;
  source: string;
  url?: string;
  detail?: string;
  tags?: string[];
};

type NvdFeed = {
  vulnerabilities?: Array<{
    cve: {
      id: string;
      published: string;
      descriptions?: Array<{ lang: string; value: string }>;
      metrics?: { cvssMetricV31?: Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }>; cvssMetricV40?: Array<{ cvssData?: { baseScore?: number; baseSeverity?: string } }> };
    };
  }>;
};

type KevFeed = {
  vulnerabilities: Array<{ cveID: string; vulnerabilityName: string; dateAdded: string; vendorProject: string; product: string; shortDescription: string; knownRansomwareCampaignUse: string }>;
};

function parseRss(xml: string, source: string, category: FeedItem["category"]): FeedItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((m) => m[1]);
  return items.slice(0, 25).map((item, i) => {
    const pick = (tag: string) => {
      const cdata = item.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, "i"))?.[1];
      const plain = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1];
      return (cdata ?? plain ?? "").trim();
    };
    const link = pick("link") || item.match(/<link\s+href="([^"]+)"/i)?.[1] || "";
    return {
      id: `${source}-${i}-${pick("guid") || link}`,
      title: pick("title").replace(/<[^>]+>/g, "").slice(0, 300),
      category,
      date: new Date(pick("pubDate") || Date.now()).toISOString(),
      source,
      url: link,
      detail: pick("description").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400),
    };
  }).filter((i) => i.title);
}

export const intelFeed = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    days: z.number().min(1).max(30).optional(),
    keys: z.record(z.string(), z.string().max(200)).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("feed", 1, 8);
    const days = data.days ?? 7;
    const sources: Array<{ name: string; ok: boolean; detail?: string; url?: string; count: number }> = [];

    const end = new Date();
    const start = new Date(end.getTime() - days * 86400000);
    const fmt = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, "");

    const [nvd, kev, cisa, thn, bleeping] = await Promise.all([
      cached(`feed:nvd:${days}`, 10 * 60_000, async () => {
        try {
          const r = await fetchJson<NvdFeed>(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?pubStartDate=${encodeURIComponent(fmt(start))}&pubEndDate=${encodeURIComponent(fmt(end))}&resultsPerPage=40`,
            { timeoutMs: 30000 },
          );
          sources.push({ name: "NIST NVD (novas CVEs)", ok: true, count: r.vulnerabilities?.length ?? 0 });
          return r;
        } catch (e) {
          sources.push({ name: "NIST NVD", ok: false, detail: (e as Error).message, count: 0 });
          return null;
        }
      }),
      cached("kev:catalog", 30 * 60_000, async () => {
        try {
          const r = await fetchJson<KevFeed>("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", { timeoutMs: 30000 });
          sources.push({ name: "CISA KEV", ok: true, count: r.vulnerabilities.length });
          return r;
        } catch (e) {
          sources.push({ name: "CISA KEV", ok: false, detail: (e as Error).message, count: 0 });
          return null;
        }
      }),
      cached("feed:cisa:rss", 15 * 60_000, async () => {
        try {
          const res = await fetch("https://www.cisa.gov/cybersecurity-advisories/all.xml", {
            headers: { "user-agent": "LifeAgency-OSINT/3.0" },
            signal: AbortSignal.timeout(20000),
          });
          const xml = await res.text();
          const items = parseRss(xml, "CISA Advisories", "advisory");
          sources.push({ name: "CISA Advisories (RSS)", ok: res.ok, count: items.length });
          return items;
        } catch (e) {
          sources.push({ name: "CISA Advisories", ok: false, detail: (e as Error).message, count: 0 });
          return [] as FeedItem[];
        }
      }),
      cached("feed:thn:rss", 15 * 60_000, async () => {
        try {
          const res = await fetch("https://feeds.feedburner.com/TheHackersNews", {
            headers: { "user-agent": "LifeAgency-OSINT/3.0" },
            signal: AbortSignal.timeout(15000),
          });
          const xml = await res.text();
          const items = parseRss(xml, "The Hacker News", "news");
          sources.push({ name: "The Hacker News (RSS)", ok: res.ok, count: items.length });
          return items;
        } catch (e) {
          sources.push({ name: "The Hacker News", ok: false, detail: (e as Error).message, count: 0 });
          return [] as FeedItem[];
        }
      }),
      cached("feed:bleeping:rss", 15 * 60_000, async () => {
        try {
          const res = await fetch("https://www.bleepingcomputer.com/feed/", {
            headers: { "user-agent": "LifeAgency-OSINT/3.0" },
            signal: AbortSignal.timeout(15000),
          });
          const xml = await res.text();
          const items = parseRss(xml, "BleepingComputer", "news");
          sources.push({ name: "BleepingComputer (RSS)", ok: res.ok, count: items.length });
          return items;
        } catch (e) {
          sources.push({ name: "BleepingComputer", ok: false, detail: (e as Error).message, count: 0 });
          return [] as FeedItem[];
        }
      }),
    ]);

    const items: FeedItem[] = [];
    for (const v of nvd?.vulnerabilities ?? []) {
      const metric = v.cve.metrics?.cvssMetricV40?.[0]?.cvssData ?? v.cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      items.push({
        id: v.cve.id,
        title: `${v.cve.id}${metric?.baseScore ? ` · CVSS ${metric.baseScore}` : ""}`,
        category: "vulnerability",
        severity: metric?.baseSeverity?.toLowerCase(),
        date: v.cve.published,
        source: "NIST NVD",
        url: `https://nvd.nist.gov/vuln/detail/${v.cve.id}`,
        detail: (v.cve.descriptions?.find((d) => d.lang === "en")?.value ?? "").slice(0, 400),
        tags: [v.cve.id],
      });
    }
    for (const v of (kev?.vulnerabilities ?? []).slice().sort((a, b) => b.dateAdded.localeCompare(a.dateAdded)).slice(0, 25)) {
      items.push({
        id: `kev-${v.cveID}`,
        title: `${v.cveID} — ${v.vulnerabilityName}`,
        category: "exploited",
        severity: "critical",
        date: v.dateAdded,
        source: "CISA KEV",
        url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
        detail: v.shortDescription,
        tags: [v.vendorProject, v.product, ...(v.knownRansomwareCampaignUse === "Known" ? ["ransomware"] : [])],
      });
    }
    items.push(...(cisa ?? []), ...(thn ?? []), ...(bleeping ?? []));

    const key = data.keys?.ABUSECH_AUTH_KEY;
    if (key) {
      try {
        const tf = await cached("feed:threatfox", 10 * 60_000, () =>
          fetchJson<{ data?: Array<{ ioc: string; threat_type: string; malware_printable?: string; first_seen: string; confidence_level?: number }> }>(
            `https://threatfox-api.abuse.ch/api/v1/`,
            { method: "POST", headers: { "content-type": "application/json", "Auth-Key": key }, body: JSON.stringify({ query: "get_iocs", days: 1 }), timeoutMs: 20000 },
          ),
        );
        const rows = (tf.data ?? []).slice(0, 25);
        for (const r of rows) {
          items.push({
            id: `tf-${r.ioc}`,
            title: `${r.threat_type} — ${r.malware_printable ?? "malware não classificado"}`,
            category: "c2",
            severity: "high",
            date: r.first_seen,
            source: "abuse.ch ThreatFox",
            detail: r.ioc,
            tags: [r.ioc],
          });
        }
        sources.push({ name: "abuse.ch ThreatFox", ok: true, count: rows.length });
      } catch (e) {
        sources.push({ name: "abuse.ch ThreatFox", ok: false, detail: (e as Error).message, count: 0 });
      }
    } else {
      sources.push({
        name: "abuse.ch ThreatFox / URLhaus",
        ok: false,
        detail: "Auth-Key gratuita não configurada — sem IOCs de C2 e domínios maliciosos do abuse.ch.",
        count: 0,
        url: "https://auth.abuse.ch/",
      });
    }

    const deduped = [...new Map(items.map((i) => [i.id, i])).values()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { queriedAt: new Date().toISOString(), windowDays: days, items: deduped.slice(0, 200), sources };
  });

/* -------------------------------------------------------------------------- */
/* Source health                                                              */
/* -------------------------------------------------------------------------- */

const PROBES: Array<{ id: string; name: string; url: string; auth?: (keys: Record<string, string>) => Record<string, string> }> = [
  { id: "google-dns", name: "Google Public DNS", url: "https://dns.google/resolve?name=example.com&type=A" },
  { id: "cloudflare-dns", name: "Cloudflare DNS", url: "https://cloudflare-dns.com/dns-query?name=example.com&type=A" },
  { id: "rdap", name: "RDAP (rdap.org)", url: "https://rdap.org/domain/example.com" },
  { id: "crtsh", name: "crt.sh", url: "https://crt.sh/?q=example.com&output=json" },
  { id: "ripestat", name: "RIPEstat", url: "https://stat.ripe.net/data/prefix-overview/data.json?resource=8.8.8.8" },
  { id: "ipwhois", name: "ipwho.is", url: "https://ipwho.is/8.8.8.8" },
  { id: "nvd", name: "NIST NVD", url: "https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=CVE-2021-44228" },
  { id: "kev", name: "CISA KEV", url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json" },
  { id: "osv", name: "OSV.dev", url: "https://api.osv.dev/v1/vulns/GHSA-29mw-wpgm-hmr9" },
  { id: "epss", name: "FIRST EPSS", url: "https://api.first.org/data/v1/epss?cve=CVE-2021-44228" },
  { id: "wayback", name: "Wayback Machine", url: "https://archive.org/wayback/available?url=example.com" },
  { id: "github", name: "GitHub API", url: "https://api.github.com/users/torvalds" },
  { id: "brasilapi", name: "BrasilAPI CNPJ", url: "https://brasilapi.com.br/api/cnpj/v1/33000167000101" },
  { id: "otx", name: "AlienVault OTX", url: "https://otx.alienvault.com/api/v1/indicators/IPv4/8.8.8.8/general" },
  { id: "hibp", name: "HIBP (catálogo)", url: "https://haveibeenpwned.com/api/v3/breaches" },
  { id: "cisa-rss", name: "CISA Advisories RSS", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
  { id: "reddit", name: "Reddit JSON", url: "https://www.reddit.com/user/spez/about.json" },
  {
    id: "abusech",
    name: "abuse.ch (Auth-Key)",
    url: "https://urlhaus-api.abuse.ch/v1/urls/recent/",
    auth: (keys: Record<string, string>): Record<string, string> => (keys.ABUSECH_AUTH_KEY ? { "Auth-Key": keys.ABUSECH_AUTH_KEY } : {}),
  },
];

export const sourceHealth = createServerFn({ method: "POST" })
  .inputValidator(z.object({ keys: z.record(z.string(), z.string().max(200)).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("health", 1, 4);
    const keys = data.keys ?? {};
    const rows = await Promise.all(
      PROBES.map(async (p) => {
        const started = Date.now();
        try {
          const headers: Record<string, string> = { "user-agent": "LifeAgency-OSINT/3.0", ...(p.auth ? p.auth(keys) : {}) };
          if (p.id === "cloudflare-dns") headers.accept = "application/dns-json";
          const res = await fetch(p.url, { headers, signal: AbortSignal.timeout(12000) });
          await res.body?.cancel().catch(() => {});
          const needsKey = p.id === "abusech" && !keys.ABUSECH_AUTH_KEY;
          return {
            id: p.id,
            name: p.name,
            ok: res.ok && !(p.id === "reddit" && res.status === 403),
            status: res.status,
            ms: Date.now() - started,
            detail: needsKey
              ? "Sem Auth-Key: a API responde 401 até configurar a chave gratuita."
              : res.status === 403 && p.id === "reddit"
                ? "Bloqueia requisições de datacenter (403)."
                : undefined,
          };
        } catch (e) {
          return { id: p.id, name: p.name, ok: false, status: 0, ms: Date.now() - started, detail: (e as Error).message };
        }
      }),
    );
    return {
      checkedAt: new Date().toISOString(),
      online: rows.filter((r) => r.ok).length,
      total: rows.length,
      rows,
    };
  });

/* -------------------------------------------------------------------------- */
/* Small DNS check used by Quick Search pivots                                */
/* -------------------------------------------------------------------------- */

export const domainExists = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(3).max(253) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("domain-exists", 1, 30);
    try {
      const ans = await doh(data.domain, "NS", "cloudflare");
      return { domain: data.domain, exists: ans.Status === 0 && (ans.Answer?.length ?? 0) > 0, status: ans.Status === 3 ? "NXDOMAIN" : "NOERROR" };
    } catch (e) {
      return { domain: data.domain, exists: false, status: (e as Error).message };
    }
  });
