/** Professional report generation (HTML for PDF/print, JSON and CSV). */

import type { GraphDoc, Investigation } from "./store";
import { analyzeInvestigation, executiveSummary } from "./assistant";
import { STATUS_LABELS } from "./types";

export type ReportType = "domain" | "ip" | "cyber" | "company" | "investigation" | "full";

export const REPORT_TYPES: Array<{ id: ReportType; label: string; scope: string }> = [
  { id: "domain", label: "Domain Intelligence Report", scope: "Registro, DNS, certificados, tecnologias e histórico de domínios." },
  { id: "ip", label: "IP Intelligence Report", scope: "Rede, ASN, prefixo, PTR, geolocalização aproximada e reputação." },
  { id: "cyber", label: "Cyber Threat Report", scope: "Vulnerabilidades, exploração ativa, IOCs e postura de segurança." },
  { id: "company", label: "Company Intelligence Report", scope: "Cadastro público, presença digital e infraestrutura corporativa." },
  { id: "investigation", label: "Digital Investigation Report", scope: "Caso completo: entidades, evidências, relações e conclusão." },
  { id: "full", label: "Full OSINT Report", scope: "Consolidação integral de todas as evidências e fontes do caso." },
];

export type ReportOptions = {
  type: ReportType;
  classification: string;
  analyst: string;
  includeData: boolean;
  graph?: GraphDoc | null;
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildReportHtml(inv: Investigation, opts: ReportOptions): string {
  const analysis = analyzeInvestigation(inv);
  const summary = executiveSummary(inv, analysis);
  const type = REPORT_TYPES.find((t) => t.id === opts.type) ?? REPORT_TYPES[4];
  const tools = [...new Set(inv.evidence.map((e) => e.tool))];
  const sources = [...new Set(inv.evidence.map((e) => e.source))];
  const generated = new Date().toLocaleString("pt-BR");

  const evidenceBlocks = inv.evidence.map((ev) => `
    <article class="evidence">
      <h4>${esc(ev.tool)} <span class="muted">· ${esc(ev.source)}</span></h4>
      <p class="mono small">Entrada: ${esc(ev.input || "—")} · Data: ${esc(new Date(ev.at).toLocaleString("pt-BR"))}</p>
      <p>${esc(ev.summary)}</p>
      ${opts.includeData && ev.data ? `<pre>${esc(JSON.stringify(ev.data, null, 2).slice(0, 6000))}</pre>` : ""}
    </article>`).join("");

  const entityRows = inv.entities.map((e) => `
    <tr><td>${esc(e.kind)}</td><td class="mono">${esc(e.value)}</td><td>${esc(e.source)}</td><td>${esc(e.confidence)}</td><td>${esc(new Date(e.at).toLocaleDateString("pt-BR"))}</td></tr>`).join("");

  const graphSection = opts.graph && opts.graph.edges.length
    ? `<table><thead><tr><th>Origem</th><th>Relação</th><th>Destino</th><th>Fonte</th><th>Confiança</th><th>Data</th></tr></thead><tbody>
        ${opts.graph.edges.map((e) => {
          const from = opts.graph!.nodes.find((n) => n.id === e.from)?.label ?? e.from;
          const to = opts.graph!.nodes.find((n) => n.id === e.to)?.label ?? e.to;
          return `<tr><td class="mono">${esc(from)}</td><td>${esc(e.label)}</td><td class="mono">${esc(to)}</td><td>${esc(e.source)}</td><td>${esc(e.confidence)}</td><td>${esc(new Date(e.at).toLocaleString("pt-BR"))}</td></tr>`;
        }).join("")}
      </tbody></table>`
    : `<p>${opts.graph ? "O grafo selecionado não possui conexões registradas." : "Nenhum grafo de relacionamentos vinculado a este relatório."}</p>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(type.label)} — ${esc(inv.code)}</title>
<style>
  :root { --ink:#111827; --muted:#5b6678; --line:#dfe4ec; --accent:#1d4ed8; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color:var(--ink); background:#fff; font-size:11.5px; line-height:1.55; }
  .page { max-width: 820px; margin: 0 auto; padding: 40px 46px 56px; }
  .cover { min-height: 900px; display:flex; flex-direction:column; justify-content:space-between; page-break-after: always; border-left: 6px solid var(--accent); padding-left: 28px; }
  .brand { font-family: "Space Grotesk", sans-serif; letter-spacing:.32em; text-transform:uppercase; font-size:11px; color:var(--muted); }
  .cover h1 { font-family: "Space Grotesk", sans-serif; font-size: 34px; line-height:1.15; margin: 18px 0 8px; }
  .cover .type { font-size: 13px; color: var(--accent); font-weight:600; letter-spacing:.08em; text-transform:uppercase; }
  .cover .case { margin-top:26px; border-top:1px solid var(--line); padding-top:18px; }
  .cover .meta { margin-top: 30px; font-size: 11px; color: var(--muted); }
  .classification { display:inline-block; border:1px solid var(--ink); padding:3px 10px; font-size:9.5px; letter-spacing:.16em; text-transform:uppercase; }
  h2 { font-family:"Space Grotesk", sans-serif; font-size: 17px; margin: 30px 0 10px; padding-bottom:6px; border-bottom:1px solid var(--line); }
  h2 span { color: var(--accent); margin-right: 8px; font-size: 13px; }
  h3 { font-size: 13px; margin: 18px 0 6px; }
  h4 { font-size: 12px; margin: 0 0 4px; }
  p { margin: 0 0 9px; }
  table { width:100%; border-collapse: collapse; font-size:10.5px; margin: 8px 0 14px; }
  th, td { text-align:left; border-bottom:1px solid var(--line); padding:6px 7px; vertical-align:top; }
  th { background:#f4f6fa; font-size:9.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:10px; word-break: break-all; }
  .small { font-size:10px; color:var(--muted); }
  .muted { color: var(--muted); font-weight:400; }
  .evidence { border:1px solid var(--line); border-radius:6px; padding:10px 12px; margin-bottom:10px; page-break-inside: avoid; }
  pre { background:#0f172a; color:#e2e8f0; padding:9px 11px; border-radius:5px; font-size:9px; overflow:auto; max-height: 280px; white-space:pre-wrap; }
  .box { border-left:3px solid var(--accent); background:#f6f8fd; padding:10px 12px; margin: 10px 0; }
  .grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 22px; font-size:10.5px; }
  .grid div { border-bottom:1px solid var(--line); padding-bottom:4px; }
  .k { color: var(--muted); font-size:9.5px; text-transform:uppercase; letter-spacing:.07em; }
  ul { margin: 4px 0 12px 18px; padding:0; }
  li { margin-bottom: 4px; }
  footer { margin-top: 34px; border-top:1px solid var(--line); padding-top: 10px; font-size:9.5px; color:var(--muted); }
  @page { size: A4; margin: 16mm; }
  @media print { .page { padding: 0; max-width: none; } .cover { min-height: auto; } }
</style></head>
<body><div class="page">
  <section class="cover">
    <div>
      <div class="brand">Life Agency · Intelligence. Investigation. Insight.</div>
      <div class="type">${esc(type.label)}</div>
      <h1>${esc(inv.name)}</h1>
      <p class="muted">${esc(type.scope)}</p>
      <div class="case">
        <div class="grid">
          <div><span class="k">Investigation ID</span><br />${esc(inv.code)}</div>
          <div><span class="k">Status</span><br />${esc(STATUS_LABELS[inv.status])}</div>
          <div><span class="k">Analista</span><br />${esc(opts.analyst || "Não informado")}</div>
          <div><span class="k">Gerado em</span><br />${esc(generated)}</div>
          <div><span class="k">Evidências</span><br />${inv.evidence.length}</div>
          <div><span class="k">Entidades</span><br />${inv.entities.length}</div>
        </div>
      </div>
    </div>
    <div class="meta">
      <span class="classification">${esc(opts.classification)}</span>
      <p style="margin-top:14px">Documento gerado automaticamente pela plataforma Life Agency a partir de fontes públicas.
      Não contém dados privados, credenciais ou conteúdo obtido por acesso não autorizado.</p>
    </div>
  </section>

  <h2><span>01</span>Identificação</h2>
  <table><tbody>
    <tr><th>Investigação</th><td>${esc(inv.name)} (${esc(inv.code)})</td></tr>
    <tr><th>Descrição</th><td>${esc(inv.description || "—")}</td></tr>
    <tr><th>Tags</th><td>${esc(inv.tags.join(", ") || "—")}</td></tr>
    <tr><th>Criação</th><td>${esc(new Date(inv.createdAt).toLocaleString("pt-BR"))}</td></tr>
    <tr><th>Última atualização</th><td>${esc(new Date(inv.updatedAt).toLocaleString("pt-BR"))}</td></tr>
  </tbody></table>

  <h2><span>02</span>Resumo executivo</h2>
  <div class="box">${esc(summary)}</div>

  <h2><span>03</span>Objetivo</h2>
  <p>${esc(inv.objective || "Objetivo não declarado pelo analista.")}</p>

  <h2><span>04</span>Metodologia</h2>
  <p>Coleta passiva em fontes públicas e gratuitas: RDAP, DNS over HTTPS, Certificate Transparency, bases de roteamento (RIPEstat/Team Cymru),
  catálogos oficiais de vulnerabilidades (NIST NVD, CISA KEV), OSV, EPSS, Wayback Machine, APIs públicas de perfis e dados abertos governamentais.
  Nenhuma varredura ativa, exploração ou acesso autenticado foi realizado. Resultados foram registrados com fonte e horário.</p>

  <h2><span>05</span>Ferramentas utilizadas</h2>
  ${tools.length ? `<ul>${tools.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "<p>Nenhuma ferramenta registrada.</p>"}

  <h2><span>06</span>Fontes consultadas</h2>
  ${sources.length ? `<ul>${sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : "<p>Nenhuma fonte registrada.</p>"}

  <h2><span>07</span>Resultados</h2>
  ${inv.evidence.length ? `<table><thead><tr><th>Ferramenta</th><th>Entrada</th><th>Fonte</th><th>Data</th></tr></thead><tbody>
    ${inv.evidence.map((e) => `<tr><td>${esc(e.tool)}</td><td class="mono">${esc(e.input || "—")}</td><td>${esc(e.source)}</td><td>${esc(new Date(e.at).toLocaleString("pt-BR"))}</td></tr>`).join("")}
  </tbody></table>` : "<p>Nenhum resultado registrado.</p>"}

  <h2><span>08</span>Evidências</h2>
  ${evidenceBlocks || "<p>Nenhuma evidência detalhada.</p>"}

  <h2><span>09</span>Relacionamentos</h2>
  ${inv.entities.length ? `<table><thead><tr><th>Tipo</th><th>Valor</th><th>Fonte</th><th>Confiança</th><th>Registro</th></tr></thead><tbody>${entityRows}</tbody></table>` : "<p>Nenhuma entidade registrada.</p>"}
  <h3>Conexões mapeadas</h3>
  ${graphSection}

  <h2><span>10</span>Indicadores de confiança</h2>
  <h3>Fatos confirmados</h3>
  ${analysis.facts.length ? `<ul>${analysis.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "<p>Nenhum fato confirmado.</p>"}
  <h3>Informações não confirmadas</h3>
  ${analysis.unconfirmed.length ? `<ul>${analysis.unconfirmed.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "<p>Nenhum ponto pendente.</p>"}
  <h3>Hipóteses</h3>
  ${analysis.hypotheses.length ? `<ul>${analysis.hypotheses.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "<p>Nenhuma hipótese registrada.</p>"}

  <h2><span>11</span>Limitações</h2>
  <ul>${analysis.limitations.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>

  <h2><span>12</span>Conclusão</h2>
  <p>${esc(inv.conclusion || "Conclusão não registrada pelo analista.")}</p>

  <h2><span>13</span>Notas do analista</h2>
  ${inv.notes.length ? inv.notes.map((n) => `<div class="evidence"><p>${esc(n.body)}</p><p class="small">${esc(new Date(n.at).toLocaleString("pt-BR"))}</p></div>`).join("") : "<p>Nenhuma nota.</p>"}

  <h2><span>14</span>Data de geração</h2>
  <p>${esc(generated)} · Life Agency ${esc(opts.classification)}</p>

  <footer>
    Life Agency — OSINT &amp; Cyber Intelligence · Intelligence. Investigation. Insight.<br />
    Documento produzido com informações públicas. Coincidências de identificadores não constituem prova de identidade ou vínculo entre pessoas.
  </footer>
</div></body></html>`;
}

export function buildReportJson(inv: Investigation, opts: ReportOptions) {
  const analysis = analyzeInvestigation(inv);
  return {
    report: {
      type: opts.type,
      title: (REPORT_TYPES.find((t) => t.id === opts.type) ?? REPORT_TYPES[4]).label,
      classification: opts.classification,
      analyst: opts.analyst || null,
      generatedAt: new Date().toISOString(),
      generator: "Life Agency v3.0",
    },
    investigation: inv,
    analysis,
    executiveSummary: executiveSummary(inv, analysis),
    graph: opts.graph ?? null,
    limitations: analysis.limitations,
  };
}

export function buildReportCsv(inv: Investigation) {
  const rows: Array<Record<string, unknown>> = [];
  for (const e of inv.entities) rows.push({ tipo: "entidade", categoria: e.kind, valor: e.value, fonte: e.source, confianca: e.confidence, data: e.at, detalhe: "" });
  for (const e of inv.evidence) rows.push({ tipo: "evidencia", categoria: e.toolId, valor: e.input, fonte: e.source, confianca: "", data: e.at, detalhe: e.summary });
  for (const n of inv.notes) rows.push({ tipo: "nota", categoria: "", valor: n.body, fonte: "analista", confianca: "", data: n.at, detalhe: "" });
  return rows;
}
