import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertAsn,
  assertDomain,
  assertIp,
  cached,
  doh,
  enforceRateLimit,
  fetchJson,
  isBlockedAddress,
  txtValue,
  UpstreamError,
} from "@/lib/agency/http.server";

export type SourceStatus = { name: string; ok: boolean; detail?: string; url?: string };

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const ipKey = (scope: string, ip: string) => `${scope}:${ip}`;

function parseCymruAnswer(txt: string): { asn: string; prefix: string; country: string; registry: string; allocated: string } | null {
  const parts = txt.split("|").map((p) => p.trim());
  if (parts.length < 5) return null;
  return { asn: `AS${parts[0]}`, prefix: parts[1], country: parts[2], registry: parts[3], allocated: parts[4] };
}

async function cymruOrigin(ip: string) {
  const query = ip.includes(":")
    ? `${ip.replace(/:/g, "").split("").reverse().join(".")}.origin6.asn.cymru.com`
    : `${ip.split(".").reverse().join(".")}.origin.asn.cymru.com`;
  try {
    const ans = await doh(query, "TXT", "cloudflare");
    const txt = (ans.Answer ?? []).find((r) => r.type === 16)?.data;
    if (!txt) return null;
    return parseCymruAnswer(txtValue(txt));
  } catch {
    return null;
  }
}

type IpWho = {
  success?: boolean;
  message?: string;
  ip?: string;
  type?: string;
  country?: string;
  country_code?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  connection?: { asn?: number; org?: string; isp?: string; domain?: string };
  timezone?: { id?: string; utc?: string };
  continent?: string;
};

type RdapIp = {
  handle?: string;
  name?: string;
  startAddress?: string;
  endAddress?: string;
  country?: string;
  type?: string;
  events?: Array<{ eventAction: string; eventDate: string }>;
  entities?: Array<{
    roles?: string[];
    vcardArray?: [string, Array<[string, unknown, string, unknown]>];
  }>;
  cidr0_cidrs?: Array<{ v4prefix?: string; v6prefix?: string; length: number }>;
};

type RipePrefixOverview = {
  data?: {
    resource?: string;
    prefixes?: Array<{ prefix: string; ip?: string }>;
    asns?: Array<{ asn: number; holder: string; description?: string }>;
  };
};

type RipeAsOverview = { data?: { resource?: string; holder?: string; announced?: boolean; type?: string } };
type RipeAnnounced = { data?: { prefixes?: Array<{ prefix: string }> } };
type RipeNeighbours = { data?: { neighbours?: Array<{ asn: number; type: string; power: number }> } };
type RipeNetworkInfo = { data?: { prefix?: string | null; asns?: number[] } };
type RipeRouting = {
  data?: {
    visibility?: { v4?: { ris_peers_seeing?: number; total_ris_peers?: number }; v6?: { ris_peers_seeing?: number; total_ris_peers?: number } };
    origin?: Array<{ origin?: number; Time?: string }>;
    last_update?: { time?: string };
  };
};

/* -------------------------------------------------------------------------- */
/* IP lookup                                                                  */
/* -------------------------------------------------------------------------- */

export type IpLookupResult = {
  ip: string;
  queriedAt: string;
  version: "IPv4" | "IPv6";
  classification: "public" | "private/reserved";
  geo: {
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    accuracyNote: string;
  } | null;
  network: {
    asn?: string;
    organization?: string;
    isp?: string;
    prefix?: string;
    rir?: string;
    allocated?: string;
    handle?: string;
    range?: string;
    networkName?: string;
  };
  rdap: {
    handle?: string;
    name?: string;
    range?: string;
    country?: string;
    type?: string;
    registered?: string;
    updated?: string;
    entities?: string[];
  } | null;
  reverseDns: string[];
  routing?: { seenBy?: string; total?: string; lastUpdate?: string };
  sources: SourceStatus[];
};

