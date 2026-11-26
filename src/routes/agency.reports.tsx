import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, ExternalLink, FileBarChart, FileJson, FileSpreadsheet, Printer } from "lucide-react";
import { listGraphs, listInvestigations } from "@/lib/agency/store";
import { REPORT_TYPES, buildReportCsv, buildReportHtml, buildReportJson, type ReportType } from "@/lib/agency/report";
import { download, toCsv } from "@/lib/agency/format";
import { Badge, Button, Empty, Field, Notice, PageHeader, Panel } from "@/components/agency/kit";

export const Route = createFileRoute("/agency/reports")({
  validateSearch: (s: Record<string, unknown>) => ({ case: typeof s.case === "string" ? s.case : undefined }),
  head: () => ({ meta: [{ title: "Report Center — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { case: caseId } = Route.useSearch();
  const investigations = useMemo(() => listInvestigations(), []);
  const graphs = useMemo(() => listGraphs(), []);
  const [selected, setSelected] = useState(caseId ?? investigations[0]?.id ?? "");
  const [type, setType] = useState<ReportType>("investigation");
  const [classification, setClassification] = useState("INTERNO · USO RESTRITO");
  const [analyst, setAnalyst] = useState("");
  const [includeData, setIncludeData] = useState(true);
  const [graphId, setGraphId] = useState("");

  const inv = investigations.find((i) => i.id === selected) ?? null;
  const graph = graphs.find((g) => g.id === graphId) ?? null;
  const opts = { type, classification, analyst, includeData, graph };
  const html = useMemo(() => (inv ? buildReportHtml(inv, opts) : ""), [inv, type, classification, analyst, includeData, graph]);

  const printReport = () => {
    if (!inv) return;
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  if (!investigations.length) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Report Center" title="Relatórios profissionais" subtitle="Gere documentos a partir de investigações com evidências reais." />
        <Empty title="Nenhuma investigação disponível" hint="Crie um caso no Investigation Workspace para gerar relatórios." />
        <Link to="/agency/workspace" search={{ case: undefined }} className="ag-btn ag-btn-primary w-fit">Abrir Workspace</Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Report Center"
        title="Relatórios profissionais"
        subtitle="Documento corporativo com capa, metodologia, fontes, evidências, relacionamentos, confiança, limitações e conclusão. Exporte em HTML, JSON, CSV ou PDF via impressão."
        actions={<Badge tone="cyan"><FileBarChart className="h-3 w-3" /> {REPORT_TYPES.length} modelos</Badge>}
      />

      <Panel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Investigação">
            <select className="ag-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {investigations.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
            </select>
          </Field>
          <Field label="Tipo de relatório">
            <select className="ag-select" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {REPORT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Classificação">
            <select className="ag-select" value={classification} onChange={(e) => setClassification(e.target.value)}>
              <option>INTERNO · USO RESTRITO</option>
              <option>CONFIDENCIAL</option>
              <option>PÚBLICO</option>
            </select>
          </Field>
          <Field label="Analista responsável">
            <input className="ag-input" value={analyst} onChange={(e) => setAnalyst(e.target.value)} placeholder="nome ou matrícula" />
          </Field>
          <Field label="Grafo de relacionamentos (opcional)">
            <select className="ag-select" value={graphId} onChange={(e) => setGraphId(e.target.value)}>
              <option value="">Nenhum</option>
              {graphs.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.edges.length} conexões</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[11.5px] text-[var(--ag-muted)]">
              <input type="checkbox" checked={includeData} onChange={(e) => setIncludeData(e.target.checked)} />
              Incluir payload JSON das evidências
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" onClick={printReport} disabled={!inv}><Printer className="h-3.5 w-3.5" /> Imprimir / PDF</Button>
          <Button onClick={() => inv && download(`${inv.code}-${type}.html`, html, "text/html;charset=utf-8")} disabled={!inv}><Download className="h-3.5 w-3.5" /> HTML</Button>
          <Button onClick={() => inv && download(`${inv.code}-${type}.json`, JSON.stringify(buildReportJson(inv, opts), null, 2), "application/json")} disabled={!inv}><FileJson className="h-3.5 w-3.5" /> JSON</Button>
          <Button onClick={() => inv && download(`${inv.code}-${type}.csv`, toCsv(buildReportCsv(inv)), "text/csv")} disabled={!inv}><FileSpreadsheet className="h-3.5 w-3.5" /> CSV</Button>
          <Button variant="ghost" onClick={() => { const w = window.open("", "_blank"); if (w && inv) { w.document.write(html); w.document.close(); } }} disabled={!inv}>
            <ExternalLink className="h-3.5 w-3.5" /> Abrir em nova aba
          </Button>
        </div>
      </Panel>

      {inv && (
        <Panel
          title="Pré-visualização"
          description={`${REPORT_TYPES.find((t) => t.id === type)?.label} · ${inv.evidence.length} evidências · ${inv.entities.length} entidades`}
        >
          <iframe title="Pré-visualização do relatório" srcDoc={html} className="h-[640px] w-full rounded-xl border border-[var(--ag-border)] bg-white" sandbox="" />
          <Notice tone="info" title="PDF">
            Use “Imprimir / PDF” e escolha “Salvar como PDF”. A folha de estilo de impressão já está configurada em A4.
          </Notice>
        </Panel>
      )}
    </div>
  );
}
