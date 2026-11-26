/**
 * Report generation from stored case data only.
 * Formats: HTML (printable), JSON, CSV, PDF (jsPDF, text) and PNG (canvas).
 */

import { caseStats } from "./store";
import { executiveSummary } from "./ai";
import {
  CASE_STATUS_LABEL, CONFIDENCE_LABEL, NODE_KIND_LABEL,
  type PaletteCase, type PaletteEdge, type PaletteNode,
} from "./types";

export type ReportType = "summary" | "full" | "entities" | "relationships" | "cyber" | "evidence";

export const REPORT_LABEL: Record<ReportType, string> = {
  summary: "Investigation Summary",
  full: "Full OSINT Report",
  entities: "Entity Report",
  relationships: "Relationship Report",
  cyber: "Cyber Intelligence Report",
  evidence: "Evidence Report",
};

export type ReportDoc = {
  title: string;
  subtitle: string;
  meta: Array<{ label: string; value: string }>;
  sections: Array<{ heading: string; paragraphs: string[]; table?: { columns: string[]; rows: string[][] } }>;
  generatedAt: string;
};

function nodeLine(n: PaletteNode): string {
  return `${NODE_KIND_LABEL[n.kind]} · ${n.title} · ${CONFIDENCE_LABEL[n.confidence]} · fontes: ${n.sources.join(", ") || "nenhuma"} · evidências: ${n.evidenceIds.length}`;
}

function edgeLine(c: PaletteCase, e: PaletteEdge): string {
  const name = (id: string) => c.nodes.find((n) => n.id === id)?.title ?? id;
  return `${name(e.source)} → ${name(e.target)} · ${e.relation} · ${CONFIDENCE_LABEL[e.confidence]} · ${e.sourceLabel || "fonte não informada"} · ${e.discoveredAt.slice(0, 10)}`;
}

