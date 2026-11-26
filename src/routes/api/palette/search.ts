import { createFileRoute } from "@tanstack/react-router";
import { domainLookup, dnsLookup, sslAnalyzer, subdomainFinder, waybackHistory, websiteAnalyzer } from "@/lib/agency/api/domain.functions";
import { asnLookup, bgpLookup, dnsPropagation, ipLookup, ipReputation, reverseDnsLookup } from "@/lib/agency/api/ip.functions";
import { cveLookup, hashLookup, kevSearch, otxIndicator, threatFoxLookup } from "@/lib/agency/api/cyber.functions";
import { emailAnalysis } from "@/lib/agency/api/email.functions";
import { githubSearch, githubUser, hackerNewsSearch, usernameScan } from "@/lib/agency/api/social.functions";
import { urlAnalyzer, robotsSitemap, safeBrowsingLookup, urlhausLookup, virusTotalLookup } from "@/lib/agency/api/web.functions";
import { cnpjLookup, companyOpenDataLinks } from "@/lib/agency/api/company.functions";
import {
  identityDevto, identityGithub, identityGitlab, identityHackerNews, identityKeybase, identityMastodon,
} from "@/lib/agency/api/identity.functions";

/**
 * Life Palette 2.0 multi-source search endpoint.
 * All providers are the platform's existing free OSINT server functions.
 * The browser never imports server code; it posts {tool, value} here.
 * Optional-key sources are called without keys and must answer `available:false`
 * honestly — the client renders that state instead of inventing a result.
 */

const RUNNERS: Record<string, (value: string) => Promise<unknown>> = {
  domainLookup: (value) => domainLookup({ data: { domain: value } }),
  dnsLookup: (value) => dnsLookup({ data: { domain: value, resolver: "cloudflare" } }),
  dnsPropagation: (value) => dnsPropagation({ data: { domain: value } }),
  subdomainFinder: (value) => subdomainFinder({ data: { domain: value } }),
  sslAnalyzer: (value) => sslAnalyzer({ data: { domain: value } }),
  websiteAnalyzer: (value) => websiteAnalyzer({ data: { url: value } }),
  robotsSitemap: (value) => robotsSitemap({ data: { domain: value } }),
  waybackHistory: (value) => waybackHistory({ data: { domain: value, limit: 40 } }),
  ipLookup: (value) => ipLookup({ data: { ip: value } }),
  reverseDnsLookup: (value) => reverseDnsLookup({ data: { ip: value } }),
  ipReputation: (value) => ipReputation({ data: { ip: value } }),
  asnLookup: (value) => asnLookup({ data: { asn: value } }),
  bgpLookup: (value) => bgpLookup({ data: { resource: value } }),
  usernameScan: (value) => usernameScan({ data: { username: value.replace(/^@/, "") } }),
  githubUser: (value) => githubUser({ data: { username: value.replace(/^@/, "") } }),
  githubSearch: (value) => githubSearch({ data: { query: value, limit: 10 } }),
  hackerNewsSearch: (value) => hackerNewsSearch({ data: { query: value, type: "all" } }),
  identityGithub: (value) => identityGithub({ data: { username: value.replace(/^@/, "") } }),
  identityGitlab: (value) => identityGitlab({ data: { username: value.replace(/^@/, "") } }),
  identityKeybase: (value) => identityKeybase({ data: { username: value.replace(/^@/, "") } }),
  identityMastodon: (value) => identityMastodon({ data: { username: value.replace(/^@/, "") } }),
  identityDevto: (value) => identityDevto({ data: { username: value.replace(/^@/, "") } }),
  identityHackerNews: (value) => identityHackerNews({ data: { username: value.replace(/^@/, "") } }),
  emailAnalysis: (value) => emailAnalysis({ data: { email: value } }),
  cveLookup: (value) => cveLookup({ data: { cve: value } }),
  kevSearch: (value) => kevSearch({ data: { query: value, limit: 25 } }),
  otxIndicator: (value) => otxIndicator({ data: { indicator: value } }),
  urlhausLookup: (value) => urlhausLookup({ data: /^https?:\/\//i.test(value) ? { url: value } : { host: value } }),
  threatFoxLookup: (value) => threatFoxLookup({ data: { ioc: value } }),
  virusTotalLookup: (value) => {
    const kind = /^[a-f0-9]{32,64}$/i.test(value) ? "file"
      : /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value) ? "ip"
      : /^https?:\/\//i.test(value) ? "url" : "domain";
    return virusTotalLookup({ data: { target: value, kind } });
  },
  safeBrowsingLookup: (value) => safeBrowsingLookup({ data: { url: /^https?:\/\//i.test(value) ? value : `https://${value}` } }),
  hashLookup: (value) => hashLookup({ data: { hash: value } }),
  urlAnalyzer: (value) => urlAnalyzer({ data: { url: value } }),
  cnpjLookup: (value) => cnpjLookup({ data: { cnpj: value } }),
  companyOpenDataLinks: (value) => companyOpenDataLinks({ data: { query: value } }),
};

export const Route = createFileRoute("/api/palette/search")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: { tool?: unknown; value?: unknown };
        try {
          body = (await request.json()) as { tool?: unknown; value?: unknown };
        } catch {
          return Response.json({ ok: false, error: "JSON inválido." }, { status: 400 });
        }
        const tool = typeof body.tool === "string" ? body.tool : "";
        const value = typeof body.value === "string" ? body.value.trim() : "";
        if (!tool || !Object.hasOwn(RUNNERS, tool)) return Response.json({ ok: false, error: "Ferramenta não permitida." }, { status: 400 });
        if (!value || value.length > 2048) return Response.json({ ok: false, error: "Valor inválido." }, { status: 400 });

        try {
          const data = await RUNNERS[tool](value);
          return Response.json({ ok: true, tool, data }, { headers: { "cache-control": "no-store" } });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Falha na consulta.";
          const status = /rate|limite|429/i.test(message) ? 429 : 502;
          return Response.json({ ok: false, tool, error: message.slice(0, 500) }, { status, headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});
