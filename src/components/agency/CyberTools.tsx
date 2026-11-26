import { useState } from "react";
import { Calculator, FileCode2, Fingerprint, Upload } from "lucide-react";
import { Badge, Button, CopyButton, Field, KV, Notice, Panel } from "./kit";
import { cvss31Score, download, formatBytes, identifyFileType, md5, sha1Hex, sha256Hex, type CvssMetrics } from "@/lib/agency/format";

const YARA_TEMPLATE = `rule LifeAgency_Suspicious_PowerShell
{
    meta:
        description = "Execução de PowerShell codificado em base64"
        author      = "Life Agency"
        reference   = "https://attack.mitre.org/techniques/T1059/001/"
        date        = "2026-01-01"

    strings:
        $ps1 = "powershell" nocase
        $ps2 = "-enc" nocase
        $ps3 = "FromBase64String" nocase

    condition:
        2 of them
}

rule LifeAgency_Generic_C2_Beacon
{
    meta:
        description = "Padrões comuns de beacon HTTP de baixa reputação"
    strings:
        $ua1 = "MSIE 6.0" ascii
        $ua2 = "curl/7." ascii
        $path1 = "/gate.php" ascii
        $path2 = "/panel/api" ascii

    condition:
        any of ($ua*) and any of ($path*)
}`;

