/**
 * Life Agency — catalog of navigation, tools, data sources and OSINT framework entries.
 * Client-safe metadata only (no secrets, no server imports).
 */

export type AccessKind = "free" | "key-optional" | "client" | "link";

export type ToolPageKey =
  | "overview"
  | "quick-search"
  | "osint"
  | "domain"
  | "ip"
  | "network"
  | "username"
  | "email"
  | "web"
  | "social"
  | "cyber"
  | "company"
  | "image"
  | "document"
  | "geospatial"
  | "threat"
  | "palette"
  | "workspace"
  | "identity"
  | "graph"
  | "reports"
  | "api"
  | "settings"
  | "tool-builder"
  | "activity";

export type NavItem = {
  key: ToolPageKey;
  label: string;
  icon: string;
  to: string;
  group: "Operations" | "OSINT" | "Cyber" | "Workbench" | "Platform";
  hint?: string;
};

export const NAV: NavItem[] = [
  { key: "overview", label: "Overview", icon: "LayoutDashboard", to: "/agency", group: "Operations", hint: "Intelligence dashboard" },
  { key: "quick-search", label: "Quick Search", icon: "Search", to: "/agency/quick-search", group: "Operations", hint: "Universal pivoting" },
  { key: "palette", label: "Life Palette", icon: "Layers", to: "/agency/palette", group: "Operations", hint: "Visual investigation canvas" },
  { key: "osint", label: "OSINT Intelligence", icon: "Library", to: "/agency/osint", group: "OSINT", hint: "Framework library" },
  { key: "domain", label: "Domain Intelligence", icon: "Globe", to: "/agency/domain", group: "OSINT" },
  { key: "ip", label: "IP Intelligence", icon: "Server", to: "/agency/ip", group: "OSINT" },
  { key: "network", label: "Network Intelligence", icon: "Network", to: "/agency/network", group: "OSINT" },
  { key: "username", label: "Username Intelligence", icon: "AtSign", to: "/agency/username", group: "OSINT" },
  { key: "email", label: "Email Intelligence", icon: "Mail", to: "/agency/email", group: "OSINT" },
  { key: "web", label: "Web Intelligence", icon: "Link2", to: "/agency/web", group: "OSINT" },
  { key: "social", label: "Social Intelligence", icon: "Share2", to: "/agency/social", group: "OSINT" },
  { key: "company", label: "Company Intelligence", icon: "Building2", to: "/agency/company", group: "OSINT" },
  { key: "image", label: "Image Intelligence", icon: "Image", to: "/agency/image", group: "OSINT" },
  { key: "document", label: "Document Intelligence", icon: "FileText", to: "/agency/document", group: "OSINT" },
  { key: "geospatial", label: "Geospatial Intelligence", icon: "Map", to: "/agency/geospatial", group: "OSINT" },
  { key: "cyber", label: "Cyber Intelligence", icon: "ShieldAlert", to: "/agency/cyber", group: "Cyber" },
  { key: "threat", label: "Threat Intelligence", icon: "Radar", to: "/agency/threat", group: "Cyber" },
  { key: "workspace", label: "Investigation Workspace", icon: "FolderOpen", to: "/agency/workspace", group: "Workbench" },
  { key: "identity", label: "Case Seeder", icon: "Fingerprint", to: "/agency/identity", group: "Workbench", hint: "Identity correlation" },
  { key: "graph", label: "Link Analysis", icon: "Waypoints", to: "/agency/graph", group: "Workbench" },
  { key: "reports", label: "Report Center", icon: "FileBarChart", to: "/agency/reports", group: "Workbench" },
  { key: "tool-builder", label: "Tool Builder", icon: "Workflow", to: "/agency/tool-builder", group: "Workbench" },
  { key: "activity", label: "Activity Log", icon: "History", to: "/agency/activity", group: "Workbench" },
  { key: "api", label: "API Center", icon: "PlugZap", to: "/agency/api", group: "Platform" },
  { key: "settings", label: "Settings", icon: "Settings", to: "/agency/settings", group: "Platform" },
];

export const NAV_GROUPS = ["Operations", "OSINT", "Cyber", "Workbench", "Platform"] as const;

