import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, Download, FileSearch, FileText, Info, Upload } from "lucide-react";
import { unzipSync, strFromU8 } from "fflate";
import { Badge, Button, Collapse, CopyButton, DataTable, Empty, KV, Notice, PageHeader, Panel, Spinner } from "@/components/agency/kit";
import { download, formatBytes, identifyFileType, md5, sha1Hex, sha256Hex, toCsv } from "@/lib/agency/format";

export const Route = createFileRoute("/agency/document")({
  head: () => ({ meta: [{ title: "Document Intelligence — Life Agency" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: DocumentPage,
});

type DocReport = {
  name: string;
  size: number;
  detected: string;
  mime: string;
  hex: string;
  hashes: { md5: string; sha1: string; sha256: string };
  properties: Array<[string, string]>;
  structure: Array<{ entry: string; size: number }>;
  text?: string;
  textNote?: string;
  stats?: Array<[string, string]>;
};

function DocumentPage() {
  const [report, setReport] = useState<DocReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setReport(null);
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error("Arquivo maior que 30 MB — limite para processamento local no navegador.");
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const info = await identifyFileType(file);
      const [sha256, sha1] = await Promise.all([sha256Hex(buffer), sha1Hex(buffer)]);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const properties: Array<[string, string]> = [];
      const structure: Array<{ entry: string; size: number }> = [];
      let text = "";
      let textNote = "";
      let stats: Array<[string, string]> | undefined;

      if (ext === "pdf" || info.type === "PDF") {
        const raw = new TextDecoder("latin1").decode(bytes);
        textNote = "Metadados do dicionário Info e XMP. Objetos comprimidos (FlateDecode) não são descompactados.";
        const pick = (key: string) => {
          const m = raw.match(new RegExp(`/${key}\\s*\\(([^)]*)\\)`));
          return m ? decodePdfString(m[1]) : undefined;
        };
        const info2: Record<string, string | undefined> = {
          Title: pick("Title"), Author: pick("Author"), Subject: pick("Subject"),
          Creator: pick("Creator"), Producer: pick("Producer"),
          CreationDate: pick("CreationDate"), ModDate: pick("ModDate"), Keywords: pick("Keywords"),
        };
        for (const [k, v] of Object.entries(info2)) if (v) properties.push([k, v]);
        const xmp = raw.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
        if (xmp) {
          for (const [k, v] of Object.entries(xmpFields(xmp[0]))) properties.push([`XMP.${k}`, v]);
        }
        const pages = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
        properties.push(["Páginas (aprox.)", String(pages)]);
        properties.push(["PDF versão", raw.slice(0, 8).replace("%PDF-", "").trim() || "—"]);
        properties.push(["Criptografado", /\/Encrypt\b/.test(raw) ? "sim" : "não"]);
        const stream = raw.match(/<dc:description>[\s\S]*?<\/dc:description>/)?.[0];
        if (stream) properties.push(["Descrição (XMP)", stream.replace(/<[^>]+>/g, "").trim().slice(0, 500)]);
        structure.push({ entry: "Objetos", size: (raw.match(/\bobj\b/g) ?? []).length });
        structure.push({ entry: "Streams", size: (raw.match(/\bstream\b/g) ?? []).length });
      } else if (["docx", "xlsx", "pptx", "zip"].includes(ext) || info.type === "ZIP/OOXML") {
        textNote = "Documentos OOXML são arquivos ZIP: propriedades em docProps/, texto em XML interno.";
        try {
          const files = unzipSync(bytes);
          for (const [name, content] of Object.entries(files)) {
            structure.push({ entry: name, size: content.byteLength });
          }
          const core = files["docProps/core.xml"] ? strFromU8(files["docProps/core.xml"]) : "";
          const app = files["docProps/app.xml"] ? strFromU8(files["docProps/app.xml"]) : "";
          if (core) {
            for (const [k, v] of Object.entries(xmlTagFields(core))) properties.push([`core.${k}`, v]);
          }
          if (app) {
            for (const [k, v] of Object.entries(xmlTagFields(app))) properties.push([`app.${k}`, v]);
          }
          const textFiles = Object.keys(files).filter((n) =>
            /word\/document\.xml$/.test(n) || /ppt\/slides\/slide\d+\.xml$/.test(n) || /xl\/sharedStrings\.xml$/.test(n),
          );
          const chunks: string[] = [];
          for (const n of textFiles.slice(0, 20)) {
            const xml = strFromU8(files[n]);
            const paragraphs = [...xml.matchAll(/<(?:w:p|a:p|t)[^>]*>([\s\S]*?)<\/(?:w:p|a:p|t)>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter(Boolean);
            if (paragraphs.length) chunks.push(`--- ${n} ---\n${paragraphs.join("\n")}`);
          }
          text = chunks.join("\n\n").slice(0, 20000);
        } catch (e) {
          properties.push(["Aviso", `Falha ao abrir o ZIP interno: ${(e as Error).message}`]);
        }
      } else {
        const decoded = new TextDecoder("utf-8").decode(bytes);
        text = decoded.slice(0, 20000);
        const lines = decoded.split(/\r?\n/);
        stats = [
          ["Linhas", String(lines.length)],
          ["Caracteres", String(decoded.length)],
          ["Palavras", String(decoded.split(/\s+/).filter(Boolean).length)],
          ["Provável CSV", lines[0]?.includes(",") || lines[0]?.includes(";") ? "sim" : "não"],
        ];
        if ((lines[0] ?? "").includes(",") || (lines[0] ?? "").includes(";")) {
          const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
          const header = lines[0].split(delimiter);
          stats.push(["Separador", delimiter]);
          stats.push(["Colunas", String(header.length)]);
          for (const h of header.slice(0, 20)) properties.push(["Coluna", h.trim()]);
        }
      }

      setReport({
        name: file.name,
        size: file.size,
        detected: info.type,
        mime: info.mime,
        hex: info.hex,
        hashes: { md5: md5(bytes), sha1, sha256 },
        properties,
        structure,
        text,
        textNote,
        stats,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="OSINT · Arquivos"
        title="Document Intelligence"
        subtitle="Metadados, estrutura, hashes e extração de texto para PDF, DOCX, XLSX, PPTX, TXT e CSV. Todo o processamento acontece no seu navegador."
        actions={<Badge tone="green">local · nada é enviado</Badge>}
      />

      <Panel title="Upload e inspeção" description="Nenhum documento é transmitido a serviços externos. Limite de 30 MB.">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--ag-border-strong)] px-6 py-10 text-center transition-colors hover:border-cyan-400/40 hover:bg-white/[0.02]">
          <Upload className="h-6 w-6 text-cyan-300" />
          <span className="text-[12.5px] font-medium text-[#dce8f5]">Selecionar documento</span>
          <span className="text-[11px] text-[var(--ag-faint)]">PDF · DOCX · XLSX · PPTX · TXT · CSV</span>
          <input type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.md,.json,application/pdf" className="hidden" onChange={(e) => void analyze(e.target.files?.[0])} />
        </label>
        {busy && <Spinner label="Lendo estrutura e metadados…" />}
        {error && <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/[0.07] p-3 text-[12px] text-rose-200">{error}</div>}
      </Panel>

      {report && (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Document Properties" description="Identificação técnica do arquivo.">
              <KV
                cols={2}
                items={[
                  { label: "Arquivo", value: report.name },
                  { label: "Tamanho", value: formatBytes(report.size) },
                  { label: "Tipo detectado", value: <Badge tone="cyan">{report.detected}</Badge> },
                  { label: "MIME", value: report.mime },
                  { label: "Assinatura", value: <span className="ag-mono text-[10px]">{report.hex}</span> },
                ]}
              />
              <div className="mt-3 space-y-1.5">
                {(["md5", "sha1", "sha256"] as const).map((k) => (
                  <div key={k} className="rounded-lg border border-[var(--ag-border)] bg-black/25 px-2.5 py-1.5">
                    <div className="flex items-center justify-between"><span className="ag-label">{k}</span><CopyButton value={report.hashes[k]} /></div>
                    <div className="ag-mono mt-0.5 break-all text-[10.5px] text-[#c7d6e6]">{report.hashes[k]}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => download(`${report.name}.hashes.txt`, `md5 ${report.hashes.md5}\nsha1 ${report.hashes.sha1}\nsha256 ${report.hashes.sha256}`)}>
                  <Download className="h-3 w-3" /> Exportar hashes
                </Button>
                <a href={`https://www.virustotal.com/gui/file/${report.hashes.sha256}`} target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !px-2.5 !py-1.5 !text-[11px]">
                  Consultar SHA-256 no VirusTotal
                </a>
              </div>
            </Panel>

            <Panel title="Metadados do documento" description="Campos encontrados no arquivo, sem interpretação inventada.">
              {report.properties.length ? (
                <DataTable rows={report.properties.map(([k, v]) => ({ campo: k, valor: v }))} maxRows={120} columns={["campo", "valor"]} />
              ) : (
                <Empty title="Nenhum metadado de propriedade encontrado" hint="O arquivo pode ter sido exportado sem propriedades ou usa compressão não suportada." />
              )}
              {report.textNote && <p className="mt-2 text-[10.5px] text-[var(--ag-faint)]">{report.textNote}</p>}
            </Panel>
          </div>

          {report.stats && (
            <Panel title="Estatísticas de texto" description="Contagem local do conteúdo.">
              <KV cols={3} items={report.stats.map(([label, value]) => ({ label, value }))} />
            </Panel>
          )}

          {report.structure.length > 0 && (
            <Collapse title={`Document Structure Analyzer (${report.structure.length} entradas)`}>
              <DataTable rows={report.structure.map((s) => ({ entrada: s.entry, bytes: s.size }))} maxRows={200} />
            </Collapse>
          )}

          {report.text !== undefined && (
            <Panel
              title="Text Extractor"
              description="Texto extraído localmente (limitado a 20.000 caracteres)."
              actions={
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(report.text ?? "")}><Copy className="h-3 w-3" /> Copiar</Button>
                  <Button size="sm" variant="ghost" onClick={() => download(`${report.name}.txt`, report.text ?? "")}><Download className="h-3 w-3" /> TXT</Button>
                  <Button size="sm" variant="ghost" onClick={() => download(`${report.name}.csv`, toCsv([{ texto: report.text ?? "" }]), "text/csv")}><FileText className="h-3 w-3" /> CSV</Button>
                </div>
              }
            >
              {report.text.trim() ? (
                <pre className="ag-mono max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--ag-border)] bg-black/30 p-3 text-[11px] leading-relaxed text-[#c8d6e5]">{report.text}</pre>
              ) : (
                <Empty title="Nenhum texto extraído" hint="PDFs digitalizados (imagem) exigem OCR, que não é executado aqui." icon={<FileSearch className="h-6 w-6" />} />
              )}
            </Panel>
          )}
        </>
      )}

      <Panel title="Privacidade e limitações" icon={<Info className="h-3.5 w-3.5" />}>
        <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--ag-muted)]">
          <li>• O arquivo é lido com <span className="ag-mono text-[10.5px]">FileReader</span> no navegador; não há upload para o servidor do Life Agency nem para terceiros.</li>
          <li>• PDFs com objetos comprimidos podem ocultar propriedades; o extrator mostra apenas o que está legível sem descompressão.</li>
          <li>• OCR não é executado. Documentos escaneados retornam pouco ou nenhum texto.</li>
          <li>• DOCX/XLSX/PPTX são lidos como ZIP OOXML (fflate), incluindo docProps e texto dos parágrafos/células.</li>
          <li>• Nenhum documento é enviado automaticamente a sandboxes ou serviços de malware.</li>
        </ul>
        <div className="mt-3"><Notice tone="info">Dica: para verificar segurança de um documento, use o SHA-256 acima no VirusTotal — a consulta é manual e opcional.</Notice></div>
      </Panel>
    </div>
  );
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" } as Record<string, string>)[c] ?? c)
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function xmlTagFields(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of xml.matchAll(/<([a-zA-Z0-9:]+)(?:\s[^>]*)?>([^<]{1,500})<\/\1>/g)) {
    const tag = m[1].split(":").pop() ?? m[1];
    if (["Properties", "coreProperties", "ExtendedProperties"].includes(tag)) continue;
    const value = m[2].trim();
    if (value) out[tag] = value;
  }
  return out;
}

function xmpFields(xmp: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of xmp.matchAll(/<([a-zA-Z0-9]+:[a-zA-Z0-9]+)>([^<]{1,500})<\/\1>/g)) {
    const key = m[1].split(":").pop() ?? m[1];
    if (out[key]) continue;
    out[key] = m[2].trim();
  }
  return out;
}
