import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cached, enforceRateLimit, fetchJson, UpstreamError } from "@/lib/agency/http.server";

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

/* -------------------------------------------------------------------------- */
/* NVD                                                                        */
/* -------------------------------------------------------------------------- */

type NvdMetric = {
  type?: string;
  cvssData?: { baseScore?: number; baseSeverity?: string; vectorString?: string; version?: string };
  baseSeverity?: string;
};

type NvdCve = {
  id: string;
  published: string;
  lastModified: string;
  vulnStatus?: string;
  descriptions?: Array<{ lang: string; value: string }>;
  metrics?: { cvssMetricV31?: NvdMetric[]; cvssMetricV40?: NvdMetric[]; cvssMetricV30?: NvdMetric[]; cvssMetricV2?: NvdMetric[] };
  weaknesses?: Array<{ description?: Array<{ value: string }> }>;
  configurations?: Array<{ nodes?: Array<{ cpeMatch?: Array<{ criteria: string; vulnerable: boolean }> }> }>;
  references?: Array<{ url: string; source?: string; tags?: string[] }>;
};

type NvdResponse = { totalResults: number; vulnerabilities?: Array<{ cve: NvdCve }> };

type KevEntry = {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction: string;
  dueDate: string;
  knownRansomwareCampaignUse: string;
};

type KevCatalog = { catalogVersion: string; dateReleased: string; count: number; vulnerabilities: KevEntry[] };

function pickMetrics(cve: NvdCve) {
  const m = cve.metrics;
  const primary = m?.cvssMetricV40?.[0]?.cvssData ?? m?.cvssMetricV31?.[0]?.cvssData ?? m?.cvssMetricV30?.[0]?.cvssData;
  const severity = m?.cvssMetricV40?.[0]?.cvssData?.baseSeverity
    ?? m?.cvssMetricV31?.[0]?.cvssData?.baseSeverity
    ?? m?.cvssMetricV31?.[0]?.baseSeverity;
  return {
    score: primary?.baseScore,
    severity: severity?.toLowerCase(),
    vector: primary?.vectorString,
    version: primary?.version,
  };
}

export const kevCatalog = () =>
  cached("kev:catalog", 30 * 60_000, () =>
    fetchJson<KevCatalog>("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", { timeoutMs: 25000 }),
  );

