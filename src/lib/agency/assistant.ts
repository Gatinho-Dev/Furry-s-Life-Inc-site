/**
 * Life Intelligence AI — deterministic analysis engine.
 * It never invents data: every statement is derived from evidence stored in the
 * investigation, and gaps are reported as limitations.
 */

import type { Investigation } from "./store";

export type AnalysisSection = {
  facts: string[];
  unconfirmed: string[];
  hypotheses: string[];
  limitations: string[];
  suggestions: string[];
};

export function analyzeInvestigation(inv: Investigation): AnalysisSection {
  const facts: string[] = [];
  const unconfirmed: string[] = [];
  const hypotheses: string[] = [];
  const limitations: string[] = [];
  const suggestions: string[] = [];

  const byTool = new Map<string, number>();
  for (const ev of inv.evidence) byTool.set(ev.tool, (byTool.get(ev.tool) ?? 0) + 1);

  if (!inv.evidence.length) {
    limitations.push("Nenhuma evidência coletada ainda: não há base factual para conclusões.");
  }

  for (const ev of inv.evidence) {
    const data = ev.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") continue;

    if (ev.toolId === "domain-lookup") {
      const rdap = data.rdap as { registrar?: string; created?: string; expires?: string; nameservers?: string[] } | null;
      if (rdap?.registrar) facts.push(`${ev.input}: registrador declarado no RDAP é ${rdap.registrar}${rdap.created ? `, criado em ${rdap.created.slice(0, 10)}` : ""}.`);
      if (rdap?.expires) facts.push(`${ev.input}: expiração registrada em ${rdap.expires.slice(0, 10)}.`);
      if (!rdap) limitations.push(`${ev.input}: o RDAP não retornou registro — dados de propriedade não confirmados.`);
    }

    if (ev.toolId === "dns-lookup") {
      const records = data.records as Record<string, Array<{ value: string }>> | undefined;
      if (records) {
        const parts = Object.entries(records).filter(([, v]) => v.length).map(([k, v]) => `${k} (${v.length})`);
        facts.push(`${ev.input}: registros DNS observados — ${parts.join(", ")}.`);
      }
      if (data.dnssecValidated === false) unconfirmed.push(`${ev.input}: DNSSEC não validado na resposta consultada.`);
    }

    if (ev.toolId === "ip-lookup") {
      const network = data.network as { asn?: string; organization?: string; prefix?: string } | undefined;
      const geo = data.geo as { country?: string; city?: string } | null;
      if (network?.asn) facts.push(`${ev.input}: anunciado por ${network.asn}${network.organization ? ` (${network.organization})` : ""}${network.prefix ? `, prefixo ${network.prefix}` : ""}.`);
      if (geo?.country) facts.push(`${ev.input}: geolocalização aproximada em ${geo.city ? `${geo.city}, ` : ""}${geo.country}.`);
    }

    if (ev.toolId === "cve-lookup") {
      const kev = data.kev as { dateAdded?: string } | null;
      const metrics = data.metrics as { score?: number; severity?: string } | null;
      if (data.found) facts.push(`${ev.input}: publicada no NVD${metrics?.score ? ` com CVSS ${metrics.score} (${metrics.severity})` : ""}.`);
      if (kev) facts.push(`${ev.input}: presente no catálogo CISA KEV desde ${kev.dateAdded} — exploração ativa confirmada.`);
    }

    if (ev.toolId === "website-analyzer") {
      const techs = data.technologies as Array<{ name: string }> | undefined;
      if (techs?.length) facts.push(`${ev.input}: tecnologias observadas — ${techs.slice(0, 8).map((t) => t.name).join(", ")}.`);
      const headers = data.securityHeaders as Array<{ header: string; present: boolean }> | undefined;
      if (headers) {
        const missing = headers.filter((h) => !h.present).map((h) => h.header);
        if (missing.length) unconfirmed.push(`${ev.input}: headers de segurança ausentes (${missing.slice(0, 4).join(", ")}).`);
      }
    }

    if (ev.toolId === "url-analyzer") {
      const indicators = data.indicators as Array<{ label: string; severity: string }> | undefined;
      if (indicators?.length) unconfirmed.push(`${ev.input}: ${indicators.length} indicador(es) heurísticos (${indicators.slice(0, 3).map((i) => i.label).join("; ")}), não confirmados por fonte externa.`);
    }

    if (ev.toolId === "subdomain-finder") {
      const total = data.total as number | undefined;
      if (typeof total === "number") facts.push(`${ev.input}: ${total} nomes distintos observados em Certificate Transparency.`);
    }

    if (ev.toolId === "username-search") {
      const found = data.found as number | undefined;
      if (typeof found === "number") unconfirmed.push(`${ev.input}: ${found} perfis públicos com o mesmo username — a identidade não está comprovada.`);
    }

    if (ev.toolId.startsWith("identity-")) {
      const profiles = (data.profiles as unknown[] | undefined)?.length ?? 0;
      const rows = (data.signals as Array<{ confidence?: string }> | undefined) ?? [];
      const confirmed = rows.filter((s) => s.confidence === "confirmed").length;
      const probable = rows.filter((s) => s.confidence === "probable").length;
      if (profiles) facts.push(`${ev.input}: ${profiles} perfil(is) público(s) consolidado(s) por ${ev.tool}.`);
      if (confirmed) facts.push(`${ev.input}: ${confirmed} sinal(is) confirmado(s) por declaração/prova da própria fonte em ${ev.tool}.`);
      if (probable) unconfirmed.push(`${ev.input}: ${probable} sinal(is) provável(is) em ${ev.tool} dependem de confirmação humana.`);
      if (ev.toolId === "identity-correlation") hypotheses.push(`${ev.input}: correlações derivadas (avatar/contato) são compatíveis com a mesma pessoa, mas não a comprovam.`);
    }

    if (ev.toolId === "cnpj") {
      const company = data.company as { legalName?: string; status?: string } | undefined;
      if (company?.legalName) facts.push(`${ev.input}: ${company.legalName} — situação cadastral ${company.status ?? "não informada"}.`);
    }
  }

  if (inv.entities.length) {
    const kinds = new Map<string, number>();
    for (const e of inv.entities) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1);
    facts.push(`O caso reúne ${inv.entities.length} entidades registradas (${[...kinds.entries()].map(([k, v]) => `${v} ${k}`).join(", ")}).`);
  }

  if (inv.entities.length > 1 && !inv.evidence.some((e) => e.toolId === "domain-lookup" || e.toolId === "ip-lookup")) {
    hypotheses.push("Há múltiplas entidades, mas nenhuma consulta de registro/rede que permita afirmar relação técnica entre elas.");
  }

  const kinds = new Set(inv.entities.map((e) => e.kind));
  if (kinds.has("domain")) suggestions.push("Executar Domain Lookup, DNS Lookup e Subdomain Finder para o domínio principal.");
  if (kinds.has("ip")) suggestions.push("Executar IP Lookup e BGP Prefix Lookup para confirmar ASN e prefixo.");
  if (kinds.has("email")) suggestions.push("Executar Email Intelligence (SPF/DMARC/DKIM) e o catálogo público de vazamentos.");
  if (kinds.has("username")) suggestions.push("Comparar perfis públicos com evidências visuais (avatar, bio, links) antes de correlacionar.");
  if (kinds.has("cve")) suggestions.push("Consultar EPSS e CISA KEV para priorizar a vulnerabilidade.");
  if (inv.evidence.length > 0 && !inv.conclusion.trim()) suggestions.push("Registrar a conclusão analítica separando fatos de hipóteses.");

  if (byTool.size) {
    facts.push(`Ferramentas com evidência registrada: ${[...byTool.entries()].map(([k, v]) => `${k} (${v})`).join(", ")}.`);
  }

  if (!inv.evidence.some((e) => /geo|ip/i.test(e.toolId))) limitations.push("Nenhuma evidência de rede/geolocalização registrada.");
  limitations.push("A plataforma não executa varreduras ativas, não acessa conteúdo privado e não confirma identidade de pessoas.");
  if (inv.evidence.some((e) => e.toolId === "username-search")) limitations.push("Coincidência de username é indício fraco e não prova que contas pertencem à mesma pessoa.");

  return { facts, unconfirmed, hypotheses, limitations, suggestions };
}

export function executiveSummary(inv: Investigation, analysis: AnalysisSection): string {
  const parts: string[] = [];
  parts.push(`A investigação ${inv.code} ("${inv.name}") reúne ${inv.evidence.length} evidência(s) e ${inv.entities.length} entidade(s).`);
  if (inv.objective) parts.push(`Objetivo declarado: ${inv.objective}`);
  if (analysis.facts.length) parts.push(`Foram confirmados ${analysis.facts.length} pontos a partir de fontes públicas identificadas.`);
  if (analysis.unconfirmed.length) parts.push(`${analysis.unconfirmed.length} ponto(s) permanecem não confirmados ou dependem de validação adicional.`);
  if (inv.conclusion) parts.push(`Conclusão registrada pelo analista: ${inv.conclusion}`);
  else parts.push("Não há conclusão formal registrada pelo analista.");
  return parts.join(" ");
}