export function HashCalculator() {
  const [text, setText] = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; type: string; hex: string; md5: string; sha1: string; sha256: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textHashes, setTextHashes] = useState<{ md5: string; sha1: string; sha256: string } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const [sha256, sha1] = await Promise.all([sha256Hex(buffer), sha1Hex(buffer)]);
      const info = await identifyFileType(file);
      setFileInfo({
        name: file.name, size: file.size, type: info.type, hex: info.hex,
        md5: md5(new Uint8Array(buffer)), sha1, sha256,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const computeText = async () => {
    if (!text) return;
    setTextHashes({ md5: md5(text), sha1: await sha1Hex(text), sha256: await sha256Hex(text) });
  };

  return (
    <Panel title="File Hash & Type Identifier" description="Cálculo local (MD5, SHA-1, SHA-256) e identificação por assinatura de bytes. O arquivo nunca sai do navegador." icon={<Fingerprint className="h-3.5 w-3.5" />}>
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-dashed border-[var(--ag-border-strong)] px-3 py-4 text-[12px] text-[var(--ag-muted)] hover:border-cyan-400/40">
        <span className="flex items-center gap-2"><Upload className="h-4 w-4" /> Selecionar arquivo para hash local</span>
        <span className="text-[10.5px] text-[var(--ag-faint)]">sem upload externo</span>
        <input type="file" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </label>
      {busy && <div className="mt-3 text-[11.5px] text-[var(--ag-muted)]">Calculando…</div>}
      {error && <div className="mt-2 text-[11.5px] text-rose-300">{error}</div>}
      {fileInfo && (
        <div className="mt-3 space-y-2">
          <KV
            items={[
              { label: "Arquivo", value: fileInfo.name },
              { label: "Tamanho", value: formatBytes(fileInfo.size) },
              { label: "Tipo detectado", value: <Badge tone="cyan">{fileInfo.type}</Badge> },
              { label: "Assinatura (hex)", value: <span className="ag-mono text-[10px]">{fileInfo.hex}</span> },
            ]}
          />
          {(["md5", "sha1", "sha256"] as const).map((algo) => (
            <div key={algo} className="rounded-lg border border-[var(--ag-border)] bg-black/25 p-2">
              <div className="flex items-center justify-between">
                <span className="ag-label">{algo}</span>
                <div className="flex items-center gap-1.5">
                  <CopyButton value={fileInfo[algo]} />
                  <Button size="sm" variant="ghost" onClick={() => download(`${fileInfo.name}.${algo}.txt`, fileInfo[algo])}>Baixar</Button>
                </div>
              </div>
              <div className="ag-mono mt-1 break-all text-[10.5px] text-[#c7d6e6]">{fileInfo[algo]}</div>
            </div>
          ))}
          <a href={`https://www.virustotal.com/gui/file/${fileInfo.sha256}`} target="_blank" rel="noreferrer" className="ag-link text-[11px]">
            Abrir SHA-256 no VirusTotal (consulta manual) →
          </a>
        </div>
      )}

      <div className="mt-4 border-t border-[var(--ag-border)] pt-3">
        <Field label="Ou calcular hash de texto">
          <textarea className="ag-textarea" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="cole o conteúdo…" />
        </Field>
        <Button size="sm" className="mt-2" onClick={() => void computeText()} disabled={!text}>Calcular</Button>
        {textHashes && (
          <div className="mt-2 space-y-1.5">
            {(["md5", "sha1", "sha256"] as const).map((algo) => (
              <div key={algo} className="flex items-center gap-2 text-[10.5px]">
                <span className="ag-label w-12 shrink-0">{algo}</span>
                <span className="ag-mono break-all text-[#c7d6e6]">{textHashes[algo]}</span>
                <CopyButton value={textHashes[algo]} label="" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

const OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  AV: [{ value: "N", label: "Network (N)" }, { value: "A", label: "Adjacent (A)" }, { value: "L", label: "Local (L)" }, { value: "P", label: "Physical (P)" }],
  AC: [{ value: "L", label: "Low (L)" }, { value: "H", label: "High (H)" }],
  PR: [{ value: "N", label: "None (N)" }, { value: "L", label: "Low (L)" }, { value: "H", label: "High (H)" }],
  UI: [{ value: "N", label: "None (N)" }, { value: "R", label: "Required (R)" }],
  S: [{ value: "U", label: "Unchanged (U)" }, { value: "C", label: "Changed (C)" }],
  C: [{ value: "H", label: "High (H)" }, { value: "L", label: "Low (L)" }, { value: "N", label: "None (N)" }],
  I: [{ value: "H", label: "High (H)" }, { value: "L", label: "Low (L)" }, { value: "N", label: "None (N)" }],
  A: [{ value: "H", label: "High (H)" }, { value: "L", label: "Low (L)" }, { value: "N", label: "None (N)" }],
};

export function CvssCalculator() {
  const [metrics, setMetrics] = useState<CvssMetrics>({ AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "H", I: "H", A: "H" });
  const result = cvss31Score(metrics);
  const tone = result.score >= 9 ? "rose" : result.score >= 7 ? "amber" : result.score >= 4 ? "amber" : "green";
  return (
    <Panel title="CVSS 3.1 Calculator" description="Cálculo local seguindo a especificação oficial do FIRST." icon={<Calculator className="h-3.5 w-3.5" />}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(OPTIONS) as Array<keyof CvssMetrics>).map((key) => (
          <Field key={key} label={key}>
            <select className="ag-select" value={metrics[key]} onChange={(e) => setMetrics({ ...metrics, [key]: e.target.value as never })}>
              {OPTIONS[key].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-[var(--ag-border)] bg-black/25 p-3">
        <div>
          <div className="ag-label">Score</div>
          <div className="font-display text-3xl font-bold tabular-nums">{result.score.toFixed(1)}</div>
        </div>
        <Badge tone={tone as "green"}>{result.severity}</Badge>
        <div className="min-w-0 flex-1">
          <div className="ag-label">Vetor</div>
          <div className="ag-mono break-all text-[10.5px] text-[#c7d6e6]">{result.vector}</div>
        </div>
        <CopyButton value={result.vector} label="Copiar vetor" />
      </div>
    </Panel>
  );
}

export function YaraViewer() {
  const [content, setContent] = useState(YARA_TEMPLATE);
  const [name, setName] = useState("life-agency-reference.yar");
  const lines = content.split("\n");
  return (
    <Panel
      title="YARA Rule Viewer"
      description="Visualize e carregue regras YARA localmente. A plataforma não executa regras nem envia arquivos para sandbox."
      icon={<FileCode2 className="h-3.5 w-3.5" />}
      actions={
        <label className="ag-btn ag-btn-ghost !px-2.5 !py-1.5 !text-[11px] cursor-pointer">
          Carregar .yar
          <input
            type="file"
            accept=".yar,.yara,text/plain"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setContent(await f.text());
              setName(f.name);
            }}
          />
        </label>
      }
    >
      <div className="mb-2 flex items-center justify-between text-[10.5px] text-[var(--ag-faint)]">
        <span className="ag-mono">{name}</span>
        <span>{lines.length} linhas · {Math.ceil(content.length / 1024)} KB</span>
      </div>
      <textarea
        className="ag-textarea ag-mono !text-[11px]"
        rows={16}
        spellCheck={false}
        value={content}
        onChange={(e) => { setContent(e.target.value); setName("rascunho.yar"); }}
      />
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={() => download(name, content, "text/plain")}>Baixar regra</Button>
        <a href="https://yara.readthedocs.io/en/stable/writingrules.html" target="_blank" rel="noreferrer" className="ag-btn ag-btn-ghost !px-2.5 !py-1.5 !text-[11px]">Documentação YARA</a>
      </div>
      <div className="mt-3"><Notice tone="info">Regras de referência são exemplos abertos para estudo de sintaxe — não são um feed dinâmico.</Notice></div>
    </Panel>
  );
}