export const cveLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ cve: z.string().min(3).max(30) }))
  .handler(async ({ data }) => {
    const cveId = data.cve.trim().toUpperCase();
    if (!/^CVE-\d{4}-\d{4,}$/.test(cveId)) throw new UpstreamError("Formato esperado: CVE-2021-44228.", 400, "validation");
    await enforceRateLimit("nvd", 1, 6);
    const sources: SourceStatus[] = [];

    const [nvd, kev, epss] = await Promise.all([
      cached(`nvd:cve:${cveId}`, 30 * 60_000, async () => {
        try {
          const r = await fetchJson<NvdResponse>(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`, { timeoutMs: 18000 });
          sources.push({ name: "NIST NVD", ok: true });
          return r.vulnerabilities?.[0]?.cve ?? null;
        } catch (e) {
          sources.push({ name: "NIST NVD", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached("kev:catalog", 30 * 60_000, async () => {
        try {
          const cat = await fetchJson<KevCatalog>("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", { timeoutMs: 25000 });
          sources.push({ name: "CISA KEV", ok: true });
          return cat;
        } catch (e) {
          sources.push({ name: "CISA KEV", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(`epss:${cveId}`, 60 * 60_000, async () => {
        try {
          const r = await fetchJson<{ data?: Array<{ cve: string; epss: string; percentile: string; date?: string }> }>(
            `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(cveId)}`,
            { timeoutMs: 12000 },
          );
          sources.push({ name: "FIRST EPSS", ok: true });
          return r.data?.[0] ?? null;
        } catch {
          return null;
        }
      }),
    ]);

    const kevEntry = kev?.vulnerabilities.find((v) => v.cveID === cveId) ?? null;
    return {
      cve: cveId,
      queriedAt: new Date().toISOString(),
      found: Boolean(nvd),
      description: nvd?.descriptions?.find((d) => d.lang === "en")?.value,
      published: nvd?.published,
      lastModified: nvd?.lastModified,
      status: nvd?.vulnStatus,
      metrics: nvd ? pickMetrics(nvd) : null,
      weaknesses: [...new Set((nvd?.weaknesses ?? []).flatMap((w) => (w.description ?? []).map((d) => d.value)))].slice(0, 20),
      affectedCpe: [...new Set((nvd?.configurations ?? []).flatMap((c) => (c.nodes ?? []).flatMap((n) => (n.cpeMatch ?? []).filter((m) => m.vulnerable).map((m) => m.criteria))))].slice(0, 40),
      references: (nvd?.references ?? []).slice(0, 25).map((r) => ({ url: r.url, tags: r.tags ?? [] })),
      kev: kevEntry,
      epss: epss ? { score: Number(epss.epss), percentile: Number(epss.percentile), date: epss.date } : null,
      sources,
    };
  });

export const cveSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ keyword: z.string().min(2).max(200), limit: z.number().min(1).max(50).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("nvd", 1, 4);
    const limit = data.limit ?? 20;
    const sources: SourceStatus[] = [];
    const json = await cached(`nvd:search:${data.keyword}:${limit}`, 10 * 60_000, async () => {
      try {
        return await fetchJson<NvdResponse>(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(data.keyword)}&resultsPerPage=${limit}`,
          { timeoutMs: 25000 },
        );
      } catch (e) {
        throw new UpstreamError(`NVD: ${(e as Error).message}`, 502, "nvd");
      }
    });
    sources.push({ name: "NIST NVD", ok: true });
    return {
      keyword: data.keyword,
      total: json.totalResults,
      queriedAt: new Date().toISOString(),
      results: (json.vulnerabilities ?? []).map((v) => {
        const m = pickMetrics(v.cve);
        return {
          cve: v.cve.id,
          description: (v.cve.descriptions?.find((d) => d.lang === "en")?.value ?? "").slice(0, 400),
          published: v.cve.published,
          score: m.score,
          severity: m.severity,
          status: v.cve.vulnStatus,
        };
      }),
      sources,
    };
  });

export const kevSearch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ query: z.string().max(200).optional(), limit: z.number().min(1).max(100).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("kev", 1, 15);
    const cat = await cached("kev:catalog", 30 * 60_000, () =>
      fetchJson<KevCatalog>("https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json", { timeoutMs: 25000 }),
    );
    const q = (data.query ?? "").trim().toLowerCase();
    const rows = cat.vulnerabilities
      .filter((v) => !q || [v.cveID, v.vendorProject, v.product, v.vulnerabilityName].join(" ").toLowerCase().includes(q))
      .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
      .slice(0, data.limit ?? 40);
    return {
      catalogVersion: cat.catalogVersion,
      released: cat.dateReleased,
      totalInCatalog: cat.count,
      matched: rows.length,
      queriedAt: new Date().toISOString(),
      entries: rows,
      source: { name: "CISA KEV", ok: true },
    };
  });

/* -------------------------------------------------------------------------- */
/* OSV                                                                        */
/* -------------------------------------------------------------------------- */

type OsvVuln = {
  id: string;
  summary?: string;
  details?: string;
  published?: string;
  modified?: string;
  aliases?: string[];
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{ package?: { name: string; ecosystem: string }; ranges?: unknown[]; versions?: string[] }>;
  references?: Array<{ type: string; url: string }>;
  database_specific?: { severity?: string };
};

export const osvQuery = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    packageName: z.string().min(1).max(150),
    ecosystem: z.enum(["npm", "PyPI", "Go", "crates.io", "Maven", "NuGet", "RubyGems", "Packagist", "Pub", "Hex", "OSS-Fuzz"]),
    version: z.string().min(1).max(50),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("osv", 1, 15);
    const json = await fetchJson<{ vulns?: OsvVuln[] }>("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ package: { name: data.packageName, ecosystem: data.ecosystem }, version: data.version }),
      timeoutMs: 15000,
    });
    const vulns = json.vulns ?? [];
    return {
      package: data.packageName,
      ecosystem: data.ecosystem,
      version: data.version,
      queriedAt: new Date().toISOString(),
      total: vulns.length,
      results: vulns.slice(0, 50).map((v) => ({
        id: v.id,
        summary: v.summary,
        severity: v.database_specific?.severity ?? v.severity?.[0]?.score,
        published: v.published,
        aliases: v.aliases,
        references: (v.references ?? []).slice(0, 5),
      })),
      source: { name: "OSV.dev", ok: true, url: "https://osv.dev" },
    };
  });

/* -------------------------------------------------------------------------- */
/* abuse.ch: MalwareBazaar + ThreatFox (free Auth-Key required)                */
/* -------------------------------------------------------------------------- */