/* ------------------------------------------------------------------ */
/* Data sources                                                        */
/* ------------------------------------------------------------------ */

export type SourceDef = {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  access: "free" | "key-optional";
  keyEnv?: string;
  limits: string;
  docs?: string;
  probe: "live" | "none";
};

export const SOURCES: SourceDef[] = [
  { id: "google-dns", name: "Google Public DNS (DoH)", category: "DNS", description: "Resolução DNS sobre HTTPS com suporte a DNSSEC.", url: "https://dns.google", access: "free", limits: "Uso razoável, sem chave.", probe: "live" },
  { id: "cloudflare-dns", name: "Cloudflare DNS (DoH)", category: "DNS", description: "Resolver público 1.1.1.1 via DoH JSON.", url: "https://cloudflare-dns.com", access: "free", limits: "Uso razoável, sem chave.", probe: "live" },
  { id: "rdap", name: "RDAP (rdap.org)", category: "Registry", description: "Registro de domínios e blocos IP em formato JSON.", url: "https://rdap.org", access: "free", limits: "Bootstrap público; limites variam por registro.", probe: "live" },
  { id: "crt-sh", name: "crt.sh — Certificate Transparency", category: "Certificates", description: "Certificados públicos e descoberta de subdomínios.", url: "https://crt.sh", access: "free", limits: "Consultas amplas podem expirar.", probe: "live" },
  { id: "ripestat", name: "RIPEstat", category: "Routing", description: "ASN, prefixos anunciados, vizinhos BGP e histórico de roteamento.", url: "https://stat.ripe.net", access: "free", limits: "API pública com rate limit por IP.", probe: "live" },
  { id: "cymru", name: "Team Cymru IP→ASN (DNS)", category: "Routing", description: "Origem de ASN e prefixo via TXT DNS.", url: "https://team-cymru.com/community-services/ip-asn-mapping/", access: "free", limits: "Consultas DNS normais.", probe: "none" },
  { id: "ipwhois", name: "ipwho.is", category: "Geolocation", description: "Geolocalização aproximada e dados de rede básicos.", url: "https://ipwho.is", access: "free", limits: "Sem chave; uso moderado.", probe: "live" },
  { id: "nvd", name: "NIST NVD API 2.0", category: "Vulnerabilities", description: "Base oficial de CVEs, CWEs e métricas CVSS.", url: "https://nvd.nist.gov/developers/vulnerabilities", access: "free", limits: "5 req/30s sem chave.", probe: "live" },
  { id: "kev", name: "CISA KEV Catalog", category: "Vulnerabilities", description: "Vulnerabilidades exploradas ativamente.", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", access: "free", limits: "Feed JSON estático.", probe: "live" },
  { id: "osv", name: "OSV.dev", category: "Vulnerabilities", description: "Vulnerabilidades em ecossistemas open-source (npm, PyPI, Go...).", url: "https://osv.dev", access: "free", limits: "API pública.", probe: "live" },
  { id: "epss", name: "FIRST EPSS", category: "Vulnerabilities", description: "Probabilidade de exploração de CVEs em 30 dias.", url: "https://www.first.org/epss", access: "free", limits: "API pública.", probe: "live" },
  { id: "urlhaus", name: "abuse.ch URLhaus", category: "Malware", description: "URLs de distribuição de malware e consulta de hosts.", url: "https://urlhaus.abuse.ch", access: "free", limits: "Sem chave; limites de uso.", probe: "live" },
  { id: "malwarebazaar", name: "abuse.ch MalwareBazaar", category: "Malware", description: "Repositório de amostras por hash (metadados).", url: "https://bazaar.abuse.ch", access: "free", limits: "Sem chave; metadados apenas.", probe: "live" },
  { id: "threatfox", name: "abuse.ch ThreatFox", category: "Malware", description: "Indicadores de comprometimento (C2) comunitários.", url: "https://threatfox.abuse.ch", access: "free", limits: "Sem chave; 1 consulta ampla por vez.", probe: "live" },
  { id: "otx", name: "AlienVault OTX", category: "Threat Intel", description: "Pulsos comunitários e reputação de IP/domínio/hash.", url: "https://otx.alienvault.com", access: "key-optional", keyEnv: "OTX_API_KEY", limits: "Chave gratuita amplia limites.", probe: "live" },
  { id: "virustotal", name: "VirusTotal", category: "Threat Intel", description: "Reputação multi-engine de URL/arquivo/domínio.", url: "https://www.virustotal.com", access: "key-optional", keyEnv: "VT_API_KEY", limits: "API gratuita: 4 req/min.", probe: "live" },
  { id: "abuseipdb", name: "AbuseIPDB", category: "Threat Intel", description: "Denúncias de abuso por endereço IP.", url: "https://www.abuseipdb.com", access: "key-optional", keyEnv: "ABUSEIPDB_API_KEY", limits: "1.000 checagens/dia no plano gratuito.", probe: "live" },
  { id: "shodan", name: "Shodan", category: "Attack Surface", description: "Metadados públicos de serviços expostos (host lookup).", url: "https://www.shodan.io", access: "key-optional", keyEnv: "SHODAN_API_KEY", limits: "Créditos gratuitos limitados.", probe: "live" },
  { id: "greynoise", name: "GreyNoise", category: "Threat Intel", description: "Classificação de ruído de internet e scanners.", url: "https://www.greynoise.io", access: "key-optional", keyEnv: "GREYNOISE_API_KEY", limits: "Plano comunitário gratuito.", probe: "live" },
  { id: "wayback", name: "Wayback Machine (Internet Archive)", category: "Archives", description: "Capturas históricas de páginas e snapshots.", url: "https://web.archive.org", access: "free", limits: "Uso razoável; pode ser lento.", probe: "live" },
  { id: "osm", name: "OpenStreetMap", category: "Geospatial", description: "Camadas de mapa e dados geográficos abertos.", url: "https://www.openstreetmap.org", access: "free", limits: "Política de tiles: uso moderado com atribuição.", probe: "none" },
  { id: "github", name: "GitHub Public API", category: "Social", description: "Perfis, repositórios e busca pública de usuários.", url: "https://docs.github.com/rest", access: "free", limits: "60 req/h sem token.", probe: "live" },
  { id: "reddit", name: "Reddit Public JSON", category: "Social", description: "Perfil público e histórico de posts/comentários.", url: "https://www.reddit.com/dev/api/", access: "free", limits: "Rate limit agressivo; pode bloquear datacenters.", probe: "live" },
  { id: "brasilapi", name: "BrasilAPI — CNPJ", category: "Company", description: "Dados públicos de CNPJ a partir da base da Receita Federal.", url: "https://brasilapi.com.br/docs", access: "free", limits: "API pública com rate limit.", probe: "live" },
  { id: "hibp", name: "Have I Been Pwned", category: "Breach", description: "Verificação de exposição em vazamentos conhecidos.", url: "https://haveibeenpwned.com/API/v3", access: "key-optional", keyEnv: "HIBP_API_KEY", limits: "Chave paga; catálogo de breaches público.", probe: "live" },
  { id: "safe-browsing", name: "Google Safe Browsing", category: "Reputation", description: "Verificação de URLs contra listas do Google.", url: "https://developers.google.com/safe-browsing", access: "key-optional", keyEnv: "GOOGLE_SAFE_BROWSING_KEY", limits: "Chave gratuita com cota diária.", probe: "none" },
  { id: "mastodon", name: "Mastodon (instâncias públicas)", category: "Social", description: "Busca pública de contas e status por instância.", url: "https://joinmastodon.org", access: "free", limits: "Depende da instância.", probe: "none" },
  { id: "sherlock", name: "Sherlock Project (catálogo de sites)", category: "Identity", description: "Lista pública de 464 sites com URL de perfil e heurística de usuário inexistente.", url: "https://github.com/sherlock-project/sherlock", access: "free", limits: "MIT. Alguns sites bloqueiam datacenter (403/429) e SPAs devolvem 200 para perfis inexistentes.", probe: "none" },
  { id: "keybase", name: "Keybase", category: "Identity", description: "Provas criptográficas que ligam contas de várias plataformas.", url: "https://keybase.io", access: "free", limits: "Somente perfis e provas públicas.", probe: "live" },
  { id: "gravatar", name: "Gravatar (perfil público)", category: "Identity", description: "Perfil público associado ao hash MD5 de um e-mail.", url: "https://gravatar.com", access: "free", limits: "Só existe se o titular publicou o perfil; contas vinculadas podem estar desatualizadas.", probe: "live" },
  { id: "gitlab", name: "GitLab Users API", category: "Identity", description: "Perfil público, site, e-mail público e redes declaradas.", url: "https://docs.gitlab.com/ee/api/users.html", access: "free", limits: "Rate limit público por IP.", probe: "live" },
  { id: "devto", name: "dev.to API", category: "Identity", description: "Perfil público com GitHub e X vinculados.", url: "https://developers.forem.com/api", access: "free", limits: "API pública sem chave.", probe: "live" },
];

/* ------------------------------------------------------------------ */
/* Framework library                                                   */
/* ------------------------------------------------------------------ */

export type FrameworkEntry = {
  name: string;
  category: string;
  description: string;
  url: string;
  access: AccessKind;
  needsKey: boolean;
  status: "available" | "limited" | "external" | "paid";
  limitations?: string;
  internal?: string; // path to the internal tool implementing it
};

export const FRAMEWORK: FrameworkEntry[] = [
  { name: "RDAP Domain Lookup", category: "Domain Research", description: "Registro, registrador, datas e nameservers via RDAP.", url: "https://rdap.org", access: "free", needsKey: false, status: "available", internal: "/agency/domain" },
  { name: "DNS over HTTPS", category: "Domain Research", description: "Consulta A/AAAA/MX/TXT/NS/SOA/CAA/DNSSEC via Google e Cloudflare.", url: "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/", access: "free", needsKey: false, status: "available", internal: "/agency/domain" },
  { name: "crt.sh Certificate Search", category: "Domain Research", description: "Subdomínios por Certificate Transparency.", url: "https://crt.sh", access: "free", needsKey: false, status: "limited", limitations: "Consultas com wildcard em domínios grandes podem expirar (timeout do próprio crt.sh).", internal: "/agency/domain" },
  { name: "Wayback Machine", category: "Domain Research", description: "Histórico de capturas de páginas.", url: "https://web.archive.org", access: "free", needsKey: false, status: "available", internal: "/agency/domain" },
  { name: "RIPEstat", category: "IP Research", description: "ASN, prefixos, vizinhos e status de roteamento.", url: "https://stat.ripe.net", access: "free", needsKey: false, status: "available", internal: "/agency/ip" },
  { name: "Team Cymru IP to ASN", category: "IP Research", description: "Origem ASN via DNS reverso.", url: "https://team-cymru.com/community-services/ip-asn-mapping/", access: "free", needsKey: false, status: "available", internal: "/agency/ip" },
  { name: "ipwho.is", category: "IP Research", description: "Geolocalização aproximada de IP.", url: "https://ipwho.is", access: "free", needsKey: false, status: "limited", limitations: "Precisão por cidade é aproximada e pode estar incorreta.", internal: "/agency/ip" },
  { name: "BGP.tools", category: "IP Research", description: "Consulta visual de rotas e ASNs.", url: "https://bgp.tools", access: "link", needsKey: false, status: "external", limitations: "Sem API pública aberta; acesso via site oficial.", internal: "/agency/network" },
  { name: "WhatsMyName (conceito)", category: "Username Research", description: "Verificação de perfis públicos por plataforma.", url: "https://whatsmyname.app", access: "free", needsKey: false, status: "limited", limitations: "Algumas plataformas bloqueiam requisições de datacenter (403/429).", internal: "/agency/username" },
  { name: "GitHub Users API", category: "Username Research", description: "Perfil e repositórios públicos.", url: "https://docs.github.com/rest/users", access: "free", needsKey: false, status: "available", limitations: "60 requisições por hora sem token.", internal: "/agency/username" },
  { name: "Reddit JSON", category: "Username Research", description: "Perfil público e conteúdo recente.", url: "https://www.reddit.com/dev/api/", access: "free", needsKey: false, status: "limited", limitations: "Reddit bloqueia IPs de datacenter com frequência.", internal: "/agency/username" },
  { name: "Sherlock Project (MIT)", category: "Username Research", description: "Catálogo aberto de 464 sites usado na varredura estendida.", url: "https://github.com/sherlock-project/sherlock", access: "free", needsKey: false, status: "available", limitations: "SPAs podem devolver 200 para perfis inexistentes; bloqueios de datacenter aparecem como tal.", internal: "/agency/identity" },
  { name: "Keybase proofs", category: "Username Research", description: "Provas criptográficas ligando contas de várias plataformas.", url: "https://keybase.io", access: "free", needsKey: false, status: "available", limitations: "Depende de o titular ter publicado as provas.", internal: "/agency/identity" },
  { name: "Gravatar", category: "Email Research", description: "Perfil público e contas vinculadas a um e-mail.", url: "https://gravatar.com", access: "free", needsKey: false, status: "available", limitations: "Só existe quando o perfil é público.", internal: "/agency/identity" },
  { name: "SPF / DMARC / DKIM (DNS)", category: "Email Research", description: "Validação de políticas de e-mail via TXT DNS.", url: "https://dns.google", access: "free", needsKey: false, status: "available", internal: "/agency/email" },
  { name: "Have I Been Pwned", category: "Email Research", description: "Consulta de exposição a vazamentos.", url: "https://haveibeenpwned.com/API/v3", access: "key-optional", needsKey: true, status: "limited", limitations: "A API de e-mail exige chave paga; o catálogo de breaches é público.", internal: "/agency/email" },
  { name: "Reddit Search", category: "Social Media Research", description: "Busca pública de posts e comunidades.", url: "https://www.reddit.com/search/", access: "free", needsKey: false, status: "limited", limitations: "Sujeito a bloqueio de datacenter.", internal: "/agency/social" },
  { name: "Mastodon Public API", category: "Social Media Research", description: "Busca pública por hashtag/status em instâncias abertas.", url: "https://docs.joinmastodon.org/methods/", access: "free", needsKey: false, status: "external", limitations: "Cada instância define limites e escopo da busca.", internal: "/agency/social" },
  { name: "Google / Bing / DuckDuckGo operators", category: "Social Media Research", description: "Operadores de busca aplicados a redes públicas.", url: "https://duckduckgo.com", access: "link", needsKey: false, status: "external", internal: "/agency/social" },
  { name: "EXIF local (exifr)", category: "Image Research", description: "Leitura local de metadados de imagem.", url: "https://github.com/MikeKovarik/exifr", access: "client", needsKey: false, status: "available", internal: "/agency/image" },
  { name: "Reverse image search", category: "Image Research", description: "Links diretos para Google Lens, Bing, Yandex e TinEye.", url: "https://tineye.com", access: "link", needsKey: false, status: "external", internal: "/agency/image" },
  { name: "PDF / OOXML metadata (local)", category: "Document Research", description: "Extração local de propriedades e estrutura.", url: "https://www.loc.gov/preservation/digital/formats/fdd/fdd000125.shtml", access: "client", needsKey: false, status: "available", internal: "/agency/document" },
  { name: "BrasilAPI CNPJ", category: "Company Research", description: "Dados públicos de empresas brasileiras.", url: "https://brasilapi.com.br/docs", access: "free", needsKey: false, status: "available", internal: "/agency/company" },
  { name: "NIST NVD", category: "Cyber Threat Research", description: "Base oficial de vulnerabilidades.", url: "https://nvd.nist.gov", access: "free", needsKey: false, status: "available", internal: "/agency/cyber" },
  { name: "CISA KEV", category: "Cyber Threat Research", description: "Catálogo de vulnerabilidades exploradas.", url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", access: "free", needsKey: false, status: "available", internal: "/agency/cyber" },
  { name: "OSV.dev", category: "Cyber Threat Research", description: "Vulnerabilidades de dependências open-source.", url: "https://osv.dev", access: "free", needsKey: false, status: "available", internal: "/agency/cyber" },
  { name: "abuse.ch URLhaus", category: "Cyber Threat Research", description: "URLs maliciosas e hosts comprometidos.", url: "https://urlhaus.abuse.ch", access: "free", needsKey: false, status: "available", internal: "/agency/cyber" },
  { name: "abuse.ch MalwareBazaar", category: "Cyber Threat Research", description: "Metadados de amostras por hash.", url: "https://bazaar.abuse.ch", access: "free", needsKey: false, status: "available", internal: "/agency/cyber" },
  { name: "abuse.ch ThreatFox", category: "Cyber Threat Research", description: "IOCs comunitários de C2.", url: "https://threatfox.abuse.ch", access: "free", needsKey: false, status: "available", internal: "/agency/threat" },
  { name: "OpenStreetMap + Leaflet", category: "Geospatial Research", description: "Mapas abertos e camadas GeoJSON/KML.", url: "https://www.openstreetmap.org", access: "free", needsKey: false, status: "available", internal: "/agency/geospatial" },
  { name: "Nominatim", category: "Geospatial Research", description: "Geocodificação de endereços públicos.", url: "https://nominatim.org", access: "key-optional", needsKey: false, status: "external", limitations: "Uso máximo de 1 req/s e atribuição obrigatória; usado apenas como link.", internal: "/agency/geospatial" },
];

/* ------------------------------------------------------------------ */
/* Tool registry (used by Quick Search, dashboard, Tool Builder)        */
/* ------------------------------------------------------------------ */

export type ToolDef = {
  id: string;
  name: string;
  page: ToolPageKey;
  description: string;
  input: "domain" | "ip" | "url" | "username" | "email" | "hash" | "cve" | "asn" | "company" | "file" | "text" | "coords";
  source: string;
  access: AccessKind;
};

export const TOOLS: ToolDef[] = [
  { id: "domain-lookup", name: "Domain Lookup (RDAP)", page: "domain", description: "Registro, registrador, datas e status via RDAP.", input: "domain", source: "rdap", access: "free" },
  { id: "dns-lookup", name: "DNS Lookup", page: "domain", description: "Registros DNS completos e DNSSEC.", input: "domain", source: "google-dns", access: "free" },
  { id: "subdomain-finder", name: "Subdomain Finder", page: "domain", description: "Subdomínios por Certificate Transparency.", input: "domain", source: "crt-sh", access: "free" },
  { id: "ssl-analyzer", name: "SSL Analyzer", page: "domain", description: "Emissor, validade e SANs de certificados públicos.", input: "domain", source: "crt-sh", access: "free" },
  { id: "website-analyzer", name: "Website Analyzer", page: "domain", description: "Status, headers, tecnologias, robots e sitemap.", input: "domain", source: "live", access: "free" },
  { id: "wayback", name: "Historical Domain Intelligence", page: "domain", description: "Capturas históricas da Wayback Machine.", input: "domain", source: "wayback", access: "free" },
  { id: "ip-lookup", name: "IP Lookup", page: "ip", description: "ASN, prefixo, país e rede via RDAP/RIPEstat.", input: "ip", source: "ripestat", access: "free" },
  { id: "ip-geo", name: "IP Geolocation", page: "ip", description: "Localização aproximada de IP.", input: "ip", source: "ipwhois", access: "free" },
  { id: "reverse-dns", name: "Reverse DNS", page: "ip", description: "PTR do endereço IP.", input: "ip", source: "google-dns", access: "free" },
  { id: "asn-lookup", name: "ASN Lookup", page: "network", description: "Detalhes e prefixos anunciados por ASN.", input: "asn", source: "ripestat", access: "free" },
  { id: "bgp-lookup", name: "BGP Prefix Lookup", page: "network", description: "Status de roteamento e origem BGP.", input: "ip", source: "ripestat", access: "free" },
  { id: "dns-propagation", name: "DNS Propagation Checker", page: "network", description: "Compara respostas entre resolvers públicos.", input: "domain", source: "google-dns", access: "free" },
  { id: "username-search", name: "Username Search", page: "username", description: "Perfis públicos por username em múltiplas plataformas.", input: "username", source: "live", access: "free" },
  { id: "github-user", name: "GitHub Username Lookup", page: "username", description: "Perfil e repositórios públicos.", input: "username", source: "github", access: "free" },
  { id: "reddit-user", name: "Reddit Username Lookup", page: "username", description: "Perfil e atividade pública.", input: "username", source: "reddit", access: "free" },
  { id: "email-analysis", name: "Email Domain Intelligence", page: "email", description: "MX, SPF, DMARC, DKIM e provedor.", input: "email", source: "google-dns", access: "free" },
  { id: "breach-check", name: "Breach Notification Lookup", page: "email", description: "Catálogo público HIBP (e checagem com chave opcional).", input: "email", source: "hibp", access: "key-optional" },
  { id: "url-analyzer", name: "URL Analysis", page: "web", description: "Redirects, headers, reputação e indicadores.", input: "url", source: "live", access: "free" },
  { id: "urlhaus-url", name: "URLhaus Lookup", page: "web", description: "Verificação de URL em base de malware.", input: "url", source: "urlhaus", access: "free" },
  { id: "cve-lookup", name: "CVE Lookup", page: "cyber", description: "Detalhes NVD, CVSS, KEV e EPSS.", input: "cve", source: "nvd", access: "free" },
  { id: "cve-search", name: "NVD Search", page: "cyber", description: "Busca por palavra-chave/produto.", input: "text", source: "nvd", access: "free" },
  { id: "kev", name: "CISA KEV Lookup", page: "cyber", description: "Exploração ativa confirmada.", input: "cve", source: "kev", access: "free" },
  { id: "osv", name: "OSV Vulnerability Database", page: "cyber", description: "Vulnerabilidades de pacotes open-source.", input: "text", source: "osv", access: "free" },
  { id: "hash-lookup", name: "Hash / Malware Lookup", page: "cyber", description: "MalwareBazaar por hash.", input: "hash", source: "malwarebazaar", access: "free" },
  { id: "threatfox", name: "ThreatFox Search", page: "threat", description: "IOC de C2 comunitário.", input: "text", source: "threatfox", access: "free" },
  { id: "cnpj", name: "Company Search (CNPJ)", page: "company", description: "Dados públicos de empresas brasileiras.", input: "company", source: "brasilapi", access: "free" },
];

/** Tools suggested for a detected input kind. */
export function suggestionsFor(kind: string): ToolDef[] {
  const map: Record<string, string[]> = {
    domain: ["domain-lookup", "dns-lookup", "subdomain-finder", "ssl-analyzer", "website-analyzer", "wayback", "dns-propagation"],
    ip: ["ip-lookup", "ip-geo", "reverse-dns", "bgp-lookup", "asn-lookup"],
    url: ["url-analyzer", "urlhaus-url", "website-analyzer", "ssl-analyzer"],
    username: ["username-search", "github-user", "reddit-user"],
    email: ["email-analysis", "breach-check"],
    hash: ["hash-lookup"],
    cve: ["cve-lookup", "kev", "cve-search"],
    asn: ["asn-lookup", "bgp-lookup"],
    company: ["cnpj", "website-analyzer", "subdomain-finder"],
    text: ["cve-search", "osv", "threatfox"],
  };
  const ids = map[kind] ?? [];
  return ids.map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean) as ToolDef[];
}

export type InputKind = "domain" | "ip" | "url" | "username" | "email" | "hash" | "cve" | "asn" | "company" | "text";

const IPV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^(([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|([0-9a-f]{1,4}:){1,6}:[0-9a-f]{1,4}|::([0-9a-f]{1,4}:){0,6}[0-9a-f]{1,4}|([0-9a-f]{1,4}:){1,7}:|::1|::)$/i;
const DOMAIN = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

/** Detect the kind of an arbitrary user input. */
export function detectInput(raw: string): InputKind {
  const v = raw.trim();
  if (!v) return "text";
  if (IPV4.test(v)) return "ip";
  if (IPV6.test(v)) return "ip";
  if (/^https?:\/\//i.test(v)) return "url";
  if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(v)) return "email";
  if (/^cve-\d{4}-\d{4,}$/i.test(v)) return "cve";
  if (/^as\d+$/i.test(v)) return "asn";
  if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(v)) return "hash";
  if (/^(?:\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|[A-Z0-9]{12}\d{2})$/i.test(v)) return "company";
  if (DOMAIN.test(v)) return "domain";
  if (/^[a-z0-9._-]{3,32}$/i.test(v)) return "username";
  return "text";
}

export const APP_VERSION = "3.0";
export const APP_NAME = "Life Agency";
export const APP_SLOGAN = "Intelligence. Investigation. Insight.";