export const ipLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ip: z.string().min(2).max(64) }))
  .handler(async ({ data }): Promise<IpLookupResult> => {
    await enforceRateLimit("ip-lookup", 1, 30);
    const ip = assertIp(data.ip);
    const isV6 = ip.includes(":");
    const blocked = isBlockedAddress(ip);
    const sources: SourceStatus[] = [];

    if (blocked) {
      return {
        ip,
        queriedAt: new Date().toISOString(),
        version: isV6 ? "IPv6" : "IPv4",
        classification: "private/reserved",
        geo: null,
        network: {},
        rdap: null,
        reverseDns: [],
        sources: [{ name: "Classificação local", ok: true, detail: "Endereço privado/reservado — consultas externas não se aplicam." }],
      };
    }

    const [geo, rdapRaw, cymru, ptr, networkInfo, routing] = await Promise.all([
      cached(ipKey("geo", ip), 30 * 60_000, async () => {
        try {
          const json = await fetchJson<IpWho>(`https://ipwho.is/${encodeURIComponent(ip)}`, { timeoutMs: 9000 });
          if (json.success === false) throw new UpstreamError(json.message ?? "Sem dados", 404, "ipwho.is");
          sources.push({ name: "ipwho.is (geolocalização aproximada)", ok: true });
          return json;
        } catch (e) {
          sources.push({ name: "ipwho.is", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(ipKey("rdap", ip), 60 * 60_000, async () => {
        try {
          const json = await fetchJson<RdapIp>(`https://rdap.org/ip/${encodeURIComponent(ip)}`, { timeoutMs: 12000 });
          sources.push({ name: "RDAP (rdap.org)", ok: true });
          return json;
        } catch (e) {
          sources.push({ name: "RDAP", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(ipKey("cymru", ip), 60 * 60_000, () => cymruOrigin(ip)),
      cached(ipKey("ptr", ip), 30 * 60_000, async () => {
        const name = isV6 ? `${ip.replace(/:/g, "").split("").reverse().join(".")}.ip6.arpa` : `${ip.split(".").reverse().join(".")}.in-addr.arpa`;
        try {
          const ans = await doh(name, "PTR", "google");
          return (ans.Answer ?? []).filter((r) => r.type === 12).map((r) => r.data.replace(/\.$/, ""));
        } catch { return []; }
      }),
      cached(ipKey("netinfo", ip), 30 * 60_000, async () => {
        try {
          return await fetchJson<RipeNetworkInfo>(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(ip)}`, { timeoutMs: 10000 });
        } catch (e) {
          sources.push({ name: "RIPEstat network-info", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(ipKey("routing", ip), 15 * 60_000, async () => {
        try {
          return await fetchJson<RipeRouting>(`https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(ip)}`, { timeoutMs: 12000 });
        } catch { return null; }
      }),
    ]);

    let organization: string | undefined;
    const entities: string[] = [];
    if (rdapRaw?.entities) {
      for (const ent of rdapRaw.entities) {
        const fn = ent.vcardArray?.[1]?.find((r) => r[0] === "fn")?.[3];
        if (typeof fn === "string") entities.push(fn);
      }
      organization = entities[0];
    }

    const prefix = networkInfo?.data?.prefix ?? cymru?.prefix;
    const asns: string[] = networkInfo?.data?.asns?.map((a) => `AS${a}`) ?? [];
    let asHolder: string | undefined;
    if (asns[0]) {
      try {
        const over = await cached(`as-overview:${asns[0]}`, 60 * 60_000, () =>
          fetchJson<RipeAsOverview>(`https://stat.ripe.net/data/as-overview/data.json?resource=${asns[0]}`, { timeoutMs: 9000 }),
        );
        asHolder = over.data?.holder;
      } catch { /* optional */ }
    }

    const vis = routing?.data?.visibility?.[isV6 ? "v6" : "v4"];
    return {
      ip,
      queriedAt: new Date().toISOString(),
      version: isV6 ? "IPv6" : "IPv4",
      classification: "public",
      geo: geo
        ? {
            country: geo.country,
            countryCode: geo.country_code,
            region: geo.region,
            city: geo.city,
            latitude: geo.latitude,
            longitude: geo.longitude,
            timezone: geo.timezone?.id,
            accuracyNote: "Localização aproximada (nível de país/região). Não representa a posição de uma pessoa.",
          }
        : null,
      network: {
        asn: asns[0] ?? cymru?.asn,
        organization: asHolder ?? geo?.connection?.org ?? organization,
        isp: geo?.connection?.isp,
        prefix,
        rir: cymru?.registry?.toUpperCase(),
        allocated: cymru?.allocated,
        handle: rdapRaw?.handle,
        range: rdapRaw?.startAddress && rdapRaw?.endAddress ? `${rdapRaw.startAddress} – ${rdapRaw.endAddress}` : undefined,
        networkName: rdapRaw?.name,
      },
      rdap: rdapRaw
        ? {
            handle: rdapRaw.handle,
            name: rdapRaw.name,
            range: rdapRaw.startAddress && rdapRaw.endAddress ? `${rdapRaw.startAddress} – ${rdapRaw.endAddress}` : undefined,
            country: rdapRaw.country,
            type: rdapRaw.type,
            registered: rdapRaw.events?.find((e) => e.eventAction === "registration")?.eventDate,
            updated: rdapRaw.events?.find((e) => e.eventAction === "last changed")?.eventDate,
            entities,
          }
        : null,
      reverseDns: ptr,
      routing: vis
        ? {
            seenBy: vis.ris_peers_seeing !== undefined ? String(vis.ris_peers_seeing) : undefined,
            total: vis.total_ris_peers !== undefined ? String(vis.total_ris_peers) : undefined,
            lastUpdate: routing?.data?.last_update?.time,
          }
        : undefined,
      sources,
    };
  });

/* -------------------------------------------------------------------------- */
/* Reverse DNS + prefix/BGP                                                   */
/* -------------------------------------------------------------------------- */

export const reverseDnsLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ ip: z.string().min(2).max(64) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("rdns", 1, 40);
    const ip = assertIp(data.ip);
    const name = ip.includes(":")
      ? `${ip.replace(/:/g, "").split("").reverse().join(".")}.ip6.arpa`
      : `${ip.split(".").reverse().join(".")}.in-addr.arpa`;
    const ans = await doh(name, "PTR", "google");
    return {
      ip,
      ptrQuery: name,
      hostnames: (ans.Answer ?? []).filter((r) => r.type === 12).map((r) => r.data.replace(/\.$/, "")),
      status: ans.Status === 0 ? "NOERROR" : ans.Status === 3 ? "NXDOMAIN" : String(ans.Status),
      resolver: ans.resolver,
      queriedAt: new Date().toISOString(),
      source: { name: "Google Public DNS (PTR)", ok: true },
    };
  });

export const asnLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ asn: z.string().min(1).max(20) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("asn-lookup", 1, 25);
    const asn = assertAsn(data.asn);
    const resource = `AS${asn}`;
    const sources: SourceStatus[] = [];
    const [overview, prefixes, neighbours] = await Promise.all([
      cached(`as-overview:${resource}`, 60 * 60_000, async () => {
        try {
          const r = await fetchJson<RipeAsOverview>(`https://stat.ripe.net/data/as-overview/data.json?resource=${resource}`, { timeoutMs: 10000 });
          sources.push({ name: "RIPEstat as-overview", ok: true });
          return r;
        } catch (e) {
          sources.push({ name: "RIPEstat as-overview", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(`as-prefixes:${resource}`, 60 * 60_000, async () => {
        try {
          const r = await fetchJson<RipeAnnounced>(`https://stat.ripe.net/data/announced-prefixes/data.json?resource=${resource}`, { timeoutMs: 15000 });
          sources.push({ name: "RIPEstat announced-prefixes", ok: true });
          return r;
        } catch (e) {
          sources.push({ name: "RIPEstat announced-prefixes", ok: false, detail: (e as Error).message });
          return null;
        }
      }),
      cached(`as-neighbours:${resource}`, 60 * 60_000, async () => {
        try {
          const r = await fetchJson<RipeNeighbours>(`https://stat.ripe.net/data/asn-neighbours/data.json?resource=${resource}`, { timeoutMs: 12000 });
          sources.push({ name: "RIPEstat asn-neighbours", ok: true });
          return r;
        } catch { return null; }
      }),
    ]);

    return {
      asn: resource,
      queriedAt: new Date().toISOString(),
      holder: overview?.data?.holder,
      announced: overview?.data?.announced,
      type: overview?.data?.type,
      prefixes: (prefixes?.data?.prefixes ?? []).map((p) => p.prefix).sort(),
      neighbours: (neighbours?.data?.neighbours ?? [])
        .slice()
        .sort((a, b) => b.power - a.power)
        .slice(0, 40)
        .map((n) => ({ asn: `AS${n.asn}`, type: n.type === "left" ? "upstream/peer" : "downstream", power: n.power })),
      sources,
      links: [
        { label: "BGP.tools", url: `https://bgp.tools/as/${asn}` },
        { label: "RIPEstat", url: `https://stat.ripe.net/AS${asn}` },
        { label: "PeeringDB (busca)", url: `https://www.peeringdb.com/search?q=AS${asn}` },
      ],
    };
  });

export const bgpLookup = createServerFn({ method: "POST" })
  .inputValidator(z.object({ resource: z.string().min(2).max(80) }))
  .handler(async ({ data }) => {
    await enforceRateLimit("bgp", 1, 25);
    const resource = data.resource.trim();
    if (!/^[0-9a-f.:/]+$/i.test(resource)) throw new UpstreamError("Informe um IP ou prefixo CIDR.", 400, "validation");
    const sources: SourceStatus[] = [];
    const [status, info, overview] = await Promise.all([
      cached(`routing:${resource}`, 15 * 60_000, async () => {
        try { return await fetchJson<RipeRouting>(`https://stat.ripe.net/data/routing-status/data.json?resource=${encodeURIComponent(resource)}`, { timeoutMs: 12000 }); }
        catch (e) { sources.push({ name: "RIPEstat routing-status", ok: false, detail: (e as Error).message }); return null; }
      }),
      cached(`netinfo:${resource}`, 30 * 60_000, async () => {
        try { return await fetchJson<RipeNetworkInfo>(`https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(resource)}`, { timeoutMs: 10000 }); }
        catch { return null; }
      }),
      cached(`prefix-overview:${resource}`, 30 * 60_000, async () => {
        try {
          const r = await fetchJson<RipePrefixOverview>(`https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(resource)}`, { timeoutMs: 12000 });
          sources.push({ name: "RIPEstat prefix-overview", ok: true });
          return r;
        } catch (e) { sources.push({ name: "RIPEstat prefix-overview", ok: false, detail: (e as Error).message }); return null; }
      }),
    ]);
    const vis = status?.data?.visibility?.v4 ?? status?.data?.visibility?.v6;
    return {
      resource,
      queriedAt: new Date().toISOString(),
      prefix: info?.data?.prefix ?? overview?.data?.prefixes?.[0]?.prefix,
      originAsns: (info?.data?.asns ?? overview?.data?.asns?.map((a) => a.asn) ?? []).map((a) => `AS${a}`),
      holders: overview?.data?.asns ?? [],
      announcedPrefixes: overview?.data?.prefixes ?? [],
      visibility: vis ? { seenBy: vis.ris_peers_seeing, total: vis.total_ris_peers } : null,
      lastUpdate: status?.data?.last_update?.time,
      sources,
      links: [
        { label: "BGP.tools", url: `https://bgp.tools/search?q=${encodeURIComponent(resource)}` },
        { label: "RIPEstat", url: `https://stat.ripe.net/${encodeURIComponent(resource)}` },
      ],
    };
  });

/* -------------------------------------------------------------------------- */
/* DNS propagation / comparison                                               */
/* -------------------------------------------------------------------------- */

export const dnsPropagation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ domain: z.string().min(1).max(253), type: z.enum(["A", "AAAA", "MX", "TXT", "NS", "CNAME", "CAA"]).optional() }))
  .handler(async ({ data }) => {
    await enforceRateLimit("dns-propagation", 1, 15);
    const domain = assertDomain(data.domain);
    const type = data.type ?? "A";
    const resolvers = ["google", "cloudflare", "adguard"] as const;
    const results = await Promise.all(
      resolvers.map(async (r) => {
        try {
          const ans = await doh(domain, type, r);
          return {
            resolver: ans.resolver,
            ok: ans.Status === 0,
            status: ans.Status === 0 ? "NOERROR" : ans.Status === 3 ? "NXDOMAIN" : String(ans.Status),
            values: (ans.Answer ?? []).map((a) => (type === "TXT" ? txtValue(a.data) : a.data)),
            ttl: ans.Answer?.[0]?.TTL,
          };
        } catch (e) {
          return { resolver: r, ok: false, status: (e as Error).message, values: [] as string[], ttl: undefined };
        }
      }),
    );
    const sets = results.map((r) => [...r.values].sort().join("|"));
    return {
      domain,
      type,
      queriedAt: new Date().toISOString(),
      results,
      consistent: new Set(sets.filter(Boolean)).size <= 1,
      sources: results.map((r) => ({ name: r.resolver, ok: r.ok })),
    };
  });

export const publicDnsResolve = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    name: z.string().min(1).max(253),
    type: z.string().min(1).max(10),
    resolver: z.enum(["google", "cloudflare", "adguard"]).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("doh", 1, 40);
    const name = data.name.trim().toLowerCase();
    if (!/^[a-z0-9._-]+$/.test(name)) throw new UpstreamError("Nome inválido.", 400, "validation");
    const ans = await doh(name, data.type.toUpperCase(), data.resolver ?? "google");
    return {
      name,
      type: data.type.toUpperCase(),
      resolver: ans.resolver,
      status: ans.Status === 0 ? "NOERROR" : ans.Status === 3 ? "NXDOMAIN" : String(ans.Status),
      dnssecAuthenticated: Boolean(ans.AD),
      answers: (ans.Answer ?? []).map((a) => ({ name: a.name, type: a.type, ttl: a.TTL, data: a.data })),
      authority: (ans.Authority ?? []).map((a) => ({ name: a.name, type: a.type, ttl: a.TTL, data: a.data })),
      queriedAt: new Date().toISOString(),
    };
  });

/* -------------------------------------------------------------------------- */
/* Reputation (free sources + optional keys)                                  */
/* -------------------------------------------------------------------------- */

export const ipReputation = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    ip: z.string().min(2).max(64),
    keys: z.record(z.string(), z.string().max(200)).optional(),
  }))
  .handler(async ({ data }) => {
    await enforceRateLimit("ip-reputation", 1, 20);
    const ip = assertIp(data.ip);
    if (isBlockedAddress(ip)) throw new UpstreamError("Endereços privados não possuem reputação pública.", 400, "validation");
    const keys = data.keys ?? {};
    const sources: SourceStatus[] = [];
    const results: Record<string, any> = {};

    if (keys.ABUSEIPDB_API_KEY) {
      try {
        const r = await fetchJson<{ data?: unknown }>(
          `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
          { headers: { key: keys.ABUSEIPDB_API_KEY, accept: "application/json" }, timeoutMs: 10000 },
        );
        results.abuseipdb = r.data;
        sources.push({ name: "AbuseIPDB", ok: true });
      } catch (e) { sources.push({ name: "AbuseIPDB", ok: false, detail: (e as Error).message }); }
    } else sources.push({ name: "AbuseIPDB", ok: false, detail: "Chave opcional não configurada.", url: "https://www.abuseipdb.com" });

    if (keys.VT_API_KEY) {
      try {
        const r = await fetchJson<{ data?: { attributes?: unknown } }>(
          `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(ip)}`,
          { headers: { "x-apikey": keys.VT_API_KEY }, timeoutMs: 12000 },
        );
        const attr = r.data?.attributes as { last_analysis_stats?: Record<string, number>; as_owner?: string; country?: string; reputation?: number } | undefined;
        results.virustotal = attr
          ? { stats: attr.last_analysis_stats, asOwner: attr.as_owner, country: attr.country, reputation: attr.reputation }
          : null;
        sources.push({ name: "VirusTotal", ok: true });
      } catch (e) { sources.push({ name: "VirusTotal", ok: false, detail: (e as Error).message }); }
    } else sources.push({ name: "VirusTotal", ok: false, detail: "Chave opcional não configurada.", url: "https://www.virustotal.com" });

    if (keys.SHODAN_API_KEY) {
      try {
        const r = await fetchJson<Record<string, any>>(
          `https://api.shodan.io/shodan/host/${encodeURIComponent(ip)}?key=${encodeURIComponent(keys.SHODAN_API_KEY)}`,
          { timeoutMs: 12000 },
        );
        results.shodan = {
          ports: r.ports, hostnames: r.hostnames, org: r.org, os: r.os, isp: r.isp, country: r.country_name, lastUpdate: r.last_update,
        };
        sources.push({ name: "Shodan", ok: true });
      } catch (e) { sources.push({ name: "Shodan", ok: false, detail: (e as Error).message }); }
    } else sources.push({ name: "Shodan", ok: false, detail: "Chave opcional não configurada.", url: "https://www.shodan.io" });

    if (keys.GREYNOISE_API_KEY) {
      try {
        const r = await fetchJson<unknown>(`https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`, {
          headers: { key: keys.GREYNOISE_API_KEY },
          timeoutMs: 10000,
        });
        results.greynoise = r;
        sources.push({ name: "GreyNoise", ok: true });
      } catch (e) { sources.push({ name: "GreyNoise", ok: false, detail: (e as Error).message }); }
    }

    // AlienVault OTX: the general indicator endpoint is public (no key required).
    try {
      const otx = await cached(`otx:ip:${ip}`, 15 * 60_000, () =>
        fetchJson<{ pulse_info?: { count?: number; pulses?: Array<{ name: string; modified: string; tags?: string[] }> }; reputation?: number; whois?: string }>(
          `https://otx.alienvault.com/api/v1/indicators/IPv4/${encodeURIComponent(ip)}/general`,
          { timeoutMs: 12000 },
        ),
      );
      results.otx = { pulses: otx.pulse_info?.count ?? 0, recentPulses: (otx.pulse_info?.pulses ?? []).slice(0, 10).map((p) => ({ name: p.name, modified: p.modified })), reputation: otx.reputation };
      sources.push({ name: "AlienVault OTX (público)", ok: true });
    } catch (e) {
      sources.push({ name: "AlienVault OTX", ok: false, detail: (e as Error).message });
    }

    return { ip, queriedAt: new Date().toISOString(), results, sources, interpretation: "Sinais de reputação são indicativos e vêm de fontes comunitárias. Ausência de reportes não garante que o IP seja confiável." };
  });