export function buildReport(c: PaletteCase, type: ReportType): ReportDoc {
  const stats = caseStats(c);
  const generatedAt = new Date().toISOString();
  const baseMeta = [
    { label: "Investigação", value: `${c.code} — ${c.title}` },
    { label: "Status", value: CASE_STATUS_LABEL[c.status] },
    { label: "Prioridade", value: c.priority },
    { label: "Responsável", value: c.owner },
    { label: "Criado em", value: c.createdAt.slice(0, 19).replace("T", " ") },
    { label: "Atualizado em", value: c.updatedAt.slice(0, 19).replace("T", " ") },
    { label: "Gerado em", value: generatedAt.slice(0, 19).replace("T", " ") },
  ];
  const scope = [
    { heading: "Objetivo", paragraphs: [c.objective || "Não registrado."] },
    { heading: "Metodologia", paragraphs: [
      "Coleta em fontes públicas e APIs oficiais (RDAP, DNS, Certificate Transparency, NVD/KEV, RIPEstat, Wayback, GitHub e demais fontes listadas no caso).",
      "Cada entidade e relação registra fonte, data e nível de confiança explicável. Nenhuma conexão é criada sem evidência ou indicação explícita de hipótese.",
      `Consulta(s) registrada(s): ${stats.searches}. Evidência(s) arquivada(s): ${stats.evidence}.`,
    ] },
  ];
  const limitations = {
    heading: "Limitações",
    paragraphs: [
      "Fontes públicas podem estar incompletas, desatualizadas ou bloqueadas; ausência de resultado não prova ausência do fato.",
      "Níveis de confiança são regras auditáveis, não probabilidades estatísticas.",
      "Este relatório não afirma identidade, autoria ou intenção sem evidência direta correspondente.",
      c.shared?.readOnly ? "Caso importado como snapshot read-only; pode não refletir o original." : "Dados armazenados localmente no navegador do analista.",
    ],
  };

  if (type === "summary") {
    return {
      title: "Investigation Summary", subtitle: c.title, meta: baseMeta, generatedAt,
      sections: [
        ...scope,
        { heading: "Resumo executivo", paragraphs: [executiveSummary(c)] },
        { heading: "Indicadores", paragraphs: [
          `${stats.nodes} entidades · ${stats.edges} relações · ${stats.groups} grupos.`,
          `Confiança: ${stats.verified} verificada(s), ${stats.high} alta, ${stats.medium} média, ${stats.low} baixa, ${stats.unverified} não verificada(s).`,
          `Cobertura de proveniência: ${stats.coverage}%. Entidades isoladas: ${stats.isolatedNodes}. Relações frágeis: ${stats.unverifiedEdges}.`,
        ] },
        { heading: "Principais achados", paragraphs: c.nodes.filter((n) => n.confidence === "verified" || n.confidence === "high").slice(0, 10).map(nodeLine).length
          ? c.nodes.filter((n) => n.confidence === "verified" || n.confidence === "high").slice(0, 10).map(nodeLine)
          : ["Nenhuma entidade em nível verificado ou alto."] },
        { heading: "Conclusão", paragraphs: [c.notes[0]?.body || "Conclusão não registrada. Use as evidências e a classificação de confiança antes de concluir."] },
        limitations,
      ],
    };
  }

  if (type === "entities") {
    return {
      title: "Entity Report", subtitle: c.title, meta: baseMeta, generatedAt,
      sections: [
        ...scope,
        {
          heading: `Entidades (${c.nodes.length})`,
          paragraphs: [],
          table: {
            columns: ["Tipo", "Valor", "Confiança", "Fontes", "Evidências", "Criado"],
            rows: c.nodes.map((n) => [NODE_KIND_LABEL[n.kind], n.title, CONFIDENCE_LABEL[n.confidence], n.sources.join("; ") || "—", String(n.evidenceIds.length), n.createdAt.slice(0, 10)]),
          },
        },
        limitations,
      ],
    };
  }

  if (type === "relationships") {
    return {
      title: "Relationship Report", subtitle: c.title, meta: baseMeta, generatedAt,
      sections: [
        ...scope,
        {
          heading: `Relações (${c.edges.length})`,
          paragraphs: [],
          table: {
            columns: ["Origem", "Destino", "Tipo", "Confiança", "Fonte", "Descoberta"],
            rows: c.edges.map((e) => [
              c.nodes.find((n) => n.id === e.source)?.title ?? e.source,
              c.nodes.find((n) => n.id === e.target)?.title ?? e.target,
              e.relation, CONFIDENCE_LABEL[e.confidence], e.sourceLabel || "—", e.discoveredAt.slice(0, 10),
            ]),
          },
        },
        { heading: "Justificativas", paragraphs: c.edges.filter((e) => e.description || e.notes).slice(0, 30).map((e) => `${edgeLine(c, e)} — ${[e.description, e.notes].filter(Boolean).join(" / ")}`).length
          ? c.edges.filter((e) => e.description || e.notes).slice(0, 30).map((e) => `${edgeLine(c, e)} — ${[e.description, e.notes].filter(Boolean).join(" / ")}`)
          : ["Nenhuma relação possui justificativa textual registrada."] },
        limitations,
      ],
    };
  }

  if (type === "cyber") {
    const iocs = c.nodes.filter((n) => ["ipv4", "ipv6", "domain", "url", "hash", "cve", "certificate"].includes(n.kind));
    return {
      title: "Cyber Intelligence Report", subtitle: c.title, meta: baseMeta, generatedAt,
      sections: [
        ...scope,
        { heading: "Indicadores técnicos", paragraphs: iocs.length ? iocs.map(nodeLine) : ["Nenhum indicador técnico registrado."] },
        {
          heading: "Consultas em fontes de segurança",
          paragraphs: [],
          table: {
            columns: ["Data", "Fonte", "Consulta", "Status", "Resumo"],
            rows: c.searches.slice(0, 60).map((s) => [s.at.slice(0, 16).replace("T", " "), s.source, s.query, s.status, s.summary.slice(0, 160)]),
          },
        },
        limitations,
      ],
    };
  }

  if (type === "evidence") {
    return {
      title: "Evidence Report", subtitle: c.title, meta: baseMeta, generatedAt,
      sections: [
        ...scope,
        {
          heading: `Evidências (${c.evidence.length})`,
          paragraphs: [],
          table: {
            columns: ["ID", "Título", "Tipo", "Coletada", "Responsável", "SHA-256", "Entidades"],
            rows: c.evidence.map((e) => [e.id, e.title, e.kind, e.collectedAt.slice(0, 10), e.responsible, e.sha256?.slice(0, 24) ?? "—", e.nodeIds.length.toString()]),
          },
        },
        { heading: "Descrições", paragraphs: c.evidence.length ? c.evidence.map((e) => `${e.title}: ${e.description || "sem descrição"}${e.url ? ` (${e.url})` : ""}`) : ["Nenhuma evidência registrada."] },
        limitations,
      ],
    };
  }

  return {
    title: "Full OSINT Report", subtitle: c.title, meta: baseMeta, generatedAt,
    sections: [
      ...scope,
      { heading: "Resumo executivo", paragraphs: [executiveSummary(c)] },
      { heading: "Entidades", paragraphs: c.nodes.length ? c.nodes.map(nodeLine) : ["Nenhuma entidade registrada."] },
      { heading: "Relações", paragraphs: c.edges.length ? c.edges.map((e) => edgeLine(c, e)) : ["Nenhuma relação registrada."] },
      {
        heading: "Fontes consultadas",
        paragraphs: c.searches.length
          ? [...new Set(c.searches.map((s) => s.source))].map((s) => `${s}: ${c.searches.filter((x) => x.source === s).length} consulta(s)`)
          : ["Nenhuma consulta registrada."],
      },
      {
        heading: "Evidências",
        paragraphs: c.evidence.length ? c.evidence.map((e) => `${e.title} — ${e.kind}; ${e.url ?? e.filename ?? "conteúdo local"}; SHA-256: ${e.sha256 ?? "não calculado"}`) : ["Nenhuma evidência arquivada."],
      },
      { heading: "Timeline", paragraphs: c.timeline.slice(0, 40).map((t) => `${t.at.slice(0, 16).replace("T", " ")} · ${t.title}${t.detail ? ` — ${t.detail}` : ""}`) },
      { heading: "Conclusão", paragraphs: [c.notes[0]?.body || "Conclusão não registrada."] },
      limitations,
    ],
  };
}

