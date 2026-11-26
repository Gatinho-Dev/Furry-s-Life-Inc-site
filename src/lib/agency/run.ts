/**
 * Central dispatch of real tool executions (client → server functions).
 * Used by Quick Search, Tool Builder and multi-tool investigations.
 */

import {
  dnsLookup, domainLookup, sslAnalyzer, subdomainFinder, waybackHistory, websiteAnalyzer,
} from "./api/domain.functions";
import { asnLookup, bgpLookup, dnsPropagation, ipLookup, ipReputation, publicDnsResolve, reverseDnsLookup } from "./api/ip.functions";
import { urlAnalyzer, urlhausLookup, safeBrowsingLookup, virusTotalLookup } from "./api/web.functions";
import { cveLookup, cveSearch, hashLookup, kevSearch, otxIndicator, threatFoxLookup } from "./api/cyber.functions";
import { breachAccountCheck, breachCatalog, emailAnalysis } from "./api/email.functions";
import { githubSearch, githubUser, redditUser, usernameScan } from "./api/social.functions";
import { cnpjLookup } from "./api/company.functions";
import { getPrefs } from "./store";

export type Runner = {
  id: string;
  name: string;
  source: string;
  run: (input: string) => Promise<unknown>;
};

function keys(): Record<string, string> {
  return getPrefs().apiKeys;
}

const asDomain = (v: string) => v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const asUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);

