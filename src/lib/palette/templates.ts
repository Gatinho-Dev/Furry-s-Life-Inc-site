import type { PaletteNodeKind, PlanStep } from "./types";

export type PaletteTemplate = {
  id: string;
  name: string;
  description: string;
  objective: string;
  tags: string[];
  seedKind?: PaletteNodeKind;
  seedLabel?: string;
  seedPlaceholder?: string;
  steps: Array<{ label: string; hint: string; tool?: string }>;
};

export const PALETTE_TEMPLATES: PaletteTemplate[] = [
  {
    id: "domain-investigation",
    name: "Domain Investigation",
    description: "Registro, DNS, subdomínios, certificados, tecnologia e histórico de um domínio.",
    objective: "Mapear a infraestrutura pública de um domínio e documentar dono, DNS, certificados e evolução.",
    tags: ["domain", "infrastructure"],
    seedKind: "domain",
    seedLabel: "Domínio alvo",
    seedPlaceholder: "exemplo.com",
    steps: [
      { label: "Registro e DNS", hint: "RDAP + Google/Cloudflare DNS (A, NS, MX, TXT)", tool: "domainLookup" },
      { label: "Subdomínios e certificados", hint: "crt.sh — Certificate Transparency", tool: "subdomainFinder" },
      { label: "Tecnologia do site", hint: "Cabeçalhos, meta, robots e sitemap", tool: "websiteAnalyzer" },
      { label: "Histórico", hint: "Wayback Machine — capturas por ano", tool: "waybackHistory" },
      { label: "Reputação e ameaças", hint: "OTX / URLhaus quando houver indicador", tool: "otxIndicator" },
    ],
  },
  {
    id: "ip-investigation",
    name: "IP Investigation",
    description: "Rede, ASN, prefixo, PTR, BGP e reputação de um endereço IP.",
    objective: "Determinar a quem o IP pertence, em que rede está anunciado e como se comporta.",
    tags: ["ip", "network"],
    seedKind: "ipv4",
    seedLabel: "Endereço IP",
    seedPlaceholder: "203.0.113.10",
    steps: [
      { label: "Rede e ASN", hint: "RDAP, Team Cymru e RIPEstat", tool: "ipLookup" },
      { label: "Reverse DNS", hint: "PTR pelo resolver público", tool: "reverseDnsLookup" },
      { label: "BGP e prefixo", hint: "RIPEstat — anúncios e vizinhos", tool: "bgpLookup" },
      { label: "Reputação", hint: "OTX / URLhaus / AbuseIPDB (chave opcional)", tool: "ipReputation" },
      { label: "Serviços expostos", hint: "Shodan (chave opcional)", tool: "virusTotalLookup" },
    ],
  },
  {
    id: "threat-investigation",
    name: "Cyber Threat Investigation",
    description: "CVE, hash, URL e indicadores com contexto de exploração.",
    objective: "Avaliar um indicador de ameaça com fontes primárias e evidências arquivadas.",
    tags: ["threat", "vulnerability"],
    seedKind: "cve",
    seedLabel: "CVE ou indicador",
    seedPlaceholder: "CVE-2021-44228",
    steps: [
      { label: "Vulnerabilidade", hint: "NVD + CISA KEV + EPSS", tool: "cveLookup" },
      { label: "Indicador", hint: "OTX e URLhaus quando aplicável", tool: "otxIndicator" },
      { label: "Hash", hint: "MalwareBazaar / VirusTotal (metadados)", tool: "hashLookup" },
      { label: "Evidência", hint: "Arquivar payload/hash e registrar a fonte", tool: "evidence" },
    ],
  },
  {
    id: "company-investigation",
    name: "Company Investigation",
    description: "Dados públicos de empresa, domínio corporativo e presença oficial.",
    objective: "Identificar a empresa por trás de um ativo público, com dados oficiais e fontes abertas.",
    tags: ["company", "corporate"],
    seedKind: "company",
    seedLabel: "Empresa ou CNPJ",
    seedPlaceholder: "nome da empresa ou CNPJ",
    steps: [
      { label: "Dados oficiais", hint: "BrasilAPI / Receita Federal para CNPJ", tool: "cnpjLookup" },
      { label: "Domínio corporativo", hint: "Registro, DNS e certificados", tool: "domainLookup" },
      { label: "Website e tecnologia", hint: "Cabeçalhos, meta e robots", tool: "websiteAnalyzer" },
      { label: "Presença pública", hint: "GitHub, redes e menções abertas", tool: "usernameScan" },
    ],
  },
  {
    id: "identity-correlation",
    name: "Identity Correlation",
    description: "Perfis públicos, contatos declarados e chaves, com confiança por sinal.",
    objective: "Reunir presença pública de um identificador sem afirmar que contas são da mesma pessoa.",
    tags: ["identity", "socmint"],
    seedKind: "username",
    seedLabel: "Username público",
    seedPlaceholder: "usuario",
    steps: [
      { label: "Presença", hint: "Sherlock (464 sites) + 26 plataformas", tool: "usernameScanBatch" },
      { label: "Perfis declarados", hint: "GitHub, Keybase, HN, Mastodon, GitLab, dev.to", tool: "identityGithub" },
      { label: "Contatos e chaves", hint: "Somente o que o perfil publica", tool: "identityGravatar" },
      { label: "Correlação", hint: "Comparar avatar, chave e contato; exigir confirmação humana", tool: "ai" },
    ],
  },
  {
    id: "custom",
    name: "Custom Investigation",
    description: "Comece vazio, escolha os tipos de nó e as fontes conforme o caso.",
    objective: "",
    tags: [],
    steps: [],
  },
];

export function templateById(id: string): PaletteTemplate | undefined {
  return PALETTE_TEMPLATES.find((t) => t.id === id);
}

export function planFromTemplate(id: string): PlanStep[] {
  const tpl = templateById(id);
  if (!tpl) return [];
  return tpl.steps.map((s, i) => ({
    id: `step-${i}-${s.tool ?? "manual"}`,
    label: s.label,
    hint: s.hint,
    tool: s.tool,
    done: false,
  }));
}