/** Standalone HTML with print styles. Safe: all user text is escaped. */
export function reportToHtml(c: PaletteCase, type: ReportType): string {
  const doc = buildReport(c, type);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const sections = doc.sections.map((s) => `
    <section>
      <h2>${esc(s.heading)}</h2>
      ${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
      ${s.table ? `<table><thead><tr>${s.table.columns.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}
    </section>`).join("");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(doc.title)} — ${esc(c.title)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, "Segoe UI", Inter, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 24px; color: #111827; line-height: 1.55; }
  header { border-bottom: 2px solid #0ea5e9; padding-bottom: 16px; margin-bottom: 24px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; color: #0369a1; text-transform: uppercase; letter-spacing: .06em; }
  p { font-size: 12.5px; margin: 6px 0; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
  th, td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 4px 24px; font-size: 11.5px; margin: 12px 0; }
  .meta span { color: #4b5563; }
  .badge { display: inline-block; font-size: 10px; background: #e0f2fe; color: #075985; padding: 2px 8px; border-radius: 999px; }
  footer { margin-top: 36px; border-top: 1px solid #e5e7eb; padding-top: 10px; font-size: 10px; color: #6b7280; }
  @media print { body { margin: 0; } section { break-inside: avoid; } }
</style></head>
<body>
<header>
  <span class="badge">Life Palette · Life Agency</span>
  <h1>${esc(doc.title)}</h1>
  <div>${esc(c.title)}</div>
</header>
<div class="meta">${doc.meta.map((m) => `<div><span>${esc(m.label)}:</span> ${esc(m.value)}</div>`).join("")}</div>
${sections}
<footer>Gerado por Life Palette em ${esc(doc.generatedAt)}. Documento baseado exclusivamente nos registros do caso. Verifique as fontes originais antes de decisões críticas.</footer>
</body></html>`;
}

export function reportToCsv(c: PaletteCase, type: ReportType): string {
  const doc = buildReport(c, type);
  const rows: string[] = [];
  rows.push(["Secção", "Campo 1", "Campo 2", "Campo 3", "Campo 4", "Campo 5"].join(","));
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  for (const s of doc.sections) {
    if (s.table) {
      rows.push([esc(s.heading), ...s.table.columns.map(esc)].join(","));
      for (const r of s.table.rows) rows.push([esc(s.heading), ...r.map(esc)].join(","));
    } else {
      for (const p of s.paragraphs) rows.push([esc(s.heading), esc(p), "", "", "", ""].join(","));
    }
  }
  return rows.join("\n");
}

export function reportToMarkdown(c: PaletteCase, type: ReportType): string {
  const doc = buildReport(c, type);
  const lines: string[] = [`# ${doc.title}`, "", `**${c.code} — ${c.title}**`, ""];
  for (const m of doc.meta) lines.push(`- ${m.label}: ${m.value}`);
  lines.push("");
  for (const s of doc.sections) {
    lines.push(`## ${s.heading}`, "");
    for (const p of s.paragraphs) lines.push(p, "");
    if (s.table) {
      lines.push(`| ${s.table.columns.join(" | ")} |`);
      lines.push(`| ${s.table.columns.map(() => "---").join(" | ")} |`);
      for (const r of s.table.rows) lines.push(`| ${r.join(" | ")} |`);
      lines.push("");
    }
  }
  lines.push(`_Gerado por Life Palette em ${doc.generatedAt}._`);
  return lines.join("\n");
}

/** PDF via jsPDF (text layout, no external fonts). */
export async function downloadReportPdf(c: PaletteCase, type: ReportType): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = buildReport(c, type);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 44;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  const lineHeight = 12;

  const write = (text: string, size: number, bold = false, color: [number, number, number] = [17, 24, 39]) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text, width) as string[];
    for (const line of lines) {
      if (y > pdf.internal.pageSize.getHeight() - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += lineHeight;
    }
  };

  write("Life Palette · Life Agency", 9, true, [3, 105, 161]);
  y += 4;
  write(doc.title, 17, true);
  write(c.title, 11, false, [75, 85, 99]);
  y += 6;
  for (const m of doc.meta) write(`${m.label}: ${m.value}`, 8.5, false, [75, 85, 99]);
  y += 8;

  for (const s of doc.sections) {
    if (y > pdf.internal.pageSize.getHeight() - 90) { pdf.addPage(); y = margin; }
    write(s.heading.toUpperCase(), 10.5, true, [3, 105, 161]);
    for (const p of s.paragraphs) write(p, 9);
    if (s.table) {
      write(s.table.columns.join(" · "), 8, true, [55, 65, 81]);
      for (const row of s.table.rows.slice(0, 200)) write(row.join(" · "), 8);
    }
    y += 8;
  }
  if (y > pdf.internal.pageSize.getHeight() - 60) { pdf.addPage(); y = margin; }
  write(`Gerado em ${doc.generatedAt}. Baseado exclusivamente nos registros do caso; verifique as fontes originais.`, 7.5, false, [107, 114, 128]);
  pdf.save(`life-palette-${type}-${c.code}.pdf`);
}