export const RUNNERS: Record<string, Runner> = {
  "domain-lookup": {
    id: "domain-lookup", name: "Domain Lookup (RDAP)", source: "rdap.org",
    run: (v) => domainLookup({ data: { domain: asDomain(v) } }),
  },
  "dns-lookup": {
    id: "dns-lookup", name: "DNS Lookup", source: "Google Public DNS",
    run: (v) => dnsLookup({ data: { domain: asDomain(v) } }),
  },
  "subdomain-finder": {
    id: "subdomain-finder", name: "Subdomain Finder", source: "crt.sh",
    run: (v) => subdomainFinder({ data: { domain: asDomain(v) } }),
  },
  "ssl-analyzer": {
    id: "ssl-analyzer", name: "SSL Analyzer", source: "crt.sh",
    run: (v) => sslAnalyzer({ data: { domain: asDomain(v) } }),
  },
  "website-analyzer": {
    id: "website-analyzer", name: "Website Analyzer", source: "HTTP direto",
    run: (v) => websiteAnalyzer({ data: { url: asUrl(v) } }),
  },
  "wayback": {
    id: "wayback", name: "Wayback History", source: "Internet Archive",
    run: (v) => waybackHistory({ data: { domain: asDomain(v), limit: 40 } }),
  },
  "ip-lookup": {
    id: "ip-lookup", name: "IP Lookup", source: "RDAP + RIPEstat",
    run: (v) => ipLookup({ data: { ip: v.trim() } }),
  },
  "reverse-dns": {
    id: "reverse-dns", name: "Reverse DNS", source: "Google Public DNS",
    run: (v) => reverseDnsLookup({ data: { ip: v.trim() } }),
  },
  "ip-reputation": {
    id: "ip-reputation", name: "IP Reputation", source: "OTX + opcionais",
    run: (v) => ipReputation({ data: { ip: v.trim(), keys: keys() } }),
  },
  "asn-lookup": {
    id: "asn-lookup", name: "ASN Lookup", source: "RIPEstat",
    run: (v) => asnLookup({ data: { asn: v.trim() } }),
  },
  "bgp-lookup": {
    id: "bgp-lookup", name: "BGP Prefix Lookup", source: "RIPEstat",
    run: (v) => bgpLookup({ data: { resource: v.trim() } }),
  },
  "dns-propagation": {
    id: "dns-propagation", name: "DNS Propagation", source: "Google + Cloudflare + AdGuard",
    run: (v) => dnsPropagation({ data: { domain: asDomain(v) } }),
  },
  "dns-resolve": {
    id: "dns-resolve", name: "Public DNS Resolver", source: "DoH",
    run: (v) => publicDnsResolve({ data: { name: v.trim(), type: "A" } }),
  },
  "username-search": {
    id: "username-search", name: "Username Search", source: "Perfis públicos",
    run: (v) => usernameScan({ data: { username: v.trim().replace(/^@/, "") } }),
  },
  "github-user": {
    id: "github-user", name: "GitHub Profile", source: "GitHub API",
    run: (v) => githubUser({ data: { username: v.trim().replace(/^@/, "") } }),
  },
  "reddit-user": {
    id: "reddit-user", name: "Reddit Profile", source: "Reddit JSON",
    run: (v) => redditUser({ data: { username: v.trim().replace(/^@/, "") } }),
  },
  "email-analysis": {
    id: "email-analysis", name: "Email Intelligence", source: "DNS (SPF/DMARC/DKIM)",
    run: (v) => emailAnalysis({ data: { email: v.trim().toLowerCase() } }),
  },
  "breach-catalog": {
    id: "breach-catalog", name: "Breach Catalog", source: "HIBP",
    run: (v) => breachCatalog({ data: { query: asDomain(v) } }),
  },
  "breach-check": {
    id: "breach-check", name: "Breach Account Check", source: "HIBP (chave)",
    run: (v) => breachAccountCheck({ data: { email: v.trim().toLowerCase(), keys: keys() } }),
  },
  "url-analyzer": {
    id: "url-analyzer", name: "URL Analysis", source: "HTTP direto + heurísticas",
    run: (v) => urlAnalyzer({ data: { url: asUrl(v) } }),
  },
  "urlhaus-url": {
    id: "urlhaus-url", name: "URLhaus Lookup", source: "abuse.ch",
    run: (v) => (/^https?:\/\//i.test(v) ? urlhausLookup({ data: { url: v, keys: keys() } }) : urlhausLookup({ data: { host: v.trim(), keys: keys() } })),
  },
  "safe-browsing": {
    id: "safe-browsing", name: "Safe Browsing", source: "Google (chave)",
    run: (v) => safeBrowsingLookup({ data: { url: asUrl(v), keys: keys() } }),
  },
  "virustotal": {
    id: "virustotal", name: "VirusTotal", source: "VirusTotal (chave)",
    run: (v) => virusTotalLookup({ data: { target: v.trim(), kind: /^\d{1,3}(\.\d{1,3}){3}$/.test(v.trim()) ? "ip" : v.includes("://") ? "url" : "domain", keys: keys() } }),
  },
  "cve-lookup": {
    id: "cve-lookup", name: "CVE Lookup", source: "NVD + KEV + EPSS",
    run: (v) => cveLookup({ data: { cve: v.trim() } }),
  },
  "cve-search": {
    id: "cve-search", name: "NVD Search", source: "NIST NVD",
    run: (v) => cveSearch({ data: { keyword: v.trim(), limit: 15 } }),
  },
  "kev": {
    id: "kev", name: "CISA KEV Search", source: "CISA",
    run: (v) => kevSearch({ data: { query: v.trim(), limit: 30 } }),
  },
  "hash-lookup": {
    id: "hash-lookup", name: "Malware Hash Lookup", source: "MalwareBazaar",
    run: (v) => hashLookup({ data: { hash: v.trim(), keys: keys() } }),
  },
  "threatfox": {
    id: "threatfox", name: "ThreatFox Search", source: "abuse.ch",
    run: (v) => threatFoxLookup({ data: { ioc: v.trim(), keys: keys() } }),
  },
  "otx": {
    id: "otx", name: "OTX Indicator", source: "AlienVault OTX",
    run: (v) => otxIndicator({ data: { indicator: v.trim() } }),
  },
  "cnpj": {
    id: "cnpj", name: "CNPJ Lookup", source: "BrasilAPI / Receita Federal",
    run: (v) => cnpjLookup({ data: { cnpj: v.trim() } }),
  },
  "github-search": {
    id: "github-search", name: "GitHub Search", source: "GitHub API",
    run: (v) => githubSearch({ data: { query: v.trim(), limit: 15 } }),
  },
};

export function getRunner(id: string): Runner | undefined {
  return RUNNERS[id];
}

export async function runTool(id: string, input: string): Promise<unknown> {
  const runner = RUNNERS[id];
  if (!runner) throw new Error(`Ferramenta sem integração: ${id}`);
  return runner.run(input);
}
