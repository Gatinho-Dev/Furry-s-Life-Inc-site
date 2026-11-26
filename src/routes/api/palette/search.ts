import { createFileRoute } from "@tanstack/react-router";
import { domainLookup, dnsLookup, sslAnalyzer, subdomainFinder, waybackHistory, websiteAnalyzer } from "@/lib/agency/api/domain.functions";
import { asnLookup, bgpLookup, ipLookup, reverseDnsLookup } from "@/lib/agency/api/ip.functions";
import { cveLookup, hashLookup } from "@/lib/agency/api/cyber.functions";
import { emailAnalysis } from "@/lib/agency/api/email.functions";
import { usernameScan } from "@/lib/agency/api/social.functions";
import { urlAnalyzer } from "@/lib/agency/api/web.functions";
import { cnpjLookup } from "@/lib/agency/api/company.functions";

/**
 * Life Palette multi-source search endpoint.
 * All providers are the platform's existing free OSINT server functions.
 * The browser never imports server code; it posts {tool, value} here.
 */

const RUNNERS: Record<string, (value: string) => Promise<unknown>> = {
  domainLookup: (value) => domainLookup({ data: { domain: value } }),
  dnsLookup: (value) => dnsLookup({ data: { domain: value, resolver: "cloudflare" } }),
  subdomainFinder: (value) => subdomainFinder({ data: { domain: value } }),
  sslAnalyzer: (value) => sslAnalyzer({ data: { domain: value } }),
  websiteAnalyzer: (value) => websiteAnalyzer({ data: { url: value } }),
  waybackHistory: (value) => waybackHistory({ data: { domain: value, limit: 40 } }),
  ipLookup: (value) => ipLookup({ data: { ip: value } }),
  reverseDnsLookup: (value) => reverseDnsLookup({ data: { ip: value } }),
  asnLookup: (value) => asnLookup({ data: { asn: value } }),
  bgpLookup: (value) => bgpLookup({ data: { resource: value } }),
  usernameScan: (value) => usernameScan({ data: { username: value.replace(/^@/, "") } }),
  emailAnalysis: (value) => emailAnalysis({ data: { email: value } }),
  cveLookup: (value) => cveLookup({ data: { cve: value } }),
  hashLookup: (value) => hashLookup({ data: { hash: value } }),
  urlAnalyzer: (value) => urlAnalyzer({ data: { url: value } }),
  cnpjLookup: (value) => cnpjLookup({ data: { cnpj: value } }),
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
        if (!tool || !RUNNERS[tool]) return Response.json({ ok: false, error: "Ferramenta não permitida." }, { status: 400 });
        if (!value || value.length > 2048) return Response.json({ ok: false, error: "Valor inválido." }, { status: 400 });

        try {
          const data = await RUNNERS[tool](value);
          return Response.json({ ok: true, tool, data }, { headers: { "cache-control": "no-store" } });
        } catch (e) {
          const message = e instanceof Error ? e.message : "Falha na consulta.";
          return Response.json({ ok: false, tool, error: message.slice(0, 500) }, { status: 502, headers: { "cache-control": "no-store" } });
        }
      },
    },
  },
});