/** GraphML export — valid XML consumable by Gephi, yEd and Cytoscape. */
export function reportToGraphMl(c: PaletteCase): string {
  const esc = (v: string) => String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const nodes = c.nodes.map((n) => `    <node id="${esc(n.id)}">
      <data key="label">${esc(n.title)}</data>
      <data key="kind">${esc(n.kind)}</data>
      <data key="confidence">${esc(n.confidence)}</data>
      <data key="sources">${esc(n.sources.join(" | "))}</data>
      <data key="evidence">${n.evidenceIds.length}</data>
      <data key="tags">${esc(n.tags.join(" | "))}</data>
    </node>`).join("\n");
  const edges = c.edges.map((e) => `    <edge id="${esc(e.id)}" source="${esc(e.source)}" target="${esc(e.target)}">
      <data key="label">${esc(e.relation)}</data>
      <data key="confidence">${esc(e.confidence)}</data>
      <data key="style">${esc(e.style)}</data>
      <data key="source">${esc(e.sourceLabel)}</data>
      <data key="origin">${esc(e.origin)}</data>
      <data key="discovered">${esc(e.discoveredAt.slice(0, 10))}</data>
    </edge>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key id="label" for="all" attr.name="label" attr.type="string"/>
  <key id="kind" for="node" attr.name="kind" attr.type="string"/>
  <key id="confidence" for="all" attr.name="confidence" attr.type="string"/>
  <key id="sources" for="node" attr.name="sources" attr.type="string"/>
  <key id="evidence" for="node" attr.name="evidence" attr.type="int"/>
  <key id="tags" for="node" attr.name="tags" attr.type="string"/>
  <key id="style" for="edge" attr.name="style" attr.type="string"/>
  <key id="source" for="edge" attr.name="source" attr.type="string"/>
  <key id="origin" for="edge" attr.name="origin" attr.type="string"/>
  <key id="discovered" for="edge" attr.name="discovered" attr.type="string"/>
  <graph id="${esc(c.code)}" edgedefault="directed">
    <data key="label">${esc(`${c.code} — ${c.title}`)}</data>
${nodes}
${edges}
  </graph>
</graphml>`;
}

export function evidenceChain(c: PaletteCase): Array<{ evidenceId: string; title: string; nodes: string[]; collectedAt: string; sha256?: string }> {
  return c.evidence.map((e) => ({
    evidenceId: e.id,
    title: e.title,
    nodes: e.nodeIds.map((id) => c.nodes.find((n) => n.id === id)?.title ?? id),
    collectedAt: e.collectedAt,
    sha256: e.sha256,
  }));
}