export const hashLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    hash: z.string().min(32).max(64),
    keys: z.record(z.string(), z.string().max(200)).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("hash-lookup", 1, 10);
    const hash = data.hash.trim().toLowerCase();
    if (!/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/.test(hash)) throw new UpstreamError("Hash deve ser MD5, SHA-1 ou SHA-256.", 400, "validation");
    const key = data.keys?.ABUSECH_AUTH_KEY;
    if (!key) {
      return {
        available: false as const,
        reason: "MalwareBazaar exige Auth-Key gratuita. Configure ABUSECH_AUTH_KEY no API Center.",
        signup: "https://auth.abuse.ch/",
        queriedAt: new Date().toISOString(),
        sources: [{ name: "abuse.ch MalwareBazaar", ok: false, detail: "Auth-Key obrigatória (gratuita)." }],
      };
    }
    const json = await fetchJson<Record<string, any>>("https://mb-api.abuse.ch/api/v1/", {
      method: "POST",
      body: new URLSearchParams({ query: "get_info", hash }).toString(),
      headers: { "content-type": "application/x-www-form-urlencoded", "Auth-Key": key },
      timeoutMs: 18000,
    });
    return { available: true as const, hash, queriedAt: new Date().toISOString(), data: json, sources: [{ name: "abuse.ch MalwareBazaar", ok: true }] };
  });

export const otxIndicator = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    indicator: z.string().min(1).max(300),
    kind: z.enum(["ip", "domain", "hostname", "url", "file"]).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("otx", 1, 15);
    const indicator = data.indicator.trim();
    const section = data.kind ?? (/^\d{1,3}(\.\d{1,3}){3}$/.test(indicator) ? "ip" : indicator.includes("://") ? "url" : "domain");
    const type = section === "ip" ? "IPv4" : section === "url" ? "url" : section === "file" ? "file" : "domain";
    const endpoint = `https://otx.alienvault.com/api/v1/indicators/${type}/${encodeURIComponent(indicator)}/general`;
    try {
      const json = await cached(`otx:${type}:${indicator}`, 15 * 60_000, () =>
        fetchJson<{
          pulse_info?: { count?: number; pulses?: Array<{ name: string; modified: string; tags?: string[]; author_name?: string }> };
          reputation?: number;
          validation?: unknown;
        }>(endpoint, { timeoutMs: 12000 }),
      );
      return {
        available: true as const,
        indicator,
        type,
        queriedAt: new Date().toISOString(),
        reputation: json.reputation,
        pulseCount: json.pulse_info?.count ?? 0,
        pulses: (json.pulse_info?.pulses ?? []).slice(0, 20),
        sources: [{ name: "AlienVault OTX (público)", ok: true, url: `https://otx.alienvault.com/indicator/${type}/${indicator}` }],
      };
    } catch (e) {
      return {
        available: false as const,
        indicator,
        queriedAt: new Date().toISOString(),
        reason: (e as Error).message,
        sources: [{ name: "AlienVault OTX", ok: false, detail: (e as Error).message }],
      };
    }
  });

export const threatFoxLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    ioc: z.string().min(2).max(300).optional(),
    recentDays: z.number().min(1).max(7).optional(),
    keys: z.record(z.string(), z.string().max(200)).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("threatfox", 1, 8);
    const key = data.keys?.ABUSECH_AUTH_KEY;
    if (!key) {
      return {
        available: false as const,
        reason: "ThreatFox exige Auth-Key gratuita do abuse.ch. Configure ABUSECH_AUTH_KEY no API Center.",
        signup: "https://auth.abuse.ch/",
        queriedAt: new Date().toISOString(),
      };
    }
    const body = data.ioc
      ? { query: "search_ioc", search_term: data.ioc }
      : { query: "get_iocs", days: data.recentDays ?? 1 };
    const json = await fetchJson<Record<string, any>>("https://threatfox-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { "content-type": "application/json", "Auth-Key": key },
      body: JSON.stringify(body),
      timeoutMs: 20000,
    });
    return { available: true as const, queriedAt: new Date().toISOString(), data: json, sources: [{ name: "abuse.ch ThreatFox", ok: true }] };
  });

/* -------------------------------------------------------------------------- */
/* YARA reference (local, no upload)                                          */
/* -------------------------------------------------------------------------- */

export const YARA_TEMPLATE = `rule LifeAgency_Suspicious_PowerShell
{
    meta:
        description = "Detecta execução de PowerShell codificado em base64"
        author      = "Life Agency"
        reference   = "https://attack.mitre.org/techniques/T1059/001/"
        date        = "2026-01-01"

    strings:
        $ps1 = "powershell" nocase
        $ps2 = "-enc" nocase
        $ps3 = "FromBase64String" nocase

    condition:
        2 of them
}

rule LifeAgency_Generic_C2_Beacon
{
    meta:
        description = "Padrões comuns de beacon HTTP de baixa reputação"
    strings:
        $ua1 = "Mozilla/4.0 (compatible; MSIE 6.0" ascii
        $ua2 = "curl/7." ascii
        $path1 = "/gate.php" ascii
        $path2 = "/panel/api" ascii

    condition:
        any of ($ua*) and any of ($path*)
}`;
