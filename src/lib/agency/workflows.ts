/** Investigation workflows executed step by step with real tools. */

export type Workflow = {
  id: string;
  name: string;
  description: string;
  inputKind: "domain" | "ip" | "url" | "email" | "username" | "company";
  steps: Array<{ toolId: string; label: string; optional?: boolean }>;
};

export const WORKFLOWS: Workflow[] = [
  {
    id: "domain-investigation",
    name: "Domain Investigation Workflow",
    description: "Registro, DNS, subdomínios, certificados, análise técnica, histórico e segurança.",
    inputKind: "domain",
    steps: [
      { toolId: "domain-lookup", label: "Domain Lookup (RDAP)" },
      { toolId: "dns-lookup", label: "DNS Lookup" },
      { toolId: "subdomain-finder", label: "Subdomain Finder (CT)" },
      { toolId: "ssl-analyzer", label: "SSL Analyzer" },
      { toolId: "website-analyzer", label: "Website & Technology Detection" },
      { toolId: "wayback", label: "Historical Domain Intelligence" },
      { toolId: "ip-lookup", label: "IP Resolution & Network", optional: true },
    ],
  },
  {
    id: "ip-investigation",
    name: "IP & Network Investigation",
    description: "Geolocalização aproximada, ASN, prefixo, rota, PTR e reputação.",
    inputKind: "ip",
    steps: [
      { toolId: "ip-lookup", label: "IP Lookup" },
      { toolId: "reverse-dns", label: "Reverse DNS" },
      { toolId: "bgp-lookup", label: "BGP / Routing" },
      { toolId: "ip-reputation", label: "Reputation (OTX + opcionais)" },
      { toolId: "otx", label: "OTX Pulses" },
    ],
  },
  {
    id: "url-investigation",
    name: "URL & Content Investigation",
    description: "Parse, redirecionamentos, headers, indicadores de phishing e reputação.",
    inputKind: "url",
    steps: [
      { toolId: "url-analyzer", label: "URL Analysis" },
      { toolId: "website-analyzer", label: "Website Analyzer" },
      { toolId: "urlhaus-url", label: "URLhaus (chave gratuita)" },
      { toolId: "safe-browsing", label: "Safe Browsing (chave gratuita)", optional: true },
      { toolId: "virustotal", label: "VirusTotal (chave)", optional: true },
    ],
  },
  {
    id: "email-investigation",
    name: "Email Domain Investigation",
    description: "MX, provedor, SPF, DMARC, DKIM e catálogo de vazamentos do domínio.",
    inputKind: "email",
    steps: [
      { toolId: "email-analysis", label: "Email Intelligence" },
      { toolId: "breach-catalog", label: "Breach Catalog (domínio)" },
    ],
  },
  {
    id: "username-investigation",
    name: "Public Identity Investigation",
    description: "Perfis públicos, GitHub, Reddit e correlação manual.",
    inputKind: "username",
    steps: [
      { toolId: "username-search", label: "Username Sweep" },
      { toolId: "github-user", label: "GitHub Profile" },
      { toolId: "reddit-user", label: "Reddit Profile" },
    ],
  },
  {
    id: "company-investigation",
    name: "Company Investigation",
    description: "Cadastro público (CNPJ), presença web, subdomínios e certificados.",
    inputKind: "company",
    steps: [
      { toolId: "cnpj", label: "CNPJ / Cadastro público" },
      { toolId: "website-analyzer", label: "Corporate Website" },
      { toolId: "subdomain-finder", label: "Domain Association" },
      { toolId: "ssl-analyzer", label: "Certificate Association" },
    ],
  },
];

export function workflowsFor(kind: string): Workflow[] {
  return WORKFLOWS.filter((w) => w.inputKind === kind);
}
